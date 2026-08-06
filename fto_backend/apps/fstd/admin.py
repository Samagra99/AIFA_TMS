from django.contrib import admin
from .models import FSTDDevice

@admin.register(FSTDDevice)
class FSTDDeviceAdmin(admin.ModelAdmin):
    list_display = ("device_code", "name", "aircraft_type", "qualification_level", "is_active")
    list_filter = ("is_active", "aircraft_type", "qualification_level")
    search_fields = ("device_code", "name")
