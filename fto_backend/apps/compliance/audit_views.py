"""
compliance/audit_views.py
--------------------------
API views for the DGCA Audit Dashboard and monthly reports.

Endpoints (add to compliance/audit_urls.py):
  GET  /api/compliance/audit/live/              → live 100-pt score
  GET  /api/compliance/audit/history/           → past AuditRecords
  POST /api/compliance/audit/snapshot/          → freeze live score as draft
  GET  /api/compliance/audit/alerts/            → active ComplianceAlerts
  POST /api/compliance/audit/alerts/{id}/resolve/ → resolve an alert
  GET  /api/compliance/reports/{report_type}/   → one of 4 monthly reports
       ?year=YYYY&month=MM

All endpoints require IsAuthenticated.
Report export (PDF/XLSX) is handled by the frontend via browser print / xlsx.js.
"""

import logging
from datetime import date

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .audit_models import AuditCategory, AuditRecord, ComplianceAlert
from .audit_scoring import AuditScoringEngine
from .audit_serializers import (
    AuditRecordSerializer,
    ComplianceAlertSerializer,
)
from .report_generators import (
    aircraft_utilization_report,
    instructor_utilization_report,
    spl_monthly_report,
    trainee_hours_report,
)

log = logging.getLogger(__name__)

REPORT_GENERATORS = {
    'spl-monthly':             spl_monthly_report,
    'aircraft-utilization':    aircraft_utilization_report,
    'instructor-utilization':  instructor_utilization_report,
    'trainee-hours':           trainee_hours_report,
}


# ─────────────────────────────────────────────────────────────────────────────
# Live audit score
# ─────────────────────────────────────────────────────────────────────────────

class LiveAuditScoreView(APIView):
    """
    GET /api/compliance/audit/live/

    Computes the 100-point DGCA FTO score in real-time from live DB data and
    returns a fully-structured JSON document consumed by the React dashboard.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        engine   = AuditScoringEngine()
        all_keys = engine.compute_all()      # { key → (score, max, detail) }

        categories_qs = (
            AuditCategory.objects
            .prefetch_related('parameters')
            .order_by('sort_order')
        )

        category_rows = []
        total_score   = 0.0
        total_max     = 0

        for cat in categories_qs:
            cat_score = 0.0
            param_rows = []

            for param in cat.parameters.order_by('sort_order'):
                if param.auto_scored and param.scoring_logic_key in all_keys:
                    sc, mx, detail = all_keys[param.scoring_logic_key]
                    p_score   = float(sc)
                    p_max     = mx or param.max_points
                    auto_flag = True
                else:
                    # Manual parameter → assume full score (examiner overrides on AuditRecord)
                    p_score   = float(param.max_points)
                    p_max     = param.max_points
                    detail    = 'Manual assessment required'
                    auto_flag = False

                cat_score += p_score
                param_rows.append({
                    'code':       param.code,
                    'name':       param.name,
                    'score':      round(p_score, 2),
                    'max_score':  p_max,
                    'percentage': round(p_score / p_max * 100, 1) if p_max else 0,
                    'detail':     detail,
                    'auto':       auto_flag,
                })

            total_score += cat_score
            total_max   += cat.max_points
            category_rows.append({
                'code':       cat.code,
                'name':       cat.name,
                'icon':       cat.icon,
                'score':      round(cat_score, 2),
                'max_score':  cat.max_points,
                'percentage': round(cat_score / cat.max_points * 100, 1) if cat.max_points else 0,
                'parameters': param_rows,
            })

        pct = round(total_score / total_max * 100, 1) if total_max else 0

        if pct >= 90:
            rating, label, colour = 'excellent',     'Excellent',     '#22c55e'
        elif pct >= 75:
            rating, label, colour = 'good',          'Good',          '#f5a623'
        elif pct >= 60:
            rating, label, colour = 'satisfactory',  'Satisfactory',  '#f97316'
        else:
            rating, label, colour = 'unsatisfactory','Unsatisfactory','#ef4444'

        return Response({
            'as_of':        timezone.now().isoformat(),
            'total_score':  round(total_score, 2),
            'max_score':    total_max,
            'percentage':   pct,
            'rating':       rating,
            'rating_label': label,
            'rating_color': colour,
            'categories':   category_rows,
        })


# ─────────────────────────────────────────────────────────────────────────────
# Audit history (frozen snapshots)
# ─────────────────────────────────────────────────────────────────────────────

class AuditHistoryView(APIView):
    """
    GET  /api/compliance/audit/history/     → last 12 audit records
    POST /api/compliance/audit/snapshot/    → freeze current live score
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        records = AuditRecord.objects.exclude(status='live').order_by('-audit_date')[:12]
        return Response(AuditRecordSerializer(records, many=True).data)

    def post(self, request):
        """Freeze the live score into a draft AuditRecord."""
        engine = AuditScoringEngine()
        all_keys = engine.compute_all()
        total = sum(float(v[0]) for v in all_keys.values())

        record = AuditRecord.objects.create(
            audit_date=date.today(),
            status='draft',
            total_score=round(total, 2),
            created_by=request.user,
        )
        return Response(
            AuditRecordSerializer(record).data,
            status=status.HTTP_201_CREATED
        )


# ─────────────────────────────────────────────────────────────────────────────
# Compliance alerts
# ─────────────────────────────────────────────────────────────────────────────

class ComplianceAlertViewSet(viewsets.ModelViewSet):
    """
    GET    /api/compliance/alerts/            → active alerts
    GET    /api/compliance/alerts/?all=true   → all (including resolved)
    POST   /api/compliance/alerts/            → create manual alert
    POST   /api/compliance/alerts/{id}/resolve/ → resolve
    """
    permission_classes = [IsAuthenticated]
    serializer_class   = ComplianceAlertSerializer

    def get_queryset(self):
        show_all = self.request.query_params.get('all', 'false').lower() == 'true'
        qs = ComplianceAlert.objects.all()
        if not show_all:
            qs = qs.filter(is_resolved=False)
        return qs.order_by('severity', '-created_at')    # critical first

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        if alert.is_resolved:
            return Response({'detail': 'Alert already resolved.'}, status=400)
        alert.resolve(request.user)
        return Response(ComplianceAlertSerializer(alert).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Quick counts by severity – used by dashboard header badges."""
        qs = ComplianceAlert.objects.filter(is_resolved=False)
        return Response({
            'critical': qs.filter(severity='critical').count(),
            'warning':  qs.filter(severity='warning').count(),
            'info':     qs.filter(severity='info').count(),
            'total':    qs.count(),
        })


# ─────────────────────────────────────────────────────────────────────────────
# Monthly reports
# ─────────────────────────────────────────────────────────────────────────────

class MonthlyReportView(APIView):
    """
    GET /api/compliance/reports/{report_type}/?year=YYYY&month=MM

    report_type must be one of:
      spl-monthly | aircraft-utilization | instructor-utilization | trainee-hours
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_type: str):
        if report_type not in REPORT_GENERATORS:
            return Response(
                {'detail': f"Unknown report type '{report_type}'. "
                           f"Valid: {', '.join(REPORT_GENERATORS)}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        now   = timezone.now()
        year  = int(request.query_params.get('year',  now.year))
        month = int(request.query_params.get('month', now.month))

        if not (1 <= month <= 12):
            return Response({'detail': 'month must be 1–12.'}, status=400)
        if year < 2000 or year > now.year + 1:
            return Response({'detail': 'year out of range.'}, status=400)

        try:
            data = REPORT_GENERATORS[report_type](year, month)
            return Response(data)
        except Exception as exc:
            log.exception("Report generation failed: %s %s/%s", report_type, year, month)
            return Response(
                {'detail': f"Report generation error: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
