from rest_framework import serializers
from apps.core.permissions import IsCAMO
from apps.scheduling.models import FlightType
from .models import MaintenanceRecord, AdSbDirective, AmeDutyLog, SortieGrade


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    
    tail_number = serializers.CharField(source="aircraft.tail_number", read_only=True)
    snag_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False
    )
    
    class Meta:
        model = MaintenanceRecord
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, data):
        if data.get("crs_issued") and not data.get("crs_issued_by"):
            raise serializers.ValidationError("crs_issued_by is required when issuing a CRS.")
            
        status = data.get("status", getattr(self.instance, "status", "planned"))
        if status in ["in_progress", "completed"]:
            if not data.get("performed_at_date") and not getattr(self.instance, "performed_at_date", None):
                raise serializers.ValidationError({"performed_at_date": "Required for in-progress or completed maintenance."})
            if not data.get("performed_at_hours") and not getattr(self.instance, "performed_at_hours", None):
                raise serializers.ValidationError({"performed_at_hours": "Required for in-progress or completed maintenance."})
                
        return data

    def create(self, validated_data):
        from apps.dispatch.models import SnagEntry
        snag_ids = validated_data.pop("snag_ids", [])
        record = super().create(validated_data)
        if snag_ids:
            SnagEntry.objects.filter(id__in=snag_ids).update(maintenance_record=record)
        return record


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
        read_only_fields = ["id", "graded_at", "created_at", "updated_at", "locked_at", "graded_by"]

    def validate_grade(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError("Grade must be between 1 and 5.")
        return value

    def validate(self, data):
        instance = self.instance
        if instance and instance.is_locked:
            raise serializers.ValidationError("This grade is locked and cannot be modified.")

        flight   = data.get("flight")   or (instance and instance.flight)
        exercise = data.get("exercise") or (instance and instance.exercise)

        if flight and exercise:
            # 1. Verify exercise is attached to flight
            if not flight.exercises.filter(exercise=exercise).exists():
                raise serializers.ValidationError({
                    "exercise": f"Exercise {exercise.exercise_code} was not included in Flight {flight.id}."
                })

            # 2. Check instructor permissions for Dual vs Solo flights
            request = self.context.get("request")
            if request and hasattr(request, "user") and hasattr(request.user, "role"):
                user = request.user
                is_cfi_or_admin = user.role in ("cfi", "superadmin")
                is_dual = flight.flight_type == FlightType.DUAL

                if is_dual and not is_cfi_or_admin:
                    instructor_profile = getattr(user, "instructor_profile", None)
                    if not instructor_profile or (flight.instructor != instructor_profile and flight.secondary_instructor != instructor_profile):
                        assigned_name = flight.instructor.user.get_full_name() if flight.instructor else "the assigned instructor"
                        raise serializers.ValidationError({
                            "detail": f"Permission Denied: Only {assigned_name} (who conducted this dual sortie) is permitted to grade it."
                        })
        return data
