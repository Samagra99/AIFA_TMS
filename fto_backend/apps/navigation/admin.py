from django.contrib import admin
from .models import Airport, CrossCountryRoute, RouteLeg, RouteAlternate, RouteNearbyAirport


class RouteLegInline(admin.TabularInline):
    model = RouteLeg
    extra = 1
    ordering = ['sequence']


class RouteAlternateInline(admin.TabularInline):
    model = RouteAlternate
    extra = 1


class RouteNearbyInline(admin.TabularInline):
    model = RouteNearbyAirport
    extra = 1


@admin.register(Airport)
class AirportAdmin(admin.ModelAdmin):
    list_display = ['icao_code', 'name', 'city', 'has_fuel', 'is_verified', 'is_active']
    search_fields = ['icao_code', 'name', 'city']
    list_filter = ['has_fuel', 'is_verified', 'is_active', 'country']


@admin.register(CrossCountryRoute)
class CrossCountryRouteAdmin(admin.ModelAdmin):
    list_display = ['name', 'departure_airport', 'destination_airport', 'is_triangular', 'total_distance_nm', 'is_active']
    inlines = [RouteLegInline, RouteAlternateInline, RouteNearbyInline]
    search_fields = ['name']
    list_filter = ['is_triangular', 'is_active']
