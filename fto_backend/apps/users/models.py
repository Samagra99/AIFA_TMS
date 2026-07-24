import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from apps.core.models import TimeStampedModel
from apps.infrastructure.models import Base
from django.contrib.auth.hashers import check_password, make_password


class UserRole(models.TextChoices):
    SUPERADMIN     = "superadmin",     "Super Admin"
    CFI            = "cfi",            "Chief Flight Instructor"
    INSTRUCTOR     = "instructor",     "Instructor / FI"
    DISPATCHER     = "dispatcher",     "Dispatcher / Operations"
    STUDENT        = "student",        "Student Pilot"
    CAMO           = "camo",           "CAMO Manager"
    SAFETY_OFFICER = "safety_officer", "Safety & Compliance Officer"
    FINANCE        = "finance",        "Finance Manager"


class UserManager(BaseUserManager):
    def create_user(self, email, password, role=UserRole.STUDENT, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, role=role, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra):
        extra.setdefault("role", UserRole.SUPERADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # employee_id       = models.IntegerField(unique=True, default=0)
    email             = models.EmailField(unique=True)
    phone             = models.CharField(max_length=20, unique=True, blank=True, null=True)
    first_name        = models.CharField(max_length=100)
    last_name         = models.CharField(max_length=100)
    role              = models.CharField(max_length=30, choices=UserRole.choices, db_index=True)
    home_base         = models.ForeignKey(Base, on_delete=models.SET_NULL, null=True, blank=True)
    is_active         = models.BooleanField(default=True)
    is_staff          = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    dispatch_pin      = models.CharField(max_length=128, blank=True, null=True, help_text="Hashed PIN for dispatch/acceptance signatures.")
    # Increment to invalidate all current JWTs for this user
    token_version     = models.IntegerField(default=0)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    objects = UserManager()
    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["first_name", "last_name", "role"]

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}> [{self.role}]"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def invalidate_all_tokens(self):
        self.token_version += 1
        self.save(update_fields=["token_version", "updated_at"])

    def set_pin(self, raw_pin):
        """Securely hashes and sets the user's operational PIN."""
        if self.role in [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.CFI, UserRole.DISPATCHER]:
            self.dispatch_pin = make_password(raw_pin)
            self.save(update_fields=["dispatch_pin", "updated_at"])
        else:
            raise ValueError(f"PINs are not permitted for role: {self.role}")
        
    def verify_pin(self, raw_pin):
        """Verifies a provided raw PIN against the hashed dispatch_pin."""
        if not self.dispatch_pin:
            return False
        return check_password(raw_pin, self.dispatch_pin)


class Instructor(TimeStampedModel):
    id                          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user                        = models.OneToOneField(User, on_delete=models.CASCADE, related_name="instructor_profile")
    cfi_licence_number          = models.CharField(max_length=50, blank=True, null=True)
    cfi_expiry                  = models.DateField(null=True, blank=True)
    # FDTL counters in MINUTES — reset nightly by Celery task
    fdtl_daily_remaining_min    = models.IntegerField(default=480,  help_text="8 hrs = 480 min")
    fdtl_weekly_remaining_min   = models.IntegerField(default=1800, help_text="30 hrs = 1800 min")
    fdtl_monthly_remaining_min  = models.IntegerField(default=6000, help_text="100 hrs = 6000 min")
    fdtl_last_reset_date        = models.DateField(default=timezone.now)
    # Prior Flying Hours imported from external logbooks (e.g. eGCA)
    previous_hours_total        = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    previous_hours_instructional= models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    previous_hours_pic          = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    previous_hours_instrument   = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    # Ratings
    instrument_rating           = models.BooleanField(default=False)
    multi_engine_rating         = models.BooleanField(default=False)
    # Stores list of AircraftType PKs this instructor is type-rated on
    type_rating_ids             = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "instructors"

    def __str__(self):
        return f"Instructor: {self.user.get_full_name()}"

    @property
    def fdtl_daily_remaining_hrs(self):
        return round(self.fdtl_daily_remaining_min / 60, 2)


class Student(TimeStampedModel):
    class TargetLicence(models.TextChoices):
        PPL = "PPL", "Private Pilot Licence"
        CPL = "CPL", "Commercial Pilot Licence"

    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user                  = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    # Licensing
    spl_number            = models.CharField(max_length=50, blank=True, null=True)
    spl_issue_date        = models.DateField(null=True, blank=True)
    spl_expiry            = models.DateField(null=True, blank=True)
    medical_class         = models.SmallIntegerField(null=True, blank=True, choices=[(1,"Class 1"), (2,"Class 2")])
    medical_expiry        = models.DateField(null=True, blank=True)
    frtol_number          = models.CharField(max_length=50, blank=True, null=True)
    frtol_expiry          = models.DateField(null=True, blank=True)
    # Prior Flying Hours imported from external logbooks (e.g. eGCA)
    previous_hours_total        = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    previous_hours_pic          = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    previous_hours_p1_us        = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    previous_hours_dual         = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    previous_hours_solo         = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    previous_hours_cross_country= models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    previous_hours_night        = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    previous_hours_instrument   = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    # Logbook totals — auto-updated by signal after each sortie is graded; NEVER manually editable
    hours_total           = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    hours_pic             = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    hours_p1_us           = models.DecimalField(max_digits=7, decimal_places=1, default=0.0, help_text="Hours logged as PIC Under Supervision (GFT, IRT, NC-120, NC-250)")
    hours_dual            = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    hours_solo            = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    hours_cross_country   = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    hours_night           = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    hours_instrument      = models.DecimalField(max_digits=7, decimal_places=1, default=0.0)
    # Solo authorisation
    solo_approved         = models.BooleanField(default=False)
    solo_approved_by      = models.ForeignKey(Instructor, on_delete=models.SET_NULL, null=True, blank=True)
    solo_approved_at      = models.DateTimeField(null=True, blank=True)
    solo_max_crosswind_kt = models.DecimalField(max_digits=4, decimal_places=1, default=7.0)
    # Enrolment
    batch_number          = models.CharField(max_length=20, blank=True, null=True)
    enrollment_date       = models.DateField(default=timezone.now)
    target_licence        = models.CharField(max_length=10, choices=TargetLicence.choices, default=TargetLicence.CPL)

    class Meta:
        db_table = "students"

    def __str__(self):
        return f"Student: {self.user.get_full_name()} | {self.target_licence}"

    @property
    def is_medically_current(self):
        if not self.medical_expiry:
            return False
        return self.medical_expiry > timezone.now().date()

    @property
    def is_spl_current(self):
        if not self.spl_expiry:
            return False
        return self.spl_expiry > timezone.now().date()


class DocumentType(models.TextChoices):
    SPL             = "spl",             "Student Pilot Licence"
    MEDICAL_CLASS1  = "medical_class1",  "Medical Certificate Class 1"
    MEDICAL_CLASS2  = "medical_class2",  "Medical Certificate Class 2"
    FRTOL           = "frtol",           "Radio Telephony Operator Licence"
    ATPL_THEORY     = "atpl_theory",     "ATPL Theory Credits"
    CPL             = "cpl",             "Commercial Pilot Licence"


class StudentDocument(TimeStampedModel):
    class Status(models.TextChoices):
        VALID           = "valid",          "Valid"
        EXPIRING_SOON   = "expiring_soon",  "Expiring Soon (< 60 days)"
        EXPIRED         = "expired",        "Expired"
        PENDING_RENEWAL = "pending_renewal","Pending Renewal"

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student         = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="documents")
    document_type   = models.CharField(max_length=30, choices=DocumentType.choices)
    document_number = models.CharField(max_length=100, blank=True, null=True)
    issue_date      = models.DateField(null=True, blank=True)
    expiry_date     = models.DateField(null=True, blank=True, db_index=True)
    status          = models.CharField(max_length=20, choices=Status.choices, default=Status.VALID)
    file_path       = models.TextField(blank=True, null=True, help_text="MinIO object key")
    file_hash       = models.CharField(max_length=64, blank=True, null=True, help_text="SHA-256")
    uploaded_by     = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")
    uploaded_at     = models.DateTimeField(auto_now_add=True)
    notes           = models.TextField(blank=True, null=True)
    # Regulatory: never hard-delete documents — supersede them
    is_superseded   = models.BooleanField(default=False)
    superseded_by   = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "student_documents"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.student.user.get_full_name()} | {self.document_type} | {self.expiry_date}"
