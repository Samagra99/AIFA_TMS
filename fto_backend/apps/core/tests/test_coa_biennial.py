"""
Tests for H5 Fix: CoA and biennial checks in scheduling engine.
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, PropertyMock
from django.test import TestCase
from apps.core.scheduling_engine import SchedulingRuleEngine


def make_student():
    s = MagicMock()
    s.spl_expiry = date.today() + timedelta(days=180)
    s.medical_expiry = date.today() + timedelta(days=180)
    s.frtol_expiry = None
    return s

def make_instructor():
    i = MagicMock()
    i.fdtl_daily_remaining_min = 480
    i.fdtl_weekly_remaining_min = 1800
    i.fdtl_monthly_remaining_min = 6000
    return i

def make_aircraft(coa_expiry=None, biennial_due=None):
    a = MagicMock()
    a.status = "airworthy"
    a.aog_reason = None
    a.hobbs_total = Decimal("100.0")
    a.next_50hr_at = Decimal("150.0")
    a.next_100hr_at = Decimal("200.0")
    a.next_annual_due = None
    a.coa_expiry = coa_expiry
    a.next_biennial_due = biennial_due
    a.current_base.ferry_buffer_hours = Decimal("0")
    a.aircraft_type.da_solo_warning_ft = 5500
    return a


class TestCoABiennialChecks(TestCase):
    def setUp(self):
        self.engine = SchedulingRuleEngine()

    def test_valid_coa_passes(self):
        aircraft = make_aircraft(coa_expiry=date.today() + timedelta(days=365))
        result = self.engine.check(
            student=make_student(), instructor=make_instructor(),
            aircraft=aircraft, duration_minutes=60
        )
        coa_check = next((c for c in result.checks if c.name == "aircraft_coa_valid"), None)
        self.assertIsNotNone(coa_check)
        self.assertTrue(coa_check.passed)

    def test_expired_coa_blocks(self):
        aircraft = make_aircraft(coa_expiry=date.today() - timedelta(days=1))
        result = self.engine.check(
            student=make_student(), instructor=make_instructor(),
            aircraft=aircraft, duration_minutes=60
        )
        self.assertFalse(result.all_passed)
        names = [c.name for c in result.blocking_failures]
        self.assertIn("aircraft_coa_valid", names)

    def test_valid_biennial_passes(self):
        aircraft = make_aircraft(biennial_due=date.today() + timedelta(days=365))
        result = self.engine.check(
            student=make_student(), instructor=make_instructor(),
            aircraft=aircraft, duration_minutes=60
        )
        biennial_check = next((c for c in result.checks if c.name == "aircraft_biennial_due"), None)
        self.assertIsNotNone(biennial_check)
        self.assertTrue(biennial_check.passed)

    def test_overdue_biennial_blocks(self):
        aircraft = make_aircraft(biennial_due=date.today() - timedelta(days=1))
        result = self.engine.check(
            student=make_student(), instructor=make_instructor(),
            aircraft=aircraft, duration_minutes=60
        )
        self.assertFalse(result.all_passed)
        names = [c.name for c in result.blocking_failures]
        self.assertIn("aircraft_biennial_due", names)

    def test_no_coa_no_check(self):
        """If coa_expiry is None, no check is added."""
        aircraft = make_aircraft(coa_expiry=None)
        result = self.engine.check(
            student=make_student(), instructor=make_instructor(),
            aircraft=aircraft, duration_minutes=60
        )
        coa_check = next((c for c in result.checks if c.name == "aircraft_coa_valid"), None)
        self.assertIsNone(coa_check)
