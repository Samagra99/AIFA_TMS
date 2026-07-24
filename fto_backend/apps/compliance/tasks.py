import datetime
from celery import shared_task
from django.utils import timezone
from .audit_tasks import refresh_compliance_alerts
from apps.users.models import Student, Instructor
from apps.infrastructure.models import Aircraft
from apps.core.notifications import create_notification
from apps.core.models import NotificationCategory, NotificationSeverity

@shared_task
def scan_compliance_and_fdtl_expiries():
    today = timezone.now().date()

    # 1. Student Medical & SPL Expiries
    for s in Student.objects.select_related("user").all():
        if not s.user:
            continue
        if s.medical_expiry:
            days_left = (s.medical_expiry - today).days
            if days_left <= 0:
                create_notification(
                    user=s.user,
                    title="Medical Certificate Expired!",
                    message="Your Medical Certificate has expired. Flying activities are suspended until renewed.",
                    category=NotificationCategory.LICENSE_EXPIRY,
                    severity=NotificationSeverity.CRITICAL,
                    action_url="/students"
                )
            elif days_left <= 7:
                create_notification(
                    user=s.user,
                    title="Medical Certificate Expiring Soon",
                    message=f"Your Medical Certificate expires in {days_left} days ({s.medical_expiry:%d %b %Y}). Please schedule renewal.",
                    category=NotificationCategory.LICENSE_EXPIRY,
                    severity=NotificationSeverity.WARNING,
                    action_url="/students"
                )

        if s.spl_expiry:
            days_left = (s.spl_expiry - today).days
            if days_left <= 0:
                create_notification(
                    user=s.user,
                    title="Student Pilot Licence (SPL) Expired!",
                    message="Your SPL has expired. Please submit renewal documents to Flight Ops.",
                    category=NotificationCategory.LICENSE_EXPIRY,
                    severity=NotificationSeverity.CRITICAL,
                    action_url="/students"
                )
            elif days_left <= 7:
                create_notification(
                    user=s.user,
                    title="SPL Expiring Soon",
                    message=f"Your Student Pilot Licence expires in {days_left} days ({s.spl_expiry:%d %b %Y}).",
                    category=NotificationCategory.LICENSE_EXPIRY,
                    severity=NotificationSeverity.WARNING,
                    action_url="/students"
                )

    # 2. Instructor CFI Expiries & Low FDTL Margins
    for i in Instructor.objects.select_related("user").all():
        if not i.user:
            continue
        if i.cfi_expiry:
            days_left = (i.cfi_expiry - today).days
            if days_left <= 0:
                create_notification(
                    user=i.user,
                    title="CFI License Expired!",
                    message="Your CFI License has expired. Flight instructional privileges are suspended.",
                    category=NotificationCategory.LICENSE_EXPIRY,
                    severity=NotificationSeverity.CRITICAL,
                    action_url="/instructors"
                )
            elif days_left <= 7:
                create_notification(
                    user=i.user,
                    title="CFI License Expiring Soon",
                    message=f"Your CFI license expires in {days_left} days ({i.cfi_expiry:%d %b %Y}).",
                    category=NotificationCategory.LICENSE_EXPIRY,
                    severity=NotificationSeverity.WARNING,
                    action_url="/instructors"
                )

        if i.fdtl_daily_remaining_min < 60:
            create_notification(
                user=i.user,
                title="Approaching Daily FDTL Limit",
                message=f"Only {i.fdtl_daily_remaining_min} minutes remaining in your daily FDTL allowance.",
                category=NotificationCategory.FDTL,
                severity=NotificationSeverity.WARNING,
                action_url="/instructors"
            )

    # 3. Aircraft Maintenance & Inspection Due (< 5 Hobbs Hours Remaining)
    for ac in Aircraft.objects.select_related("current_base").all():
        rem_50 = (ac.next_50hr_at - ac.hobbs_total) if ac.next_50hr_at else 999
        rem_100 = (ac.next_100hr_at - ac.hobbs_total) if ac.next_100hr_at else 999
        min_rem = min(rem_50, rem_100)

        if min_rem <= 5.0 and ac.status == "airworthy":
            create_notification(
                target_role="camo",
                title=f"Aircraft Inspection Due: {ac.tail_number}",
                message=f"Aircraft {ac.tail_number} has only {min_rem:.1f} Hobbs hours remaining before mandatory inspection threshold.",
                category=NotificationCategory.AIRCRAFT_MAINT,
                severity=NotificationSeverity.WARNING,
                action_url="/maintenance"
            )

    return "Compliance and FDTL scan complete."