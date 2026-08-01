"""
Rostering app — manages the instructor-plan → AI-suggest → FullCalendar workflow.

Flow:
  1. CFI creates a DailyPlanRequest for a specific date + base.
  2. Each active instructor at that base receives a notification and
     submits an InstructorDailyPlan (availability window + sortie entries).
  3. Each InstructorDailyPlanEntry links a student to an exercise.
     If the prerequisite is not met, a CFI override is requested.
  4. Once all plans are in, the scheduling officer triggers AI roster
     generation. The AISuggestedRoster stores Gemini's response.
  5. The scheduling officer reviews, adjusts via drag-drop, and
     "confirms" — which bulk-creates Flight records.
"""
import uuid
from django.db import models
from apps.core.models import AuditedModel, TimeStampedModel


class InstructorStudentAssignment(TimeStampedModel):
    """
    Permanent (course-duration) assignment of a student to an instructor.
    Used to populate each instructor's plan form with their student list.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instructor  = models.ForeignKey("users.Instructor", on_delete=models.PROTECT,
                                    related_name="student_assignments")
    student     = models.ForeignKey("users.Student",    on_delete=models.PROTECT,
                                    related_name="instructor_assignments")
    base        = models.ForeignKey("infrastructure.Base", on_delete=models.PROTECT)
    assigned_by = models.ForeignKey("users.User", on_delete=models.SET_NULL,
                                    null=True, related_name="+")
    assigned_date = models.DateField(auto_now_add=True)
    is_active     = models.BooleanField(default=True)
    notes         = models.TextField(blank=True, null=True)

    class Meta:
        db_table        = "instructor_student_assignments"
        unique_together = [("instructor", "student")]
        ordering        = ["instructor", "student"]

    def __str__(self):
        return (f"{self.instructor.user.get_full_name()} ↔ "
                f"{self.student.user.get_full_name()}")


class PlanRequestStatus(models.TextChoices):
    OPEN      = "open",      "Open (awaiting submissions)"
    CLOSED    = "closed",    "Closed (Drafting In progress)"
    PENDING_CFI_APPROVAL = "pending_cfi_approval", "Pending CFI Approval"
    REJECTED_BY_CFI      = "rejected_by_cfi",      "Rejected by CFI (Needs correction)"
    ROSTERED  = "rostered",  "Roster generated"


class DailyPlanRequest(AuditedModel):
    """
    Sent by CFI/scheduling officer to all instructors at a base,
    requesting their availability + intended sorties for a specific date.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan_date    = models.DateField(db_index=True)
    base         = models.ForeignKey("infrastructure.Base", on_delete=models.PROTECT,
                                     related_name="plan_requests")
    deadline     = models.DateTimeField(help_text="Instructors must submit by this time")
    status       = models.CharField(max_length=20, choices=PlanRequestStatus.choices,
                                    default=PlanRequestStatus.OPEN)
    notes        = models.TextField(blank=True, null=True,
                                    help_text="Instructions or context for instructors")

    cfi_comments = models.TextField(blank=True, null=True, help_text="Reason for rejection or changes required")
    reviewed_by  = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_rosters")
    reviewed_at  = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table        = "daily_plan_requests"
        unique_together = [("plan_date", "base")]
        ordering        = ["-plan_date"]

    def __str__(self):
        return f"Plan Request {self.plan_date} — {self.base.icao_code}"


class InstructorPlanStatus(models.TextChoices):
    PENDING   = "pending",   "Pending"
    SUBMITTED = "submitted", "Submitted"
    LEAVE     = "leave",     "On Leave"
    APPROVED  = "approved",  "Approved by CFI"


class InstructorDailyPlan(TimeStampedModel):
    """
    One instructor's response to a DailyPlanRequest.
    Contains their availability window and list of intended sorties.
    """
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan_request    = models.ForeignKey(DailyPlanRequest, on_delete=models.CASCADE,
                                        related_name="instructor_plans")
    instructor      = models.ForeignKey("users.Instructor", on_delete=models.PROTECT,
                                        related_name="daily_plans")
    availability_start = models.TimeField(help_text="Earliest the instructor can fly")
    availability_end   = models.TimeField(help_text="Latest the instructor can finish")
    status          = models.CharField(max_length=20, choices=InstructorPlanStatus.choices,
                                       default=InstructorPlanStatus.PENDING)
    submitted_at    = models.DateTimeField(null=True, blank=True)
    notes           = models.TextField(blank=True, null=True)

    class Meta:
        db_table        = "instructor_daily_plans"
        unique_together = [("plan_request", "instructor")]

    def __str__(self):
        return (f"{self.instructor.user.get_full_name()} — "
                f"{self.plan_request.plan_date} [{self.status}]")


class InstructorDailyPlanEntry(TimeStampedModel):
    """
    One intended sortie inside an instructor's daily plan.
    student + exercise + preferred time + optional CFI override flag.
    """
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan            = models.ForeignKey(InstructorDailyPlan, on_delete=models.CASCADE,
                                        related_name="entries")
    student         = models.ForeignKey("users.Student", on_delete=models.PROTECT)
    exercise        = models.ForeignKey("syllabus.SyllabusExercise", on_delete=models.PROTECT)
    preferred_start = models.TimeField(null=True, blank=True)
    estimated_duration_min = models.IntegerField(default=60)
    # Prerequisite handling
    prereq_met      = models.BooleanField(default=True,
                       help_text="False when previous exercise not yet passed")
    cfi_override_requested = models.BooleanField(default=False)
    cfi_override_approved  = models.BooleanField(default=False)
    cfi_override_reason    = models.TextField(blank=True, null=True)
    cfi_approved_by        = models.ForeignKey("users.User", on_delete=models.SET_NULL,
                                               null=True, blank=True, related_name="+")
    sequence_order  = models.SmallIntegerField(default=1)

    class Meta:
        db_table = "instructor_daily_plan_entries"
        ordering = ["sequence_order", "preferred_start"]

    def __str__(self):
        return (f"{self.plan.instructor.user.get_full_name()} → "
                f"{self.student.user.get_full_name()} | {self.exercise.exercise_code}")


class AISuggestedRoster(TimeStampedModel):
    """
    Stores a single Gemini-generated roster suggestion for a DailyPlanRequest.
    Multiple suggestions can exist (re-generate); latest is used.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan_request = models.ForeignKey(DailyPlanRequest, on_delete=models.CASCADE,
                                     related_name="ai_suggestions")
    # The raw JSON response from Gemini
    suggestion   = models.JSONField(help_text="Structured roster returned by Gemini")
    prompt_used  = models.TextField(help_text="Full prompt sent to Gemini (for audit)")
    model_used   = models.CharField(max_length=50, default="gemini-2.5-flash")
    confirmed    = models.BooleanField(default=False,
                   help_text="True once scheduling officer confirmed and flights were created")
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey("users.User", on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name="+")

    class Meta:
        db_table = "ai_suggested_rosters"
        ordering = ["-created_at"]

    def __str__(self):
        return (f"AI Roster — {self.plan_request.plan_date} "
                f"{'✓ Confirmed' if self.confirmed else '(draft)'}")
