from django.contrib import admin
from .models import OccurrenceReport, HazardEntry


@admin.register(OccurrenceReport)
class OccurrenceReportAdmin(admin.ModelAdmin):
    list_display  = ("report_number", "occurrence_type", "severity", "base", "submitted_at", "is_locked", "dgca_submitted")
    list_filter   = ("severity", "occurrence_type", "dgca_submitted")
    search_fields = ("report_number", "description")
    readonly_fields = ("report_number", "submitted_at", "locked_at")


@admin.register(HazardEntry)
class HazardEntryAdmin(admin.ModelAdmin):
    list_display = ("title", "risk_score", "status", "base", "review_date")
    list_filter  = ("status",)
