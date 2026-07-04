from rest_framework.routers import DefaultRouter
from .views import InventoryItemViewSet, InventoryRequisitionViewSet
router = DefaultRouter()
router.register("items",        InventoryItemViewSet,        basename="inventory-item")
router.register("requisitions", InventoryRequisitionViewSet, basename="requisition")
urlpatterns = router.urls
