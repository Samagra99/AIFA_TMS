"""
compliance/audit_models.py
--------------------------
DGCA 100-point FTO Ranking System – database models.

Add to compliance/models.py:
    from .audit_models import (
        AuditCategory, AuditParameter, AuditRecord,
        AuditParameterScore, ComplianceAlert
    )

Then run:
    python manage.py makemigrations compliance
    python manage.py migrate
    python manage.py seed_audit_categories
"""

from django.db import models
from django.utils import timezone


# ─────────────────────────────────────────────────────────────────────────────
# Audit schema definition (categories + parameters)
# ─────────────────────────────────────────────────────────────────────────────

class AuditCategory(models.Model):
    """
    One of the 7 top-level DGCA FTO ranking categories.
    Total max_points across all categories = 100.
    """
    code        = models.CharField(max_length=10, unique=True)   # "C1" … "C7"
    name        = models.CharField(max_length=120)
    max_points  = models.PositiveSmallIntegerField()
    description = models.TextField(blank=True)
    sort_order  = models.PositiveSmallIntegerField(default=0)
    icon        = models.CharField(max_length=40, blank=True,     # for UI
                      help_text="Lucide icon name, e.g. 'Building2'")

    class Meta:
        ordering            = ['sort_order']
        verbose_name        = 'Audit Category'
        verbose_name_plural = 'Audit Categories'

    def __str__(self):
        return f"{self.code} – {self.name} ({self.max_points} pts)"


class AuditParameter(models.Model):
    """
    Individual scoring line within a category (e.g. C1.1, C1.2 …).
    auto_scored=True  → score computed live by AuditScoringEngine
    auto_scored=False → examiner fills it in manually on AuditRecord
    """
    category          = models.ForeignKey(
                            AuditCategory, on_delete=models.CASCADE,
                            related_name='parameters')
    code              = models.CharField(max_length=20, unique=True)   # "C1.1"
    name              = models.CharField(max_length=200)
    max_points        = models.PositiveSmallIntegerField()
    description       = models.TextField(blank=True)
    auto_scored       = models.BooleanField(
                            default=False,
                            help_text="Computed live from DB; no manual entry needed")
    scoring_logic_key = models.CharField(
                            max_length=60, blank=True,
                            help_text="Maps to AuditScoringEngine.score_<key>() method")
    sort_order        = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return f"{self.code}: {self.name} ({self.max_points} pts)"


# ─────────────────────────────────────────────────────────────────────────────
# Audit records (point-in-time snapshots)
# ─────────────────────────────────────────────────────────────────────────────

class AuditRecord(models.Model):
    """
    One completed or in-progress DGCA audit.
    The 'live' record is auto-recomputed by the dashboard endpoint on every
    request; historical records are frozen snapshots.
    """
    STATUS = [
        ('live',      'Live – auto-computed'),
        ('draft',     'Draft'),
        ('completed', 'Completed'),
        ('submitted', 'Submitted to DGCA'),
    ]

    audit_date            = models.DateField()
    status                = models.CharField(max_length=20, choices=STATUS, default='draft')
    total_score           = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    auditor_name          = models.CharField(max_length=200, blank=True)
    auditor_designation   = models.CharField(max_length=200, blank=True)
    remarks               = models.TextField(blank=True)
    created_by            = models.ForeignKey(
                                'users.User', on_delete=models.SET_NULL,
                                null=True, blank=True,
                                related_name='audit_records_created')
    created_at            = models.DateTimeField(auto_now_add=True)
    updated_at            = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-audit_date']

    # ── helpers ──────────────────────────────────────────────────────────────

    @property
    def percentage(self) -> float:
        return float(self.total_score)          # always out of 100

    @property
    def rating(self) -> tuple[str, str]:
        p = self.percentage
        if p >= 90: return ('excellent',     'Excellent')
        if p >= 75: return ('good',          'Good')
        if p >= 60: return ('satisfactory',  'Satisfactory')
        return           ('unsatisfactory', 'Unsatisfactory')

    @property
    def rating_color(self) -> str:
        """Tailwind/hex colour key consumed by the React frontend."""
        colours = {
            'excellent':     '#22c55e',   # green-500
            'good':          '#f5a623',   # amber (brand)
            'satisfactory':  '#f97316',   # orange-500
            'unsatisfactory':'#ef4444',   # red-500
        }
        return colours[self.rating[0]]

    def __str__(self):
        return f"Audit {self.audit_date} – {self.total_score}/100 ({self.rating[1]})"


class AuditParameterScore(models.Model):
    """Score awarded to one parameter within one AuditRecord."""
    audit         = models.ForeignKey(
                        AuditRecord, on_delete=models.CASCADE,
                        related_name='parameter_scores')
    parameter     = models.ForeignKey(AuditParameter, on_delete=models.PROTECT)
    score         = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    remarks       = models.TextField(blank=True)
    evidence      = models.FileField(
                        upload_to='audit/evidence/', null=True, blank=True,
                        help_text="Upload to MinIO via presigned URL")
    auto_computed = models.BooleanField(default=False)

    class Meta:
        unique_together = [('audit', 'parameter')]

    def __str__(self):
        return f"{self.parameter.code}: {self.score}/{self.parameter.max_points}"


# ─────────────────────────────────────────────────────────────────────────────
# Compliance alerts (auto-generated by Celery tasks + scoring engine)
# ─────────────────────────────────────────────────────────────────────────────

class ComplianceAlert(models.Model):
    """
    Real-time compliance alert surfaced on the DGCA Audit dashboard.

    Created by:
      • Celery beat tasks (daily medical/SPL/rating expiry scan)
      • AOG cascade signal (aircraft → no CRS)
      • AuditScoringEngine when a parameter drops below threshold
      • Manual raise by CFI / Safety Officer
    """
    SEVERITY = [
        ('critical', 'Critical'),
        ('warning',  'Warning'),
        ('info',     'Info'),
    ]
    CATEGORY = [
        ('medical',       'Medical Currency'),
        ('aircraft',      'Aircraft Airworthiness'),
        ('fdtl',          'FDTL Limits'),
        ('spl',           'SPL / Exams'),
        ('training',      'Training Progress'),
        ('documentation', 'Documentation'),
        ('safety',        'Safety'),
        ('maintenance',   'Maintenance'),
    ]

    severity    = models.CharField(max_length=15, choices=SEVERITY)
    category    = models.CharField(max_length=20, choices=CATEGORY)
    title       = models.CharField(max_length=200)
    description = models.TextField()
    # Which object triggered this alert (optional – for deep-link in UI)
    entity_type = models.CharField(max_length=40, blank=True)   # 'student' | 'instructor' | 'aircraft'
    entity_id   = models.PositiveIntegerField(null=True, blank=True)
    entity_name = models.CharField(max_length=200, blank=True)
    due_date    = models.DateField(null=True, blank=True)
    is_resolved = models.BooleanField(default=False, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
                      'users.User', on_delete=models.SET_NULL,
                      null=True, blank=True, related_name='alerts_resolved')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['is_resolved', 'severity']),
            models.Index(fields=['category', 'is_resolved']),
        ]

    def resolve(self, user) -> None:
        self.is_resolved = True
        self.resolved_at = timezone.now()
        self.resolved_by = user
        self.save(update_fields=['is_resolved', 'resolved_at', 'resolved_by'])

    def __str__(self):
        return f"[{self.severity.upper()}] {self.title}"
