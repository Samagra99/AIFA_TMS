from django.contrib import admin
from .models import TechLog, SnagEntry


class SnagInline(admin.TabularInline):
    model = SnagEntry
    extra = 0
    readonly_fields = ("triggers_aog",)


@admin.register(TechLog)
class TechLogAdmin(admin.ModelAdmin):
    list_display = ("flight", "aircraft", "status", "hobbs_out", "hobbs_in", "flight_duration_minutes")
    list_filter  = ("status",)
    inlines      = [SnagInline]
    readonly_fields = ("flight_duration_minutes",)


@admin.register(SnagEntry)
class SnagAdmin(admin.ModelAdmin):
    list_display = ("aircraft", "category", "description", "reported_by", "reported_at", "resolved_at")
    list_filter  = ("category",)
    search_fields = ("description", "aircraft__tail_number")
