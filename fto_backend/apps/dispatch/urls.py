from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import TechLogViewSet, SnagEntryViewSet, BAEquipmentViewSet, BATestEntryViewSet, ba_candidates
from .sync_views import sync_pull, dispatch_record_push

router = DefaultRouter()
router.register("tech-logs", TechLogViewSet, basename="tech-log")
router.register("snags",     SnagEntryViewSet, basename="snag")
router.register("ba-equipment", BAEquipmentViewSet, basename="ba-equipment")
router.register("ba-tests", BATestEntryViewSet, basename="ba-test")

urlpatterns = router.urls + [
    path("sync/pull/", sync_pull, name="dispatch-sync-pull"),
    path("records/", dispatch_record_push, name="dispatch-record-push"),
    path("ba-candidates/", ba_candidates, name="ba-candidates"),
]
