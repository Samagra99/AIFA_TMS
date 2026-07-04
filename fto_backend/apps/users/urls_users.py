from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers as nested_routers
from .views import UserViewSet, InstructorViewSet, StudentViewSet, StudentDocumentViewSet

router = DefaultRouter()
router.register("list",        UserViewSet,       basename="user")
router.register("instructors", InstructorViewSet, basename="instructor")
router.register("students",    StudentViewSet,    basename="student")

students_router = nested_routers.NestedDefaultRouter(router, "students", lookup="student")
students_router.register("documents", StudentDocumentViewSet, basename="student-document")

urlpatterns = router.urls + students_router.urls
