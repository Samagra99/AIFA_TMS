import uuid
from decimal import Decimal
from django.db import models
from apps.core.models import TimeStampedModel
from apps.users.models import User, Student


class PaymentStatus(models.TextChoices):
    PENDING  = "pending",  "Pending"
    PAID     = "paid",     "Paid"
    OVERDUE  = "overdue",  "Overdue"
    WAIVED   = "waived",   "Waived"


class BillingRecord(TimeStampedModel):
    class BillingType(models.TextChoices):
        COURSE_FEE   = "course_fee",  "Course Fee"
        BLOCK_HOURS  = "block_hours", "Block Hour Package"
        EXAM_FEE     = "exam_fee",    "Exam Fee"
        MISC         = "misc",        "Miscellaneous"

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student          = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="billing_records")
    description      = models.CharField(max_length=200)
    billing_type     = models.CharField(max_length=30, choices=BillingType.choices)
    amount_inr       = models.DecimalField(max_digits=12, decimal_places=2)
    gst_rate         = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("18.00"))
    # HSN/SAC code for educational services (aviation training = 999293)
    hsn_sac_code     = models.CharField(max_length=10, default="999293")
    invoice_number   = models.CharField(max_length=30, unique=True, null=True, blank=True)
    invoice_date     = models.DateField(null=True, blank=True)
    invoice_path     = models.TextField(blank=True, null=True, help_text="MinIO object key for PDF invoice")
    status           = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING, db_index=True)
    paid_at          = models.DateTimeField(null=True, blank=True)
    payment_method   = models.CharField(max_length=30, blank=True, null=True)
    payment_reference = models.CharField(max_length=100, blank=True, null=True)
    created_by       = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")

    class Meta:
        db_table = "billing_records"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.invoice_number or 'DRAFT'} | {self.student.user.get_full_name()} | ₹{self.total_amount_inr}"

    @property
    def gst_amount(self):
        return (self.amount_inr * self.gst_rate / Decimal("100")).quantize(Decimal("0.01"))

    @property
    def total_amount_inr(self):
        return self.amount_inr + self.gst_amount


class EmiPlan(TimeStampedModel):
    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student               = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="emi_plans")
    billing_record        = models.ForeignKey(BillingRecord, on_delete=models.PROTECT, related_name="emi_plans")
    total_instalments     = models.SmallIntegerField()
    amount_per_instalment = models.DecimalField(max_digits=12, decimal_places=2)
    start_date            = models.DateField()
    notes                 = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "emi_plans"

    def __str__(self):
        return f"EMI Plan — {self.student.user.get_full_name()} — {self.total_instalments} instalments"


class EmiInstalment(TimeStampedModel):
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    emi_plan          = models.ForeignKey(EmiPlan, on_delete=models.CASCADE, related_name="instalments")
    instalment_number = models.SmallIntegerField()
    due_date          = models.DateField(db_index=True)
    amount_inr        = models.DecimalField(max_digits=12, decimal_places=2)
    status            = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    paid_at           = models.DateTimeField(null=True, blank=True)
    payment_method    = models.CharField(max_length=30, blank=True, null=True)
    payment_reference = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table     = "emi_instalments"
        unique_together = [("emi_plan", "instalment_number")]
        ordering     = ["due_date"]

    def __str__(self):
        return f"Instalment {self.instalment_number}/{self.emi_plan.total_instalments} — ₹{self.amount_inr} — {self.status}"
