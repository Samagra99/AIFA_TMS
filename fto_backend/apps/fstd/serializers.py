from rest_framework import serializers
from .models import FSTDDevice

class FSTDDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = FSTDDevice
        fields = '__all__'
