"""
Signals for the maintenance app:
  1. When a CRS is issued, unlock the aircraft back to 'airworthy'
  2. When a grade is saved, recalculate student logbook totals
"""
import logging
from decimal import Decimal
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from .models import MaintenanceRecord, SortieGrade
from apps.scheduling.models import Flight

logger = logging.getLogger(__name__)

from apps.dispatch.models import SnagEntry

@receiver(post_save, sender=MaintenanceRecord)
def sync_aircraft_status_with_maintenance(sender, instance, **kwargs):
    aircraft = instance.aircraft
    
    if not instance.crs_issued and aircraft.status == "airworthy":
        # H9 Fix: Only ground aircraft if maintenance status indicates work has begun
        maintenance_status = getattr(instance, 'status', 'in_progress')
        if maintenance_status == 'in_progress':
            aircraft.status = "scheduled_maintenance"
            aircraft.save(update_fields=["status", "updated_at"])
            logger.info("Maintenance started: %s grounded (Pending CRS)", aircraft.tail_number)

    # EXISTING LOGIC: Unlock the aircraft when CRS is issued
    elif instance.crs_issued:
        if aircraft.status in ("aog", "scheduled_maintenance"):
            aircraft.status     = "airworthy"
            aircraft.aog_reason = None
            aircraft.aog_since  = None
            aircraft.save(update_fields=["status", "aog_reason", "aog_since", "updated_at"])
        
        # Only resolve snags explicitly linked to this maintenance record (C4 Fix)
        linked_snags = SnagEntry.objects.filter(
            maintenance_record=instance, resolved_at__isnull=True
        )
        for snag in linked_snags:
            snag.resolved_at = timezone.now()
            snag.resolved_by = instance.crs_issued_by
            snag.resolution_notes = f"Resolved via CRS Work Order: {instance.work_order_number or instance.description[:60]}"
            snag.save(update_fields=["resolved_at", "resolved_by", "resolution_notes", "updated_at"])

        # Update next maintenance thresholds from the record
        if instance.next_due_hours:
            mtype = instance.maintenance_type
            field_map = {
                "50hr":  "next_50hr_at",
                "100hr": "next_100hr_at",
                "200hr": "next_200hr_at",
                "600hr": "next_600hr_at",
            }
            field = field_map.get(mtype)
            if field:
                setattr(aircraft, field, instance.next_due_hours)
                aircraft.save(update_fields=[field, "updated_at"])
        if instance.next_due_date:
            if instance.maintenance_type == "annual":
                aircraft.next_annual_due = instance.next_due_date
                aircraft.save(update_fields=["next_annual_due", "updated_at"])
                
        logger.info("CRS issued: %s now airworthy", aircraft.tail_number)


def shift_p1_us_hours(flight, p2_user, duration, shift_direction="to_p1_us"):
    """
    Shifts hours between Dual and P1 U/S for p2_user.
    shift_direction: "to_p1_us" (pass) or "to_dual" (fail/revert)
    """
    is_xc = getattr(flight, 'is_cross_country', False)

    if shift_direction == "to_p1_us":
        p2_user.hours_dual -= duration
        p2_user.hours_pic += duration
        p2_user.hours_p1_us += duration
        if is_xc:
            p2_user.hours_cross_country_dual -= duration
            p2_user.hours_cross_country_pic += duration
    else:
        p2_user.hours_dual += duration
        p2_user.hours_pic -= duration
        p2_user.hours_p1_us -= duration
        if is_xc:
            p2_user.hours_cross_country_dual += duration
            p2_user.hours_cross_country_pic -= duration

    update_fields = ["hours_dual", "hours_pic", "hours_p1_us"]
    if is_xc:
        update_fields.extend(["hours_cross_country_dual", "hours_cross_country_pic"])
    
    p2_user.save(update_fields=update_fields)

@receiver(post_save, sender=SortieGrade)
def handle_sortie_grade_save(sender, instance, created, **kwargs):
    if not instance.flight or not instance.exercise or not instance.exercise.log_as_p1_us:
        return

    flight = instance.flight
    # P2 is either the student or a secondary instructor (e.g. for instructor rating tests)
    p2_user = flight.student if flight.student else getattr(flight, 'secondary_instructor', None)
    
    if not p2_user:
        return

    actual_duration = getattr(flight, 'actual_duration', flight.duration_minutes)
    if hasattr(flight, 'techlog_set') and flight.techlog_set.exists():
        actual_duration = flight.techlog_set.first().flight_duration_minutes

    actual_duration = Decimal(str(actual_duration / 60.0))

    if instance.passed and not flight.p1_us_credited:
        shift_p1_us_hours(flight, p2_user, actual_duration, "to_p1_us")
        flight.p1_us_credited = True
        flight.save(update_fields=["p1_us_credited"])
    
    elif not instance.passed and flight.p1_us_credited:
        shift_p1_us_hours(flight, p2_user, actual_duration, "to_dual")
        flight.p1_us_credited = False
        flight.save(update_fields=["p1_us_credited"])

@receiver(post_delete, sender=SortieGrade)
def handle_sortie_grade_delete(sender, instance, **kwargs):
    if not instance.flight or not instance.exercise or not instance.exercise.log_as_p1_us:
        return

    flight = instance.flight
    p2_user = flight.student if flight.student else getattr(flight, 'secondary_instructor', None)
    
    if not p2_user:
        return

    actual_duration = getattr(flight, 'actual_duration', flight.duration_minutes)
    if hasattr(flight, 'techlog_set') and flight.techlog_set.exists():
        actual_duration = flight.techlog_set.first().flight_duration_minutes
        
    actual_duration = Decimal(str(actual_duration / 60.0))

    if flight.p1_us_credited:
        shift_p1_us_hours(flight, p2_user, actual_duration, "to_dual")
        flight.p1_us_credited = False
        flight.save(update_fields=["p1_us_credited"])




