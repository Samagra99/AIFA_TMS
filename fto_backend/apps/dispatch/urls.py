from rest_framework.routers import DefaultRouter
from .views import TechLogViewSet, SnagEntryViewSet
router = DefaultRouter()
router.register("tech-logs", TechLogViewSet, basename="tech-log")
router.register("snags",     SnagEntryViewSet, basename="snag")
urlpatterns = router.urls
