from rest_framework.routers import DefaultRouter
from .views import WeatherViewSet, NotamViewSet
router = DefaultRouter()
router.register("metar",  WeatherViewSet, basename="weather")
router.register("notams", NotamViewSet,   basename="notam")
urlpatterns = router.urls
