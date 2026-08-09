from rest_framework import serializers
from .models import Airport, CrossCountryRoute, RouteLeg, RouteAlternate, RouteNearbyAirport


class AirportSerializer(serializers.ModelSerializer):
    base_name = serializers.ReadOnlyField(source='base.name')

    class Meta:
        model = Airport
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class RouteLegSerializer(serializers.ModelSerializer):
    airport_icao = serializers.ReadOnlyField(source='airport.icao_code')
    airport_name = serializers.ReadOnlyField(source='airport.name')

    class Meta:
        model = RouteLeg
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class RouteAlternateSerializer(serializers.ModelSerializer):
    airport_icao = serializers.ReadOnlyField(source='airport.icao_code')
    airport_name = serializers.ReadOnlyField(source='airport.name')

    class Meta:
        model = RouteAlternate
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class RouteNearbyAirportSerializer(serializers.ModelSerializer):
    airport_icao = serializers.ReadOnlyField(source='airport.icao_code')
    airport_name = serializers.ReadOnlyField(source='airport.name')

    class Meta:
        model = RouteNearbyAirport
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class CrossCountryRouteSerializer(serializers.ModelSerializer):
    legs             = RouteLegSerializer(many=True, read_only=True)
    alternates       = RouteAlternateSerializer(many=True, read_only=True)
    nearby_airports  = RouteNearbyAirportSerializer(many=True, read_only=True)
    departure_icao   = serializers.ReadOnlyField(source='departure_airport.icao_code')
    departure_name   = serializers.ReadOnlyField(source='departure_airport.name')
    destination_icao = serializers.ReadOnlyField(source='destination_airport.icao_code')
    destination_name = serializers.ReadOnlyField(source='destination_airport.name')
    created_by_name  = serializers.SerializerMethodField()

    class Meta:
        model = CrossCountryRoute
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else ''
