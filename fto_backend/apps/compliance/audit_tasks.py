"""
compliance/audit_tasks.py
---------------------------
Celery beat task: refresh_compliance_alerts

Rewritten against the ACTUAL Amravati FTO schema:
  Student            → apps.users.models  (medical_expiry, spl_expiry)
  Instructor          → apps.users.models  (cfi_expiry — there is no separate
                        "fir_expiry"; DGCA FIR currency for this FTO is
                        tracked via cfi_expiry, the CFI licence expiry date)
  Aircraft            → apps.infrastructure.models (tail_number, status='aog')
  MaintenanceRecord    → apps.maintenance.models (next_due_date, crs_issued)
  Flight               → apps.scheduling.models

Runs nightly (and can be triggered on-demand) to scan the live operational
data for conditions that should surface as a ComplianceAlert on the DGCA
Audit dashboard. This is intentionally decoupled from AuditScoringEngine:
the scoring engine computes a live 0-100 number on every dashboard request,
while this task creates *persistent, actionable* alert rows that a CFI /
Safety Officer / CAMO head can acknowledge and resolve.

Wire into config/settings/base.py CELERY_BEAT_SCHEDULE:

    from celery.schedules import crontab

    CELERY_BEAT_SCHEDULE = {
        # ... existing tasks (weather, FDTL reset, etc.) ...
        'refresh-compliance-alerts': {
            'task': 'apps.compliance.audit_tasks.refresh_compliance_alerts',
            'schedule': crontab(hour=2, minute=0),   # 02:00 IST nightly
        },
    }

Can also be called manually:
    docker compose exec api python manage.py shell -c \\
        "from apps.compliance.audit_tasks import refresh_compliance_alerts; refresh_compliance_alerts()"
"""

import logging
from datetime import date, timedelta

from celery import shared_task

from .audit_models import ComplianceAlert

log = logging.getLogger(__name__)

# Look-ahead windows for "expiring soon" warnings
MEDICAL_WARNING_DAYS = 30
SPL_WARNING_DAYS     = 30
RATING_WARNING_DAYS  = 45

# FDTL thresholds that trigger a warning before the hard limit is breached
FDTL_FLYING_WARNING_PCT = 90    # warn at 90% of monthly flying limit


def _upsert_alert(*, severity, category, title, description,
                   entity_type='', entity_id=None, entity_name='',
                   due_date=None):
    """
    Create a ComplianceAlert if an equivalent unresolved alert doesn't
    already exist (dedupe on entity_type + entity_id + category + title,
    so re-running the task nightly doesn't spam duplicates).
    """
    existing = ComplianceAlert.objects.filter(
        is_resolved=False,
        category=category,
        entity_type=entity_type,
        entity_id=entity_id,
        title=title,
    ).first()
    if existing:
        return False

    ComplianceAlert.objects.create(
        severity=severity, category=category, title=title,
        description=description, entity_type=entity_type,
        entity_id=entity_id, entity_name=entity_name, due_date=due_date,
    )
    return True


def _autoresolve_stale(category: str, entity_type: str, still_valid_ids: set):
    """
    Auto-resolve alerts for entities that are no longer in violation
    (e.g. medical was renewed, AOG aircraft got its CRS).
    """
    qs = ComplianceAlert.objects.filter(
        is_resolved=False, category=category, entity_type=entity_type
    ).exclude(entity_id__in=still_valid_ids)
    count = qs.count()
    if count:
        qs.update(is_resolved=True)
    return count


@shared_task(name='apps.compliance.audit_tasks.refresh_compliance_alerts')
def refresh_compliance_alerts():
    """Main entry point — run all alert-generating sub-scans."""
    today = date.today()
    created = 0
    created += _scan_student_medicals(today)
    created += _scan_instructor_ratings(today)
    created += _scan_spl_expiry(today)
    created += _scan_aog_aircraft(today)
    created += _scan_fdtl_thresholds(today)
    created += _scan_maintenance_overdue(today)
    log.info("refresh_compliance_alerts: created %d new alert(s)", created)
    return created


# ── Sub-scans ─────────────────────────────────────────────────────────────────

def _scan_student_medicals(today: date) -> int:
    """Student medical (Class 1/2) expired or expiring within 30 days."""
    created = 0
    try:
        from apps.users.models import Student
        warning_cutoff = today + timedelta(days=MEDICAL_WARNING_DAYS)

        active_violations = Student.objects.filter(
            user__is_active=True,
            medical_expiry__isnull=False,
            medical_expiry__lte=warning_cutoff,
        ).select_related('user')

        valid_ids = set()
        for s in active_violations:
            valid_ids.add(s.id)
            expired = s.medical_expiry < today
            sev = 'critical' if expired else 'warning'
            title = (
                f"Medical expired: {s.user.get_full_name()}"
                if expired else
                f"Medical expiring soon: {s.user.get_full_name()}"
            )
            desc = (
                f"Class {s.medical_class or '?'} medical certificate "
                f"{'expired on' if expired else 'expires on'} {s.medical_expiry}. "
                + ("Student must be grounded from solo/dual flying until renewed."
                   if expired else
                   "Renew before this date to avoid training disruption.")
            )
            if _upsert_alert(
                severity=sev, category='medical', title=title, description=desc,
                entity_type='student', entity_id=s.id,
                entity_name=s.user.get_full_name(), due_date=s.medical_expiry,
            ):
                created += 1

        resolved = _autoresolve_stale('medical', 'student', valid_ids)
        if resolved:
            log.info("Auto-resolved %d stale student medical alert(s)", resolved)
    except Exception:
        log.exception("_scan_student_medicals failed")
    return created


def _scan_instructor_ratings(today: date) -> int:
    """
    CFI licence / instructor rating expiring within 45 days.

    Note: this schema tracks instructor currency via Instructor.cfi_expiry
    only — there is no separate FIR (Flight Instructor Rating) expiry field.
    If your FTO needs to track FIR separately from the CFI licence, add a
    dedicated field to the Instructor model.
    """
    created = 0
    try:
        from apps.users.models import Instructor
        warning_cutoff = today + timedelta(days=RATING_WARNING_DAYS)

        violations = Instructor.objects.filter(
            user__is_active=True,
            cfi_expiry__isnull=False,
            cfi_expiry__lte=warning_cutoff,
        ).select_related('user')

        valid_ids = set()
        for instructor in violations:
            valid_ids.add(instructor.id)
            expired = instructor.cfi_expiry < today
            sev = 'critical' if expired else 'warning'
            title = (
                f"CFI licence expired: {instructor.user.get_full_name()}"
                if expired else
                f"CFI licence expiring: {instructor.user.get_full_name()}"
            )
            desc = (
                f"CFI/Instructor licence {'expired on' if expired else 'expires on'} "
                f"{instructor.cfi_expiry}. "
                + ("Cannot conduct dual instruction until renewed." if expired else "")
            )
            if _upsert_alert(
                severity=sev, category='fdtl', title=title, description=desc,
                entity_type='instructor', entity_id=instructor.id,
                entity_name=instructor.user.get_full_name(), due_date=instructor.cfi_expiry,
            ):
                created += 1

        _autoresolve_stale('fdtl', 'instructor', valid_ids)
    except Exception:
        log.exception("_scan_instructor_ratings failed")
    return created


def _scan_spl_expiry(today: date) -> int:
    """SPL expired or expiring within 30 days."""
    created = 0
    try:
        from apps.users.models import Student
        warning_cutoff = today + timedelta(days=SPL_WARNING_DAYS)

        violations = Student.objects.filter(
            user__is_active=True,
            spl_number__isnull=False,
            spl_expiry__isnull=False,
            spl_expiry__lte=warning_cutoff,
        ).exclude(spl_number='').select_related('user')

        valid_ids = set()
        for s in violations:
            valid_ids.add(s.id)
            expired = s.spl_expiry < today
            sev = 'critical' if expired else 'warning'
            title = (
                f"SPL expired: {s.user.get_full_name()}"
                if expired else
                f"SPL expiring soon: {s.user.get_full_name()}"
            )
            desc = (
                f"Student Pilot Licence {'expired on' if expired else 'expires on'} "
                f"{s.spl_expiry}. "
                + ("Solo flying must cease until renewed." if expired else "")
            )
            if _upsert_alert(
                severity=sev, category='spl', title=title, description=desc,
                entity_type='student', entity_id=s.id,
                entity_name=s.user.get_full_name(), due_date=s.spl_expiry,
            ):
                created += 1

        _autoresolve_stale('spl', 'student', valid_ids)
    except Exception:
        log.exception("_scan_spl_expiry failed")
    return created


def _scan_aog_aircraft(today: date) -> int:
    """Aircraft currently AOG — critical alert until CRS is issued."""
    created = 0
    try:
        from apps.infrastructure.models import Aircraft

        aog_aircraft = Aircraft.objects.filter(is_active=True, status='aog')
        valid_ids = set()

        for ac in aog_aircraft:
            valid_ids.add(ac.id)
            base_name = ac.current_base.name if ac.current_base else '—'
            if _upsert_alert(
                severity='critical', category='aircraft',
                title=f"AOG: {ac.tail_number}",
                description=(
                    f"{ac.tail_number} is grounded (AOG) at {base_name}. "
                    f"Reason: {ac.aog_reason or 'not recorded'}. "
                    f"All future flights for this aircraft are cancelled until CAMO "
                    f"issues a CRS to restore airworthy status."
                ),
                entity_type='aircraft', entity_id=ac.id,
                entity_name=ac.tail_number,
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
    Instructors approaching their monthly flying FDTL limit
    (≥ 90% of CAR-FTL monthly cap) — early warning before hard breach.

    Uses Flight (not a separate FlightLog model) with instructor as a FK to
    Instructor, and computes duration from scheduled_start/scheduled_end
    since Flight has no direct hours column.
    """
    created = 0
    try:
        from django.db.models import Sum, F, ExpressionWrapper, DurationField
        from apps.users.models import Instructor
        from apps.scheduling.models import Flight, FlightStatus
        from .report_generators import INSTRUCTOR_MONTHLY_FLYING_LIMIT

        month_start = today.replace(day=1)
        instructors = Instructor.objects.filter(user__is_active=True).select_related('user')

        valid_ids = set()
        for instructor in instructors:
            agg = Flight.objects.filter(
                instructor=instructor,
                scheduled_start__date__gte=month_start,
                scheduled_start__date__lte=today,
                status=FlightStatus.COMPLETED,
            ).annotate(
                duration=ExpressionWrapper(
                    F('scheduled_end') - F('scheduled_start'),
                    output_field=DurationField(),
                )
            ).aggregate(total=Sum('duration'))

            td = agg['total']
            total_hours = (td.total_seconds() / 3600.0) if td else 0.0
            pct = (total_hours / INSTRUCTOR_MONTHLY_FLYING_LIMIT * 100
                   if INSTRUCTOR_MONTHLY_FLYING_LIMIT else 0)

            if pct >= FDTL_FLYING_WARNING_PCT:
                valid_ids.add(instructor.id)
                sev = 'critical' if pct >= 100 else 'warning'
                title = (
                    f"FDTL flying limit {'breached' if pct >= 100 else 'near limit'}: "
                    f"{instructor.user.get_full_name()}"
                )
                desc = (
                    f"{total_hours:.1f} hr flown this month "
                    f"({pct:.0f}% of {INSTRUCTOR_MONTHLY_FLYING_LIMIT} hr CAR-FTL monthly cap). "
                    + ("Must be rested immediately." if pct >= 100
                       else "Reduce roster load for remainder of month.")
                )
                if _upsert_alert(
                    severity=sev, category='fdtl', title=title, description=desc,
                    entity_type='instructor', entity_id=instructor.id,
                    entity_name=instructor.user.get_full_name(),
                ):
                    created += 1

        _autoresolve_stale('fdtl', 'instructor', valid_ids)
    except Exception:
        log.exception("_scan_fdtl_thresholds failed")
    return created


def _scan_maintenance_overdue(today: date) -> int:
    """
    Scheduled maintenance overdue → flag for CAMO.

    Uses MaintenanceRecord.next_due_date (not a separate MaintenanceTask
    model). A record is "overdue" if next_due_date has passed and no later
    record for the same aircraft has crs_issued=True.
    """
    created = 0
    try:
        from apps.maintenance.models import MaintenanceRecord

        candidates = MaintenanceRecord.objects.filter(
            next_due_date__isnull=False,
            next_due_date__lt=today,
        ).select_related('aircraft')

        valid_ids = set()
        for rec in candidates:
            has_later_crs = MaintenanceRecord.objects.filter(
                aircraft=rec.aircraft,
                crs_issued=True,
                performed_at_date__gt=rec.performed_at_date,
            ).exists()
            if has_later_crs:
                continue  # already superseded — not actually overdue

            valid_ids.add(rec.id)
            days_overdue = (today - rec.next_due_date).days
            tail = rec.aircraft.tail_number
            if _upsert_alert(
                severity='critical' if days_overdue > 7 else 'warning',
                category='maintenance',
                title=f"Maintenance overdue: {tail}",
                description=(
                    f"Scheduled '{rec.maintenance_type}' for {tail} is "
                    f"{days_overdue} day(s) overdue (was due {rec.next_due_date})."
                ),
                entity_type='maintenance_record', entity_id=rec.id,
                entity_name=tail, due_date=rec.next_due_date,
            ):
                created += 1

        _autoresolve_stale('maintenance', 'maintenance_record', valid_ids)
    except Exception:
        log.exception("_scan_maintenance_overdue failed")
    return created