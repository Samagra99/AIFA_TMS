"""Abstract base models shared across all apps."""
import uuid
from django.db import models
from django.conf import settings


class TimeStampedModel(models.Model):
    """Adds created_at / updated_at to every model."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditedModel(TimeStampedModel):
    """Adds created_by audit field on top of timestamps."""
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="+",
    )

    class Meta:
        abstract = True


class NotificationCategory(models.TextChoices):
    REST_RULES     = "rest_rules",     "Rest & Duty Rules"
    FDTL           = "fdtl",           "FDTL & Duty Limits"
    LICENSE_EXPIRY = "license_expiry", "License & Medical Expiry"
    AIRCRAFT_MAINT = "aircraft_maint", "Aircraft Maintenance"
    FLIGHT_SCHEDULE= "flight_schedule","Flight Schedule"
    SAFETY         = "safety",          "Safety & Compliance"


class NotificationSeverity(models.TextChoices):
    INFO     = "info",     "Information"
    WARNING  = "warning",  "Warning"
    CRITICAL = "critical", "Critical"


class Notification(TimeStampedModel):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications", null=True, blank=True)
    target_role = models.CharField(max_length=30, blank=True, null=True)
    base        = models.ForeignKey("infrastructure.Base", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    title       = models.CharField(max_length=150)
    message     = models.TextField()
    category    = models.CharField(max_length=30, choices=NotificationCategory.choices, default=NotificationCategory.FLIGHT_SCHEDULE)
    severity    = models.CharField(max_length=20, choices=NotificationSeverity.choices, default=NotificationSeverity.INFO)
    is_read     = models.BooleanField(default=False, db_index=True)
    read_at     = models.DateTimeField(null=True, blank=True)
    action_url  = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["user", "is_read"]),
            models.Index(fields=["target_role", "is_read"]),
        ]
