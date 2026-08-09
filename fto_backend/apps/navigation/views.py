from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import IsFlightOperations
from .models import Airport, CrossCountryRoute, RouteLeg, RouteAlternate, RouteNearbyAirport
from .serializers import (
    AirportSerializer, CrossCountryRouteSerializer, RouteLegSerializer,
    RouteAlternateSerializer, RouteNearbyAirportSerializer,
)


class AirportViewSet(viewsets.ModelViewSet):
    """Airport catalogue — CRUD for admins, read-only for all authenticated users."""
    queryset = Airport.objects.select_related('base').filter(is_active=True)
    serializer_class = AirportSerializer
    permission_classes = [IsFlightOperations]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['country', 'has_fuel', 'is_verified', 'is_active']
    search_fields = ['icao_code', 'iata_code', 'name', 'city']
    ordering_fields = ['icao_code', 'name']
    ordering = ['icao_code']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return super().get_permissions()


class CrossCountryRouteViewSet(viewsets.ModelViewSet):
    """Cross-country route catalogue with nested briefing packet endpoint."""
    queryset = CrossCountryRoute.objects.select_related(
        'departure_airport', 'destination_airport', 'created_by'
    ).prefetch_related(
        'legs__airport', 'alternates__airport', 'nearby_airports__airport'
    ).filter(is_active=True)
    serializer_class = CrossCountryRouteSerializer
    permission_classes = [IsFlightOperations]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_triangular', 'is_active']
    search_fields = ['name', 'departure_airport__icao_code', 'destination_airport__icao_code']
    ordering = ['name']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'briefing']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get'], url_path='briefing')
    def briefing(self, request, pk=None):
        """
        Assemble latest Weather (METAR/TAF) and active NOTAMs for every
        airport in the route: departure, destination, legs, alternates, nearby.
        """
        from apps.weather.models import WeatherCache, NotamCache
        from apps.weather.serializers import WeatherCacheSerializer, NotamCacheSerializer

        route = self.get_object()

        # Collect all unique ICAOs for this route
        icaos = set()
        icaos.add(route.departure_airport.icao_code)
        icaos.add(route.destination_airport.icao_code)
        for leg in route.legs.all():
            if leg.airport:
                icaos.add(leg.airport.icao_code)
        for alt in route.alternates.all():
            icaos.add(alt.airport.icao_code)
        for nearby in route.nearby_airports.all():
            icaos.add(nearby.airport.icao_code)

        packet = []
        for icao in sorted(icaos):
            weather = WeatherCache.objects.filter(icao_code=icao).order_by('-fetched_at').first()
            notams  = NotamCache.objects.filter(icao_code=icao, is_active=True).order_by('-effective_from')
            packet.append({
                'icao_code':     icao,
                'weather':       WeatherCacheSerializer(weather).data if weather else None,
                'weather_stale': weather.is_stale if weather else True,
                'notams':        NotamCacheSerializer(notams, many=True).data,
            })

        return Response({
            'route_id':   str(route.id),
            'route_name': route.name,
            'airports':   packet,
        })

    @action(detail=True, methods=['post'], url_path='briefing/refresh')
    def briefing_refresh(self, request, pk=None):
        """Force a live weather + NOTAM re-fetch for all airports in the route."""
        from apps.navigation.tasks import fetch_weather_for_route, fetch_notams_for_route
        route = self.get_object()
        fetch_weather_for_route.delay(str(route.id))
        fetch_notams_for_route.delay(str(route.id))
        return Response({'detail': 'Weather and NOTAM refresh queued for all route airports.'})


class RouteLegViewSet(viewsets.ModelViewSet):
    queryset = RouteLeg.objects.select_related('route', 'airport').all()
    serializer_class = RouteLegSerializer
    permission_classes = [IsFlightOperations]
    filterset_fields = ['route']


class RouteAlternateViewSet(viewsets.ModelViewSet):
    queryset = RouteAlternate.objects.select_related('route', 'airport').all()
    serializer_class = RouteAlternateSerializer
    permission_classes = [IsFlightOperations]
    filterset_fields = ['route', 'alternate_type']


class RouteNearbyAirportViewSet(viewsets.ModelViewSet):
    queryset = RouteNearbyAirport.objects.select_related('route', 'airport').all()
    serializer_class = RouteNearbyAirportSerializer
    permission_classes = [IsFlightOperations]
    filterset_fields = ['route']
