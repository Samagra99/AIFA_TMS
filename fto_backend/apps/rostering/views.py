import logging
from datetime import date
from django.utils import timezone
from django.db import models
from rest_framework import viewsets, status, serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.permissions import SAFE_METHODS
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from ..core.permissions import IsAdminOrCFI, IsInstructor, IsDispatcher
from ..maintenance.models import SortieGrade
from ..syllabus.models import SyllabusExercise
from ..users.models import Instructor, Student
from .models import (
    InstructorStudentAssignment, DailyPlanRequest,
    InstructorDailyPlan, InstructorDailyPlanEntry, AISuggestedRoster,
    PlanRequestStatus, InstructorPlanStatus,
)
from .serializers import (
    AssignmentSerializer, PlanRequestSerializer,
    InstructorDailyPlanSerializer, PlanEntrySerializer,
    AISuggestedRosterSerializer, StudentProgressSerializer,
)

logger = logging.getLogger(__name__)


# ── Instructor-Student Assignment ─────────────────────────────────────────────
class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = InstructorStudentAssignment.objects.select_related(
        "instructor__user", "student__user", "base"
    ).filter(is_active=True)
    serializer_class   = AssignmentSerializer
    permission_classes = [IsAdminOrCFI]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["instructor", "student", "base", "is_active"]

    def perform_create(self, serializer):
        serializer.save(assigned_by=self.request.user)


# ── Daily Plan Request ────────────────────────────────────────────────────────
class DailyPlanRequestViewSet(viewsets.ModelViewSet):
    # queryset = DailyPlanRequest.objects.select_related("base").all()
    serializer_class   = PlanRequestSerializer
    # permission_classes = [IsDispatcher]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["status", "base", "plan_date"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "progress", "all_plans", "latest_ai_suggestion"):
            return [IsAuthenticated()]
        return [IsDispatcher()]

    def get_queryset(self):
        user = self.request.user
        qs   = DailyPlanRequest.objects.select_related("base").all()
        if user.role == "instructor":
            return qs.filter(base=user.home_base)
        return qs
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"], url_path="progress")
    def progress(self, request, pk=None):
        """How many instructors have submitted vs total."""
        req        = self.get_object()
        plans      = req.instructor_plans.all()
        submitted  = plans.filter(status__in=["submitted","approved"]).count()
        pending    = plans.filter(status="pending").count()
        total_inst = Instructor.objects.filter(
            user__home_base=req.base, user__is_active=True
        ).count()
        return Response({
            "plan_date":   req.plan_date,
            "status":      req.status,
            "deadline":    req.deadline,
            "total":       total_inst,
            "submitted":   submitted,
            "pending":     pending,
            "awaiting":    total_inst - submitted,
        })

    @action(detail=True, methods=["post"], url_path="close")
    def close_request(self, request, pk=None):
        """CFI closes the request — no more plan submissions accepted."""
        req        = self.get_object()
        req.status = PlanRequestStatus.CLOSED
        req.save(update_fields=["status"])
        return Response({"detail": "Plan request closed."})

    @action(detail=True, methods=["get"], url_path="all-plans")
    def all_plans(self, request, pk=None):
        """CFI view: all instructor plans for this request."""
        req   = self.get_object()
        plans = req.instructor_plans.select_related(
            "instructor__user"
        ).prefetch_related("entries__student__user", "entries__exercise")
        return Response(InstructorDailyPlanSerializer(plans, many=True).data)

    @action(detail=True, methods=["get"], url_path="latest-ai-suggestion")
    def latest_ai_suggestion(self, request, pk=None):
        req = self.get_object()
        suggestion = req.ai_suggestions.order_by("-created_at").first()
        if not suggestion:
            return Response({"detail": "No AI suggestion generated yet."}, status=404)
        return Response(AISuggestedRosterSerializer(suggestion).data)

    @action(detail=True, methods=["post"], url_path="save-ai-suggestion")
    def save_ai_suggestion(self, request, pk=None):
        """Frontend saves the Claude response here after calling the API client-side."""
        req = self.get_object()
        suggestion = AISuggestedRoster.objects.create(
            plan_request = req,
            suggestion   = request.data.get("suggestion", {}),
            prompt_used  = request.data.get("prompt_used", ""),
            model_used   = request.data.get("model_used", "claude-sonnet-4-6"),
        )
        return Response(AISuggestedRosterSerializer(suggestion).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="confirm-roster")
    def confirm_roster(self, request, pk=None):
        """
        Scheduling officer confirms the (optionally AI-adjusted) roster.
        Creates Flight records for each entry in the confirmed_entries list.
        """
        from ..scheduling.models import Flight, FlightType, FlightStatus
        from ..infrastructure.models import Aircraft

        req              = self.get_object()
        confirmed_entries = request.data.get("entries", [])
        suggestion_id    = request.data.get("ai_suggestion_id")
        created          = []
        errors           = []

        for entry in confirmed_entries:
            try:
                from datetime import datetime, date as dt_date
                plan_date = req.plan_date
                start_str = entry.get("start_time", "00:00").replace(" AM", "").replace(" PM", "").strip()[:5]
                end_str   = entry.get("end_time", "00:00").replace(" AM", "").replace(" PM", "").strip()[:5]

                start_dt = timezone.make_aware(
                    datetime.strptime(f"{plan_date} {start_str}", "%Y-%m-%d %H:%M")
                )
                end_dt = timezone.make_aware(
                    datetime.strptime(f"{plan_date} {end_str}", "%Y-%m-%d %H:%M")
                )

                flight = Flight.objects.create(
                    base_id        = entry["base_id"],
                    student_id     = entry.get("student_id"),
                    instructor_id  = entry["instructor_id"],
                    aircraft_id    = entry["aircraft_id"],
                    flight_type    = entry.get("flight_type", FlightType.DUAL),
                    is_ferry       = entry.get("is_ferry", False),
                    scheduled_start= start_dt,
                    scheduled_end  = end_dt,
                    status         = FlightStatus.CONFIRMED,
                    notes          = entry.get("notes", ""),
                    created_by     = request.user,
                )
                created.append(str(flight.id))
            except Exception as exc:
                errors.append({"entry": entry, "error": str(exc)})

        # Mark suggestion as confirmed
        if suggestion_id:
            AISuggestedRoster.objects.filter(id=suggestion_id).update(
                confirmed    = True,
                confirmed_at = timezone.now(),
                confirmed_by = request.user,
            )

        req.status = PlanRequestStatus.ROSTERED
        req.save(update_fields=["status"])

        return Response({
            "created": len(created),
            "errors":  errors,
            "flight_ids": created,
        })


# ── Instructor Daily Plan ─────────────────────────────────────────────────────
class InstructorDailyPlanViewSet(viewsets.ModelViewSet):
    serializer_class   = InstructorDailyPlanSerializer
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["plan_request", "instructor", "status"]

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [IsAuthenticated()] 
        return [IsInstructor()]

    def get_queryset(self):
        user = self.request.user
        qs   = InstructorDailyPlan.objects.select_related(
            "instructor__user", "plan_request"
        ).prefetch_related("entries__student__user", "entries__exercise")

        user_role = getattr(user, 'role', '').lower()
        if user_role in ("cfi", "superadmin", "dispatcher"):
            return qs.all()
            
        try:
            return qs.filter(instructor__user=user)
        except Exception:
            return qs.none()
            
    def perform_create(self, serializer):
        try:
            instructor = self.request.user.instructor_profile
        except Exception:
            raise drf_serializers.ValidationError({"instructor":"No instructor profile linked to account."})
        serializer.save(instructor=instructor)

    # ── SHARED GRADING HELPER ──────────────────────────────────────────────────
    def _get_student_progress_dict(self, student, today):
        """Helper to evaluate syllabus progress and return the frontend dict."""
        last_grade = SortieGrade.objects.filter(
            student=student
        ).order_by("-graded_at").select_related("exercise").first()

        # Strict check against the specific exercise's pass_grade
        passed_ex_ids = set(
            SortieGrade.objects.filter(
                student=student,
                grade__gte=models.F('exercise__pass_grade')
            ).values_list("exercise_id", flat=True)
        )

        next_ex     = None
        prereq_met  = True
        for ex in SyllabusExercise.objects.order_by(
            "lesson__stage__sequence_order",
            "lesson__sequence_order",
            "sequence_order"
        ):
            if str(ex.id) not in [str(p) for p in passed_ex_ids]:
                unmet = [p for p in (ex.prerequisite_ids or [])
                         if str(p) not in [str(q) for q in passed_ex_ids]]
                next_ex    = ex
                prereq_met = len(unmet) == 0
                break

        return {
            "student_id":          str(student.id),
            "student_name":        student.user.get_full_name(),
            "spl_valid":           bool(student.spl_expiry and student.spl_expiry > today),
            "medical_valid":       bool(student.medical_expiry and student.medical_expiry > today),
            "hours_total":         str(student.hours_total),
            "last_exercise_code":  last_grade.exercise.exercise_code if last_grade else None,
            "last_exercise_title": last_grade.exercise.title if last_grade else None,
            "last_grade":          last_grade.grade if last_grade else None,
            "next_exercise_id":    str(next_ex.id)    if next_ex else None,
            "next_exercise_code":  next_ex.exercise_code if next_ex else None,
            "next_exercise_title": next_ex.title       if next_ex else None,
            "next_prereq_met":     prereq_met,
        }

    # ── ENDPOINTS ──────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="my-students")
    def my_students(self, request):
        try:
            instructor = request.user.instructor_profile
        except Exception:
            return Response({"detail": "Not an instructor."}, status=403)

        assignments = InstructorStudentAssignment.objects.filter(
            instructor=instructor, is_active=True
        ).select_related("student__user")

        today  = timezone.now().date()
        result = [self._get_student_progress_dict(a.student, today) for a in assignments]
        return Response(result)

    @action(detail=False, methods=["get"], url_path="search-students")
    def search_students(self, request):
        """Allows instructors to look up unassigned students (e.g. for check rides)."""
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])
        
        from django.db.models import Q
        students = Student.objects.filter(
            Q(user__first_name__icontains=q) | 
            Q(user__last_name__icontains=q) | 
            Q(enrollment_number__icontains=q),
            user__is_active=True
        ).select_related("user")[:10]

        today  = timezone.now().date()
        result = [self._get_student_progress_dict(s, today) for s in students]
        return Response(result)

    @action(detail=False, methods=["get"], url_path="my-plan")
    def my_plan(self, request):
        plan_request_id = request.query_params.get("plan_request")
        if not plan_request_id:
            return Response({"detail": "plan_request parameter required."}, status=400)
        try:
            instructor = request.user.instructor_profile
            plan = InstructorDailyPlan.objects.get(plan_request_id=plan_request_id, instructor=instructor)
            return Response(self.get_serializer(plan).data)
        except InstructorDailyPlan.DoesNotExist:
            return Response(None)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        plan = self.get_object()
        if plan.status == InstructorPlanStatus.SUBMITTED:
            return Response({"detail": "Already submitted."}, status=400)
        if not plan.entries.exists():
            return Response({"detail": "Add at least one sortie entry before submitting."}, status=400)
        plan.status       = InstructorPlanStatus.SUBMITTED
        plan.submitted_at = timezone.now()
        plan.save(update_fields=["status", "submitted_at"])
        return Response({"detail": "Plan submitted successfully."})


# ── Plan Entry — CFI override approval ───────────────────────────────────────
class PlanEntryViewSet(viewsets.ModelViewSet):
    queryset           = InstructorDailyPlanEntry.objects.select_related(
        "student__user", "exercise", "plan__instructor__user"
    ).all()
    serializer_class   = PlanEntrySerializer
    permission_classes = [IsInstructor]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["plan", "student", "cfi_override_requested", "cfi_override_approved"]

    @action(detail=True, methods=["post"], url_path="approve-override")
    def approve_override(self, request, pk=None):
        """CFI approves a prerequisite bypass for this entry."""
        if request.user.role not in ("cfi", "superadmin"):
            return Response({"detail": "Only CFI can approve overrides."}, status=403)
        entry = self.get_object()
        entry.cfi_override_approved = True
        entry.cfi_approved_by       = request.user
        entry.prereq_met            = True     # treat as met after CFI approval
        entry.save(update_fields=["cfi_override_approved", "cfi_approved_by", "prereq_met"])
        return Response({"detail": f"Override approved for {entry.student.user.get_full_name()}"})

    @action(detail=True, methods=["post"], url_path="reject-override")
    def reject_override(self, request, pk=None):
        """CFI rejects the bypass — instructor must choose a different exercise."""
        if request.user.role not in ("cfi", "superadmin"):
            return Response({"detail": "Only CFI can reject overrides."}, status=403)
        entry = self.get_object()
        entry.cfi_override_requested = False
        entry.cfi_override_approved  = False
        entry.save(update_fields=["cfi_override_requested", "cfi_override_approved"])
        return Response({"detail": "Override rejected. Instructor must revise their plan."})
