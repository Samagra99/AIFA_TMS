from rest_framework.routers import DefaultRouter
from .views import BillingRecordViewSet, EmiPlanViewSet
router = DefaultRouter()
router.register("billing",   BillingRecordViewSet, basename="billing")
router.register("emi-plans", EmiPlanViewSet,       basename="emi-plan")
urlpatterns = router.urls
