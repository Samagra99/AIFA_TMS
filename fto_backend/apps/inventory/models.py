import uuid
from django.db import models
from apps.core.models import TimeStampedModel
from apps.infrastructure.models import Base, AircraftType
from apps.users.models import User


class InventoryItem(TimeStampedModel):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    base             = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="inventory")
    part_number      = models.CharField(max_length=100)
    description      = models.TextField()
    # NULL means generic (consumable for any type); set to restrict to one type
    aircraft_type    = models.ForeignKey(AircraftType, on_delete=models.SET_NULL, null=True, blank=True)
    quantity_on_hand = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    unit             = models.CharField(max_length=20, default="each")
    min_stock_level  = models.DecimalField(max_digits=10, decimal_places=3, default=1)
    unit_cost_inr    = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    supplier_name    = models.CharField(max_length=200, blank=True, null=True)
    storage_location = models.CharField(max_length=50, blank=True, null=True)
    is_active        = models.BooleanField(default=True)

    class Meta:
        db_table      = "inventory_items"
        unique_together = [("base", "part_number")]
        ordering      = ["base", "part_number"]

    def __str__(self):
        return f"{self.part_number} @ {self.base.icao_code} ({self.quantity_on_hand} {self.unit})"

    @property
    def below_minimum(self):
        return self.quantity_on_hand <= self.min_stock_level


class RequisitionStatus(models.TextChoices):
    PENDING    = "pending",    "Pending"
    APPROVED   = "approved",   "Approved"
    DISPATCHED = "dispatched", "Dispatched"
    RECEIVED   = "received",   "Received"
    CANCELLED  = "cancelled",  "Cancelled"


class InventoryRequisition(TimeStampedModel):
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requesting_base     = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="outgoing_requisitions")
    fulfilling_base     = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="incoming_requisitions")
    item                = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="requisitions")
    quantity_requested  = models.DecimalField(max_digits=10, decimal_places=3)
    quantity_fulfilled  = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    status              = models.CharField(max_length=20, choices=RequisitionStatus.choices, default=RequisitionStatus.PENDING, db_index=True)
    requested_by        = models.ForeignKey(User, on_delete=models.PROTECT, related_name="requested_inventory")
    requested_at        = models.DateTimeField(auto_now_add=True)
    approved_by         = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_requisitions")
    approved_at         = models.DateTimeField(null=True, blank=True)
    dispatch_method     = models.CharField(max_length=50, blank=True, null=True,
                          help_text="ferry_flight | ground_transport | courier")
    dispatch_flight     = models.ForeignKey("scheduling.Flight", on_delete=models.SET_NULL, null=True, blank=True)
    received_at         = models.DateTimeField(null=True, blank=True)
    received_by         = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="received_inventory")
    notes               = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "inventory_requisitions"
        ordering = ["-requested_at"]

    def __str__(self):
        return f"REQ {self.id.hex[:8].upper()}: {self.item.part_number} × {self.quantity_requested} → {self.requesting_base.icao_code}"
