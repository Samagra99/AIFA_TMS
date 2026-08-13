import uuid
from django.db import models
from django.core.validators import MinValueValidator
from ..core.models import TimeStampedModel


class Base(TimeStampedModel):
    class BaseType(models.TextChoices):
        HUB       = "hub",       "Hub (Central Maintenance)"
        SATELLITE = "satellite", "Satellite Base"

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name                = models.CharField(max_length=100)
    icao_code           = models.CharField(max_length=4, unique=True)
    iata_code           = models.CharField(max_length=3, blank=True, null=True)
    base_type           = models.CharField(max_length=20, choices=BaseType.choices, default=BaseType.SATELLITE)
    is_active           = models.BooleanField(default=True)
    latitude            = models.DecimalField(max_digits=9, decimal_places=6)
    longitude           = models.DecimalField(max_digits=9, decimal_places=6)
    elevation_ft        = models.IntegerField(default=0)
    # Critical safety field: minimum hours an aircraft must retain
    # at this base before its next mandatory inspection threshold,
    # to ensure it can legally ferry back to the hub for maintenance.
    ferry_buffer_hours  = models.DecimalField(
        max_digits=4, decimal_places=2, default=2.50,
        validators=[MinValueValidator(0)],
        help_text="Hours reserved for ferry flight back to hub. 0 for the hub itself."
    )
    address             = models.TextField(blank=True, null=True)
    phone               = models.CharField(max_length=20, blank=True, null=True)
    active_runway       = models.ForeignKey(
        "infrastructure.Runway", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
        help_text="Currently active runway for dispatch crosswind calculations"
    )

    class Meta:
        db_table = "bases"
        verbose_name = "Base"
        verbose_name_plural = "Bases"
        ordering = ["-base_type", "name"]

    def __str__(self):
        return f"{self.name} ({self.icao_code})"

    @property
    def is_hub(self):
        return self.base_type == self.BaseType.HUB


class Runway(TimeStampedModel):
    """Runway at a base — managed via Django admin when creating/editing a base."""
    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    base                  = models.ForeignKey(Base, on_delete=models.CASCADE, related_name="runways")
    runway_identifier     = models.CharField(max_length=10, help_text="e.g. 09/27 or 09L/27R")
    heading_deg           = models.SmallIntegerField(help_text="Primary heading 0-359")
    reciprocal_heading_deg = models.SmallIntegerField(help_text="Reciprocal heading 0-359")
    length_ft             = models.IntegerField(null=True, blank=True)
    width_ft              = models.IntegerField(null=True, blank=True)
    is_active             = models.BooleanField(default=True)

    class Meta:
        db_table = "runways"
        ordering = ["base", "runway_identifier"]

    def __str__(self):
        return f"{self.base.icao_code} RWY {self.runway_identifier} ({self.heading_deg}°/{self.reciprocal_heading_deg}°)"


class AircraftType(TimeStampedModel):
    id                       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    make_model               = models.CharField(max_length=100, help_text="e.g. Cessna 152")
    icao_designator          = models.CharField(max_length=10, blank=True, null=True)
    engine_make_model        = models.CharField(max_length=100, blank=True, null=True)
    is_multi_engine          = models.BooleanField(default=False, help_text="True if aircraft has multiple engines (e.g. DA42, P68, PA34)")
    fuel_type                = models.CharField(max_length=20, default="AVGAS 100LL")
    oil_type                 = models.CharField(max_length=50, blank=True, null=True)
    # Crosswind limits
    max_crosswind_demo_kt    = models.DecimalField(max_digits=4, decimal_places=1, default=15.0)
    max_crosswind_student_kt = models.DecimalField(max_digits=4, decimal_places=1, default=12.0)
    # DA warning above which solo is flagged (ft)
    da_solo_warning_ft       = models.IntegerField(default=5500)
    # Maintenance intervals (hours)
    interval_50hr            = models.DecimalField(max_digits=6, decimal_places=1, default=50.0)
    interval_100hr           = models.DecimalField(max_digits=6, decimal_places=1, default=100.0)
    interval_200hr           = models.DecimalField(max_digits=6, decimal_places=1, default=200.0)
    interval_600hr           = models.DecimalField(max_digits=6, decimal_places=1, default=600.0)
    # Maintenance intervals (calendar months)
    interval_annual_months   = models.IntegerField(default=12)
    interval_biennial_months = models.IntegerField(default=24)
    # Performance data — used for informational range/endurance validation on CC routes
    cruise_speed_knots       = models.IntegerField(
        null=True, blank=True,
        help_text="Typical cruise speed (knots) for range calculation"
    )
    max_range_nm             = models.IntegerField(
        null=True, blank=True,
        help_text="Max range in nautical miles (no reserves) — for informational CC validation only"
    )

    class Meta:
        db_table = "aircraft_types"
        verbose_name = "Aircraft Type"
        verbose_name_plural = "Aircraft Types"
        ordering = ["make_model"]

    def __str__(self):
        return self.make_model


class Aircraft(TimeStampedModel):
    class Status(models.TextChoices):
        AIRWORTHY           = "airworthy",            "Airworthy"
        AOG                 = "aog",                  "AOG (Aircraft on Ground)"
        SCHEDULED_MAINT     = "scheduled_maintenance", "Scheduled Maintenance"
        FERRY_REQUIRED      = "ferry_required",        "Ferry Required"
        DEREGISTERED        = "deregistered",          "Deregistered"

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tail_number         = models.CharField(max_length=10, unique=True, help_text="e.g. VT-ABC")
    aircraft_type       = models.ForeignKey(AircraftType, on_delete=models.PROTECT, related_name="aircraft")
    home_base           = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="home_aircraft")
    current_base        = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="current_aircraft")
    away_at_airport     = models.ForeignKey(
        "navigation.Airport", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
        help_text="Current airport location if away from FTO bases"
    )
    # Airworthiness
    status              = models.CharField(max_length=30, choices=Status.choices, default=Status.AIRWORTHY, db_index=True)
    aog_reason          = models.TextField(blank=True, null=True)
    aog_since           = models.DateTimeField(null=True, blank=True)
    # Hour counters — NEVER decremented; only incremented via signal after each sortie
    hobbs_total         = models.DecimalField(max_digits=8, decimal_places=1, default=0.0, validators=[MinValueValidator(0)])
    tacho_total         = models.DecimalField(max_digits=8, decimal_places=1, default=0.0, validators=[MinValueValidator(0)])
    # Next maintenance thresholds (hours)
    next_50hr_at        = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    next_100hr_at       = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    next_200hr_at       = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    next_600hr_at       = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    # Calendar maintenance
    next_annual_due     = models.DateField(null=True, blank=True)
    next_biennial_due   = models.DateField(null=True, blank=True)
    # Registration docs
    cert_of_registration = models.CharField(max_length=50, blank=True, null=True)
    cert_of_airworthiness = models.CharField(max_length=50, blank=True, null=True)
    coa_expiry          = models.DateField(null=True, blank=True)
    serial_number       = models.CharField(max_length=50, blank=True, null=True)
    year_of_manufacture = models.IntegerField(null=True, blank=True)
    is_active           = models.BooleanField(default=True)
    notes               = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "aircraft"
        verbose_name = "Aircraft"
        verbose_name_plural = "Aircraft"
        ordering = ["tail_number"]

    def __str__(self):
        return f"{self.tail_number} ({self.aircraft_type.make_model}) — {self.status}"

    @property
    def is_aog(self):
        return self.status == self.Status.AOG

    def hours_to_next_inspection(self):
        """Returns hours remaining until the nearest upcoming inspection."""
        candidates = [
            self.next_50hr_at, self.next_100hr_at,
            self.next_200hr_at, self.next_600hr_at,
        ]
        valid = [c - self.hobbs_total for c in candidates if c is not None]
        return min(valid) if valid else None

    @property
    def ferry_buffer_triggered(self):
        """True when remaining hours ≤ current base ferry_buffer_hours."""
        remaining = self.hours_to_next_inspection()
        if remaining is None:
            return False
        return remaining <= self.current_base.ferry_buffer_hours
