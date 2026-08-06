from rest_framework import serializers
from .models import WeatherCache, NotamCache, SolarSchedule


class WeatherCacheSerializer(serializers.ModelSerializer):
    is_stale = serializers.ReadOnlyField()

    class Meta:
        model  = WeatherCache
        fields = "__all__"


class NotamCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model  = NotamCache
        fields = "__all__"

class SolarScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolarSchedule
        fields = "__all__"
