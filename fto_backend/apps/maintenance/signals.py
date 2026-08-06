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

    # Handle hours for all participants: Student, P1 Instructor, P2 Instructor/Observer
    day_hrs = getattr(flight, 'day_hours', Decimal("0.0"))
    night_hrs = getattr(flight, 'night_hours', Decimal("0.0"))
    # fallback if day_hours/night_hours are 0 but duration > 0
    if day_hrs == 0 and night_hrs == 0:
        day_hrs = duration_hrs

    is_me = False
    if flight.aircraft and getattr(flight.aircraft, 'aircraft_type_detail', None):
        if getattr(flight.aircraft.aircraft_type_detail, 'is_multi_engine', False):
            is_me = True

    # P1 Updates
    if flight.instructor and not getattr(flight, 'is_external_p1', False):
        p1 = flight.instructor
        p1.hours_total += duration_hrs
        p1.hours_pic += duration_hrs
        if getattr(flight, 'is_instructional', False):
            p1.hours_instructional += duration_hrs
        
        p1.hours_day += day_hrs
        p1.hours_night += night_hrs

        if getattr(flight, 'is_cross_country', False):
            p1.hours_cross_country_pic += duration_hrs
            
        if getattr(flight, 'is_instrument_simulated', False):
            p1.hours_instrument_simulated += duration_hrs
        if getattr(flight, 'is_instrument_actual', False):
            p1.hours_instrument_actual += duration_hrs
        if getattr(flight, 'is_simulator', False):
            p1.hours_fstd += duration_hrs
        if is_me:
            p1.hours_multi_engine += duration_hrs

        p1.save(update_fields=[
            "hours_total", "hours_pic", "hours_instructional", "hours_day", "hours_night",
            "hours_cross_country_pic", "hours_instrument_simulated", "hours_instrument_actual",
            "hours_fstd", "hours_multi_engine", "updated_at"
        ])
        logger.info("Instructor logbook updated for %s (+%.1fh)", p1.user.get_full_name(), duration_hrs)

    # P2 Updates (Student or Secondary Instructor)
    p2_user = None
    if flight.student:
        p2_user = flight.student
    elif getattr(flight, 'secondary_instructor', None):
        p2_user = flight.secondary_instructor

    if p2_user:
        is_p1_us = False
        if getattr(flight, 'is_skill_test', False):
            pass_grade = getattr(flight.exercise, 'pass_grade', 3) if hasattr(flight, 'exercise') and flight.exercise else 3
            grade_val = getattr(instance, 'grade', 0)
            log_p1_us_flag = getattr(flight.exercise, 'log_as_p1_us', False) if hasattr(flight, 'exercise') and flight.exercise else False
            if log_p1_us_flag and grade_val >= pass_grade:
                is_p1_us = True

        p2_user.hours_total += duration_hrs
        p2_user.hours_day += day_hrs
        p2_user.hours_night += night_hrs

        if flight.flight_type == "solo":
            p2_user.hours_pic += duration_hrs
            p2_user.hours_solo += duration_hrs
            if getattr(flight, 'is_cross_country', False):
                p2_user.hours_cross_country_pic += duration_hrs
        else:
            if is_p1_us:
                p2_user.hours_p1_us += duration_hrs
                p2_user.hours_pic += duration_hrs
                if getattr(flight, 'is_cross_country', False):
                    p2_user.hours_cross_country_pic += duration_hrs
            else:
                p2_user.hours_dual += duration_hrs
                if getattr(flight, 'is_cross_country', False):
                    p2_user.hours_cross_country_dual += duration_hrs

        if getattr(flight, 'is_instrument_simulated', False):
            p2_user.hours_instrument_simulated += duration_hrs
        if getattr(flight, 'is_instrument_actual', False):
            p2_user.hours_instrument_actual += duration_hrs
        if getattr(flight, 'is_simulator', False):
            p2_user.hours_fstd += duration_hrs
        if is_me:
            p2_user.hours_multi_engine += duration_hrs
        
        p2_update_fields = [
            "hours_total", "hours_pic", "hours_dual", "hours_solo", "hours_p1_us",
            "hours_day", "hours_night", "hours_cross_country_dual", "hours_cross_country_pic",
            "hours_instrument_simulated", "hours_instrument_actual", "hours_fstd", "hours_multi_engine",
            "updated_at"
        ]
        p2_user.save(update_fields=p2_update_fields)
        logger.info("Trainee logbook updated (+%.1fh)", duration_hrs)
