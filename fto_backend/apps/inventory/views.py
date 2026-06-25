from django.db import models as dj_models
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from apps.core.permissions import IsCAMO, IsDispatcher
from .models import InventoryItem, InventoryRequisition, RequisitionStatus
from .serializers import InventoryItemSerializer, InventoryRequisitionSerializer


class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset         = InventoryItem.objects.select_related("base", "aircraft_type").filter(is_active=True)
    serializer_class = InventoryItemSerializer
    permission_classes  = [IsDispatcher]
    filter_backends     = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields    = ["base", "aircraft_type", "is_active"]
    search_fields       = ["part_number", "description"]

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        """Items at or below minimum stock level — auto-triggers requisition workflow."""
        base_id = request.query_params.get("base_id")
        qs = self.get_queryset().filter(
            quantity_on_hand__lte=dj_models.F("min_stock_level")
        )
        if base_id:
            qs = qs.filter(base_id=base_id)
        return Response(InventoryItemSerializer(qs, many=True).data)


class InventoryRequisitionViewSet(viewsets.ModelViewSet):
    queryset = InventoryRequisition.objects.select_related(
        "item", "requesting_base", "fulfilling_base", "requested_by"
    ).all()
    serializer_class   = InventoryRequisitionSerializer
    permission_classes = [IsCAMO]
    filterset_fields   = ["status", "requesting_base", "fulfilling_base"]

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        req             = self.get_object()
        req.status      = RequisitionStatus.APPROVED
        req.approved_by = request.user
        req.approved_at = timezone.now()
        req.save(update_fields=["status", "approved_by", "approved_at"])
        return Response({"detail": "Requisition approved."})

    @action(detail=True, methods=["post"], url_path="receive")
    def receive(self, request, pk=None):
        req                    = self.get_object()
        qty                    = request.data.get("quantity_fulfilled", req.quantity_requested)
        req.quantity_fulfilled = qty
        req.status             = RequisitionStatus.RECEIVED
        req.received_at        = timezone.now()
        req.received_by        = request.user
        req.save(update_fields=["quantity_fulfilled", "status", "received_at", "received_by"])
        # Credit stock to the receiving base
        item_at_base, _ = InventoryItem.objects.get_or_create(
            base        = req.requesting_base,
            part_number = req.item.part_number,
            defaults    = {
                "description":      req.item.description,
                "quantity_on_hand": 0,
                "unit":             req.item.unit,
                "min_stock_level":  req.item.min_stock_level,
            },
        )
        item_at_base.quantity_on_hand += float(qty)
        item_at_base.save(update_fields=["quantity_on_hand", "updated_at"])
        return Response({"detail": f"Received {qty} {req.item.unit} of {req.item.part_number}."})
