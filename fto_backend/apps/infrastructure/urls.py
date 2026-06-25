from rest_framework.routers import DefaultRouter
from .views import BaseViewSet, AircraftTypeViewSet, AircraftViewSet

router = DefaultRouter()
router.register("bases",          BaseViewSet,        basename="base")
router.register("aircraft-types", AircraftTypeViewSet, basename="aircraft-type")
router.register("aircraft",       AircraftViewSet,    basename="aircraft")

urlpatterns = router.urls
