from django.contrib import admin
from .models import Base, AircraftType, Aircraft, Runway


class RunwayInline(admin.TabularInline):
    model = Runway
    extra = 1


@admin.register(Base)
class BaseAdmin(admin.ModelAdmin):
    list_display = ['name', 'icao_code', 'base_type', 'is_active', 'active_runway']
    inlines = [RunwayInline]


@admin.register(AircraftType)
class AircraftTypeAdmin(admin.ModelAdmin):
    list_display = ['make_model', 'icao_designator', 'is_multi_engine']


@admin.register(Aircraft)
class AircraftAdmin(admin.ModelAdmin):
    list_display = ['tail_number', 'aircraft_type', 'home_base', 'status', 'hobbs_total']
    list_filter = ['status', 'home_base']


@admin.register(Runway)
class RunwayAdmin(admin.ModelAdmin):
    list_display = ['base', 'runway_identifier', 'heading_deg', 'reciprocal_heading_deg', 'is_active']
    list_filter = ['base', 'is_active']
