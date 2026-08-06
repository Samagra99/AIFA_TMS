"""
compliance/report_generators.py
--------------------------------
Generates the 4 DGCA reports required by the FTO using custom date ranges.

Reports:
  1. SPL Report               – SPLs issued in custom date range
  2. Aircraft Utilisation Report – fleet flying hours vs available
  3. Instructor Utilisation Report – FDTL, flying, duty
  4. Trainee Flying Hours Report – per-student range + cumulative
"""

import logging
from calendar import monthrange
from datetime import date
import datetime

from django.db.models import Count, Q, Sum, F, ExpressionWrapper, DurationField

log = logging.getLogger(__name__)

# DGCA-mandated CPL course total hours
COURSE_REQUIRED_HOURS = {
    'CPL': 200,
    'PPL': 40,
}
DEFAULT_COURSE_HOURS = 200

# Regulatory FDTL monthly limits (30-day baseline)
INSTRUCTOR_MONTHLY_FLYING_LIMIT = 100   # hours
INSTRUCTOR_MONTHLY_DUTY_LIMIT   = 125   # hours

# Assumed flyable hours per aircraft per day
FLYABLE_HOURS_PER_DAY = 8.0


def _duration_annotation():
    return ExpressionWrapper(
        F('scheduled_end') - F('scheduled_start'),
        output_field=DurationField(),
    )


def _td_hours(td) -> float:
    return (td.total_seconds() / 3600.0) if td else 0.0


# ─────────────────────────────────────────────────────────────────────────────
# 1. SPL Report
# ─────────────────────────────────────────────────────────────────────────────

def spl_monthly_report(start_date: date, end_date: date, year: int = None, month: int = None) -> dict:
    from apps.users.models import Student

    qs = (
        Student.objects
        .filter(
            spl_issue_date__gte=start_date,
            spl_issue_date__lte=end_date,
        )
        .select_related('user')
        .order_by('spl_issue_date')
    )

    students = []
    for s in qs:
        students.append({
            'student_id':      str(s.id),
            'name':             s.user.get_full_name(),
            'batch_no':         s.batch_number or '—',
            'spl_number':       s.spl_number or '—',
            'spl_issued_date':  str(s.spl_issue_date),
            'spl_expiry':       str(s.spl_expiry) if s.spl_expiry else '—',
            'target_licence':   s.target_licence.code if s.target_licence else '—',
        })

    return {
        'report_type':        'spl_monthly',
        'start_date':         str(start_date),
        'end_date':           str(end_date),
        'year':               year or start_date.year,
        'month':              month or start_date.month,
        'total_spls_issued':  len(students),
        'students':           students,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Aircraft Utilisation Report
# ─────────────────────────────────────────────────────────────────────────────

def aircraft_utilization_report(start_date: date, end_date: date, year: int = None, month: int = None) -> dict:
    from apps.infrastructure.models import Aircraft
    from apps.scheduling.models import Flight, FlightStatus

    num_days = max(1, (end_date - start_date).days + 1)
    available_per_aircraft = num_days * FLYABLE_HOURS_PER_DAY

    aircraft_qs = Aircraft.objects.select_related('aircraft_type', 'current_base').filter(is_active=True).order_by('tail_number')

    rows = []
    total_available = 0.0
    total_flown     = 0.0
    total_flights   = 0

    for ac in aircraft_qs:
        agg = (
            Flight.objects
            .filter(
                aircraft=ac,
                scheduled_start__date__gte=start_date,
                scheduled_start__date__lte=end_date,
                status=FlightStatus.COMPLETED
            )
            .annotate(duration=_duration_annotation())
            .aggregate(
                hours=Sum('duration'),
                flights=Count('id'),
            )
        )

        actual = _td_hours(agg['hours'])
        flights = int(agg['flights'] or 0)
        util    = round(actual / available_per_aircraft * 100, 1) if available_per_aircraft else 0

        total_available += available_per_aircraft
        total_flown     += actual
        total_flights   += flights

        rows.append({
            'aircraft_id':      str(ac.id),
            'registration':     ac.tail_number,
            'aircraft_type':    ac.aircraft_type.make_model if ac.aircraft_type else '—',
            'base':             ac.current_base.name if ac.current_base else '—',
            'status':           ac.status,
            'available_hours':  round(available_per_aircraft, 1),
            'actual_hours':     round(actual, 1),
            'total_flights':    flights,
            'utilization_pct':  util,
        })

    fleet_util = round(total_flown / total_available * 100, 1) if total_available else 0

    return {
        'report_type':            'aircraft_utilization',
        'start_date':             str(start_date),
        'end_date':               str(end_date),
        'year':                   year or start_date.year,
        'month':                  month or start_date.month,
        'num_days':               num_days,
        'total_aircraft':         len(rows),
        'total_available_hours':  round(total_available, 1),
        'total_actual_hours':     round(total_flown, 1),
        'total_flights':          total_flights,
        'fleet_utilization_pct':  fleet_util,
        'aircraft':               rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Instructor Utilisation Report
# ─────────────────────────────────────────────────────────────────────────────

def instructor_utilization_report(start_date: date, end_date: date, year: int = None, month: int = None) -> dict:
    from apps.users.models import Instructor
    from apps.scheduling.models import Flight, FlightStatus, InstructorDutyLog

    num_days = max(1, (end_date - start_date).days + 1)
    scaled_flying_limit = round(INSTRUCTOR_MONTHLY_FLYING_LIMIT * (num_days / 30.0), 1)
    scaled_duty_limit   = round(INSTRUCTOR_MONTHLY_DUTY_LIMIT * (num_days / 30.0), 1)

    instructors = (
        Instructor.objects
        .filter(user__is_active=True)
        .select_related('user')
        .order_by('user__last_name', 'user__first_name')
    )

    rows = []
    for instructor in instructors:
        user = instructor.user

        fly_agg = (
            Flight.objects
            .filter(
                instructor=instructor,
                scheduled_start__date__gte=start_date,
                scheduled_start__date__lte=end_date,
                status=FlightStatus.COMPLETED,
            )
            .annotate(duration=_duration_annotation())
            .aggregate(
                total_hours=Sum('duration'),
                total_flights=Count('id'),
            )
        )

        total_flying = _td_hours(fly_agg['total_hours'])

        duty_agg = InstructorDutyLog.objects.filter(
            instructor=instructor,
            duty_start__date__gte=start_date,
            duty_start__date__lte=end_date,
        ).aggregate(total_duty=Sum('total_duty_minutes'))
        total_minutes = duty_agg['total_duty']
        duty_hours = round(total_minutes / 60.0, 1) if total_minutes else 0.0

        fdtl_flying_pct = round(total_flying / scaled_flying_limit * 100, 1) if scaled_flying_limit else 0
        fdtl_duty_pct   = round(duty_hours   / scaled_duty_limit   * 100, 1) if scaled_duty_limit else 0

        try:
            from apps.rostering.models import InstructorStudentAssignment
            active_students = InstructorStudentAssignment.objects.filter(
                instructor=instructor, is_active=True
            ).count()
        except Exception:
            active_students = None

        rows.append({
            'instructor_id':     str(instructor.id),
            'name':              user.get_full_name(),
            'fir_licence_number': instructor.fir_licence_number or '—',
            'total_flying_hrs':  round(total_flying, 1),
            'duty_hours':        duty_hours,
            'fdtl_flying_pct':   fdtl_flying_pct,
            'fdtl_duty_pct':     fdtl_duty_pct,
            'active_students':   active_students,
            'total_flights':     int(fly_agg['total_flights'] or 0),
        })

    return {
        'report_type':             'instructor_utilization',
        'start_date':              str(start_date),
        'end_date':                str(end_date),
        'year':                    year or start_date.year,
        'month':                   month or start_date.month,
        'num_days':                num_days,
        'total_instructors':       len(rows),
        'total_flying_hours':      round(sum(r['total_flying_hrs'] for r in rows), 1),
        'total_duty_hours':        round(sum(r['duty_hours']        for r in rows), 1),
        'monthly_flying_limit':    scaled_flying_limit,
        'monthly_duty_limit':      scaled_duty_limit,
        'instructors':             rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. Trainee Flying Hours Report
# ─────────────────────────────────────────────────────────────────────────────

def trainee_hours_report(start_date: date, end_date: date, year: int = None, month: int = None) -> dict:
    from apps.users.models import Student
    from apps.scheduling.models import Flight, FlightType, FlightStatus

    students = (
        Student.objects
        .filter(user__is_active=True)
        .select_related('user')
        .order_by('user__last_name', 'user__first_name')
    )

    rows = []
    for student in students:
        user = student.user

        month_agg = (
            Flight.objects
            .filter(
                student=student,
                scheduled_start__date__gte=start_date,
                scheduled_start__date__lte=end_date,
                status=FlightStatus.COMPLETED
            )
            .annotate(duration=_duration_annotation())
            .aggregate(
                dual=Sum('duration', filter=Q(flight_type="dual", is_skill_test=False)),
                solo=Sum('duration', filter=Q(flight_type="solo", is_skill_test=False)),
                check=Sum('duration', filter=Q(is_skill_test=True)),
                flights=Count('id'),
            )
        )
        dual  = _td_hours(month_agg['dual'])
        solo  = _td_hours(month_agg['solo'])
        check = _td_hours(month_agg['check'])
        month_total = dual + solo

        cumulative = float(student.hours_total)

        target_code = student.target_licence.code if student.target_licence else 'CPL'
        required_hours = COURSE_REQUIRED_HOURS.get(
            target_code, DEFAULT_COURSE_HOURS
        )

        progress_pct = round(min(cumulative / required_hours * 100, 100), 1) if required_hours else 0

        rows.append({
            'student_id':           str(student.id),
            'name':                 user.get_full_name(),
            'batch_no':             student.batch_number or '-',
            'course_type':          target_code,
            'month_dual_hours':     round(dual,         1),
            'month_solo_hours':     round(solo,         1),
            'month_check_hours':    round(check,        1),
            'month_total_hours':    round(month_total,  1),
            'month_total_flights':  int(month_agg['flights'] or 0),
            'cumulative_hours':     round(cumulative,   1),
            'course_required_hours': required_hours,
            'progress_pct':         progress_pct,
        })

    rows.sort(key=lambda r: -r['month_total_hours'])

    return {
        'report_type':            'trainee_hours',
        'start_date':             str(start_date),
        'end_date':               str(end_date),
        'year':                   year or start_date.year,
        'month':                  month or start_date.month,
        'total_students':         len(rows),
        'month_total_hours':      round(sum(r['month_total_hours'] for r in rows), 1),
        'month_dual_hours':       round(sum(r['month_dual_hours']  for r in rows), 1),
        'month_solo_hours':       round(sum(r['month_solo_hours']  for r in rows), 1),
        'month_check_hours':      round(sum(r['month_check_hours'] for r in rows), 1),
        'students':               rows,
    }
