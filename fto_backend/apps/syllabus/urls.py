from rest_framework.routers import DefaultRouter
from .views import SyllabusStageViewSet, SyllabusExerciseViewSet

router = DefaultRouter()
router.register("stages",    SyllabusStageViewSet,    basename="stage")
router.register("exercises", SyllabusExerciseViewSet, basename="exercise")
urlpatterns = router.urls
