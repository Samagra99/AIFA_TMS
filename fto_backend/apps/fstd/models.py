from django.db import models
from apps.core.models import AuditedModel

class FSTDDevice(AuditedModel):
    """
    Flight Simulation Training Device (FSTD) registry.
    Separates simulators from physical aircraft to preserve hobbs/airworthiness counters.
    """
    device_code = models.CharField(max_length=50, unique=True, help_text="e.g. SIM-01")
    name = models.CharField(max_length=150, help_text="e.g. Cessna 172 FTD Level 5")
    aircraft_type = models.CharField(max_length=50, blank=True, help_text="e.g. C172")
    qualification_level = models.CharField(max_length=50, blank=True, help_text="e.g. FTD Level 5, FNPT II")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "FSTD Device"
        verbose_name_plural = "FSTD Devices"
        ordering = ["device_code"]

    def __str__(self):
        return f"{self.device_code} - {self.name}"
