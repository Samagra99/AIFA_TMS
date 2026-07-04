"""
compliance/report_generators.py
--------------------------------
Generates the 4 DGCA monthly reports required by the FTO.

All generators return a plain Python dict (JSON-serialisable).
The view layer passes these directly to Response() via DRF.

Reports:
  1. SPL Monthly Report          – SPLs issued in a given month
  2. Aircraft Utilisation Report – fleet flying hours vs available
  3. Instructor Utilisation Report – FDTL, flying, students
  4. Trainee Flying Hours Report – per-student monthly + cumulative

Adjust model import paths to match your actual app structure.
Field names marked  # ← adjust  may differ in your schema.
"""

import logging
from calendar import monthrange
from datetime import date
from decimal import Decimal
import datetime

from django.db.models import Count, Q, Sum, F, ExpressionWrapper, DurationField

log = logging.getLogger(__name__)

# DGCA-mandated CPL course total hours (adjust if your FTO runs PPL too)
COURSE_REQUIRED_HOURS = {
    'CPL': 200,
    'PPL': 40,
}
DEFAULT_COURSE_HOURS = 200

# Regulatory FDTL monthly flying limit for instructors (DGCA CAR-FTL)
INSTRUCTOR_MONTHLY_FLYING_LIMIT  = 100   # hours
INSTRUCTOR_MONTHLY_DUTY_LIMIT    = 125   # hours

# Assumed flyable hours per aircraft per day (DGCA operational standard)
FLYABLE_HOURS_PER_DAY = 8.0


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def _month_range(year: int, month: int) -> tuple[date, date]:
    _, last_day = monthrange(year, month)
    return date(year, month, 1), date(year, month, last_day)


def _duration_annotation():
    """Reusable annotation: exact flight duration as a Django DurationField."""
    return ExpressionWrapper(
        F('scheduled_end') - F('scheduled_start'),
        output_field=DurationField(),
    )
 
 
def _td_hours(td) -> float:
    """Convert a timedelta aggregate (or None) to decimal hours."""
    return (td.total_seconds() / 3600.0) if td else 0.0


# ─────────────────────────────────────────────────────────────────────────────
# 1.  SPL Monthly Report
# ─────────────────────────────────────────────────────────────────────────────

def spl_monthly_report(year: int, month: int) -> dict:
    """
    Returns a count and list of all SPLs issued during the given month.

    Assumes StudentProfile has:
      spl_issued_date  DateField
      spl_number       CharField
      spl_expiry       DateField
      assigned_instructor  ForeignKey → CustomUser
    """

    from apps.users.models import Student   # ← adjust if different path

    start, end = _month_range(year, month)

    qs = (
        Student.objects
        .filter(
            spl_issue_date__gte=start,
            spl_issue_date__lte=end,
            # spl_issued=True
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
            'target_licence':   s.target_licence,
        })

    return {
        'report_type':        'spl_monthly',
        'year':               year,
        'month':              month,
        'total_spls_issued':  len(students),
        'students':           students,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2.  Monthly Aircraft Utilisation Report
# ─────────────────────────────────────────────────────────────────────────────

def aircraft_utilization_report(year: int, month: int) -> dict:
    """
    For each active aircraft:
      available_hours = days_in_month × FLYABLE_HOURS_PER_DAY
      actual_hours    = sum of block_off_time_hours from completed FlightLogs
      utilization_pct = actual / available × 100

    Assumes FlightLog has:
      aircraft          ForeignKey → Aircraft
      flight_date       DateField
      block_off_time_hours  DecimalField   (← adjust to your actual column)
      status            CharField  ('completed' | 'cancelled' | …)
    """
    from apps.infrastructure.models import Aircraft
    from apps.scheduling.models import Flight, FlightStatus


    start, end = _month_range(year, month)
    _, days_in_month = monthrange(year, month)
    available_per_aircraft = days_in_month * FLYABLE_HOURS_PER_DAY

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
                scheduled_start__date__gte=start,
                scheduled_start__date__lte=end,
                status='completed'
            )
            .annotate(duration=_duration_annotation())
            .aggregate(
                hours=Sum('duration'),   # ← adjust field name
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
        'year':                   year,
        'month':                  month,
        'total_aircraft':         len(rows),
        'total_available_hours':  round(total_available, 1),
        'total_actual_hours':     round(total_flown, 1),
        'total_flights':          total_flights,
        'fleet_utilization_pct':  fleet_util,
        'aircraft':               rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3.  Monthly Instructor Utilisation Report
# ─────────────────────────────────────────────────────────────────────────────

def instructor_utilization_report(year: int, month: int) -> dict:
    """
    Per instructor:
      dual_hours      – flying on dual-type sorties
      check_hours     – flying on proficiency_check sorties
      solo_hours      – supervised solo hours logged against this instructor
      total_flying    – dual + check + solo
      duty_hours      – from InstructorDutyLog.total_duty_minutes
      fdtl_flying_pct / fdtl_duty_pct — vs monthly CAR-FTL caps
      active_students – from InstructorStudentAssignment (permanent pairing)
 
    IMPORTANT: Flight.instructor is a FK to Instructor, NOT to User.
    (The first-draft version of this report incorrectly filtered
    Flight.objects.filter(instructor=user) — that would silently return
    zero rows for every instructor, since `user` is a User instance and
    `instructor` expects an Instructor instance. Fixed here.)
    """
    from apps.users.models import Instructor
    from apps.scheduling.models import Flight, FlightType, FlightStatus, InstructorDutyLog
 
    start, end = _month_range(year, month)
 
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
                instructor=instructor,          # ← FK to Instructor, not User
                scheduled_start__date__gte=start,
                scheduled_start__date__lte=end,
                status=FlightStatus.COMPLETED,
            )
            .annotate(duration=_duration_annotation())
            .aggregate(
                total_hours=Sum('duration'),
                total_flights=Count('id'),
            )
        )
        
        total_flying = _td_hours(fly_agg['total_hours'])

 
        # FDTL duty hours from InstructorDutyLog
        duty_agg = InstructorDutyLog.objects.filter(
            instructor=instructor,
            duty_start__date__gte=start,
            duty_start__date__lte=end,
        ).aggregate(total_duty=Sum('total_duty_minutes'))
        total_minutes = duty_agg['total_duty']
        duty_hours = round(total_minutes / 60.0, 1) if total_minutes else 0.0


        fdtl_flying_pct = round(total_flying / INSTRUCTOR_MONTHLY_FLYING_LIMIT * 100, 1)
        fdtl_duty_pct   = round(duty_hours   / INSTRUCTOR_MONTHLY_DUTY_LIMIT   * 100, 1)

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
            'cfi_licence_number': instructor.cfi_licence_number or '—',
            'total_flying_hrs':  round(total_flying, 1),
            'duty_hours':        duty_hours,
            'fdtl_flying_pct':   fdtl_flying_pct,
            'fdtl_duty_pct':     fdtl_duty_pct,
            'active_students':   active_students,
            'total_flights':     int(fly_agg['total_flights'] or 0),
        })

    return {
        'report_type':             'instructor_utilization',
        'year':                    year,
        'month':                   month,
        'total_instructors':       len(rows),
        'total_flying_hours':      round(sum(r['total_flying_hrs'] for r in rows), 1),
        'total_duty_hours':        round(sum(r['duty_hours']        for r in rows), 1),
        'monthly_flying_limit':    INSTRUCTOR_MONTHLY_FLYING_LIMIT,
        'monthly_duty_limit':      INSTRUCTOR_MONTHLY_DUTY_LIMIT,
        'instructors':             rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4.  Monthly Trainee Flying Hours Report
# ─────────────────────────────────────────────────────────────────────────────

def trainee_hours_report(year: int, month: int) -> dict:
    """
    Per active student:
      month_dual / solo / ifox / check / total  – this month
      cumulative_hours                           – lifetime total
      course_required_hours                      – from StudentProfile
      progress_pct                               – cumulative / required × 100

    Assumes FlightLog has:
      student      ForeignKey → CustomUser
      flight_type  CharField ('DUAL' | 'SOLO' | 'IFOX' | 'CHECK')
    """
    from apps.users.models import Student   # ← adjust
    from apps.scheduling.models import Flight, FlightType, FlightStatus
    
    start, end = _month_range(year, month)

    students = (
        Student.objects
        .filter( user__is_active=True)
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
                scheduled_start__date__gte=start,
                scheduled_start__date__lte=end,
                status=FlightStatus.COMPLETED
            )
            .annotate(duration=_duration_annotation())
            .aggregate(
                dual=Sum('duration', filter=Q(flight_type__in=[
                    FlightType.DUAL, FlightType.CROSS_COUNTRY_DUAL, FlightType.NIGHT_DUAL, FlightType.INSTRUMENT, FlightType.PROGRESS_CHECK
                ])),
                solo=Sum('duration', filter=Q(flight_type__in=[
                    FlightType.SOLO, FlightType.CROSS_COUNTRY_SOLO, FlightType.NIGHT_SOLO, FlightType.PROFICIENCY_CHECK
                ])),
                check=Sum('duration', filter=Q(flight_type__in=[
                    FlightType.PROFICIENCY_CHECK
                ])),
                flights=Count('id'),
            )
        )
        dual  = _td_hours(month_agg['dual'])
        solo  = _td_hours(month_agg['solo'])
        # ifox  = _td_hours(month_agg['ifox'])
        check = _td_hours(month_agg['check'])
        month_total = dual + solo

        cumulative = float(student.hours_total)

        required_hours = COURSE_REQUIRED_HOURS.get(
            student.target_licence, DEFAULT_COURSE_HOURS
        )

        progress_pct    = round(min(cumulative / required_hours * 100, 100), 1) if required_hours else 0

        rows.append({
            'student_id':           str(student.id),
            'name':                 user.get_full_name(),
            'batch_no':             student.batch_number or '-',
            'course_type':          student.target_licence,
            # 'instructor':           (
            #     sp.assigned_instructor.get_full_name()
            #     if sp.assigned_instructor else '—'
            # ),
            'month_dual_hours':     round(dual,         1),
            'month_solo_hours':     round(solo,         1),
            # 'month_ifox_hours':     round(ifox,         1),
            'month_check_hours':    round(check,        1),
            'month_total_hours':    round(month_total,  1),
            'month_total_flights':  int(month_agg['flights'] or 0),
            'cumulative_hours':     round(cumulative,   1),
            'course_required_hours': required_hours,
            'progress_pct':         progress_pct,
        })

    # Sort by most hours flown this month (descending)
    rows.sort(key=lambda r: -r['month_total_hours'])

    return {
        'report_type':            'trainee_hours',
        'year':                   year,
        'month':                  month,
        'total_students':         len(rows),
        'month_total_hours':      round(sum(r['month_total_hours'] for r in rows), 1),
        'month_dual_hours':       round(sum(r['month_dual_hours']  for r in rows), 1),
        'month_solo_hours':       round(sum(r['month_solo_hours']  for r in rows), 1),
        # 'month_ifox_hours':       round(sum(r['month_ifox_hours']  for r in rows), 1),
        'month_check_hours':      round(sum(r['month_check_hours'] for r in rows), 1),
        'students':               rows,
    }
