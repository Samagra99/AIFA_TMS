from rest_framework import serializers
from .models import Base, AircraftType, Aircraft


class BaseSerializer(serializers.ModelSerializer):
    is_hub = serializers.ReadOnlyField()

    class Meta:
        model = Base
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class AircraftTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AircraftType
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class AircraftListSerializer(serializers.ModelSerializer):
    aircraft_type_name  = serializers.CharField(source="aircraft_type.make_model", read_only=True)
    home_base_name      = serializers.CharField(source="home_base.name", read_only=True)
    current_base_name   = serializers.CharField(source="current_base.name", read_only=True)
    ferry_buffer_triggered = serializers.ReadOnlyField()
    hours_to_next_inspection = serializers.ReadOnlyField()

    class Meta:
        model = Aircraft
        fields = [
            "id", "tail_number", "aircraft_type", "aircraft_type_name",
            "home_base", "home_base_name", "current_base", "current_base_name",
            "status", "aog_reason", "aog_since",
            "hobbs_total", "tacho_total",
            "next_50hr_at", "next_100hr_at", "next_annual_due",
            "ferry_buffer_triggered", "hours_to_next_inspection",
            "is_active",
        ]


class AircraftDetailSerializer(serializers.ModelSerializer):
    aircraft_type_detail = AircraftTypeSerializer(source="aircraft_type", read_only=True)
    ferry_buffer_triggered = serializers.ReadOnlyField()

    class Meta:
        model = Aircraft
        fields = "__all__"
        read_only_fields = ("id", "hobbs_total", "tacho_total", "created_at", "updated_at")
