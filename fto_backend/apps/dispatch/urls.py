from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import TechLogViewSet, SnagEntryViewSet
from .sync_views import sync_pull, dispatch_record_push

router = DefaultRouter()
router.register("tech-logs", TechLogViewSet, basename="tech-log")
router.register("snags",     SnagEntryViewSet, basename="snag")
urlpatterns = router.urls + [
    path("sync/pull/", sync_pull, name="dispatch-sync-pull"),
    path("records/", dispatch_record_push, name="dispatch-record-push"),
]
