"""
Celery tasks for weather and NOTAM data fetching.

Schedule (defined in Django admin → Periodic Tasks once DB is up):
  - fetch_weather_all_bases  → every 30 minutes
  - fetch_notams_all_bases   → every 60 minutes
  - lock_old_occurrence_reports → daily at 02:00 IST
  - reset_instructor_fdtl_daily → daily at 04:00 IST
  - alert_expiring_documents    → daily at 06:00 IST
"""
import logging
import requests
from decimal import Decimal
from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(queue="weather", bind=True, max_retries=3)
def fetch_weather_for_base(self, icao_code: str, elevation_ft: int = 0):
    """Fetch METAR/TAF from Open-Meteo for a given ICAO aerodrome."""
    from apps.weather.models import WeatherCache
    from apps.infrastructure.models import Base

    try:
        base = Base.objects.get(icao_code=icao_code)
        url = f"{settings.OPEN_METEO_BASE_URL}/forecast"
        params = {
            "latitude":  float(base.latitude),
            "longitude": float(base.longitude),
            "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure",
            "wind_speed_unit": "kn",
            "timezone": "Asia/Kolkata",
        }
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json().get("current", {})

        temp_c = data.get("temperature_2m")
        qnh    = data.get("surface_pressure")  # hPa
        wind_spd = data.get("wind_speed_10m")
        wind_dir = data.get("wind_direction_10m")
        gust     = data.get("wind_gusts_10m")

        da = WeatherCache.compute_density_altitude(temp_c, qnh, elevation_ft)

        WeatherCache.objects.create(
            icao_code           = icao_code,
            wind_direction_deg  = int(wind_dir) if wind_dir else None,
            wind_speed_kt       = int(wind_spd) if wind_spd else None,
            wind_gust_kt        = int(gust) if gust else None,
            temp_celsius        = Decimal(str(temp_c)) if temp_c else None,
            qnh_hpa             = Decimal(str(qnh)) if qnh else None,
            density_altitude_ft = da,
            observation_time    = timezone.now(),
        )
        logger.info("Weather updated for %s — DA: %sft", icao_code, da)

    except Exception as exc:
        logger.error("Weather fetch failed for %s: %s", icao_code, exc)
        raise self.retry(exc=exc, countdown=120)


@shared_task(queue="weather")
def fetch_weather_all_bases():
    """Fan out a weather fetch task for every active base."""
    from apps.infrastructure.models import Base
    for base in Base.objects.filter(is_active=True):
        fetch_weather_for_base.delay(base.icao_code, base.elevation_ft)


@shared_task(queue="notifications")
def alert_expiring_documents():
    """Send email + push alerts for documents expiring within 30 or 60 days."""
    from apps.users.models import StudentDocument
    today = timezone.now().date()
    thresholds = [
        (30, "CRITICAL — expires in 30 days"),
        (60, "WARNING — expires in 60 days"),
    ]
    for days, label in thresholds:
        target_date = today + timezone.timedelta(days=days)
        docs = StudentDocument.objects.filter(
            expiry_date=target_date, is_superseded=False
        ).select_related("student__user")
        for doc in docs:
            student = doc.student
            logger.info(
                "Document alert [%s]: %s — %s %s",
                label, student.user.get_full_name(), doc.document_type, doc.expiry_date
            )
            # TODO: send email via Django send_mail + FCM push


@shared_task(queue="default")
def reset_instructor_fdtl_daily():
    """Reset daily FDTL counters at 04:00 IST each day. Weekly/monthly via separate logic."""
    from apps.users.models import Instructor
    today = timezone.now().date()
    updated = Instructor.objects.filter(fdtl_last_reset_date__lt=today).update(
        fdtl_daily_remaining_min=480,
        fdtl_last_reset_date=today,
    )
    logger.info("FDTL daily reset: %d instructors updated", updated)


@shared_task(queue="default")
def lock_old_occurrence_reports():
    """Lock occurrence reports that are > 48 hours old (regulatory immutability)."""
    from apps.compliance.models import OccurrenceReport
    cutoff = timezone.now() - timezone.timedelta(hours=48)
    locked = OccurrenceReport.objects.filter(
        locked_at__isnull=True,
        submitted_at__lt=cutoff,
    ).update(locked_at=timezone.now())
    logger.info("Occurrence reports locked: %d", locked)


@shared_task(queue="default")
def lock_old_sortie_grades():
    """Lock sortie grades that are > 7 days old."""
    from apps.maintenance.models import SortieGrade
    cutoff = timezone.now() - timezone.timedelta(days=7)
    locked = SortieGrade.objects.filter(
        locked_at__isnull=True,
        graded_at__lt=cutoff,
    ).update(locked_at=timezone.now())
    logger.info("Sortie grades locked: %d", locked)
