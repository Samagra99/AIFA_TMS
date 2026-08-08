import uuid
from django.db import models
from apps.core.models import AuditedModel, TimeStampedModel


class FlightType(models.TextChoices):
    DUAL = "dual", "Dual"
    SOLO = "solo", "Solo"


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
    is_external_p1  = models.BooleanField(default=False, help_text="True if P1 is an external DGCA Examiner without a system account")
    external_p1_name = models.CharField(max_length=150, blank=True, null=True, help_text="Name and designation of external DGCA Examiner")
    passenger_name  = models.CharField(max_length=100, blank=True, null=True, help_text="For joyrides/intro flights")
    is_instructional = models.BooleanField(default=True)
    is_cross_country = models.BooleanField(default=False)
    is_night         = models.BooleanField(default=False)
    is_instrument_simulated = models.BooleanField(default=False)
    is_instrument_actual = models.BooleanField(default=False)
    is_simulator     = models.BooleanField(default=False)
    is_skill_test    = models.BooleanField(default=False)
    is_ferry         = models.BooleanField(default=False)
    day_hours        = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    night_hours      = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    fstd_device      = models.ForeignKey("fstd.FSTDDevice", null=True, blank=True, on_delete=models.SET_NULL)
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

    # Added to track stateful transition of hours from Dual to P1 U/S
    p1_us_credited      = models.BooleanField(default=False)

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
        return self.flight_type == FlightType.SOLO


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
    # Multi-Engine breakdown
    is_multi_engine       = models.BooleanField(default=False)
    me_day_ut_minutes     = models.IntegerField(default=0)
    me_day_p1_minutes     = models.IntegerField(default=0)
    me_day_p2_minutes     = models.IntegerField(default=0)
    me_night_ut_minutes   = models.IntegerField(default=0)
    me_night_p1_minutes   = models.IntegerField(default=0)
    me_night_p2_minutes   = models.IntegerField(default=0)
    exercises             = models.CharField(max_length=255, blank=True, null=True)
    remarks               = models.TextField(blank=True, null=True)
    approval_status       = models.CharField(max_length=30, default="Approved")

    class Meta:
        db_table = "prior_flight_logs"
        ordering = ["-flight_date"]
        indexes  = [models.Index(fields=["user", "flight_date"])]
