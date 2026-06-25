from rest_framework.routers import DefaultRouter
from .views import MaintenanceRecordViewSet, AdSbDirectiveViewSet, AmeDutyLogViewSet, SortieGradeViewSet
router = DefaultRouter()
router.register("records",    MaintenanceRecordViewSet, basename="maintenance-record")
router.register("directives", AdSbDirectiveViewSet,     basename="ad-sb-directive")
router.register("ame-duty",   AmeDutyLogViewSet,        basename="ame-duty")
router.register("grades",     SortieGradeViewSet,       basename="sortie-grade")
urlpatterns = router.urls
