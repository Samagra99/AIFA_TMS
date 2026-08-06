import uuid
from django.contrib.postgres.fields import ArrayField
from django.db import models
from apps.core.models import TimeStampedModel


class LicenceType(TimeStampedModel):
    code        = models.CharField(max_length=20, primary_key=True, help_text="Short code, e.g. CPL, PPL, ATPL")
    name        = models.CharField(max_length=100, help_text="Full name, e.g. Commercial Pilot Licence")
    description = models.TextField(blank=True, null=True)
    is_active   = models.BooleanField(default=True)

    class Meta:
        db_table = "licence_types"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class SyllabusStage(TimeStampedModel):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    licence_type   = models.ForeignKey(LicenceType, on_delete=models.CASCADE, null=True, blank=True, related_name="stages")
    stage_number   = models.SmallIntegerField()
    title          = models.CharField(max_length=200)
    description    = models.TextField(blank=True, null=True)
    sequence_order = models.SmallIntegerField()

    class Meta:
        db_table = "syllabus_stages"
        unique_together = [("licence_type", "stage_number")]
        ordering = ["licence_type", "sequence_order"]

    def __str__(self):
        code = self.licence_type.code if self.licence_type else ""
        return f"{code} Stage {self.stage_number}: {self.title}"


class SyllabusLesson(TimeStampedModel):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stage          = models.ForeignKey(SyllabusStage, on_delete=models.CASCADE, related_name="lessons")
    lesson_number  = models.SmallIntegerField()
    title          = models.CharField(max_length=200)
    sequence_order = models.SmallIntegerField()

    class Meta:
        db_table = "syllabus_lessons"
        unique_together = [("stage", "lesson_number")]
        ordering = ["sequence_order"]

    def __str__(self):
        return f"Lesson {self.lesson_number}: {self.title}"


class FlightTypeRequired(models.TextChoices):
    DUAL                 = "dual",                 "Dual"
    SOLO                 = "solo",                 "Solo"
    CROSS_COUNTRY_DUAL   = "cross_country_dual",   "Cross-Country Dual"
    CROSS_COUNTRY_SOLO   = "cross_country_solo",   "Cross-Country Solo"
    NIGHT_DUAL           = "night_dual",           "Night Dual"
    NIGHT_SOLO           = "night_solo",           "Night Solo"
    INSTRUMENT           = "instrument",           "Instrument"
    DUAL_INSTRUMENT      = "dual_instrument",      "Dual Instrument"
    DUAL_MULTI_ENGINE    = "dual_multi_engine",    "Dual Multi-Engine"
    INSTRUCTOR_DUAL      = "instructor_dual",      "Instructor Dual"
    PROGRESS_CHECK       = "progress_check",       "Progress Check"
    PROFICIENCY_CHECK    = "proficiency_check",    "Proficiency Check"
    KNOWLEDGE_TEST       = "knowledge_test",       "Ground Knowledge Test"
    GROUND_TRAINING      = "ground_training",      "Ground Training"
    LICENSING_PROCESS    = "licensing_process",    "Licensing Process"
    FSTD_INSTRUMENT      = "fstd_instrument",      "FSTD Simulator Instrument"
    FSTD_PROGRESS_CHECK  = "fstd_progress_check",  "FSTD Simulator Progress Check"
    DGCA_FLIGHT_TEST     = "dgca_flight_test",     "DGCA Flight Test (P1 U/S Logged)"
    BUFFER               = "buffer",               "Buffer"


class SyllabusExercise(TimeStampedModel):
    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson               = models.ForeignKey(SyllabusLesson, on_delete=models.CASCADE, related_name="exercises")
    exercise_code        = models.CharField(max_length=20, help_text="e.g. EX-4A")
    title                = models.CharField(max_length=200, help_text="e.g. Steep Turns")
    description          = models.TextField(blank=True, null=True)
    flight_type_required = models.CharField(max_length=40, choices=FlightTypeRequired.choices, default=FlightTypeRequired.DUAL)
    # List of SyllabusExercise PKs that must be passed (grade >= pass_grade) before scheduling this exercise
    prerequisite_ids     = ArrayField(models.UUIDField(), default=list, blank=True)
    pass_grade           = models.SmallIntegerField(default=3, help_text="Minimum grade (1–5) to clear this exercise")
    sequence_order       = models.SmallIntegerField()

    is_buffer            = models.BooleanField(default=False, help_text="If true, instructors can schedule without CFI override.")
    is_knowledge_test   = models.BooleanField(default=False, help_text="True for K1..K12 ground/oral tests")
    log_as_p1_us        = models.BooleanField(default=False, help_text="If true, passed test is logged as P1 U/S (SOLO) in student logbook")

    dual_hours          = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    solo_hours          = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    fstd_hours          = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    instrument_hours    = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "syllabus_exercises"
        unique_together = [("lesson", "exercise_code")]
        ordering = ["sequence_order"]

    def __str__(self):
        return f"{self.exercise_code}: {self.title}"
