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
    def __init__(self):
        """M5 Fix: Request-scope cache to avoid repeated DB queries within a single check() call."""
        self._cache = {}

    def _cached_query(self, key: str, query_fn):
        """Execute query_fn only if result is not already cached for this engine instance."""
        if key not in self._cache:
            self._cache[key] = query_fn()
        return self._cache[key]

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
        cfi_override: bool = False,
        flight_id=None,
        route=None
    ) -> SchedulingCheckResult:
        result = SchedulingCheckResult()

        if scheduled_start and scheduled_end:
            now = timezone.now()
            is_future = scheduled_start >= (now - timezone.timedelta(minutes=5))
            result.checks.append(RuleResult(
                name="no_backdated_start",
                passed=is_future,
                detail="Backdated flight scheduling is strictly prohibited. Start time must be in the future." if not is_future else "Clear."
            ))

            is_valid_range = scheduled_end > scheduled_start
            result.checks.append(RuleResult(
                name="valid_time_window",
                passed=is_valid_range,
                detail="Scheduled end time must be after scheduled start time." if not is_valid_range else "Clear."
            ))

            # M5 Fix: Cache overlap query for reuse across student/instructor/aircraft checks
            def _build_overlaps():
                qs = Flight.objects.filter(
                    status__in=[FlightStatus.SCHEDULED, FlightStatus.CONFIRMED, FlightStatus.DISPATCHED, FlightStatus.AIRBORNE, FlightStatus.DRAFT],
                    scheduled_start__lt=scheduled_end,
                    scheduled_end__gt=scheduled_start
                )
                if flight_id:
                    qs = qs.exclude(id=flight_id)
                return qs
            overlaps = self._cached_query(f"overlaps_{scheduled_start}_{scheduled_end}_{flight_id}", _build_overlaps)

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
            result.checks.extend(self._check_prerequisites(student, exercise, cfi_override))
            
        target_d = scheduled_start.date() if scheduled_start else timezone.now().date()
        
        if student:
            result.checks.extend(self._check_student(student, target_d))
        if instructor:
            result.checks.extend(self._check_instructor(instructor, duration_minutes, target_d))
        if secondary_instructor:
            # You can prefix the rule names inside _check_instructor dynamically if needed
            result.checks.extend(self._check_instructor(secondary_instructor, duration_minutes, target_d))
        if aircraft:
            result.checks.extend(self._check_aircraft(aircraft, duration_minutes, route=route))
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
            result.checks.append(RuleResult(
                name="student_solo_approved",
                passed=student.solo_approved,
                detail="Student is not approved for solo flight."
            ))
        return result
    
    # ── Syllabus Prerequisite Check (NEW) ──────────────────────────────────────
    def _check_prerequisites(self, student, exercise, cfi_override: bool) -> List[RuleResult]:
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
        
        detail_msg = "Prerequisites Met."
        if unmet:
            from apps.syllabus.models import SyllabusExercise
            unmet_codes = SyllabusExercise.objects.filter(id__in=unmet).values_list("exercise_code", flat=True)
            detail_msg = f"Missing passed prerequisites: {', '.join(unmet_codes)}"

        return [RuleResult(
            name="syllabus_prerequisites_met",
            passed=len(unmet) == 0,
            detail=detail_msg,
            is_hard_block=False # False allows frontend Draft UI flow; API enforce is in FlightSerializer
        )]

    # ── Student checks ────────────────────────────────────────────────────────
    def _check_student(self, student, target_date=None) -> List[RuleResult]:
        today = target_date or timezone.now().date()
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

        # 7-Day Continuous Flight Rule (Hard Block, NO CFI Override)
        results.extend(self._check_student_consecutive_days(student, today))

        return results

    def _check_student_consecutive_days(self, student, target_date) -> List[RuleResult]:
        import datetime
        import uuid
        from apps.scheduling.models import Flight, FlightStatus, PriorFlightLog

        student_id = getattr(student, "id", None) or getattr(student, "pk", None)
        if not student_id or not isinstance(student_id, (str, uuid.UUID)):
            return [RuleResult(
                name="student_7_day_continuous_flight_block",
                passed=True,
                detail="Consecutive flight days: 0/6."
            )]

        consecutive_flown_days = 0
        flown_dates = []

        for i in range(1, 7):
            check_d = target_date - datetime.timedelta(days=i)
            has_flight = Flight.objects.filter(
                student=student,
                scheduled_start__date=check_d,
                status__in=[FlightStatus.SCHEDULED, FlightStatus.CONFIRMED, FlightStatus.DISPATCHED, FlightStatus.AIRBORNE, FlightStatus.COMPLETED]
            ).exists()

            if not has_flight and hasattr(student, 'user'):
                has_flight = PriorFlightLog.objects.filter(
                    user=student.user,
                    flight_date=check_d
                ).exists()

            if has_flight:
                consecutive_flown_days += 1
                flown_dates.append(check_d.strftime("%d %b"))
            else:
                break

        if consecutive_flown_days >= 6:
            flown_range_str = f"{flown_dates[-1]} to {flown_dates[0]}"
            return [RuleResult(
                name="student_7_day_continuous_flight_block",
                passed=False,
                detail=(
                    f"Mandatory Rest Violation: Student has flown on 6 consecutive days ({flown_range_str}). "
                    f"Mandatory 24-hour rest required. Cannot schedule, plan, or dispatch on day 7, even with CFI override."
                ),
                is_hard_block=True
            )]
        return [RuleResult(
            name="student_7_day_continuous_flight_block",
            passed=True,
            detail=f"Consecutive flight days: {consecutive_flown_days}/6."
        )]

    # ── Instructor checks ─────────────────────────────────────────────────────
    def _check_instructor(self, instructor, duration_minutes: int, target_date=None) -> List[RuleResult]:
        from apps.core.fdtl_utils import calculate_instructor_fdtl
        
        target_date = target_date or timezone.now().date()
        results = []
        duration_hours = float(duration_minutes) / 60.0

        windows_results = calculate_instructor_fdtl(instructor, target_date, include_scheduled=True)

        for w in windows_results:
            key = w['window']
            flown_hours = w['flown_hours']
            cap = w['cap_hours']
            
            passed = (flown_hours + duration_hours) <= cap
            results.append(RuleResult(
                name=f"instructor_fdtl_{key}",
                passed=passed,
                detail=f"FDTL {key}: Flown {flown_hours}h + needs {duration_hours:.1f}h. Limit {cap}h."
            ))

        return results

    # ── Aircraft checks ───────────────────────────────────────────────────────
    def _check_aircraft(self, aircraft, duration_minutes: int, route=None) -> List[RuleResult]:
        today = timezone.now().date()
        duration_hours = Decimal(str(duration_minutes)) / Decimal("60")
        results = []

        # AOG hard stop
        results.append(RuleResult(
            name="aircraft_not_aog",
            passed=(aircraft.status == "airworthy"),
            detail=f"Aircraft status: {aircraft.status}. {aircraft.aog_reason or ''}",
        ))

        # Deferred defects check (Go snags)
        from apps.dispatch.models import SnagEntry, SnagCategory
        active_deferred_snags = SnagEntry.objects.filter(
            aircraft=aircraft,
            category=SnagCategory.GO,
            resolved_at__isnull=True
        )

        for snag in active_deferred_snags:
            if snag.is_overdue:
                # H4 Fix: Report the finding but do NOT mutate aircraft status.
                # AOG transitions are handled exclusively by dispatch/signals.py::aog_cascade

                results.append(RuleResult(
                    name="aircraft_deferred_defect_overdue",
                    passed=False,
                    detail=f"AIRCRAFT SHOULD BE GROUNDED: Deferred defect '{snag.description}' resolution deadline passed on {snag.resolution_due_date.strftime('%d %b %Y %H:%M')}.",
                    is_hard_block=True
                ))
            else:
                due_str = snag.resolution_due_date.strftime('%d %b %Y %H:%M') if snag.resolution_due_date else "CAMO Timeline Pending"
                results.append(RuleResult(
                    name="aircraft_deferred_defect_warning",
                    passed=True,
                    detail=f"⚠️ OPERATING UNDER DEFERRED DEFECT: '{snag.description}' (CAMO Due: {due_str}). Notes: {snag.camo_notes or 'None'}",
                ))

        # Ferry Buffer — the signature safety rule for satellite bases
        ferry_buffer = Decimal("0")
        try:
            base = aircraft.current_base
            ferry_buffer = Decimal(str(base.ferry_buffer_hours or "0"))
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

        # 6e: Hard block local flights if ferry buffer is triggered
        if aircraft.ferry_buffer_triggered:
            from apps.navigation.utils import resolve_landing_airport_for_scheduling
            landing_airport = resolve_landing_airport_for_scheduling(route)
            stays_local = (
                landing_airport is None
                or getattr(landing_airport, 'base_id', None) == aircraft.current_base_id
            )
            results.append(RuleResult(
                name="aircraft_ferry_buffer_local_flight_block",
                passed=not stays_local,
                detail=(
                    "Aircraft is within ferry buffer and must be repositioned to another base — "
                    "only flights ending at a different base are permitted until it is ferried."
                ) if stays_local else "Flight repositions aircraft away from current base — permitted despite ferry buffer.",
                is_hard_block=True,
            ))

        # Calendar-based annual
        if aircraft.next_annual_due:
            results.append(RuleResult(
                name="aircraft_annual_due",
                passed=aircraft.next_annual_due > today,
                detail=f"Annual inspection due: {aircraft.next_annual_due}",
            ))

        # Certificate of Airworthiness expiry (H5 Fix)
        if aircraft.coa_expiry:
            results.append(RuleResult(
                name="aircraft_coa_valid",
                passed=aircraft.coa_expiry > today,
                detail=f"Certificate of Airworthiness expiry: {aircraft.coa_expiry}",
            ))

        # Biennial inspection (H5 Fix)
        if aircraft.next_biennial_due:
            results.append(RuleResult(
                name="aircraft_biennial_due",
                passed=aircraft.next_biennial_due > today,
                detail=f"Biennial inspection due: {aircraft.next_biennial_due}",
            ))

        return results

    # ── Weather checks (only for solo flights) ────────────────────────────────
    def _check_weather(self, weather, student, aircraft) -> List[RuleResult]:
        import math
        results = []
        if weather.wind_speed_kt is not None:
            # True crosswind calculation using active runway heading
            crosswind_kt = weather.wind_speed_kt  # Default: use raw wind speed as fallback
            runway_heading = None

            # Try to get active runway heading for accurate crosswind calculation
            try:
                if hasattr(weather, 'active_runway') and weather.active_runway:
                    runway_heading = weather.active_runway.heading_deg
                elif hasattr(aircraft, 'current_base') and aircraft.current_base:
                    base = aircraft.current_base
                    if hasattr(base, 'active_runway') and base.active_runway:
                        runway_heading = base.active_runway.heading_deg
            except Exception:
                pass

            if runway_heading is not None and weather.wind_direction_deg is not None:
                # True crosswind component: |wind_speed × sin(wind_dir - runway_heading)|
                angle_diff = abs(weather.wind_direction_deg - runway_heading)
                crosswind_kt = abs(weather.wind_speed_kt * math.sin(math.radians(angle_diff)))
                detail_str = (
                    f"True crosswind: {crosswind_kt:.1f}kt "
                    f"(Wind {weather.wind_direction_deg}°/{weather.wind_speed_kt}kt, "
                    f"RWY heading {runway_heading}°) — "
                    f"student solo limit: {student.solo_max_crosswind_kt}kt"
                )
            else:
                detail_str = (
                    f"Wind: {weather.wind_speed_kt}kt (crosswind approximate — no active runway set) — "
                    f"student solo limit: {student.solo_max_crosswind_kt}kt"
                )

            results.append(RuleResult(
                name="crosswind_within_student_limit",
                passed=Decimal(str(crosswind_kt)) <= student.solo_max_crosswind_kt,
                detail=detail_str,
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
                is_hard_block=False,
            ))
        return results
