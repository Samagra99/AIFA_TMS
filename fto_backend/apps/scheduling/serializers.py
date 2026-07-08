from rest_framework import serializers
from apps.core.scheduling_engine import SchedulingRuleEngine
from .models import Flight, FlightExercise, InstructorDutyLog


class FlightExerciseSerializer(serializers.ModelSerializer):
    exercise_title = serializers.CharField(source="exercise.title", read_only=True)
    class Meta:
        model = FlightExercise
        fields = "__all__"


class FlightSerializer(serializers.ModelSerializer):

    cfi_override = serializers.BooleanField(write_only=True, required=False, default=False)

    exercises     = FlightExerciseSerializer(many=True, read_only=True)
    duration_minutes = serializers.ReadOnlyField()
    is_solo       = serializers.ReadOnlyField()

    aircraft_name = serializers.CharField(source="aircraft.tail_number", read_only=True)
    instructor_name = serializers.CharField(source="instructor.user.get_full_name", read_only=True)
    # NEW: Send the secondary instructor data to the UI
    secondary_instructor_name = serializers.CharField(
        source="secondary_instructor.user.get_full_name", read_only=True
    )
    student_name = serializers.CharField(source="student.user.get_full_name", read_only=True)

    instructor_user_id = serializers.UUIDField(source="instructor.user.id", read_only=True)
    student_user_id = serializers.UUIDField(source="student.user.id", read_only=True)

    exercise_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Flight
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def create(self, validated_data):
        exercise_id = validated_data.pop("exercise_id", None)
        flight = super().create(validated_data)
        if exercise_id:
            FlightExercise.objects.create(flight=flight, exercise_id=exercise_id)
        return flight

    def validate(self, data):
        # Run the hard-constraint scheduling rule engine on every confirm attempt
        cfi_override = data.pop("cfi_override", False)
        
        # 2. Security Check: Only CFIs and Admins can use this flag
        # if cfi_override:
        #     user = self.context['request'].user
        #     if user.role not in ['cfi', 'superadmin']:
        #         raise serializers.ValidationError({
        #             "cfi_override": "Permission Denied. Only a CFI can override syllabus prerequisites."
        #         })
            
        status = data.get("status", getattr(self.instance, "status", "scheduled"))
        if status == "confirmed":
            engine = SchedulingRuleEngine()

            scheduled_start = data.get("scheduled_start", getattr(self.instance, "scheduled_start", None))
            scheduled_end   = data.get("scheduled_end", getattr(self.instance, "scheduled_end", None))
            student         = data.get("student", getattr(self.instance, "student", None))
            instructor      = data.get("instructor", getattr(self.instance, "instructor", None))
            sec_instructor  = data.get("secondary_instructor", getattr(self.instance, "secondary_instructor", None))
            aircraft        = data.get("aircraft", getattr(self.instance, "aircraft", None))
            flight_type     = data.get("flight_type", getattr(self.instance, "flight_type", ""))

            duration = 60

            if scheduled_start and scheduled_end:
                duration = int((scheduled_end - scheduled_start).total_seconds() / 60)

            # exercise_id = data.get("exercise_id")
            exercise_obj = None
            if "exercise_id" in data:
                exercise_id = data.get("exercise_id")
                if exercise_id:
                    from apps.syllabus.models import SyllabusExercise
                    exercise_obj = SyllabusExercise.objects.filter(id=exercise_id).first()
            elif self.instance:
                # If we are confirming an existing draft, grab its already-attached exercise
                first_ex = self.instance.exercises.first()
                if first_ex:
                    exercise_obj = first_ex.exercise
            
            result = engine.check(
                student=student,
                instructor=instructor,
                secondary_instructor=sec_instructor,
                aircraft=aircraft,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                exercise=exercise_obj,
                duration_minutes=duration,
                is_solo=flight_type in ("solo","cross_country_solo","night_solo"),
                cfi_override=cfi_override,
                flight_id=self.instance.id if self.instance else None
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
