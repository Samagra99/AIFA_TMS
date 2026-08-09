"""
Navigation Celery tasks — weather and NOTAM fetching for cross-country routes.
These are ADDITIVE; existing fetch_weather_for_base / fetch_notams_all_bases
tasks are untouched and continue to run independently on their existing schedule.
"""
import logging
import requests
from celery import shared_task

logger = logging.getLogger(__name__)


def _get_route_icaos(route_id: str) -> list:
    """Return all unique ICAO codes referenced by a route."""
    from apps.navigation.models import CrossCountryRoute
    try:
        route = CrossCountryRoute.objects.prefetch_related(
            'legs__airport', 'alternates__airport', 'nearby_airports__airport'
        ).get(id=route_id)
    except CrossCountryRoute.DoesNotExist:
        logger.warning('CrossCountryRoute %s not found for ICAO collection.', route_id)
        return []

    icaos = set()
    icaos.add(route.departure_airport.icao_code)
    icaos.add(route.destination_airport.icao_code)
    for leg in route.legs.all():
        if leg.airport:
            icaos.add(leg.airport.icao_code)
    for alt in route.alternates.all():
        icaos.add(alt.airport.icao_code)
    for nearby in route.nearby_airports.all():
        icaos.add(nearby.airport.icao_code)
    return list(icaos)


@shared_task(queue='weather', bind=True, max_retries=3)
def fetch_weather_for_route(self, route_id: str):
    """Fan-out weather fetches for every airport in the route (additive task)."""
    from apps.weather.tasks import fetch_weather_for_base
    from apps.navigation.models import Airport

    icaos = _get_route_icaos(route_id)
    for icao in icaos:
        try:
            airport = Airport.objects.get(icao_code=icao)
            elevation = airport.elevation_ft
        except Airport.DoesNotExist:
            elevation = 0
        # Reuse the existing per-ICAO weather task — no changes to it
        fetch_weather_for_base.delay(icao, elevation)
    logger.info('Weather refresh queued for route %s airports: %s', route_id, icaos)


@shared_task(queue='weather', bind=True, max_retries=3)
def fetch_notams_for_route(self, route_id: str):
    """Fetch and cache NOTAMs from AviationWeather.gov for every airport in the route."""
    icaos = _get_route_icaos(route_id)
    for icao in icaos:
        try:
            _fetch_notams_for_icao(icao)
        except Exception as exc:
            logger.error('NOTAM fetch failed for %s: %s', icao, exc)
    logger.info('NOTAM refresh completed for route %s airports: %s', route_id, icaos)


def _fetch_notams_for_icao(icao_code: str):
    """Fetch active NOTAMs from AviationWeather.gov for a given ICAO code."""
    from apps.weather.models import NotamCache
    from django.utils.dateparse import parse_datetime

    url = 'https://aviationweather.gov/api/data/notam'
    params = {'icaos': icao_code, 'format': 'json'}
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    data_list = resp.json()

    if not data_list:
        logger.info('No NOTAMs returned for %s', icao_code)
        return

    fetched_ids = set()
    for notam in data_list:
        notam_id = notam.get('notamID') or notam.get('id')
        if not notam_id:
            continue

        notam_text = (
            notam.get('traditionalMessage')
            or notam.get('text')
            or str(notam)
        )

        eff_from_raw = notam.get('effectiveStart') or notam.get('startDate')
        eff_to_raw   = notam.get('effectiveEnd')   or notam.get('endDate')
        eff_from = parse_datetime(eff_from_raw) if eff_from_raw else None
        eff_to   = parse_datetime(eff_to_raw)   if eff_to_raw   else None

        NotamCache.objects.update_or_create(
            icao_code=icao_code,
            notam_id=str(notam_id),
            defaults={
                'notam_type':     notam.get('notamType', ''),
                'notam_text':     notam_text,
                'effective_from': eff_from,
                'effective_to':   eff_to,
                'is_permanent':   eff_to is None,
                'is_active':      True,
            },
        )
        fetched_ids.add(str(notam_id))

    # Deactivate old NOTAMs for this ICAO not returned by the latest fetch
    NotamCache.objects.filter(
        icao_code=icao_code, is_active=True
    ).exclude(notam_id__in=fetched_ids).update(is_active=False)

    logger.info('NOTAMs updated for %s: %d active', icao_code, len(fetched_ids))
