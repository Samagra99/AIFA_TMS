from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from .models import WeatherCache, NotamCache
from .serializers import WeatherCacheSerializer, NotamCacheSerializer
from .tasks import fetch_weather_for_base
from ..infrastructure.models import Base


class WeatherViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WeatherCache.objects.all()
    serializer_class = WeatherCacheSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["icao_code"]

    @action(detail=False, methods=["get"], url_path="latest")
    def latest(self, request):
        base_id = request.query_params.get("baseid", "")
        icao = request.query_params.get("icao", "")

        if base_id and base_id != 'all':
            base = get_object_or_404(Base, id=base_id)
            icao = base.icao_code

        if not icao:
            return Response({"detail": "query param required."}, status=400)
        
        wx = WeatherCache.latest_for(icao)
        if not wx:
            # Trigger a fresh fetch and return empty for now
            fetch_weather_for_base.delay(icao)
            return Response({"detail": "No data yet — fetch queued."}, status=202)
        return Response(WeatherCacheSerializer(wx).data)

    @action(detail=False, methods=["get"], url_path="briefing-packet")
    def briefing_packet(self, request):
        """All weather data needed for a pre-flight briefing at a given base."""
        base_id = request.query_params.get("baseid", "")
        icao = request.query_params.get("icao", "")
        
        if base_id and base_id != 'all':
            base = get_object_or_404(Base, id=base_id)
            icao = base.icao_code

        if not icao:
            return Response({"detail": "baseid or icao query param required."}, status=400)
        
        wx   = WeatherCache.latest_for(icao)
        notams = NotamCache.objects.filter(
            icao_code=icao, is_active=True
        ).order_by("-effective_from")[:20]
        return Response({
            "weather": WeatherCacheSerializer(wx).data if wx else None,
            "notams":  NotamCacheSerializer(notams, many=True).data,
            "stale":   wx.is_stale if wx else True,
        })


class NotamViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = NotamCache.objects.filter(is_active=True)
    serializer_class = NotamCacheSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["icao_code", "is_active"]
