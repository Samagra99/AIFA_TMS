from rest_framework import serializers
from .models import InventoryItem, InventoryRequisition


class InventoryItemSerializer(serializers.ModelSerializer):
    below_minimum = serializers.ReadOnlyField()
    base_name     = serializers.CharField(source="base.name", read_only=True)

    class Meta:
        model  = InventoryItem
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class InventoryRequisitionSerializer(serializers.ModelSerializer):
    item_description    = serializers.CharField(source="item.description", read_only=True)
    requesting_base_name = serializers.CharField(source="requesting_base.name", read_only=True)
    fulfilling_base_name = serializers.CharField(source="fulfilling_base.name", read_only=True)

    class Meta:
        model  = InventoryRequisition
        fields = "__all__"
        read_only_fields = ["id", "requested_at", "created_at", "updated_at"]
