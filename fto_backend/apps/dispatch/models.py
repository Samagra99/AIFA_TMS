import uuid
from django.db import models
from ..core.models import TimeStampedModel


class TechLog(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN   = "open",   "Open"
        CLOSED = "closed", "Closed"
        AOG    = "aog",    "AOG (No-Go Snag Filed)"

    id                          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    flight                      = models.OneToOneField(
        "scheduling.Flight", on_delete=models.PROTECT, related_name="tech_log"
    )
    aircraft                    = models.ForeignKey(
        "infrastructure.Aircraft", on_delete=models.PROTECT, related_name="tech_logs"
    )
    # Pre-flight meter readings
    hobbs_out                   = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    tacho_out                   = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    # Dispatch clearance
    dispatch_cleared_by         = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="dispatch_cleared_logs"
    )
    dispatch_cleared_at         = models.DateTimeField(null=True, blank=True)
    # Compliance snapshot — immutable once set, stored for DGCA audit trail
    student_medical_valid       = models.BooleanField(null=True, blank=True)
    student_spl_valid           = models.BooleanField(null=True, blank=True)
    instructor_fdtl_ok          = models.BooleanField(null=True, blank=True)
    aircraft_hours_ok           = models.BooleanField(null=True, blank=True)
    ferry_buffer_ok             = models.BooleanField(null=True, blank=True)
    crosswind_ok                = models.BooleanField(null=True, blank=True)
    live_wind_kt                = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    live_crosswind_component_kt = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    density_altitude_ft         = models.IntegerField(null=True, blank=True)
    weather_snapshot            = models.ForeignKey(
        "weather.WeatherCache", on_delete=models.SET_NULL, null=True, blank=True
    )
    # Aircraft acceptance on apron (tablet — must work offline)
    accepted_by                 = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="accepted_tech_logs"
    )
    accepted_at                 = models.DateTimeField(null=True, blank=True)
    acceptance_biometric_ok     = models.BooleanField(default=False)
    briefing_acknowledged_by    = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="briefing_acks"
    )
    briefing_acknowledged_at    = models.DateTimeField(null=True, blank=True)
    # Post-flight readings
    hobbs_in                    = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    tacho_in                    = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    flight_duration_minutes     = models.IntegerField(null=True, blank=True)
    nil_defects                 = models.BooleanField(null=True, blank=True)
    status                      = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True
    )
    closed_at                   = models.DateTimeField(null=True, blank=True)
    closed_by                   = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="closed_tech_logs"
    )

    class Meta:
        db_table = "tech_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"TechLog [{self.status}] — {self.flight_id}"


class SnagCategory(models.TextChoices):
    GO          = "go",          "Go (Deferred — safe for next flight)"
    NO_GO       = "no_go",       "No-Go (Aircraft unairworthy — AOG)"
    OBSERVATION = "observation", "Observation (no airworthiness impact)"


class SnagEntry(TimeStampedModel):
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tech_log           = models.ForeignKey(TechLog, on_delete=models.PROTECT, related_name="snags")
    aircraft           = models.ForeignKey(
        "infrastructure.Aircraft", on_delete=models.PROTECT, related_name="snags"
    )
    description        = models.TextField()
    category           = models.CharField(max_length=20, choices=SnagCategory.choices, db_index=True)
    ata_chapter        = models.CharField(max_length=10, blank=True, null=True)
    deferral_reference = models.CharField(max_length=50, blank=True, null=True)
    reported_by        = models.ForeignKey(
        "users.User", on_delete=models.PROTECT, related_name="reported_snags"
    )
    reported_at        = models.DateTimeField(auto_now_add=True)
    # Set after maintenance resolves this snag
    maintenance_record = models.ForeignKey(
        "maintenance.MaintenanceRecord", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="resolves_snags"
    )
    resolved_at        = models.DateTimeField(null=True, blank=True)
    resolved_by        = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="resolved_snags"
    )
    resolution_notes   = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "snag_entries"
        ordering = ["-reported_at"]

    def __str__(self):
        return f"[{self.category.upper()}] {self.aircraft_id}: {self.description[:60]}"

    @property
    def triggers_aog(self):
        return self.category == SnagCategory.NO_GO
