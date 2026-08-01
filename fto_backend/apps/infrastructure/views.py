from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import IsAdminOrCFI, IsDispatcher, IsCAMO
from .models import Base, AircraftType, Aircraft, Runway
from .serializers import BaseSerializer, AircraftTypeSerializer, AircraftListSerializer, AircraftDetailSerializer, RunwaySerializer


class BaseViewSet(viewsets.ModelViewSet):
    queryset = Base.objects.filter(is_active=True)
    serializer_class = BaseSerializer
    # permission_classes = [IsDispatcher]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["base_type", "is_active"]
    search_fields = ["name", "icao_code"]

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        if self.request.method in ["GET", "HEAD", "OPTIONS"]:
            return [IsAuthenticated()]
        return [IsAdminOrCFI()]


class AircraftTypeViewSet(viewsets.ModelViewSet):
    queryset = AircraftType.objects.all()
    serializer_class = AircraftTypeSerializer
    permission_classes = [IsDispatcher]


class AircraftViewSet(viewsets.ModelViewSet):
    queryset = Aircraft.objects.select_related(
        "aircraft_type", "home_base", "current_base"
    ).filter(is_active=True)
    permission_classes = [IsDispatcher | IsCAMO]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["status", "current_base", "home_base", "aircraft_type"]
    search_fields = ["tail_number", "serial_number"]

    def get_serializer_class(self):
        if self.action == "list":
            return AircraftListSerializer
        return AircraftDetailSerializer

    @action(detail=False, methods=["get"], url_path="fleet-status")
    def fleet_status(self, request):
        """Real-time fleet status dashboard view — used by Dispatch."""
        base_id = request.query_params.get("base_id")
        qs = self.get_queryset()
        if base_id and base_id.lower() != "all":
            qs = qs.filter(current_base_id=base_id)
        serializer = AircraftListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="aog")
    def aog_aircraft(self, request):
        """All AOG aircraft across the network."""
        qs = self.get_queryset().filter(status="aog")
        serializer = AircraftListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="maintenance")
    def scheduled_maintenance(self, request):
        """All aircraft scheduled for maintenance."""
        qs = self.get_queryset().filter(status="scheduled_maintenance")
        serializer = AircraftListSerializer(qs, many=True)
        return Response(serializer.data)


class RunwayViewSet(viewsets.ModelViewSet):
    queryset = Runway.objects.filter(is_active=True)
    serializer_class = RunwaySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["base", "is_active"]
    search_fields = ["runway_identifier"]

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        if self.request.method in ["GET", "HEAD", "OPTIONS"]:
            return [IsAuthenticated()]
        return [IsAdminOrCFI()]
