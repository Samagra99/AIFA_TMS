from rest_framework.routers import DefaultRouter
from .views import BaseViewSet, AircraftTypeViewSet, AircraftViewSet, RunwayViewSet

router = DefaultRouter()
router.register("bases",          BaseViewSet,        basename="base")
router.register("aircraft-types", AircraftTypeViewSet, basename="aircraft-type")
router.register("aircraft",       AircraftViewSet,    basename="aircraft")
router.register("runways",        RunwayViewSet,      basename="runway")

urlpatterns = router.urls
