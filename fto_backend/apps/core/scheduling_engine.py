"""
Scheduling Rule Engine — DGCA Hard Constraint Evaluator.

Every flight confirmation must pass ALL hard constraints before the
system allows a roster slot to move from 'scheduled' → 'confirmed'.

Usage:
    from apps.core.scheduling_engine import SchedulingRuleEngine
    engine = SchedulingRuleEngine()
    result = engine.check(student=s, instructor=i, aircraft=a, duration_minutes=60)
    if not result.all_passed:
        raise serializers.ValidationError(result.to_dict())
"""
from __future__ import annotations
from dataclasses import dataclass, field
from decimal import Decimal
from typing import List, Optional
from django.utils import timezone
from django.db.models import Q
from apps.scheduling.models import Flight, FlightStatus


@dataclass
class RuleResult:
    name: str
    passed: bool
    detail: str
    is_hard_block: bool = True  # False = warning only (CFI can override)


@dataclass
class SchedulingCheckResult:
    checks: List[RuleResult] = field(default_factory=list)

    @property
    def all_passed(self) -> bool:
        return all(c.passed for c in self.checks if c.is_hard_block)

    @property
    def blocking_failures(self) -> List[RuleResult]:
        return [c for c in self.checks if not c.passed and c.is_hard_block]

    @property
    def warnings(self) -> List[RuleResult]:
        return [c for c in self.checks if not c.passed and not c.is_hard_block]

    def to_dict(self) -> dict:
        return {
            "all_passed": self.all_passed,
            "blocking_failures": [
                {"rule": c.name, "detail": c.detail} for c in self.blocking_failures
            ],
            "warnings": [
                {"rule": c.name, "detail": c.detail} for c in self.warnings
            ],
        }


class SchedulingRuleEngine:
    def check(
        self,
        student=None,
        instructor=None,
        secondary_instructor=None,
        aircraft=None,
        scheduled_start=None,
        scheduled_end=None,
        exercise=None,
        duration_minutes: int = 60,
        weather=None,
        is_solo: bool = False,
    ) -> SchedulingCheckResult:
        result = SchedulingCheckResult()

        if scheduled_start and scheduled_end:
            # Find any active flights overlapping this time window
            overlaps = Flight.objects.filter(
                status__in=[FlightStatus.SCHEDULED, FlightStatus.CONFIRMED, FlightStatus.DISPATCHED, FlightStatus.AIRBORNE, FlightStatus.DRAFT],
                scheduled_start__lt=scheduled_end,
                scheduled_end__gt=scheduled_start
            )

        if instructor:
                is_free = not overlaps.filter(instructor=instructor).exists()
                result.checks.append(RuleResult(
                    name="instructor_no_overlap", passed=is_free,
                    detail="Instructor is already booked during this time." if not is_free else "Clear."
                ))
        # 2. Secondary Instructor Overlap
        if secondary_instructor:
                is_free = not overlaps.filter(
                    Q(instructor=secondary_instructor) | Q(secondary_instructor=secondary_instructor)
                ).exists()
                result.checks.append(RuleResult(
                    name="secondary_instructor_no_overlap", passed=is_free,
                    detail="Secondary Instructor is already booked during this time." if not is_free else "Clear."
                ))
        if aircraft:
                is_free = not overlaps.filter(aircraft=aircraft).exists()
                result.checks.append(RuleResult(
                    name="aircraft_no_overlap", passed=is_free,
                    detail="Aircraft is already booked during this time." if not is_free else "Clear."
                ))
        if student:
                is_free = not overlaps.filter(student=student).exists()
                result.checks.append(RuleResult(
                    name="student_no_overlap", passed=is_free,
                    detail="Student is already booked during this time." if not is_free else "Clear."
                ))
        if student and exercise:
            result.checks.extend(self._check_prerequisites(student, exercise))
        if student:
            result.checks.extend(self._check_student(student))
        if instructor:
            result.checks.extend(self._check_instructor(instructor, duration_minutes))
        if secondary_instructor:
            # You can prefix the rule names inside _check_instructor dynamically if needed
            result.checks.extend(self._check_instructor(secondary_instructor, duration_minutes))
        if aircraft:
            result.checks.extend(self._check_aircraft(aircraft, duration_minutes))
        if weather and student and is_solo:
            result.checks.extend(self._check_weather(weather, student, aircraft))
        if student and is_solo:
            today = timezone.now().date()
            result.checks.append(RuleResult(
                name="student_frtol_valid_for_solo",
                passed=bool(student.frtol_number and student.frtol_expiry and student.frtol_expiry > today),
                detail=(
                    f"FRTOL number: {student.frtol_number or 'NOT SET'} — "
                    f"expiry: {student.frtol_expiry or 'NOT SET'}"
                ),
            ))
        return result
    
    # ── Syllabus Prerequisite Check (NEW) ──────────────────────────────────────
    def _check_prerequisites(self, student, exercise) -> List[RuleResult]:
        """Mirrors the exact pass_grade logic from PlanEntrySerializer."""
        # Check if the exercise is a buffer flight (no prereqs needed)
        if getattr(exercise, "is_buffer", False):
            return [RuleResult(name="syllabus_prerequisites_met", passed=True, detail="Buffer exercise. No prerequisites required.")]
            
        prereqs = exercise.prerequisite_ids or []
        if not prereqs:
            return [RuleResult(name="syllabus_prerequisites_met", passed=True, detail="No prerequisites required.")]

        # Safe dynamic import to prevent circular dependencies
        from apps.maintenance.models import SortieGrade
        
        # Get all exercises where the student achieved the required pass_grade
        passed_ids = set(
            SortieGrade.objects.filter(
                student=student, 
                grade__gte=exercise.pass_grade
            ).values_list("exercise_id", flat=True)
        )

        unmet = [pid for pid in prereqs if str(pid) not in [str(p) for p in passed_ids]]
        
        return [RuleResult(
            name="syllabus_prerequisites_met",
            passed=len(unmet) == 0,
            detail=f"Missing passed prerequisite exercise IDs: {', '.join(map(str, unmet))}" if unmet else "Prerequisites met.",
            is_hard_block=False # False allows CFI to override via cfi_override_requested
        )]

    # ── Student checks ────────────────────────────────────────────────────────
    def _check_student(self, student) -> List[RuleResult]:
        today = timezone.now().date()
        results = []

        # Medical
        results.append(RuleResult(
            name="student_medical_valid",
            passed=bool(student.medical_expiry and student.medical_expiry > today),
            detail=f"Medical expiry: {student.medical_expiry or 'NOT SET'}",
        ))
        # SPL
        results.append(RuleResult(
            name="student_spl_valid",
            passed=bool(student.spl_expiry and student.spl_expiry > today),
            detail=f"SPL expiry: {student.spl_expiry or 'NOT SET'}",
        ))
        # FRTOL (only required if set; mandatory for cross-country)
        if student.frtol_expiry:
            results.append(RuleResult(
                name="student_frtol_valid",
                passed=student.frtol_expiry > today,
                detail=f"FRTOL expiry: {student.frtol_expiry}",
            ))
        return results

    # ── Instructor checks ─────────────────────────────────────────────────────
    def _check_instructor(self, instructor, duration_minutes: int) -> List[RuleResult]:
        results = []
        results.append(RuleResult(
            name="instructor_fdtl_daily",
            passed=instructor.fdtl_daily_remaining_min >= duration_minutes,
            detail=(
                f"Daily FDTL remaining: {instructor.fdtl_daily_remaining_min} min — "
                f"flight needs: {duration_minutes} min"
            ),
        ))
        results.append(RuleResult(
            name="instructor_fdtl_weekly",
            passed=instructor.fdtl_weekly_remaining_min >= duration_minutes,
            detail=f"Weekly FDTL remaining: {instructor.fdtl_weekly_remaining_min} min",
        ))
        results.append(RuleResult(
            name="instructor_fdtl_monthly",
            passed=instructor.fdtl_monthly_remaining_min >= duration_minutes,
            detail=f"Monthly FDTL remaining: {instructor.fdtl_monthly_remaining_min} min",
        ))
        return results

    # ── Aircraft checks ───────────────────────────────────────────────────────
    def _check_aircraft(self, aircraft, duration_minutes: int) -> List[RuleResult]:
        today = timezone.now().date()
        duration_hours = Decimal(str(duration_minutes)) / Decimal("60")
        results = []

        # AOG hard stop
        results.append(RuleResult(
            name="aircraft_not_aog",
            passed=(aircraft.status == "airworthy"),
            detail=f"Aircraft status: {aircraft.status}. {aircraft.aog_reason or ''}",
        ))

        # Ferry Buffer — the signature safety rule for satellite bases
        ferry_buffer = Decimal("0")
        try:
            base = aircraft.current_base
            ferry_buffer = base.ferry_buffer_hours or Decimal("0")
        except Exception:
            pass
        required_hours = duration_hours + ferry_buffer

        if aircraft.next_50hr_at is not None:
            remaining = aircraft.next_50hr_at - aircraft.hobbs_total
            results.append(RuleResult(
                name="aircraft_50hr_ferry_buffer",
                passed=remaining >= required_hours,
                detail=(
                    f"50-hr inspection remaining: {remaining:.1f}h — "
                    f"needs {duration_hours:.1f}h flight + {ferry_buffer:.1f}h ferry buffer = "
                    f"{required_hours:.1f}h total"
                ),
            ))

        if aircraft.next_100hr_at is not None:
            remaining = aircraft.next_100hr_at - aircraft.hobbs_total
            results.append(RuleResult(
                name="aircraft_100hr_ferry_buffer",
                passed=remaining >= required_hours,
                detail=(
                    f"100-hr inspection remaining: {remaining:.1f}h — "
                    f"needs {required_hours:.1f}h total"
                ),
            ))

        # Calendar-based annual
        if aircraft.next_annual_due:
            results.append(RuleResult(
                name="aircraft_annual_due",
                passed=aircraft.next_annual_due > today,
                detail=f"Annual inspection due: {aircraft.next_annual_due}",
            ))

        return results

    # ── Weather checks (only for solo flights) ────────────────────────────────
    def _check_weather(self, weather, student, aircraft) -> List[RuleResult]:
        results = []
        if weather.wind_speed_kt is not None:
            # Simplified: use wind speed as crosswind proxy (real calc needs runway QDM)
            results.append(RuleResult(
                name="crosswind_within_student_limit",
                passed=weather.wind_speed_kt <= student.solo_max_crosswind_kt,
                detail=(
                    f"Wind: {weather.wind_speed_kt}kt — "
                    f"student solo limit: {student.solo_max_crosswind_kt}kt"
                ),
            ))
        if weather.density_altitude_ft is not None and aircraft:
            da_threshold = aircraft.aircraft_type.da_solo_warning_ft
            results.append(RuleResult(
                name="density_altitude_warning",
                passed=weather.density_altitude_ft <= da_threshold,
                detail=(
                    f"Density altitude: {weather.density_altitude_ft}ft — "
                    f"warning threshold: {da_threshold}ft"
                ),
                is_hard_block=False,  # Warning only — CFI must acknowledge
            ))
        return results
