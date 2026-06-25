import uuid
from django.db import models
from django.utils import timezone
from apps.core.models import TimeStampedModel
from apps.infrastructure.models import Base, Aircraft
from apps.users.models import User


class OccurrenceType(models.TextChoices):
    INCIDENT               = "incident",               "Incident"
    ACCIDENT               = "accident",               "Accident"
    NEAR_MISS              = "near_miss",               "Near Miss"
    HAZARD_REPORT          = "hazard_report",           "Hazard Report"
    AIRSPACE_INFRINGEMENT  = "airspace_infringement",  "Airspace Infringement"
    BIRD_STRIKE            = "bird_strike",            "Bird Strike"
    TECHNICAL_DEFECT       = "technical_defect",       "Technical Defect"


class OccurrenceSeverity(models.TextChoices):
    LOW      = "low",      "Low"
    MEDIUM   = "medium",   "Medium"
    HIGH     = "high",     "High"
    CRITICAL = "critical", "Critical"


class OccurrenceReport(TimeStampedModel):
    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Auto-sequenced report number: OCC-YYYYMM-NNN  (set in save())
    report_number        = models.CharField(max_length=20, unique=True, editable=False)
    base                 = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="occurrences")
    aircraft             = models.ForeignKey(Aircraft, on_delete=models.SET_NULL, null=True, blank=True, related_name="occurrences")
    flight               = models.ForeignKey("scheduling.Flight", on_delete=models.SET_NULL, null=True, blank=True)
    occurrence_type      = models.CharField(max_length=30, choices=OccurrenceType.choices, db_index=True)
    severity             = models.CharField(max_length=20, choices=OccurrenceSeverity.choices, db_index=True)
    event_datetime       = models.DateTimeField()
    event_location       = models.TextField(blank=True, null=True)
    description          = models.TextField()
    immediate_actions    = models.TextField(blank=True, null=True)
    # PostgreSQL array stored as JSON list
    contributing_factors = models.JSONField(default=list, blank=True)
    submitted_by         = models.ForeignKey(User, on_delete=models.PROTECT, related_name="submitted_occurrences")
    submitted_at         = models.DateTimeField(auto_now_add=True)
    investigating_officer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="investigating_occurrences")
    investigation_notes  = models.TextField(blank=True, null=True)
    corrective_actions   = models.TextField(blank=True, null=True)
    closed_at            = models.DateTimeField(null=True, blank=True)
    closed_by            = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="closed_occurrences")
    # DGCA submission
    dgca_submitted       = models.BooleanField(default=False)
    dgca_submitted_at    = models.DateTimeField(null=True, blank=True)
    dgca_reference       = models.CharField(max_length=50, blank=True, null=True)
    # Immutability — locked 48 hrs after submission (enforced by Celery task)
    locked_at            = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "occurrence_reports"
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.report_number} | {self.occurrence_type} | {self.severity}"

    @property
    def is_locked(self):
        return self.locked_at is not None

    def save(self, *args, **kwargs):
        if not self.report_number:
            prefix = timezone.now().strftime("OCC-%Y%m")
            count  = OccurrenceReport.objects.filter(
                report_number__startswith=prefix
            ).count() + 1
            self.report_number = f"{prefix}-{count:03d}"
        super().save(*args, **kwargs)


class HazardEntry(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN      = "open",      "Open"
        MITIGATED = "mitigated", "Mitigated"
        ACCEPTED  = "accepted",  "Risk Accepted"
        CLOSED    = "closed",    "Closed"

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    base         = models.ForeignKey(Base, on_delete=models.SET_NULL, null=True, blank=True)
    title        = models.CharField(max_length=200)
    description  = models.TextField()
    likelihood   = models.SmallIntegerField(help_text="1 (Rare) to 5 (Almost Certain)")
    severity     = models.SmallIntegerField(help_text="1 (Negligible) to 5 (Catastrophic)")
    controls     = models.TextField(blank=True, null=True)
    status       = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    owner        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="owned_hazards")
    review_date  = models.DateField(null=True, blank=True)
    identified_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="identified_hazards")
    identified_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hazard_entries"
        ordering = ["-identified_at"]

    def __str__(self):
        return f"[{self.risk_score}] {self.title}"

    @property
    def risk_score(self):
        return self.likelihood * self.severity
