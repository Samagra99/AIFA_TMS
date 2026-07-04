from rest_framework import serializers
from apps.core.scheduling_engine import SchedulingRuleEngine
from .models import Flight, FlightExercise, InstructorDutyLog


class FlightExerciseSerializer(serializers.ModelSerializer):
    exercise_title = serializers.CharField(source="exercise.title", read_only=True)
    class Meta:
        model = FlightExercise
        fields = "__all__"


class FlightSerializer(serializers.ModelSerializer):
    exercises     = FlightExerciseSerializer(many=True, read_only=True)
    duration_minutes = serializers.ReadOnlyField()
    is_solo       = serializers.ReadOnlyField()

    class Meta:
        model = Flight
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def validate(self, data):
        # Run the hard-constraint scheduling rule engine on every confirm attempt
        status = data.get("status", getattr(self.instance, "status", "scheduled"))
        if status == "confirmed":
            engine = SchedulingRuleEngine()
            duration = int(
                (data["scheduled_end"] - data["scheduled_start"]).total_seconds() / 60
            )
            result = engine.check(
                student=data.get("student"),
                instructor=data.get("instructor"),
                aircraft=data.get("aircraft"),
                duration_minutes=duration,
                is_solo=data.get("flight_type", "") in ("solo","cross_country_solo","night_solo"),
            )
            if not result.all_passed:
                raise serializers.ValidationError({
                    "scheduling_rules": result.to_dict()
                })
        return data

    def perform_create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user


class InstructorDutyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstructorDutyLog
        fields = "__all__"
