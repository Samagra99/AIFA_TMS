from django.utils import timezone
from rest_framework import serializers
from apps.syllabus.models import SyllabusExercise
from apps.maintenance.models import SortieGrade
from .models import (
    InstructorStudentAssignment, DailyPlanRequest,
    InstructorDailyPlan, InstructorDailyPlanEntry, AISuggestedRoster,
)


class AssignmentSerializer(serializers.ModelSerializer):
    instructor_name = serializers.CharField(
        source="instructor.user.get_full_name", read_only=True)
    student_name    = serializers.CharField(
        source="student.user.get_full_name", read_only=True)
    base_name       = serializers.CharField(source="base.name", read_only=True)

    class Meta:
        model  = InstructorStudentAssignment
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class PlanRequestSerializer(serializers.ModelSerializer):
    base_name          = serializers.CharField(source="base.name",     read_only=True)
    base_icao          = serializers.CharField(source="base.icao_code", read_only=True)
    submitted_count    = serializers.SerializerMethodField()
    total_instructors  = serializers.SerializerMethodField()

    class Meta:
        model  = DailyPlanRequest
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def get_submitted_count(self, obj):
        return obj.instructor_plans.filter(status__in=["submitted","approved"]).count()

    def get_total_instructors(self, obj):
        from apps.users.models import Instructor
        return Instructor.objects.filter(
            user__home_base=obj.base, user__is_active=True
        ).count()


# ── Plan entry serializer with student progress detail ────────────────────────
class PlanEntrySerializer(serializers.ModelSerializer):
    student_name        = serializers.CharField(
        source="student.user.get_full_name", read_only=True)
    exercise_code       = serializers.CharField(source="exercise.exercise_code", read_only=True)
    exercise_title      = serializers.CharField(source="exercise.title",         read_only=True)
    exercise_pass_grade = serializers.IntegerField(source="exercise.pass_grade", read_only=True)
    is_buffer           = serializers.BooleanField(source="exercise.is_buffer", read_only=True)
    prereq_ids          = serializers.ListField(
        source="exercise.prerequisite_ids", read_only=True)

    class Meta:
        model  = InstructorDailyPlanEntry
        fields = "__all__"
        read_only_fields = ["id", "prereq_met", "created_at", "updated_at"]

    def validate(self, data):
        exercise = data.get("exercise") or (self.instance and self.instance.exercise)
        student  = data.get("student")  or (self.instance and self.instance.student)
        if not exercise or not student:
            return data
        
        if getattr(exercise, "is_buffer", False):
            data["prereq_met"] = True
            return data

        # Check prerequisites — are all required exercises passed?
        prereqs     = exercise.prerequisite_ids or []
        passed_ids  = set(
            SortieGrade.objects.filter(
                student=student, grade__gte=exercise.pass_grade
            ).values_list("exercise_id", flat=True)
        )
        unmet = [pid for pid in prereqs if str(pid) not in [str(p) for p in passed_ids]]
        data["prereq_met"] = (len(unmet) == 0)

        if unmet and not data.get("cfi_override_requested"):
            raise serializers.ValidationError({
                "exercise": (
                    f"Prerequisite exercise(s) not yet passed. "
                    f"Set cfi_override_requested=true to request CFI approval."
                )
            })
        return data


class InstructorDailyPlanSerializer(serializers.ModelSerializer):
    instructor_name  = serializers.CharField(
        source="instructor.user.get_full_name", read_only=True)
    entries          = PlanEntrySerializer(many=True, read_only=True)
    fdtl_remaining   = serializers.IntegerField(
        source="instructor.fdtl_daily_remaining_min", read_only=True)

    class Meta:
        model  = InstructorDailyPlan
        fields = "__all__"
        read_only_fields = ["id", "instructor", "submitted_at", "created_at", "updated_at"]


# ── AI suggestion serializer ──────────────────────────────────────────────────
class AISuggestedRosterSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AISuggestedRoster
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


# ── Instructor's "student card" — used in the plan submission form ─────────────
class StudentProgressSerializer(serializers.Serializer):
    """
    Returns a student's last graded exercise + what's next — used to
    populate the instructor's daily plan form.
    """
    student_id          = serializers.UUIDField()
    student_name        = serializers.CharField()
    spl_valid           = serializers.BooleanField()
    medical_valid       = serializers.BooleanField()
    hours_total         = serializers.DecimalField(max_digits=7, decimal_places=1)
    last_exercise_code  = serializers.CharField(allow_null=True)
    last_exercise_title = serializers.CharField(allow_null=True)
    last_grade          = serializers.IntegerField(allow_null=True)
    next_exercise_id    = serializers.UUIDField(allow_null=True)
    next_exercise_code  = serializers.CharField(allow_null=True)
    next_exercise_title = serializers.CharField(allow_null=True)
    next_prereq_met     = serializers.BooleanField()
    passed_exercise_ids = serializers.ListField(child=serializers.CharField(), default=[])
