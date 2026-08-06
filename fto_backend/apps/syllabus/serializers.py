from rest_framework import serializers
from .models import LicenceType, SyllabusStage, SyllabusLesson, SyllabusExercise


class LicenceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LicenceType
        fields = "__all__"


class SyllabusExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyllabusExercise
        fields = "__all__"


class SyllabusLessonSerializer(serializers.ModelSerializer):
    exercises = SyllabusExerciseSerializer(many=True, read_only=True)
    class Meta:
        model = SyllabusLesson
        fields = "__all__"


class SyllabusStageSerializer(serializers.ModelSerializer):
    lessons = SyllabusLessonSerializer(many=True, read_only=True)
    licence_type_detail = LicenceTypeSerializer(source="licence_type", read_only=True)
    class Meta:
        model = SyllabusStage
        fields = "__all__"
