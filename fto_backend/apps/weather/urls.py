from rest_framework.routers import DefaultRouter
from .views import WeatherViewSet, NotamViewSet, SolarScheduleViewSet

router = DefaultRouter()
router.register("metar",  WeatherViewSet, basename="weather")
router.register("notams", NotamViewSet,   basename="notam")
router.register("solar-schedules", SolarScheduleViewSet, basename="solar-schedules")

urlpatterns = router.urls
