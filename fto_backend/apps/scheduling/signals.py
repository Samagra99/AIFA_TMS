from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.scheduling.models import Flight, FlightStatus
from apps.core.notifications import create_notification
from apps.core.models import NotificationCategory, NotificationSeverity

@receiver(post_save, sender=Flight)
def handle_flight_notifications(sender, instance: Flight, created, **kwargs):
    if created:
        # Notify student
        if instance.student and instance.student.user:
            create_notification(
                user=instance.student.user,
                title="New Flight Planned",
                message=f"A new flight ({instance.flight_type.replace('_',' ').title()}) on {instance.aircraft.tail_number} has been scheduled for {instance.scheduled_start:%d %b, %H:%M}.",
                category=NotificationCategory.FLIGHT_SCHEDULE,
                severity=NotificationSeverity.INFO,
                action_url="/scheduling"
            )
        # Notify primary instructor
        if instance.instructor and instance.instructor.user:
            create_notification(
                user=instance.instructor.user,
                title="New Flight Assigned",
                message=f"You are assigned as instructor for {instance.student.user.get_full_name() if instance.student else 'Solo'} on {instance.aircraft.tail_number} ({instance.scheduled_start:%d %b, %H:%M}).",
                category=NotificationCategory.FLIGHT_SCHEDULE,
                severity=NotificationSeverity.INFO,
                action_url="/scheduling"
            )
        # Notify secondary instructor
        if getattr(instance, 'secondary_instructor', None) and instance.secondary_instructor.user:
            create_notification(
                user=instance.secondary_instructor.user,
                title="New Flight Assigned",
                message=f"You are assigned as secondary instructor on {instance.aircraft.tail_number} ({instance.scheduled_start:%d %b, %H:%M}).",
                category=NotificationCategory.FLIGHT_SCHEDULE,
                severity=NotificationSeverity.INFO,
                action_url="/scheduling"
            )
    else:
        # Status change notifications
        if instance.status in [FlightStatus.DISPATCHED, FlightStatus.AIRBORNE, FlightStatus.CANCELLED, FlightStatus.ABORTED, FlightStatus.COMPLETED]:
            severity = NotificationSeverity.WARNING if instance.status in [FlightStatus.CANCELLED, FlightStatus.ABORTED] else NotificationSeverity.INFO
            msg = f"Flight on {instance.aircraft.tail_number} status changed to {instance.get_status_display()}."
            if instance.student and instance.student.user:
                create_notification(
                    user=instance.student.user,
                    title=f"Flight {instance.get_status_display()}",
                    message=msg,
                    category=NotificationCategory.FLIGHT_SCHEDULE,
                    severity=severity,
                    action_url="/scheduling"
                )
            if instance.instructor and instance.instructor.user:
                create_notification(
                    user=instance.instructor.user,
                    title=f"Flight {instance.get_status_display()}",
                    message=msg,
                    category=NotificationCategory.FLIGHT_SCHEDULE,
                    severity=severity,
                    action_url="/scheduling"
                )
            if getattr(instance, 'secondary_instructor', None) and instance.secondary_instructor.user:
                create_notification(
                    user=instance.secondary_instructor.user,
                    title=f"Flight {instance.get_status_display()}",
                    message=msg,
                    category=NotificationCategory.FLIGHT_SCHEDULE,
                    severity=severity,
                    action_url="/scheduling"
                )
