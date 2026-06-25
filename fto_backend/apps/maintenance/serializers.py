from rest_framework import serializers
from apps.core.permissions import IsCAMO
from .models import MaintenanceRecord, AdSbDirective, AmeDutyLog, SortieGrade


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceRecord
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, data):
        if data.get("crs_issued") and not data.get("crs_issued_by"):
            raise serializers.ValidationError("crs_issued_by is required when issuing a CRS.")
        return data


class AdSbDirectiveSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdSbDirective
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class AmeDutyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AmeDutyLog
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class SortieGradeSerializer(serializers.ModelSerializer):
    passed = serializers.ReadOnlyField()
    is_locked = serializers.ReadOnlyField()
    exercise_title = serializers.CharField(source="exercise.title", read_only=True)

    class Meta:
        model = SortieGrade
        fields = "__all__"
        read_only_fields = ["id", "graded_at", "created_at", "updated_at", "locked_at"]

    def validate_grade(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError("Grade must be between 1 and 5.")
        return value

    def validate(self, data):
        instance = self.instance
        if instance and instance.is_locked:
            raise serializers.ValidationError("This grade is locked and cannot be modified.")
        return data
