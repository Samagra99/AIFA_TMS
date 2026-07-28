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
    elif instance.crs_issued:
        if aircraft.status in ("aog", "scheduled_maintenance"):
            aircraft.status     = "airworthy"
            aircraft.aog_reason = None
            aircraft.aog_since  = None
            aircraft.save(update_fields=["status", "aog_reason", "aog_since", "updated_at"])
        
        # Also resolve open snags for this aircraft when CRS is issued
        from apps.dispatch.models import SnagEntry
        open_snags = SnagEntry.objects.filter(aircraft=aircraft, resolved_at__isnull=True)
        for snag in open_snags:
            snag.resolved_at = timezone.now()
            snag.resolved_by = instance.crs_issued_by
            snag.resolution_notes = f"Resolved via CRS Work Order: {instance.work_order_number or instance.description[:60]}"
            snag.maintenance_record = instance
            snag.save(update_fields=["resolved_at", "resolved_by", "resolution_notes", "maintenance_record", "updated_at"])

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
    if not created or not instance.student:
        return
    flight = instance.flight
    if not flight:
        return
    try:
        tech_log = flight.tech_log
        duration_hrs = Decimal(str(tech_log.flight_duration_minutes or 0)) / Decimal("60")
    except Exception:
        return

    if duration_hrs <= 0:
        return

    exercise = getattr(flight, 'exercise', None) or getattr(instance, 'exercise', None)
    is_p1_us = bool((exercise and getattr(exercise, 'log_as_p1_us', False)) or (flight.flight_type == "dgca_flight_test"))

    ft = flight.flight_type
    student = instance.student
    student.hours_total += duration_hrs

    if is_p1_us:
        student.hours_p1_us += duration_hrs
        student.hours_pic   += duration_hrs
        student.hours_solo  += duration_hrs
    elif ft in ("solo", "cross_country_solo", "night_solo"):
        student.hours_pic   += duration_hrs
        student.hours_solo  += duration_hrs
    else:
        student.hours_dual  += duration_hrs

    if "cross_country" in ft:
        student.hours_cross_country += duration_hrs
    if "night" in ft:
        student.hours_night += duration_hrs
    if "instrument" in ft or ft == "fstd_instrument":
        student.hours_instrument += duration_hrs

    is_me = False
    if flight.aircraft:
        type_detail = getattr(flight.aircraft, 'aircraft_type_detail', None)
        if type_detail and getattr(type_detail, 'is_multi_engine', False):
            is_me = True
    if ft == "dual_multi_engine" or is_me:
        if hasattr(student, 'hours_multi_engine'):
            student.hours_multi_engine += duration_hrs

    update_fields = [
        "hours_total", "hours_pic", "hours_p1_us", "hours_dual", "hours_solo",
        "hours_cross_country", "hours_night", "hours_instrument", "updated_at"
    ]
    if hasattr(student, 'hours_multi_engine'):
        update_fields.append("hours_multi_engine")

    student.save(update_fields=update_fields)
    logger.info("Logbook updated for %s (+%.1fh %s)", student.user.get_full_name(), duration_hrs, ft)

    # Update instructor totals as Solo / PIC and Instructional
    if flight.instructor:
        instructor = flight.instructor
        instructor.previous_hours_total += duration_hrs
        instructor.previous_hours_pic += duration_hrs
        instructor.previous_hours_instructional += duration_hrs
        if is_me:
            instructor.hours_multi_engine += duration_hrs
        instructor.save(update_fields=["previous_hours_total", "previous_hours_pic", "previous_hours_instructional", "hours_multi_engine", "updated_at"])
        logger.info("Instructor logbook updated for %s (+%.1fh PIC/Instructional)", instructor.user.get_full_name(), duration_hrs)
