import uuid
from django.db import models
from apps.core.models import TimeStampedModel
from apps.infrastructure.models import Base, Aircraft
from apps.users.models import User


class MaintenanceType(models.TextChoices):
    LINE          = "line",          "Line Maintenance"
    FIFTY_HR      = "50hr",          "50-Hour Inspection"
    HUNDRED_HR    = "100hr",         "100-Hour Inspection"
    TWO_HUNDRED   = "200hr",         "200-Hour Inspection"
    SIX_HUNDRED   = "600hr",         "600-Hour Inspection"
    ANNUAL        = "annual",        "Annual Inspection"
    BIENNIAL      = "biennial",      "Biennial Inspection"
    UNSCHEDULED   = "unscheduled",   "Unscheduled / Defect Rectification"
    AD_COMPLIANCE = "ad_compliance", "AD Compliance"
    SB_COMPLIANCE = "sb_compliance", "SB Compliance"


class MaintenanceStatus(models.TextChoices):
    PLANNED     = "planned",     "Planned"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED   = "completed",   "Completed"


class MaintenanceRecord(TimeStampedModel):
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    aircraft            = models.ForeignKey(Aircraft, on_delete=models.PROTECT, related_name="maintenance_records")
    base                = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="maintenance_records")
    maintenance_type    = models.CharField(max_length=30, choices=MaintenanceType.choices, db_index=True)
    performed_at_hours  = models.DecimalField(max_digits=8, decimal_places=1)
    performed_at_date   = models.DateField()
    next_due_hours      = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    next_due_date       = models.DateField(null=True, blank=True)
    work_order_number   = models.CharField(max_length=50, unique=True, null=True, blank=True)
    ad_sb_reference     = models.CharField(max_length=100, blank=True, null=True)
    description         = models.TextField()
    # JSON array: [{part_number, description, serial_number, quantity, cost_inr}]
    parts_replaced      = models.JSONField(default=list, blank=True)
    labour_hours        = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    total_cost_inr      = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    performed_by        = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="performed_maintenance")
    ame_licence_number  = models.CharField(max_length=50, blank=True, null=True)
    # Certificate of Release to Service — only CAMO users at hub can issue
    crs_issued          = models.BooleanField(default=False)
    crs_issued_by       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="issued_crs")
    crs_issued_at       = models.DateTimeField(null=True, blank=True)
    crs_document_path   = models.TextField(blank=True, null=True, help_text="MinIO object key")
    status              = models.CharField(
        max_length=20, choices=MaintenanceStatus.choices,
        default=MaintenanceStatus.PLANNED, db_index=True,
        help_text="Work order status — aircraft only grounded when status is 'in_progress'"
    )

    class Meta:
        db_table = "maintenance_records"
        ordering = ["-performed_at_date"]

    def __str__(self):
        return f"{self.aircraft.tail_number} | {self.maintenance_type} | {self.performed_at_date}"


class ComplianceStatus(models.TextChoices):
    PENDING         = "pending",        "Pending"
    COMPLIED        = "complied",       "Complied With"
    NOT_APPLICABLE  = "not_applicable", "Not Applicable"
    RECURRING       = "recurring",      "Recurring"


class AdSbDirective(TimeStampedModel):
    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    aircraft                = models.ForeignKey(Aircraft, on_delete=models.PROTECT, related_name="directives")
    reference_number        = models.CharField(max_length=100)
    issuing_authority       = models.CharField(max_length=50, help_text="DGCA, FAA, EASA")
    title                   = models.TextField()
    description             = models.TextField(blank=True, null=True)
    directive_type          = models.CharField(max_length=10, choices=[("AD","AD"),("SB","SB"),("SL","SL")])
    compliance_status       = models.CharField(max_length=20, choices=ComplianceStatus.choices, default=ComplianceStatus.PENDING)
    compliance_due_date     = models.DateField(null=True, blank=True)
    compliance_due_hours    = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    complied_via_record     = models.ForeignKey(MaintenanceRecord, on_delete=models.SET_NULL, null=True, blank=True)
    next_recurrence_date    = models.DateField(null=True, blank=True)
    next_recurrence_hours   = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    notes                   = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "ad_sb_directives"
        ordering = ["compliance_due_date"]

    def __str__(self):
        return f"{self.directive_type} {self.reference_number} — {self.aircraft.tail_number}"


class AmeDutyLog(TimeStampedModel):
    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ame_user              = models.ForeignKey(User, on_delete=models.PROTECT, related_name="ame_duty_logs")
    shift_start           = models.DateTimeField()
    shift_end             = models.DateTimeField(null=True, blank=True)
    base                  = models.ForeignKey(Base, on_delete=models.PROTECT, related_name="ame_duty_logs")
    maintenance_record    = models.ForeignKey(MaintenanceRecord, on_delete=models.SET_NULL, null=True, blank=True)
    total_hours           = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    notes                 = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "ame_duty_logs"
        ordering = ["-shift_start"]

    def __str__(self):
        return f"AME Duty: {self.ame_user.get_full_name()} | {self.shift_start:%Y-%m-%d}"


class SortieGrade(TimeStampedModel):
    """Post-flight exercise grading — auto-updates student logbook totals via signal."""
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    flight           = models.ForeignKey("scheduling.Flight", on_delete=models.PROTECT, related_name="grades")
    exercise         = models.ForeignKey("syllabus.SyllabusExercise", on_delete=models.PROTECT)
    student          = models.ForeignKey("users.Student", on_delete=models.PROTECT, related_name="grades")
    grade            = models.SmallIntegerField(help_text="1 (Unsatisfactory) to 5 (Exceptional)")
    instructor_notes = models.TextField(blank=True, null=True)
    graded_by        = models.ForeignKey("users.Instructor", on_delete=models.PROTECT, related_name="given_grades")
    graded_at        = models.DateTimeField(auto_now_add=True)
    locked_at        = models.DateTimeField(null=True, blank=True, help_text="Immutable after 7 days")

    class Meta:
        db_table = "sortie_grades"
        unique_together = [("flight", "exercise")]
        ordering = ["-graded_at"]

    def __str__(self):
        return f"{self.student.user.get_full_name()} | {self.exercise.exercise_code} | Grade: {self.grade}"

    @property
    def is_locked(self):
        return self.locked_at is not None

    @property
    def passed(self):
        return self.grade >= self.exercise.pass_grade
