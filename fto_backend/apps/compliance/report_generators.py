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


def _f(val) -> float:
    """Safely convert Decimal / timedelta / None to float."""
    if val is None:
        return 0.0
        
    # If Django returned a DurationField aggregate (timedelta)
    if isinstance(val, datetime.timedelta):
        return val.total_seconds() / 3600.0  # Convert to hours
        
    # For Decimals, ints, floats, or numeric strings
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


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

    from ..users.models import Student   # ← adjust if different path

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
    for sp in qs:
        students.append({
            'student_id':       sp.pk,
            'name':             sp.user.get_full_name(),
            'batch_no':    getattr(sp, 'batch_number', '—'),
            'spl_number':       getattr(sp, 'spl_number', '—'),
            'spl_issued_date':  str(sp.spl_issue_date),
            'spl_expiry':       str(sp.spl_expiry) if sp.spl_expiry else '—',
            # 'instructor':       (
            #     sp.assigned_instructor.get_full_name()
            #     if sp.assigned_instructor else '—'
            # ),
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
    from ..infrastructure.models import Aircraft   # ← adjust
    try:
        from ..scheduling.models import Flight  # ← adjust
    except ImportError:
        from ..dispatch.models import FlightLog  # fallback

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
            .annotate(
                # Calculate the exact time difference for each flight
                duration=ExpressionWrapper(
                    F('scheduled_end') - F('scheduled_start'), 
                    output_field=DurationField()
                )
            )
            .aggregate(
                hours=Sum('duration'),   # ← adjust field name
                flights=Count('id'),
            )
        )
        
        td = agg['hours']
        actual = (td.total_seconds() / 3600.0) if td else 0.0

        flights = int(agg['flights'] or 0)
        util    = round(actual / available_per_aircraft * 100, 1) if available_per_aircraft else 0

        total_available += available_per_aircraft
        total_flown     += actual
        total_flights   += flights

        rows.append({
            'aircraft_id':      ac.pk,
            'registration':     ac.tail_number,
            'aircraft_type':    (
                ac.aircraft_type.make_model
                if getattr(ac, 'aircraft_type', None)
                else '-'
            ),
            'base':             (
                ac.current_base.name
                if getattr(ac, 'current_base', None)
                else '—'
            ),
            'status':           getattr(ac, 'status', '—'),
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
      dual_hours      – flying as P2/instructor on DUAL sorties
      check_hours     – flying on CHECK sorties
      total_flying    – dual + check
      duty_hours      – from FDTL / InstructorDutyRecord
      fdtl_pct        – duty_hours / INSTRUCTOR_MONTHLY_DUTY_LIMIT × 100
      active_students – students permanently assigned

    Assumes FlightLog has:
      instructor       ForeignKey → CustomUser
      flight_type      CharField  ('DUAL' | 'SOLO' | 'CHECK' | 'IFOX')
    """
    from ..users.models import Instructor, Student   # ← adjust
    try:
        from ..scheduling.models import Flight
    except ImportError:
        from ..dispatch.models import Flight

    start, end = _month_range(year, month)

    instructors = (
        Instructor.objects
        .filter(user__is_active=True)
        .select_related('user')
        .order_by('user__last_name', 'user__first_name')
    )

    rows = []
    for ip in instructors:
        user = ip.user

        # Flying hours from dispatch / scheduling
        fly_agg = (
            Flight.objects
            .filter(
                instructor=user,
                scheduled_start__date__gte=start,
                scheduled_start__date__lte=end,
                status='completed'
            )
            .annotate(
                # Calculate the exact time difference for each flight
                duration=ExpressionWrapper(
                    F('scheduled_end') - F('scheduled_start'), 
                    output_field=DurationField()
                )
            )
            .aggregate(
                dual_hours  = Sum('duration',
                                  filter=Q(flight_type='DUAL')),
                check_hours = Sum('duration',
                                  filter=Q(flight_type='CHECK')),
                solo_hours  = Sum('duration',
                                  filter=Q(flight_type='SOLO')),
                total_flights = Count('id'),
            )
        )
        dual   = _f(fly_agg['dual_hours'])
        check  = _f(fly_agg['check_hours'])
        solo   = _f(fly_agg['solo_hours'])
        total_flying = dual + check + solo

        # FDTL / duty records
        duty_hours = 0.0
        try:
            from ..scheduling.models import InstructorDutyLog    # ← adjust
            duty_agg = (
                InstructorDutyLog.objects
                .filter(
                    instructor=user,
                    duty_start__date__gte=start,
                    duty_start__date__lte=end
                )
                .aggregate(total_duty=Sum('total_duty_minutes'))   # ← adjust field
            )
            total_minutes = duty_agg['total_duty']
            
            # Convert minutes to decimal hours (e.g. 90 mins -> 1.5 hrs)
            if total_minutes:
                duty_hours = round(total_minutes / 60.0, 1)
        except Exception:
            pass   # FDTL module not wired – gracefully omit

        fdtl_flying_pct = round(total_flying / INSTRUCTOR_MONTHLY_FLYING_LIMIT * 100, 1)
        fdtl_duty_pct   = round(duty_hours   / INSTRUCTOR_MONTHLY_DUTY_LIMIT   * 100, 1)

        # active_students = (
        #     Student.objects
        #     .filter(assigned_instructor=user, enrollment_status='active')
        #     .count()
        # )

        rows.append({
            'instructor_id':     ip.pk,
            'name':              user.get_full_name(),
            # 'employee_id':       getattr(ip, 'employee_id', '—'),
            # 'rating':            getattr(ip, 'rating', '—'),
            'dual_hours':        round(dual,         1),
            'check_hours':       round(check,        1),
            'solo_hours':        round(solo,         1),
            'total_flying_hrs':  round(total_flying, 1),
            'duty_hours':        round(duty_hours,   1),
            'fdtl_flying_pct':   fdtl_flying_pct,
            'fdtl_duty_pct':     fdtl_duty_pct,
            # 'active_students':   active_students,
            'total_flights':     int(fly_agg['total_flights'] or 0),
        })

    return {
        'report_type':             'instructor_utilization',
        'year':                    year,
        'month':                   month,
        'total_instructors':       len(rows),
        'total_flying_hours':      round(sum(r['total_flying_hrs'] for r in rows), 1),
        'total_dual_hours':        round(sum(r['dual_hours']        for r in rows), 1),
        'total_check_hours':       round(sum(r['check_hours']       for r in rows), 1),
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
    from ..users.models import Student   # ← adjust
    try:
        from ..scheduling.models import Flight, FlightType, FlightStatus
    except ImportError:
        from ..scheduling.models import FlightLog

    start, end = _month_range(year, month)

    students = (
        Student.objects
        .filter( user__is_active=True)
        .select_related('user')
        .order_by('user__last_name', 'user__first_name')
    )

    def _td_to_hours(td):
        return (td.total_seconds() / 3600.0) if td else 0.0

    rows = []
    for sp in students:
        user = sp.user

        month_agg = (
            Flight.objects
            .filter(
                student=sp,
                scheduled_start__date__gte=start,
                scheduled_start__date__lte=end,
                status=FlightStatus.COMPLETED
            )
            .annotate(
                duration=ExpressionWrapper(
                    F('scheduled_end') - F('scheduled_start'),
                    output_field=DurationField()
                )
            )
            .aggregate(
                dual=Sum('duration', filter=Q(flight_type__in=[
                    FlightType.DUAL, FlightType.CROSS_COUNTRY_DUAL, FlightType.NIGHT_DUAL, FlightType.INSTRUMENT
                ])),
                solo=Sum('duration', filter=Q(flight_type__in=[
                    FlightType.SOLO, FlightType.CROSS_COUNTRY_SOLO, FlightType.NIGHT_SOLO, FlightType.PROFICIENCY_CHECK, FlightType.PROGRESS_CHECK
                ])),
                check=Sum('duration', filter=Q(flight_type__in=[
                    FlightType.PROFICIENCY_CHECK
                ])),
                flights=Count('id'),
            )
        )
        dual  = _f(month_agg['dual'])
        solo  = _f(month_agg['solo'])
        # ifox  = _f(month_agg['ifox'])
        check = _f(month_agg['check'])
        month_total = dual + solo

        # Cumulative (all time up to end of report month)
        cum_agg = (
            Flight.objects
            .filter(
                student=sp,
                scheduled_start__date__lte=end,
                status=FlightStatus.COMPLETED
            )
            .annotate(
                duration=ExpressionWrapper(
                    F('scheduled_end') - F('scheduled_start'),
                    output_field=DurationField()
                )
            )
            .aggregate(total=Sum('duration'))
        )
        cumulative = _td_to_hours(cum_agg['total'])

        course_type     = getattr(sp, 'course_type', 'CPL')
        required_hours  = COURSE_REQUIRED_HOURS.get(course_type, DEFAULT_COURSE_HOURS)
        # Also respect per-student override if stored on the model
        required_hours  = globals().get('COURSE_REQUIRED_HOURS', {}).get(course_type, 200)
        required_hours  = getattr(sp, 'course_required_hours', required_hours)
        progress_pct    = round(min(cumulative / required_hours * 100, 100), 1) if required_hours else 0

        rows.append({
            'student_id':           sp.pk,
            'name':                 user.get_full_name(),
            # 'enrollment_no':        getattr(sp, 'enrollment_number', '—'),
            'course_type':          course_type,
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
