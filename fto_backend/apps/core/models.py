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
