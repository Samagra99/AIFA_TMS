from rest_framework.routers import DefaultRouter
from .views import OccurrenceReportViewSet, HazardEntryViewSet
from django.urls import include, path

router = DefaultRouter()
router.register("occurrences", OccurrenceReportViewSet, basename="occurrence")
router.register("hazards",     HazardEntryViewSet,      basename="hazard")
# urlpatterns = router.urls
urlpatterns = [
    *router.urls,

    # Existing compliance URLs
    path("", include("apps.compliance.audit_urls")),
]