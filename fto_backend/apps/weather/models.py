import uuid
from django.db import models
from django.utils import timezone


class WeatherCache(models.Model):
    """Cached METAR/TAF data — refreshed every 30 min by Celery beat task."""
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    icao_code           = models.CharField(max_length=4, db_index=True)
    metar_raw           = models.TextField(blank=True, null=True)
    taf_raw             = models.TextField(blank=True, null=True)
    wind_direction_deg  = models.SmallIntegerField(null=True, blank=True)
    wind_speed_kt       = models.SmallIntegerField(null=True, blank=True)
    wind_gust_kt        = models.SmallIntegerField(null=True, blank=True)
    visibility_m        = models.IntegerField(null=True, blank=True)
    temp_celsius        = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    dewpoint_celsius    = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    qnh_hpa             = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    # JSON: [{coverage: "BKN", height_ft: 2500}, ...]
    cloud_layers        = models.JSONField(default=list, blank=True)
    density_altitude_ft = models.IntegerField(null=True, blank=True)
    pressure_alt_ft     = models.IntegerField(null=True, blank=True)
    observation_time    = models.DateTimeField(null=True, blank=True)
    fetched_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "weather_cache"
        ordering = ["-fetched_at"]
        get_latest_by = "fetched_at"

    def __str__(self):
        return f"METAR {self.icao_code} @ {self.fetched_at:%H:%M} | DA: {self.density_altitude_ft}ft"

    @property
    def is_stale(self):
        return (timezone.now() - self.fetched_at).total_seconds() > 5400  # 90 min

    @classmethod
    def latest_for(cls, icao_code):
        return cls.objects.filter(icao_code=icao_code).order_by("-fetched_at").first()

    @classmethod
    def compute_density_altitude(cls, temp_c, qnh_hpa, elevation_ft):
        """
        Standard ICAO density altitude formula.
        DA = PA + (ISA deviation × 120)
        PA = elevation + (1013.25 - QNH) × 30
        """
        if temp_c is None or qnh_hpa is None:
            return None
        from decimal import Decimal
        qnh       = float(qnh_hpa)
        temp      = float(temp_c)
        elev      = float(elevation_ft)
        pressure_alt = elev + (1013.25 - qnh) * 30
        isa_temp     = 15 - (pressure_alt / 1000) * 1.98
        isa_dev      = temp - isa_temp
        da           = pressure_alt + (isa_dev * 120)
        return int(da)


class NotamCache(models.Model):
    """Cached NOTAMs — refreshed hourly by Celery beat task."""
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    icao_code     = models.CharField(max_length=4, db_index=True)
    notam_id      = models.CharField(max_length=50)
    series        = models.CharField(max_length=1, blank=True, null=True)
    notam_type    = models.CharField(max_length=10, blank=True, null=True)
    purpose       = models.CharField(max_length=10, blank=True, null=True)
    scope         = models.CharField(max_length=10, blank=True, null=True)
    lower_limit   = models.CharField(max_length=20, blank=True, null=True)
    upper_limit   = models.CharField(max_length=20, blank=True, null=True)
    area          = models.TextField(blank=True, null=True)
    notam_text    = models.TextField()
    effective_from = models.DateTimeField(null=True, blank=True)
    effective_to  = models.DateTimeField(null=True, blank=True)
    is_permanent  = models.BooleanField(default=False)
    is_active     = models.BooleanField(default=True)
    fetched_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table     = "notam_cache"
        unique_together = [("icao_code", "notam_id")]
        ordering     = ["-fetched_at"]

    def __str__(self):
        return f"NOTAM {self.notam_id} @ {self.icao_code}"
