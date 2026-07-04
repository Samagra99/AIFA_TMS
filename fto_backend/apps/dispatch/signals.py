"""
AOG Cascade Signal
==================
When a No-Go SnagEntry is saved, this signal:
  1. Sets aircraft.status = AOG
  2. Cancels all future scheduled/confirmed flights for that aircraft
  3. Broadcasts an AOG alert via Django Channels to all connected dispatchers
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import SnagEntry, SnagCategory

logger = logging.getLogger(__name__)


@receiver(post_save, sender=SnagEntry)
def aog_cascade(sender, instance, created, **kwargs):
    if not created or instance.category != SnagCategory.NO_GO:
        return

    aircraft = instance.aircraft
    logger.warning("AOG CASCADE: %s — %s", aircraft.tail_number, instance.description)

    # 1. Ground the aircraft
    aircraft.status     = "aog"
    aircraft.aog_reason = instance.description
    aircraft.aog_since  = timezone.now()
    aircraft.save(update_fields=["status", "aog_reason", "aog_since", "updated_at"])

    # 2. Cancel all future flights for this aircraft
    from apps.scheduling.models import Flight, FlightStatus
    cancelled_qs = Flight.objects.filter(
        aircraft=aircraft,
        status__in=[FlightStatus.SCHEDULED, FlightStatus.CONFIRMED],
        scheduled_start__gt=timezone.now(),
    )
    
    affected_ids = list(cancelled_qs.values_list("id", flat=True))
    affected_strs = [str(fid) for fid in affected_ids]
    cancelled_count = cancelled_qs.update(
        status=FlightStatus.CANCELLED,
        cancelled_at=timezone.now(),
        cancellation_reason=f"Aircraft AOG — {instance.description}",
    )
    logger.info("AOG: Cancelled %d future flights for %s", cancelled_count, aircraft.tail_number)

    # 3. Real-time broadcast via WebSocket
    try:
        channel_layer = get_channel_layer()
        web_payload = {
            "type": "fleet_update",
            "data": {
                "event":              "aog",
                "aircraft_id":        str(aircraft.id),
                "tail_number":        aircraft.tail_number,
                "reason":             instance.description,
                "timestamp":          timezone.now().isoformat(),
                "flights_cancelled":  cancelled_count,
            },
        }
        async_to_sync(channel_layer.group_send)("fleet_status", web_payload)


        # Also send to the base-specific channel
        async_to_sync(channel_layer.group_send)(
            f"base_{aircraft.current_base_id}",
            {
                "type": "base_update",
                "data": web_payload["data"],
            },
        )

        # ── Tablet app format (new) ───────────────────────────────────────────
        # type must match what DispatchConsumer.aog_alert() expects
        tablet_payload = {
            "type":                  "aog.alert",   # Channels routes on dots
            "aircraft_registration": aircraft.tail_number,
            "snag_description":      instance.description,
            "affected_flight_ids":   affected_strs,
            "created_at":            timezone.now().isoformat(),
            "aircraft_id":           str(aircraft.id),
            "base_id":               str(aircraft.current_base_id),
        }
        
        async_to_sync(channel_layer.group_send)("dispatch", tablet_payload)
        async_to_sync(channel_layer.group_send)(
            f"dispatch_base_{aircraft.current_base_id}", tablet_payload
        )

        logger.info("AOG WebSocket broadcast sent to fleet_status + dispatch groups")
        
    except Exception as exc:
        logger.error("AOG WebSocket broadcast failed: %s", exc)
