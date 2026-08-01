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


class WeatherViewSet(viewsets.ModelViewSet):
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

    @action(detail=False, methods=["post"], url_path="manual-entry")
    def manual_entry(self, request):
        """Manual METAR/TAF entry when API is unreachable or data unavailable."""
        icao = request.data.get("icao_code")
        if not icao:
            return Response({"detail": "icao_code is required."}, status=400)

        base = Base.objects.filter(icao_code=icao).first()
        elevation_ft = base.elevation_ft if base else 0

        temp_c = request.data.get("temp_celsius")
        qnh = request.data.get("qnh_hpa")
        da = WeatherCache.compute_density_altitude(temp_c, qnh, elevation_ft)

        # Parse observation time from METAR
        metar_raw = request.data.get("metar_raw", "")
        obs_time = request.data.get("observation_time")
        if not obs_time and metar_raw:
            import re
            import datetime
            match = re.search(r'\b(\d{2})(\d{2})(\d{2})Z\b', metar_raw)
            if match:
                day, hour, minute = int(match.group(1)), int(match.group(2)), int(match.group(3))
                now = timezone.now()
                try:
                    parsed_time = now.replace(day=day, hour=hour, minute=minute, second=0, microsecond=0)
                    # If parsed time is more than 1 day in the future, it probably belongs to the previous month
                    if parsed_time > now + datetime.timedelta(days=1):
                        if now.month == 1:
                            parsed_time = parsed_time.replace(year=now.year - 1, month=12)
                        else:
                            parsed_time = parsed_time.replace(month=now.month - 1)
                    obs_time = parsed_time
                except ValueError:
                    pass

        if not obs_time:
            obs_time = timezone.now()

        wx = WeatherCache.objects.create(
            icao_code=icao,
            metar_raw=metar_raw,
            taf_raw=request.data.get("taf_raw", ""),
            wind_direction_deg=request.data.get("wind_direction_deg"),
            wind_speed_kt=request.data.get("wind_speed_kt"),
            wind_gust_kt=request.data.get("wind_gust_kt"),
            visibility_m=request.data.get("visibility_m"),
            temp_celsius=temp_c,
            dewpoint_celsius=request.data.get("dewpoint_celsius"),
            qnh_hpa=qnh,
            cloud_layers=request.data.get("cloud_layers", []),
            density_altitude_ft=da,
            observation_time=obs_time,
            source="manual",
            source_remarks=request.data.get("source_remarks", "Manual entry — API unreachable or data unavailable"),
            entered_by=request.user,
            active_runway_id=request.data.get("active_runway_id"),
        )
        return Response(WeatherCacheSerializer(wx).data, status=201)

    @action(detail=False, methods=["post"], url_path="set-active-runway")
    def set_active_runway(self, request):
        """Set the currently active runway for a base."""
        base_id = request.data.get("base_id")
        runway_id = request.data.get("runway_id")
        if not base_id or not runway_id:
            return Response({"detail": "base_id and runway_id are required."}, status=400)
        base = get_object_or_404(Base, id=base_id)
        from apps.infrastructure.models import Runway
        runway = get_object_or_404(Runway, id=runway_id, base=base)
        base.active_runway = runway
        base.save(update_fields=["active_runway", "updated_at"])
        return Response({"detail": f"Active runway set to {runway.runway_identifier} at {base.icao_code}."})


class NotamViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = NotamCache.objects.filter(is_active=True)
    serializer_class = NotamCacheSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["icao_code", "is_active"]
