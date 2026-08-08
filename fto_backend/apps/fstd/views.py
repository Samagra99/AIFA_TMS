from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import IsFlightOperations
from .models import FSTDDevice
from .serializers import FSTDDeviceSerializer

class FSTDDeviceViewSet(viewsets.ModelViewSet):
    queryset = FSTDDevice.objects.all()
    serializer_class = FSTDDeviceSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_active', 'aircraft_type']

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsFlightOperations()]
        return [IsAuthenticated()]
