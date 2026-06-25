"""
Tests for the DGCA Scheduling Rule Engine.
These are the most safety-critical unit tests in the codebase.
"""
from decimal import Decimal
from unittest.mock import MagicMock
from django.test import TestCase
from apps.core.scheduling_engine import SchedulingRuleEngine


def make_student(spl_expiry=None, medical_expiry=None, frtol_expiry=None,
                 solo_max_crosswind_kt=7):
    from datetime import date, timedelta
    s = MagicMock()
    s.spl_expiry           = spl_expiry or (date.today() + timedelta(days=180))
    s.medical_expiry       = medical_expiry or (date.today() + timedelta(days=180))
    s.frtol_expiry         = frtol_expiry
    s.solo_max_crosswind_kt = solo_max_crosswind_kt
    return s


def make_instructor(daily=480, weekly=1800, monthly=6000):
    i = MagicMock()
    i.fdtl_daily_remaining_min   = daily
    i.fdtl_weekly_remaining_min  = weekly
    i.fdtl_monthly_remaining_min = monthly
    return i


def make_aircraft(status="airworthy", hobbs=100.0, next_50hr=150.0,
                  next_100hr=200.0, ferry_buffer=2.5, aog_reason=None):
    a = MagicMock()
    a.status      = status
    a.aog_reason  = aog_reason
    a.hobbs_total = Decimal(str(hobbs))
    a.next_50hr_at  = Decimal(str(next_50hr))  if next_50hr  else None
    a.next_100hr_at = Decimal(str(next_100hr)) if next_100hr else None
    a.next_annual_due = None
    a.current_base.ferry_buffer_hours = Decimal(str(ferry_buffer))
    a.aircraft_type.da_solo_warning_ft = 5500
    return a


class TestSchedulingEngine(TestCase):
    def setUp(self):
        self.engine = SchedulingRuleEngine()

    # ── Happy path ────────────────────────────────────────────────────────────
    def test_all_pass_when_fully_compliant(self):
        result = self.engine.check(
            student=make_student(),
            instructor=make_instructor(),
            aircraft=make_aircraft(),
            duration_minutes=60,
        )
        self.assertTrue(result.all_passed)
        self.assertEqual(len(result.blocking_failures), 0)

    # ── Student checks ────────────────────────────────────────────────────────
    def test_expired_medical_blocks(self):
        from datetime import date, timedelta
        student = make_student(medical_expiry=date.today() - timedelta(days=1))
        result  = self.engine.check(student=student, instructor=make_instructor(),
                                    aircraft=make_aircraft(), duration_minutes=60)
        self.assertFalse(result.all_passed)
        names = [c.name for c in result.blocking_failures]
        self.assertIn("student_medical_valid", names)

    def test_expired_spl_blocks(self):
        from datetime import date, timedelta
        student = make_student(spl_expiry=date.today() - timedelta(days=1))
        result  = self.engine.check(student=student, instructor=make_instructor(),
                                    aircraft=make_aircraft(), duration_minutes=60)
        self.assertFalse(result.all_passed)
        self.assertIn("student_spl_valid", [c.name for c in result.blocking_failures])

    # ── Instructor FDTL ───────────────────────────────────────────────────────
    def test_fdtl_daily_breach_blocks(self):
        instr  = make_instructor(daily=30)   # only 30 min remaining
        result = self.engine.check(student=make_student(), instructor=instr,
                                   aircraft=make_aircraft(), duration_minutes=60)
        self.assertFalse(result.all_passed)
        self.assertIn("instructor_fdtl_daily", [c.name for c in result.blocking_failures])

    def test_fdtl_exact_remaining_passes(self):
        instr  = make_instructor(daily=60)   # exactly 60 min — should pass
        result = self.engine.check(student=make_student(), instructor=instr,
                                   aircraft=make_aircraft(), duration_minutes=60)
        fdtl_check = next(c for c in result.checks if c.name == "instructor_fdtl_daily")
        self.assertTrue(fdtl_check.passed)

    # ── Aircraft AOG ──────────────────────────────────────────────────────────
    def test_aog_aircraft_blocks(self):
        aircraft = make_aircraft(status="aog", aog_reason="Magneto drop")
        result   = self.engine.check(student=make_student(), instructor=make_instructor(),
                                     aircraft=aircraft, duration_minutes=60)
        self.assertFalse(result.all_passed)
        self.assertIn("aircraft_not_aog", [c.name for c in result.blocking_failures])

    # ── Ferry buffer (the signature safety rule) ──────────────────────────────
    def test_ferry_buffer_triggered_blocks_satellite(self):
        # Aircraft has 3.0 hrs to 50-hr check; flight is 1.0 hr; ferry buffer is 2.5 hr
        # Required = 1.0 + 2.5 = 3.5 hr — but only 3.0 remaining → BLOCK
        aircraft = make_aircraft(hobbs=147.0, next_50hr=150.0, ferry_buffer=2.5)
        result   = self.engine.check(student=make_student(), instructor=make_instructor(),
                                     aircraft=aircraft, duration_minutes=60)
        self.assertFalse(result.all_passed)
        self.assertIn("aircraft_50hr_ferry_buffer", [c.name for c in result.blocking_failures])

    def test_ferry_buffer_not_triggered_at_hub(self):
        # Same scenario but ferry_buffer = 0 (hub) → PASS
        aircraft = make_aircraft(hobbs=147.0, next_50hr=150.0, ferry_buffer=0.0)
        result   = self.engine.check(student=make_student(), instructor=make_instructor(),
                                     aircraft=aircraft, duration_minutes=60)
        ferry_check = next(
            (c for c in result.checks if c.name == "aircraft_50hr_ferry_buffer"), None
        )
        if ferry_check:
            self.assertTrue(ferry_check.passed)

    def test_ample_hours_at_satellite_passes(self):
        # 10 hr remaining, flight 1 hr, ferry buffer 2.5 hr → 10 >= 3.5 → PASS
        aircraft = make_aircraft(hobbs=100.0, next_50hr=110.0, ferry_buffer=2.5)
        result   = self.engine.check(student=make_student(), instructor=make_instructor(),
                                     aircraft=aircraft, duration_minutes=60)
        self.assertTrue(result.all_passed)

    # ── Multiple failures reported together ───────────────────────────────────
    def test_multiple_failures_all_reported(self):
        from datetime import date, timedelta
        student  = make_student(
            medical_expiry=date.today() - timedelta(days=5),
            spl_expiry=date.today() - timedelta(days=2),
        )
        instr    = make_instructor(daily=10)
        aircraft = make_aircraft(status="aog")
        result   = self.engine.check(student=student, instructor=instr,
                                     aircraft=aircraft, duration_minutes=60)
        self.assertFalse(result.all_passed)
        self.assertGreaterEqual(len(result.blocking_failures), 4)

    # ── to_dict output ────────────────────────────────────────────────────────
    def test_to_dict_structure(self):
        result = self.engine.check(student=make_student(), instructor=make_instructor(),
                                   aircraft=make_aircraft(), duration_minutes=60)
        d = result.to_dict()
        self.assertIn("all_passed", d)
        self.assertIn("blocking_failures", d)
        self.assertIn("warnings", d)
        self.assertIsInstance(d["blocking_failures"], list)
