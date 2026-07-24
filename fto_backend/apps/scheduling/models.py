import uuid
from django.db import models
from apps.core.models import AuditedModel, TimeStampedModel


class FlightType(models.TextChoices):
    DUAL                 = "dual",                 "Dual"
    SOLO                 = "solo",                 "Solo"
    CROSS_COUNTRY_DUAL   = "cross_country_dual",   "Cross-Country Dual"
    CROSS_COUNTRY_SOLO   = "cross_country_solo",   "Cross-Country Solo"
    NIGHT_DUAL           = "night_dual",           "Night Dual"
    NIGHT_SOLO           = "night_solo",           "Night Solo"
    INSTRUMENT           = "instrument",           "Instrument"
    DUAL_INSTRUMENT      = "dual_instrument",      "Dual Instrument"
    DUAL_MULTI_ENGINE    = "dual_multi_engine",    "Dual Multi-Engine"
    FERRY                = "ferry",                "Ferry"
    PROFICIENCY_CHECK    = "proficiency_check",    "Proficiency Check"
    PROGRESS_CHECK       = "progress_check",       "Progress Check"
    KNOWLEDGE_TEST       = "knowledge_test",       "Ground Knowledge Test"
    GROUND_TRAINING      = "ground_training",      "Ground Training"
    LICENSING_PROCESS    = "licensing_process",    "Licensing Process"
    FSTD_INSTRUMENT      = "fstd_instrument",      "FSTD Simulator Instrument"
    FSTD_PROGRESS_CHECK  = "fstd_progress_check",  "FSTD Simulator Progress Check"
    DGCA_FLIGHT_TEST     = "dgca_flight_test",     "DGCA Flight Test (P1 U/S Logged)"
    BUFFER               = "buffer",               "Buffer"


class FlightStatus(models.TextChoices):
    DRAFT     = "draft",     "Draft (Pending CFI Approval)"
    SCHEDULED  = "scheduled",  "Scheduled"
    CONFIRMED  = "confirmed",  "Confirmed"
    DISPATCHED = "dispatched", "Dispatched"
    AIRBORNE   = "airborne",   "Airborne"
    COMPLETED  = "completed",  "Completed"
    CANCELLED  = "cancelled",  "Cancelled"
    ABORTED    = "aborted",    "Aborted"
    SUSPENDED  = "suspended",  "Suspended (Conflict Resolution)"


class Flight(AuditedModel):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # All FKs use lazy string references — avoids circular import issues and
    # lets Django resolve migration dependencies automatically.
    base            = models.ForeignKey(
        "infrastructure.Base", on_delete=models.PROTECT, related_name="flights"
    )
    student         = models.ForeignKey(
        "users.Student", on_delete=models.PROTECT,
        null=True, blank=True, related_name="flights"
    )
    instructor      = models.ForeignKey(
        "users.Instructor", on_delete=models.PROTECT, related_name="flights", null=True, blank=True
    )
    # NEW: Add a slot for the second instructor
    secondary_instructor = models.ForeignKey(
        "users.Instructor", on_delete=models.PROTECT, 
        null=True, blank=True, related_name="secondary_flights"
    )
    aircraft        = models.ForeignKey(
        "infrastructure.Aircraft", on_delete=models.PROTECT, related_name="flights"
    )
    flight_type     = models.CharField(max_length=30, choices=FlightType.choices)
    is_ferry        = models.BooleanField(default=False)
    scheduled_start = models.DateTimeField(db_index=True)
    scheduled_end   = models.DateTimeField()
    status          = models.CharField(
        max_length=20, choices=FlightStatus.choices,
        default=FlightStatus.SCHEDULED, db_index=True
    )
    preflight_briefing_completed = models.BooleanField(default=False)
    ba_test_cleared              = models.BooleanField(default=False)
    dispatcher_cleared_by        = models.ForeignKey("users.User", on_delete=models.PROTECT, null=True, blank=True, related_name="cleared_flights")
    dispatcher_cleared_at        = models.DateTimeField(null=True, blank=True)
    aircraft_accepted_by         = models.ForeignKey("users.User", on_delete=models.PROTECT, null=True, blank=True, related_name="accepted_flights")
    aircraft_accepted_at         = models.DateTimeField(null=True, blank=True)
    override_requested = models.BooleanField(default=False)
    override_reason = models.TextField(blank=True, null=True)
    weather_snapshot = models.ForeignKey(
        "weather.WeatherCache", on_delete=models.SET_NULL, null=True, blank=True
    )
    cancelled_at        = models.DateTimeField(null=True, blank=True)
    cancelled_by        = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="cancelled_flights"
    )
    cancellation_reason = models.TextField(blank=True, null=True)
    notes               = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "flights"
        ordering = ["scheduled_start"]
        indexes  = [
            models.Index(fields=["base", "scheduled_start"]),
            models.Index(fields=["aircraft", "scheduled_start"]),
            models.Index(fields=["instructor", "scheduled_start"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(scheduled_end__gt=models.F("scheduled_start")),
                name="chk_flight_window",
            ),
        ]

    def __str__(self):
        return (
            f"{self.aircraft_id} | {self.flight_type} | "
            f"{self.scheduled_start:%Y-%m-%d %H:%M}"
        )

    @property
    def duration_minutes(self):
        if self.scheduled_start and self.scheduled_end:
            return int((self.scheduled_end - self.scheduled_start).total_seconds() / 60)
        return 0

    @property
    def is_solo(self):
        return self.flight_type in (
            FlightType.SOLO, FlightType.CROSS_COUNTRY_SOLO, FlightType.NIGHT_SOLO
        )


class FlightExercise(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    flight         = models.ForeignKey(Flight, on_delete=models.CASCADE, related_name="exercises")
    exercise       = models.ForeignKey(
        "syllabus.SyllabusExercise", on_delete=models.PROTECT
    )
    sequence_order = models.SmallIntegerField(default=1)

    class Meta:
        db_table       = "flight_exercises"
        unique_together = [("flight", "exercise")]


class InstructorDutyLog(TimeStampedModel):
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instructor         = models.ForeignKey(
        "users.Instructor", on_delete=models.PROTECT, related_name="duty_logs"
    )
    flight             = models.ForeignKey(
        Flight, on_delete=models.SET_NULL, null=True, blank=True
    )
    duty_start         = models.DateTimeField()
    duty_end           = models.DateTimeField(null=True, blank=True)
    flight_minutes     = models.IntegerField(default=0)
    total_duty_minutes = models.IntegerField(null=True, blank=True)
    base               = models.ForeignKey(
        "infrastructure.Base", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "instructor_duty_logs"
        indexes  = [models.Index(fields=["instructor", "duty_start"])]


class PriorFlightLog(TimeStampedModel):
    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user                  = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="prior_flight_logs")
    flight_date           = models.DateField(db_index=True)
    aircraft_type         = models.CharField(max_length=50, blank=True, null=True)
    aircraft_regn         = models.CharField(max_length=30, blank=True, null=True)
    pic_name              = models.CharField(max_length=100, blank=True, null=True)
    co_pilot_name         = models.CharField(max_length=100, blank=True, null=True)
    flight_from           = models.CharField(max_length=20, blank=True, null=True)
    flight_to             = models.CharField(max_length=20, blank=True, null=True)
    departure_time        = models.CharField(max_length=10, blank=True, null=True)
    arrival_time          = models.CharField(max_length=10, blank=True, null=True)
    dual_minutes          = models.IntegerField(default=0)
    pic_minutes           = models.IntegerField(default=0)
    copilot_minutes       = models.IntegerField(default=0)
    instrument_minutes    = models.IntegerField(default=0)
    instructional_minutes = models.IntegerField(default=0)
    exercises             = models.CharField(max_length=255, blank=True, null=True)
    remarks               = models.TextField(blank=True, null=True)
    approval_status       = models.CharField(max_length=30, default="Approved")

    class Meta:
        db_table = "prior_flight_logs"
        ordering = ["-flight_date"]
        indexes  = [models.Index(fields=["user", "flight_date"])]
