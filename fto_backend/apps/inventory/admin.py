from django.contrib import admin
from .models import InventoryItem, InventoryRequisition


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ("part_number", "description", "base", "quantity_on_hand", "min_stock_level", "below_minimum")
    list_filter  = ("base", "aircraft_type")
    search_fields = ("part_number", "description")

    @admin.display(boolean=True)
    def below_minimum(self, obj):
        return obj.below_minimum


@admin.register(InventoryRequisition)
class RequisitionAdmin(admin.ModelAdmin):
    list_display = ("item", "requesting_base", "fulfilling_base", "quantity_requested", "status")
    list_filter  = ("status",)
