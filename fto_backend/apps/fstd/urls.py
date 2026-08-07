from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FSTDDeviceViewSet

router = DefaultRouter()
router.register(r'devices', FSTDDeviceViewSet, basename='fstd-device')

urlpatterns = [
    path('', include(router.urls)),
]
