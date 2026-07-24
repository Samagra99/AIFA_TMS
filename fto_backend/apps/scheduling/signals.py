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

        # Logbook hours tracking upon flight completion
        if instance.status == FlightStatus.COMPLETED and instance.student:
            student = instance.student
            duration = (instance.scheduled_end - instance.scheduled_start).total_seconds() / 3600.0
            
            # Check if exercise is flagged as P1 U/S
            exercise = getattr(instance, 'exercise', None)
            is_p1_us = (exercise and exercise.log_as_p1_us) or (instance.flight_type == "dgca_flight_test")

            from decimal import Decimal
            dur_dec = Decimal(str(round(duration, 2)))

            student.hours_total += dur_dec

            if is_p1_us:
                student.hours_p1_us += dur_dec
                student.hours_solo += dur_dec
            elif instance.flight_type in ["solo", "cross_country_solo", "night_solo"]:
                student.hours_solo += dur_dec
            else:
                student.hours_dual += dur_dec

            if "cross_country" in instance.flight_type:
                student.hours_cross_country += dur_dec
            if "night" in instance.flight_type:
                student.hours_night += dur_dec
            if "instrument" in instance.flight_type:
                student.hours_instrument += dur_dec

            student.save(update_fields=[
                "hours_total", "hours_p1_us", "hours_solo", "hours_dual",
                "hours_cross_country", "hours_night", "hours_instrument", "updated_at"
            ])
