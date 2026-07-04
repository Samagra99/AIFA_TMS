from django.contrib import admin
from .models import Base, AircraftType, Aircraft


@admin.register(Base)
class BaseAdmin(admin.ModelAdmin):
    list_display  = ("name", "icao_code", "base_type", "ferry_buffer_hours", "is_active")
    list_filter   = ("base_type", "is_active")
    search_fields = ("name", "icao_code")


@admin.register(AircraftType)
class AircraftTypeAdmin(admin.ModelAdmin):
    list_display = ("make_model", "icao_designator", "max_crosswind_student_kt", "da_solo_warning_ft")


@admin.register(Aircraft)
class AircraftAdmin(admin.ModelAdmin):
    list_display  = ("tail_number", "aircraft_type", "current_base", "status", "hobbs_total", "next_50hr_at")
    list_filter   = ("status", "current_base", "aircraft_type")
    search_fields = ("tail_number", "serial_number")
    readonly_fields = ("hobbs_total", "tacho_total", "aog_since")
