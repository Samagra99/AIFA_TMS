from rest_framework.routers import DefaultRouter
from .views import (
    AssignmentViewSet, DailyPlanRequestViewSet,
    InstructorDailyPlanViewSet, PlanEntryViewSet,
)

router = DefaultRouter()
router.register("assignments",    AssignmentViewSet,            basename="assignment")
router.register("plan-requests",  DailyPlanRequestViewSet,     basename="plan-request")
router.register("instructor-plans", InstructorDailyPlanViewSet, basename="instructor-plan")
router.register("plan-entries",   PlanEntryViewSet,            basename="plan-entry")

urlpatterns = router.urls
