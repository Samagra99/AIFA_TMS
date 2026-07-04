"""
compliance/audit_tasks.py
---------------------------
Celery beat task: refresh_compliance_alerts

Runs nightly (and can be triggered on-demand) to scan the live operational
data for conditions that should surface as a ComplianceAlert on the DGCA
Audit dashboard. This is intentionally decoupled from AuditScoringEngine:
the scoring engine computes a live 0-100 number on every dashboard request,
while this task creates *persistent, actionable* alert rows that a CFI /
Safety Officer / CAMO head can acknowledge and resolve.

Wire into celery.py beat schedule:

    from celery.schedules import crontab

    CELERY_BEAT_SCHEDULE = {
        # ... existing tasks ...
        'refresh-compliance-alerts': {
            'task': 'compliance.audit_tasks.refresh_compliance_alerts',
            'schedule': crontab(hour=2, minute=0),   # 02:00 IST nightly
        },
    }

Can also be called manually:
    python manage.py shell -c "from compliance.audit_tasks import refresh_compliance_alerts; refresh_compliance_alerts()"
"""

import logging
from datetime import date, timedelta

from celery import shared_task
from django.db import transaction

from .audit_models import ComplianceAlert

log = logging.getLogger(__name__)

# Look-ahead windows for "expiring soon" warnings
MEDICAL_WARNING_DAYS = 30
SPL_WARNING_DAYS     = 30
RATING_WARNING_DAYS  = 45

# FDTL thresholds that trigger a warning before the hard limit is breached
FDTL_FLYING_WARNING_PCT = 90    # warn at 90% of monthly flying limit
FDTL_DUTY_WARNING_PCT   = 90


def _upsert_alert(*, severity, category, title, description,
                   entity_type='', entity_id=None, entity_name='',
                   due_date=None, dedupe_key=None):
    """
    Create a ComplianceAlert if an equivalent unresolved alert doesn't
    already exist (dedupe on entity_type + entity_id + category + title
    prefix, so re-running the task nightly doesn't spam duplicates).
    """
    existing = ComplianceAlert.objects.filter(
        is_resolved=False,
        category=category,
        entity_type=entity_type,
        entity_id=entity_id,
        title=title,
    ).first()
    if existing:
        return False   # already alerted, don't duplicate

    ComplianceAlert.objects.create(
        severity=severity, category=category, title=title,
        description=description, entity_type=entity_type,
        entity_id=entity_id, entity_name=entity_name, due_date=due_date,
    )
    return True


def _autoresolve_stale(category: str, entity_type: str, still_valid_ids: set, title_prefix: str = ''):
    """
    Auto-resolve alerts for entities that are no longer in violation
    (e.g. medical was renewed, AOG aircraft got its CRS).
    """
    qs = ComplianceAlert.objects.filter(
        is_resolved=False, category=category, entity_type=entity_type
    ).exclude(entity_id__in=still_valid_ids)
    count = qs.count()
    if count:
        for alert in qs:
            alert.is_resolved = True
            alert.save(update_fields=['is_resolved'])
    return count


@shared_task(name='compliance.audit_tasks.refresh_compliance_alerts')
def refresh_compliance_alerts():
    """Main entry point — run all alert-generating sub-scans."""
    today = date.today()
    created = 0
    created += _scan_student_medicals(today)
    created += _scan_instructor_medicals(today)
    created += _scan_instructor_ratings(today)
    created += _scan_spl_expiry(today)
    created += _scan_aog_aircraft(today)
    created += _scan_fdtl_thresholds(today)
    created += _scan_maintenance_overdue(today)
    log.info("refresh_compliance_alerts: created %d new alert(s)", created)
    return created


# ── Sub-scans ─────────────────────────────────────────────────────────────────

def _scan_student_medicals(today: date) -> int:
    """Class 2 medical expired or expiring within 30 days."""
    created = 0
    try:
        from users.models import StudentProfile
        warning_cutoff = today + timedelta(days=MEDICAL_WARNING_DAYS)

        active_violations = StudentProfile.objects.filter(
            user__is_active=True,
            enrollment_status='active',
            medical_expiry__lte=warning_cutoff,
        ).select_related('user')

        valid_ids = set()
        for sp in active_violations:
            valid_ids.add(sp.pk)
            expired = sp.medical_expiry < today
            sev   = 'critical' if expired else 'warning'
            title = (
                f"Medical expired: {sp.user.get_full_name()}"
                if expired else
                f"Medical expiring soon: {sp.user.get_full_name()}"
            )
            desc = (
                f"Class 2 medical certificate {'expired on' if expired else 'expires on'} "
                f"{sp.medical_expiry}. Student must be grounded from solo/dual flying "
                f"until renewed." if expired else
                f"Class 2 medical certificate expires on {sp.medical_expiry}. "
                f"Renew before this date to avoid training disruption."
            )
            if _upsert_alert(
                severity=sev, category='medical', title=title, description=desc,
                entity_type='student', entity_id=sp.pk,
                entity_name=sp.user.get_full_name(), due_date=sp.medical_expiry,
            ):
                created += 1

        resolved = _autoresolve_stale('medical', 'student', valid_ids)
        if resolved:
            log.info("Auto-resolved %d stale student medical alert(s)", resolved)
    except Exception:
        log.exception("_scan_student_medicals failed")
    return created


def _scan_instructor_medicals(today: date) -> int:
    """Class 1 medical expired or expiring within 30 days."""
    created = 0
    try:
        from users.models import InstructorProfile
        warning_cutoff = today + timedelta(days=MEDICAL_WARNING_DAYS)

        violations = InstructorProfile.objects.filter(
            user__is_active=True,
            medical_expiry__lte=warning_cutoff,
        ).select_related('user')

        valid_ids = set()
        for ip in violations:
            valid_ids.add(ip.pk)
            expired = ip.medical_expiry < today
            sev   = 'critical' if expired else 'warning'
            title = (
                f"Instructor medical expired: {ip.user.get_full_name()}"
                if expired else
                f"Instructor medical expiring: {ip.user.get_full_name()}"
            )
            desc = (
                f"Class 1 medical {'expired on' if expired else 'expires on'} "
                f"{ip.medical_expiry}. {'Instructor must be removed from roster immediately.' if expired else 'Renew before expiry to remain roster-eligible.'}"
            )
            if _upsert_alert(
                severity=sev, category='medical', title=title, description=desc,
                entity_type='instructor', entity_id=ip.pk,
                entity_name=ip.user.get_full_name(), due_date=ip.medical_expiry,
            ):
                created += 1

        resolved = _autoresolve_stale('medical', 'instructor', valid_ids)
        if resolved:
            log.info("Auto-resolved %d stale instructor medical alert(s)", resolved)
    except Exception:
        log.exception("_scan_instructor_medicals failed")
    return created


def _scan_instructor_ratings(today: date) -> int:
    """FIR / instructor rating expiring within 45 days."""
    created = 0
    try:
        from users.models import InstructorProfile
        warning_cutoff = today + timedelta(days=RATING_WARNING_DAYS)

        violations = InstructorProfile.objects.filter(
            user__is_active=True,
            fir_expiry__lte=warning_cutoff,
        ).select_related('user')

        valid_ids = set()
        for ip in violations:
            valid_ids.add(ip.pk)
            expired = ip.fir_expiry < today
            sev   = 'critical' if expired else 'warning'
            title = (
                f"FIR rating expired: {ip.user.get_full_name()}"
                if expired else
                f"FIR rating expiring: {ip.user.get_full_name()}"
            )
            desc = (
                f"Flight Instructor Rating {'expired on' if expired else 'expires on'} "
                f"{ip.fir_expiry}. {'Cannot conduct dual instruction until renewed.' if expired else ''}"
            )
            if _upsert_alert(
                severity=sev, category='fdtl', title=title, description=desc,
                entity_type='instructor', entity_id=ip.pk,
                entity_name=ip.user.get_full_name(), due_date=ip.fir_expiry,
            ):
                created += 1

        resolved = _autoresolve_stale('fdtl', 'instructor', valid_ids)
    except Exception:
        log.exception("_scan_instructor_ratings failed")
    return created


def _scan_spl_expiry(today: date) -> int:
    """SPL expired or expiring within 30 days."""
    created = 0
    try:
        from users.models import StudentProfile
        warning_cutoff = today + timedelta(days=SPL_WARNING_DAYS)

        violations = StudentProfile.objects.filter(
            user__is_active=True,
            enrollment_status='active',
            spl_issued=True,
            spl_expiry__lte=warning_cutoff,
        ).select_related('user')

        valid_ids = set()
        for sp in violations:
            valid_ids.add(sp.pk)
            expired = sp.spl_expiry < today
            sev   = 'critical' if expired else 'warning'
            title = (
                f"SPL expired: {sp.user.get_full_name()}"
                if expired else
                f"SPL expiring soon: {sp.user.get_full_name()}"
            )
            desc = (
                f"Student Pilot Licence {'expired on' if expired else 'expires on'} "
                f"{sp.spl_expiry}. {'Solo flying must cease until renewed.' if expired else ''}"
            )
            if _upsert_alert(
                severity=sev, category='spl', title=title, description=desc,
                entity_type='student', entity_id=sp.pk,
                entity_name=sp.user.get_full_name(), due_date=sp.spl_expiry,
            ):
                created += 1

        resolved = _autoresolve_stale('spl', 'student', valid_ids)
    except Exception:
        log.exception("_scan_spl_expiry failed")
    return created


def _scan_aog_aircraft(today: date) -> int:
    """Aircraft currently AOG without a recent CRS — critical alert."""
    created = 0
    try:
        from maintenance.models import Aircraft

        aog_aircraft = Aircraft.objects.filter(is_active=True, status='AOG')
        valid_ids = set()

        for ac in aog_aircraft:
            valid_ids.add(ac.pk)
            base_name = getattr(ac.current_base, 'name', '—') if hasattr(ac, 'current_base') else '—'
            if _upsert_alert(
                severity='critical', category='aircraft',
                title=f"AOG: {ac.registration}",
                description=(
                    f"{ac.registration} is grounded (AOG) at {base_name}. "
                    f"All future flights for this aircraft are cancelled until CAMO "
                    f"issues a CRS to restore airworthy status."
                ),
                entity_type='aircraft', entity_id=ac.pk,
                entity_name=ac.registration,
            ):
                created += 1

        resolved = _autoresolve_stale('aircraft', 'aircraft', valid_ids)
        if resolved:
            log.info("Auto-resolved %d stale AOG alert(s) — CRS issued", resolved)
    except Exception:
        log.exception("_scan_aog_aircraft failed")
    return created


def _scan_fdtl_thresholds(today: date) -> int:
    """
    Instructors approaching their monthly flying/duty FDTL limit
    (≥ 90% of CAR-FTL monthly cap) — early warning before hard breach.
    """
    created = 0
    try:
        from users.models import InstructorProfile
        from django.db.models import Sum, Q
        from calendar import monthrange
        try:
            from dispatch.models import FlightLog
        except ImportError:
            from scheduling.models import FlightLog

        from .report_generators import INSTRUCTOR_MONTHLY_FLYING_LIMIT

        month_start = today.replace(day=1)
        instructors = InstructorProfile.objects.filter(user__is_active=True).select_related('user')

        valid_ids = set()
        for ip in instructors:
            agg = FlightLog.objects.filter(
                instructor=ip.user,
                flight_date__gte=month_start,
                flight_date__lte=today,
                status='completed',
            ).aggregate(total=Sum('block_off_time_hours'))
            total = float(agg['total'] or 0)
            pct = (total / INSTRUCTOR_MONTHLY_FLYING_LIMIT * 100) if INSTRUCTOR_MONTHLY_FLYING_LIMIT else 0

            if pct >= FDTL_FLYING_WARNING_PCT:
                valid_ids.add(ip.pk)
                sev = 'critical' if pct >= 100 else 'warning'
                title = f"FDTL flying limit {'breached' if pct >= 100 else 'near limit'}: {ip.user.get_full_name()}"
                desc = (
                    f"{total:.1f} hr flown this month "
                    f"({pct:.0f}% of {INSTRUCTOR_MONTHLY_FLYING_LIMIT} hr CAR-FTL monthly cap). "
                    f"{'Must be rested immediately.' if pct >= 100 else 'Reduce roster load for remainder of month.'}"
                )
                if _upsert_alert(
                    severity=sev, category='fdtl', title=title, description=desc,
                    entity_type='instructor', entity_id=ip.pk,
                    entity_name=ip.user.get_full_name(),
                ):
                    created += 1

        resolved = _autoresolve_stale('fdtl', 'instructor', valid_ids)
    except Exception:
        log.exception("_scan_fdtl_thresholds failed")
    return created


def _scan_maintenance_overdue(today: date) -> int:
    """Scheduled maintenance tasks overdue → flag for CAMO."""
    created = 0
    try:
        from maintenance.models import MaintenanceTask

        overdue = MaintenanceTask.objects.filter(
            due_date__lt=today,
            status__in=['open', 'overdue'],
        ).select_related('aircraft')

        valid_ids = set()
        for task in overdue:
            valid_ids.add(task.pk)
            days_overdue = (today - task.due_date).days
            ac_reg = getattr(task.aircraft, 'registration', '—')
            if _upsert_alert(
                severity='critical' if days_overdue > 7 else 'warning',
                category='maintenance',
                title=f"Maintenance overdue: {ac_reg}",
                description=(
                    f"Scheduled task '{getattr(task, 'description', task)}' for {ac_reg} "
                    f"is {days_overdue} day(s) overdue (was due {task.due_date})."
                ),
                entity_type='maintenance_task', entity_id=task.pk,
                entity_name=ac_reg, due_date=task.due_date,
            ):
                created += 1

        resolved = _autoresolve_stale('maintenance', 'maintenance_task', valid_ids)
    except Exception:
        log.exception("_scan_maintenance_overdue failed")
    return created
