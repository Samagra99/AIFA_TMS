from rest_framework import serializers
from .models import WeatherCache, NotamCache


class WeatherCacheSerializer(serializers.ModelSerializer):
    is_stale = serializers.ReadOnlyField()

    class Meta:
        model  = WeatherCache
        fields = "__all__"


class NotamCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model  = NotamCache
        fields = "__all__"
