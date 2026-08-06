from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import IsInstructor, IsFlightOperations
from .models import LicenceType, SyllabusStage, SyllabusLesson, SyllabusExercise
from .serializers import LicenceTypeSerializer, SyllabusStageSerializer, SyllabusLessonSerializer, SyllabusExerciseSerializer


class LicenceTypeViewSet(viewsets.ModelViewSet):
    queryset = LicenceType.objects.filter(is_active=True)
    serializer_class = LicenceTypeSerializer
    permission_classes = [IsFlightOperations]
    filterset_fields = ["code", "is_active"]


class SyllabusStageViewSet(viewsets.ModelViewSet):
    queryset = SyllabusStage.objects.prefetch_related("lessons__exercises").all()
    serializer_class = SyllabusStageSerializer
    permission_classes = [IsFlightOperations]
    filterset_fields = ["licence_type"]


class SyllabusExerciseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SyllabusExercise.objects.select_related("lesson__stage").all()
    serializer_class = SyllabusExerciseSerializer
    permission_classes = [IsFlightOperations]
    filterset_fields = ["lesson", "flight_type_required"]
