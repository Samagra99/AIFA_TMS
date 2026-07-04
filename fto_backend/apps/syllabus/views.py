from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import IsInstructor
from .models import SyllabusStage, SyllabusLesson, SyllabusExercise
from .serializers import SyllabusStageSerializer, SyllabusLessonSerializer, SyllabusExerciseSerializer


class SyllabusStageViewSet(viewsets.ModelViewSet):
    queryset = SyllabusStage.objects.prefetch_related("lessons__exercises").all()
    serializer_class = SyllabusStageSerializer
    permission_classes = [IsInstructor]
    filterset_fields = ["licence_type"]


class SyllabusExerciseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SyllabusExercise.objects.select_related("lesson__stage").all()
    serializer_class = SyllabusExerciseSerializer
    permission_classes = [IsInstructor]
    filterset_fields = ["lesson", "flight_type_required"]
