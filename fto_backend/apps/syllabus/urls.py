from rest_framework.routers import DefaultRouter
from .views import LicenceTypeViewSet, SyllabusStageViewSet, SyllabusExerciseViewSet

router = DefaultRouter()
router.register("licence-types", LicenceTypeViewSet, basename="licence-type")
router.register("stages",        SyllabusStageViewSet,    basename="stage")
router.register("exercises",     SyllabusExerciseViewSet, basename="exercise")
urlpatterns = router.urls
