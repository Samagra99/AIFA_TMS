"""
Signals for the maintenance app:
  1. When a CRS is issued, unlock the aircraft back to 'airworthy'
  2. When a grade is saved, recalculate student logbook totals
"""
import logging
from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import MaintenanceRecord, SortieGrade

logger = logging.getLogger(__name__)

@receiver(post_save, sender=MaintenanceRecord)
def sync_aircraft_status_with_maintenance(sender, instance, **kwargs):
    aircraft = instance.aircraft
    
    # NEW LOGIC: Lock the aircraft if maintenance is ongoing (CRS pending)
    if not instance.crs_issued and aircraft.status == "airworthy":
        aircraft.status = "scheduled_maintenance" # or "aog", based on your preference
        aircraft.save(update_fields=["status", "updated_at"])
        logger.info("Maintenance started: %s grounded (Pending CRS)", aircraft.tail_number)

    # EXISTING LOGIC: Unlock the aircraft when CRS is issued
    elif instance.crs_issued and aircraft.status in ("aog", "scheduled_maintenance"):
        aircraft.status     = "airworthy"
        aircraft.aog_reason = None
        aircraft.aog_since  = None
        aircraft.save(update_fields=["status", "aog_reason", "aog_since", "updated_at"])
        
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

# @receiver(post_save, sender=MaintenanceRecord)
# def unlock_aircraft_on_crs(sender, instance, **kwargs):
#     if instance.crs_issued and instance.aircraft.status in ("aog", "scheduled_maintenance"):
#         aircraft = instance.aircraft
#         aircraft.status     = "airworthy"
#         aircraft.aog_reason = None
#         aircraft.aog_since  = None
#         aircraft.save(update_fields=["status", "aog_reason", "aog_since", "updated_at"])
#         # Update next maintenance thresholds from the record
#         if instance.next_due_hours:
#             mtype = instance.maintenance_type
#             field_map = {
#                 "50hr":  "next_50hr_at",
#                 "100hr": "next_100hr_at",
#                 "200hr": "next_200hr_at",
#                 "600hr": "next_600hr_at",
#             }
#             field = field_map.get(mtype)
#             if field:
#                 setattr(aircraft, field, instance.next_due_hours)
#                 aircraft.save(update_fields=[field, "updated_at"])
#         if instance.next_due_date:
#             if instance.maintenance_type == "annual":
#                 aircraft.next_annual_due = instance.next_due_date
#                 aircraft.save(update_fields=["next_annual_due", "updated_at"])
#         logger.info("CRS issued: %s now airworthy", aircraft.tail_number)


@receiver(post_save, sender=SortieGrade)
def update_student_logbook(sender, instance, created, **kwargs):
    if not created:
        return
    flight = instance.flight
    try:
        tech_log = flight.tech_log
        duration_hrs = Decimal(str(tech_log.flight_duration_minutes or 0)) / Decimal("60")
    except Exception:
        return

    ft = flight.flight_type
    student = instance.student
    student.hours_total += duration_hrs
    if ft in ("solo", "cross_country_solo", "night_solo"):
        student.hours_pic  += duration_hrs
        student.hours_solo += duration_hrs
    elif ft in ("dual", "cross_country_dual", "night_dual", "instrument"):
        student.hours_dual += duration_hrs
    if "cross_country" in ft:
        student.hours_cross_country += duration_hrs
    if "night" in ft:
        student.hours_night += duration_hrs
    if ft == "instrument":
        student.hours_instrument += duration_hrs
    student.save(update_fields=[
        "hours_total","hours_pic","hours_dual","hours_solo",
        "hours_cross_country","hours_night","hours_instrument","updated_at"
    ])
    logger.info("Logbook updated for %s (+%.1fh %s)", student.user.get_full_name(), duration_hrs, ft)
