from rest_framework.routers import DefaultRouter
from .views import OccurrenceReportViewSet, HazardEntryViewSet
router = DefaultRouter()
router.register("occurrences", OccurrenceReportViewSet, basename="occurrence")
router.register("hazards",     HazardEntryViewSet,      basename="hazard")
urlpatterns = router.urls
