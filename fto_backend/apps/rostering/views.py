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
    # permission_classes = [IsAdminOrCFI]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["instructor", "student", "base", "is_active"]

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            # Allows Dispatchers (and anyone authenticated) to READ assignments
            return [IsAuthenticated()] 
        # Restricts CREATE/UPDATE/DELETE to CFI/Admin only
        return [IsAdminOrCFI()]

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
        """Saves AI roster suggestion generated server-side via Gemini."""
        req = self.get_object()
        suggestion = AISuggestedRoster.objects.create(
            plan_request = req,
            suggestion   = request.data.get("suggestion", {}),
            prompt_used  = request.data.get("prompt_used", ""),
            model_used   = "gemini-2.5-flash",  # Server-controlled, not client-supplied (C5/M8 Fix)
        )
        return Response(AISuggestedRosterSerializer(suggestion).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="generate-roster")
    def generate_roster(self, request, pk=None):
        """Generates and saves AI roster suggestion server-side via Gemini."""
        from django.conf import settings
        from google import genai
        import re, json
        
        req = self.get_object()
        prompt = request.data.get("prompt", "")
        if not prompt:
            return Response({"detail": "Prompt is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config={'temperature': 0.1}
            )
            
            json_match = re.search(r'\{[\s\S]*\}', response.text)
            if not json_match:
                return Response({"detail": "No valid JSON returned by Gemini."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
            parsed = json.loads(json_match.group(0))
            
            suggestion = AISuggestedRoster.objects.create(
                plan_request=req,
                suggestion=parsed,
                prompt_used=prompt,
                model_used="gemini-2.5-flash"
            )
            return Response(AISuggestedRosterSerializer(suggestion).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Gemini generation failed: {e}")
            return Response({"detail": "AI generation failed. Please try again."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="confirm-roster")
    def confirm_roster(self, request, pk=None):
        """
        Scheduling officer confirms the (optionally AI-adjusted) roster.
        Creates Flight records for each entry in the confirmed_entries list.
        Prevents duplicates by deleting previous DRAFT flights for this date/base,
        and validating against active double-bookings.
        """
        from apps.scheduling.models import Flight, FlightType, FlightStatus, FlightExercise
        from apps.infrastructure.models import Aircraft
        from datetime import datetime
        from django.db.models import Q

        req              = self.get_object()
        confirmed_entries = request.data.get("entries", [])
        suggestion_id    = request.data.get("ai_suggestion_id")

        # ── PREVENT DUPLICATES & STALE DRAFTS ──
        # Delete existing draft flights for this base and plan date created during previous roster confirms
        Flight.objects.filter(
            base=req.base,
            scheduled_start__date=req.plan_date,
            status=FlightStatus.DRAFT
        ).delete()

        created          = []
        errors           = []

        for entry in confirmed_entries:
            try:
                plan_date = req.plan_date
                start_raw = str(entry.get("start_time", "00:00")).strip()
                end_raw   = str(entry.get("end_time", "00:00")).strip()

                def parse_time_str(time_str):
                    for fmt_str in ("%H:%M", "%I:%M %p", "%I:%M%p", "%H:%M:%S"):
                        try:
                            return datetime.strptime(time_str, fmt_str).time()
                        except ValueError:
                            pass
                    return datetime.strptime("00:00", "%H:%M").time()

                start_t = parse_time_str(start_raw)
                end_t   = parse_time_str(end_raw)

                start_dt = timezone.make_aware(datetime.combine(plan_date, start_t))
                end_dt   = timezone.make_aware(datetime.combine(plan_date, end_t))

                # Sanitize FK fields to avoid empty string "" UUID errors
                student_id    = entry.get("student_id") or None
                instructor_id = entry.get("instructor_id") or None
                aircraft_id   = entry.get("aircraft_id") or None
                exercise_id   = entry.get("exercise_id") or None

                if not aircraft_id or not instructor_id:
                    errors.append({"entry": entry, "error": "Aircraft ID and Instructor ID are required."})
                    continue

                # Check double bookings against active flights
                overlapping = Flight.objects.filter(
                    status__in=[
                        FlightStatus.DRAFT, FlightStatus.SCHEDULED,
                        FlightStatus.CONFIRMED, FlightStatus.DISPATCHED, FlightStatus.AIRBORNE
                    ],
                    scheduled_start__lt=end_dt,
                    scheduled_end__gt=start_dt
                )

                conflict_q = Q(aircraft_id=aircraft_id) | Q(instructor_id=instructor_id)
                if student_id:
                    conflict_q |= Q(student_id=student_id)

                conflict = overlapping.filter(conflict_q).first()
                if conflict:
                    errors.append({
                        "entry": entry,
                        "error": f"Conflict detected with active Flight {conflict.id}"
                    })
                    continue

                # ── SAFETY RULE ENGINE CHECK (C1 Fix) ──
                from apps.core.scheduling_engine import SchedulingRuleEngine
                from apps.users.models import Student, Instructor
                engine = SchedulingRuleEngine()
                student_obj = Student.objects.filter(id=student_id).first() if student_id else None
                instructor_obj = Instructor.objects.filter(id=instructor_id).first() if instructor_id else None
                aircraft_obj = Aircraft.objects.filter(id=aircraft_id).first() if aircraft_id else None

                engine_result = engine.check(
                    student=student_obj,
                    instructor=instructor_obj,
                    aircraft=aircraft_obj,
                    scheduled_start=start_dt,
                    scheduled_end=end_dt,
                    duration_minutes=int((end_dt - start_dt).total_seconds() / 60),
                    flight_id=None,
                )
                if not engine_result.all_passed:
                    errors.append({
                        "entry": entry,
                        "error": f"Safety check failed: {engine_result.to_dict()}"
                    })
                    continue

                flight = Flight.objects.create(
                    base            = req.base,
                    student_id     = student_id,
                    instructor_id  = instructor_id,
                    aircraft_id    = aircraft_id,
                    flight_type    = entry.get("flight_type", FlightType.DUAL),
                    is_ferry       = entry.get("is_ferry", False),
                    scheduled_start= start_dt,
                    scheduled_end  = end_dt,
                    status         = FlightStatus.DRAFT,
                    notes          = entry.get("notes", ""),
                    created_by     = request.user,
                )

                if exercise_id:
                    FlightExercise.objects.create(flight=flight, exercise_id=exercise_id)

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

        req.status = PlanRequestStatus.CLOSED
        req.save(update_fields=["status"])

        return Response({
            "created": len(created),
            "errors":  errors,
            "flight_ids": created,
        })
    
    @action(detail=True, methods=["post"], url_path="submit-for-review")
    def submit_for_review(self, request, pk=None):
        """Dispatcher submits the drafted timeline to the CFI."""
        req = self.get_object()
        if req.status not in (PlanRequestStatus.CLOSED, PlanRequestStatus.REJECTED_BY_CFI, PlanRequestStatus.OPEN):
            return Response(
                {"detail": f"Cannot submit for review from status '{req.status}'. Expected 'closed', 'rejected_by_cfi', or 'open'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        req.status = PlanRequestStatus.PENDING_CFI_APPROVAL
        req.save(update_fields=["status"])
        return Response({"detail": "Roster submitted for CFI review."})
    
    @action(detail=True, methods=["post"], url_path="approve-roster")
    def approve_roster(self, request, pk=None):
        """CFI Approves the roster. Draft flights become Confirmed."""
        from apps.scheduling.models import Flight, FlightStatus
        if request.user.role not in ("cfi", "superadmin"):
            return Response({"detail": "Only CFI can approve the roster."}, status=403)
        
        req = self.get_object()
        req.status       = PlanRequestStatus.ROSTERED
        req.reviewed_by  = request.user
        req.reviewed_at  = timezone.now()
        req.cfi_comments = request.data.get("comments", "")
        req.save(update_fields=["status", "reviewed_by", "reviewed_at", "cfi_comments"])

        # Transition all draft flights individually to fire signals & notifications (C2 Fix)
        draft_flights = Flight.objects.filter(
            scheduled_start__date=req.plan_date,
            status=FlightStatus.DRAFT
        )
        for flight in draft_flights:
            flight.status = FlightStatus.CONFIRMED
            flight.save(update_fields=["status", "updated_at"])

        # Auto-approve any pending overrides attached to these drafts
        InstructorDailyPlanEntry.objects.filter(
            plan__plan_request=req, cfi_override_requested=True, cfi_override_approved=False
        ).update(cfi_override_approved=True, cfi_approved_by=request.user, prereq_met=True)

        return Response({"detail": "Roster approved and flights confirmed. Notifications dispatched."})
    
    @action(detail=True, methods=["post"], url_path="reject-roster")
    def reject_roster(self, request, pk=None):
        """CFI Rejects the roster and returns it to Dispatcher with comments."""
        if request.user.role not in ("cfi", "superadmin"):
            return Response({"detail": "Only CFI can reject the roster."}, status=403)
        
        comments = request.data.get("comments")
        if not comments:
            return Response({"detail": "Comments are mandatory for rejection."}, status=400)

        req = self.get_object()
        req.status       = PlanRequestStatus.REJECTED_BY_CFI
        req.reviewed_by  = request.user
        req.reviewed_at  = timezone.now()
        req.cfi_comments = comments
        req.save(update_fields=["status", "reviewed_by", "reviewed_at", "cfi_comments"])
        
        return Response({"detail": "Roster returned to dispatcher for corrections."})


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
            "passed_exercise_ids": [str(eid) for eid in passed_ex_ids],
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
            Q(spl_number__icontains=q),
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
        # Lock submissions when plan request is closed
        if plan.plan_request.status in (PlanRequestStatus.CLOSED, PlanRequestStatus.PENDING_CFI_APPROVAL, PlanRequestStatus.ROSTERED):
            return Response({"detail": "Plan request is closed. No further submissions accepted."}, status=status.HTTP_400_BAD_REQUEST)
        if plan.status == InstructorPlanStatus.SUBMITTED:
            return Response({"detail": "Already submitted."}, status=400)
        if not plan.entries.exists():
            return Response({"detail": "Add at least one sortie entry before submitting."}, status=400)
        plan.status       = InstructorPlanStatus.SUBMITTED
        plan.submitted_at = timezone.now()
        plan.save(update_fields=["status", "submitted_at"])
        return Response({"detail": "Plan submitted successfully."})

    @action(detail=False, methods=["post"], url_path="mark-leave")
    def mark_leave(self, request):
        """Instructor marks themselves as ON LEAVE for a plan request date."""
        plan_request_id = request.data.get("plan_request")
        notes           = request.data.get("notes", "On Leave")
        if not plan_request_id:
            return Response({"detail": "plan_request parameter required."}, status=400)
        try:
            instructor = request.user.instructor_profile
        except Exception:
            return Response({"detail": "Not an instructor profile."}, status=403)

        plan, created = InstructorDailyPlan.objects.get_or_create(
            plan_request_id=plan_request_id,
            instructor=instructor,
            defaults={
                "availability_start": "00:00",
                "availability_end":   "00:00",
                "status":             InstructorPlanStatus.LEAVE,
                "notes":              notes,
                "submitted_at":       timezone.now(),
            }
        )
        if not created:
            plan.status       = InstructorPlanStatus.LEAVE
            plan.notes        = notes
            plan.submitted_at = timezone.now()
            plan.save(update_fields=["status", "notes", "submitted_at"])

        return Response({"detail": "Marked as on leave successfully.", "plan_id": str(plan.id)})


# ── Plan Entry — CFI override approval ───────────────────────────────────────
class PlanEntryViewSet(viewsets.ModelViewSet):
    queryset           = InstructorDailyPlanEntry.objects.select_related(
        "student__user", "exercise", "plan__instructor__user"
    ).all()
    serializer_class   = PlanEntrySerializer
    permission_classes = [IsInstructor]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ["plan", "student", "cfi_override_requested", "cfi_override_approved"]

    def perform_create(self, serializer):
        plan = serializer.validated_data.get('plan')
        if plan and plan.plan_request.status in (
            PlanRequestStatus.CLOSED, PlanRequestStatus.PENDING_CFI_APPROVAL, PlanRequestStatus.ROSTERED
        ):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": "Plan request is closed. No further entries accepted."})
        serializer.save()

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
