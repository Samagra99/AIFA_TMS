"""
Sync endpoint for the React Native tablet dispatch app.
Provides a single pull endpoint that returns all data the tablet needs
for offline-capable operation.
"""
import time
import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from apps.scheduling.models import Flight
from apps.infrastructure.models import Aircraft
from apps.dispatch.models import SnagEntry, SnagCategory, TechLog
from apps.weather.models import WeatherCache
from .sync_serializers import (
    FlightSyncSerializer, AircraftSyncSerializer, AlertSyncSerializer
)

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sync_pull(request):
    """
    Tablet app calls: GET /api/v1/dispatch/sync/pull/?since=<unix_ms>

    Returns everything the tablet needs for today (+ tomorrow for pre-dawn
    dispatch) in a single JSON payload. Filtered by the user's home base
    if they have one set.

    The `since` param allows incremental syncs after the first full pull.
    If since=0 or absent → return all records for today/tomorrow.
    """
    since_ms = int(request.query_params.get("since", 0))
    since_dt = (
        timezone.datetime.fromtimestamp(since_ms / 1000, tz=timezone.utc)
        if since_ms > 0 else None
    )

    today    = timezone.now().date()
    tomorrow = today + timedelta(days=1)
    user     = request.user

    # Base filter — restrict to user's home base if set
    base_filter = {}
    if user.home_base_id and user.role not in ("superadmin", "cfi", "dispatcher"):
        base_filter["base_id"] = user.home_base_id

    # ── Flights: today + tomorrow (dispatcher needs to pre-clear dawn flights) ──
    flights_qs = Flight.objects.filter(
        scheduled_start__date__gte=today,
        scheduled_start__date__lte=tomorrow,
        **base_filter,
    ).exclude(
        status="cancelled"
    ).select_related(
        "aircraft__aircraft_type",
        "aircraft__current_base",
        "instructor__user",
        "student__user",
    ).prefetch_related("exercises__exercise")

    if since_dt:
        flights_qs = flights_qs.filter(updated_at__gte=since_dt)

    # ── Aircraft: all airworthy + AOG (tablet needs to show AOG too) ──────────
    aircraft_qs = Aircraft.objects.filter(
        is_active=True,
        **({k.replace("base_id", "current_base_id"): v for k, v in base_filter.items()})
    ).select_related("aircraft_type", "current_base")

    if since_dt:
        aircraft_qs = aircraft_qs.filter(updated_at__gte=since_dt)

    # ── Alerts: unresolved No-Go snags (= AOG triggers) ──────────────────────
    alerts_qs = SnagEntry.objects.filter(
        category=SnagCategory.NO_GO,
        resolved_at__isnull=True,
    ).select_related("aircraft__current_base")

    if base_filter:
        alerts_qs = alerts_qs.filter(aircraft__current_base_id=user.home_base_id)

    if since_dt:
        alerts_qs = alerts_qs.filter(reported_at__gte=since_dt)

    # ── Weather: latest METAR for each relevant base ──────────────────────────
    weather_data = {}
    if user.home_base_id:
        base_icao_qs = Aircraft.objects.filter(
            current_base_id=user.home_base_id
        ).values_list("current_base__icao_code", flat=True).distinct()
    else:
        base_icao_qs = Aircraft.objects.values_list(
            "current_base__icao_code", flat=True
        ).distinct()

    for icao in base_icao_qs:
        if icao:
            wx = WeatherCache.latest_for(icao)
            if wx:
                weather_data[icao] = {
                    "icao_code":          wx.icao_code,
                    "metar_raw":          wx.metar_raw,
                    "wind_direction_deg": wx.wind_direction_deg,
                    "wind_speed_kt":      wx.wind_speed_kt,
                    "wind_gust_kt":       wx.wind_gust_kt,
                    "visibility_m":       wx.visibility_m,
                    "temp_celsius":       str(wx.temp_celsius) if wx.temp_celsius else None,
                    "qnh_hpa":            str(wx.qnh_hpa)      if wx.qnh_hpa      else None,
                    "density_altitude_ft":wx.density_altitude_ft,
                    "fetched_at":         wx.fetched_at.isoformat(),
                    "is_stale":           wx.is_stale,
                }

    return Response({
        "flights":     FlightSyncSerializer(flights_qs,  many=True).data,
        "aircraft":    AircraftSyncSerializer(aircraft_qs, many=True).data,
        "alerts":      AlertSyncSerializer(alerts_qs,   many=True).data,
        "weather":     weather_data,
        "server_time": int(time.time() * 1000),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def dispatch_record_push(request):
    """
    Tablet app calls: POST /api/v1/dispatch/records/

    Accepts a DispatchRecord from the tablet (offline mutation pushed when
    connectivity returns). Maps it onto the existing TechLog + closeout flow.

    Expected body:
    {
        "flight_id":    "<uuid>",
        "aircraft_id":  "<uuid>",
        "hobbs_out":    "1234.5",
        "tacho_out":    "1234.5",
        "hobbs_in":     "1235.5",
        "tacho_in":     "1235.5",
        "nil_defects":  true,
        "snags": [
            { "description": "...", "category": "go|no_go", "ata_chapter": "..." }
        ],
        "pre_flight_checklist": { ... },  // stored in notes
        "signature_data": "...",          // base64 SVG — stored in TechLog notes
        "dispatch_timestamp": 1234567890
    }
    """
    from apps.dispatch.models import SnagEntry
    from apps.scheduling.models import Flight, FlightStatus
    import json

    data = request.data

    try:
        flight = Flight.objects.get(id=data["flight_id"])
    except Flight.DoesNotExist:
        return Response({"error": "Flight not found."}, status=404)

    # Get or create the TechLog for this flight
    tech_log, created = TechLog.objects.get_or_create(
        flight=flight,
        defaults={"aircraft_id": data.get("aircraft_id", flight.aircraft_id)},
    )

    # Update pre-flight readings
    tech_log.hobbs_out = data.get("hobbs_out") or tech_log.hobbs_out
    tech_log.tacho_out = data.get("tacho_out") or tech_log.tacho_out

    # Post-flight readings
    hobbs_in = data.get("hobbs_in")
    tacho_in = data.get("tacho_in")
    nil_defects = data.get("nil_defects", True)

    if hobbs_in:
        tech_log.hobbs_in = hobbs_in
    if tacho_in:
        tech_log.tacho_in = tacho_in

    if hobbs_in and tech_log.hobbs_out:
        delta = float(hobbs_in) - float(tech_log.hobbs_out)
        tech_log.flight_duration_minutes = int(delta * 60)

    tech_log.nil_defects    = nil_defects
    tech_log.accepted_by    = request.user
    tech_log.accepted_at    = timezone.now()

    # Process snags
    has_no_go = False
    for snag_data in data.get("snags", []):
        cat = snag_data.get("category", "go")
        SnagEntry.objects.create(
            tech_log    = tech_log,
            aircraft    = tech_log.aircraft,
            description = snag_data.get("description", ""),
            category    = cat,
            ata_chapter = snag_data.get("ata_chapter", ""),
            reported_by = request.user,
        )
        if cat == "no_go":
            has_no_go = True

    tech_log.status    = TechLog.Status.AOG if has_no_go else TechLog.Status.CLOSED
    tech_log.closed_at = timezone.now()
    tech_log.closed_by = request.user
    tech_log.save()

    # Update aircraft hours
    if hobbs_in and tech_log.hobbs_out:
        aircraft = flight.aircraft
        delta    = float(hobbs_in) - float(tech_log.hobbs_out)
        aircraft.hobbs_total += delta
        aircraft.save(update_fields=["hobbs_total", "updated_at"])

    # Mark flight completed
    flight.status = FlightStatus.COMPLETED
    flight.save(update_fields=["status", "updated_at"])

    logger.info(
        "Tablet push: flight %s closed by %s (AOG=%s)",
        flight.id, request.user.email, has_no_go
    )

    return Response({
        "tech_log_id": str(tech_log.id),
        "status":      tech_log.status,
        "aog":         has_no_go,
        "flight_id":   str(flight.id),
    }, status=status.HTTP_201_CREATED)
