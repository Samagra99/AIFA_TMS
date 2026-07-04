"""
compliance/audit_views.py
--------------------------
DRF views for the DGCA Audit Dashboard and 4 monthly reports.

Endpoints (registered via audit_urls.py, included into compliance/urls.py):

    GET  /api/v1/compliance/audit/live/
    GET  /api/v1/compliance/audit/history/
    POST /api/v1/compliance/audit/snapshot/
    GET  /api/v1/compliance/alerts/
    GET  /api/v1/compliance/alerts/summary/
    POST /api/v1/compliance/alerts/{id}/resolve/
    GET  /api/v1/compliance/reports/spl-monthly/?year=2026&month=6
    GET  /api/v1/compliance/reports/aircraft-utilization/?year=2026&month=6
    GET  /api/v1/compliance/reports/instructor-utilization/?year=2026&month=6
    GET  /api/v1/compliance/reports/trainee-hours/?year=2026&month=6
"""
from datetime import date, datetime

from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsSafetyOfficer, IsAdminOrCFI
from .audit_models import AuditCategory, AuditRecord, ComplianceAlert
from .audit_scoring import AuditScoringEngine
from .audit_serializers import (
    AuditCategorySerializer, AuditRecordSerializer,
    ComplianceAlertSerializer, LiveAuditScoreSerializer,
)
from . import report_generators as rg


# ─────────────────────────────────────────────────────────────────────────────
# Live score computation
# ─────────────────────────────────────────────────────────────────────────────

def _build_live_score(as_of: date | None = None) -> dict:
    """
    Runs AuditScoringEngine against live DB data and assembles the full
    category → parameter tree with computed scores, for the dashboard.
    """
    as_of = as_of or timezone.now().date()
    engine = AuditScoringEngine(as_of=as_of)
    computed = engine.compute_all()   # { 'c1_post_holders': (Decimal, int, str), ... }

    categories_out = []
    total_score = 0.0
    max_score = 0

    for category in AuditCategory.objects.prefetch_related('parameters').order_by('sort_order'):
        params_out = []
        cat_score = 0.0
        cat_max = 0

        for param in category.parameters.all().order_by('sort_order'):
            if param.auto_scored and param.scoring_logic_key in computed:
                score, max_pts, detail = computed[param.scoring_logic_key]
                score_f = float(score)
                auto = True
            else:
                # Manual parameter — default to full marks unless a real
                # AuditRecord has an examiner-entered override for it
                latest_manual = (
                    AuditRecord.objects.filter(status__in=['completed', 'submitted'])
                    .order_by('-audit_date')
                    .first()
                )
                override = None
                if latest_manual:
                    override = latest_manual.parameter_scores.filter(parameter=param).first()
                score_f = float(override.score) if override else float(param.max_points)
                max_pts = param.max_points
                detail = (override.remarks if override and override.remarks
                          else "Manual assessment — pending examiner review")
                auto = False

            params_out.append({
                'code': param.code, 'name': param.name,
                'score': round(score_f, 2), 'max_score': max_pts,
                'detail': detail, 'auto': auto,
                'percentage': round(score_f / max_pts * 100, 1) if max_pts else 0,
            })
            cat_score += score_f
            cat_max += max_pts

        categories_out.append({
            'code': category.code, 'name': category.name, 'icon': category.icon,
            'score': round(cat_score, 2), 'max_score': cat_max,
            'percentage': round(cat_score / cat_max * 100, 1) if cat_max else 0,
            'parameters': params_out,
        })
        total_score += cat_score
        max_score += cat_max

    pct = round(total_score / max_score * 100, 2) if max_score else 0
    if pct >= 90:
        rating, rating_label, rating_color = 'excellent', 'Excellent', '#22c55e'
    elif pct >= 75:
        rating, rating_label, rating_color = 'good', 'Good', '#f5a623'
    elif pct >= 60:
        rating, rating_label, rating_color = 'satisfactory', 'Satisfactory', '#f97316'
    else:
        rating, rating_label, rating_color = 'unsatisfactory', 'Unsatisfactory', '#ef4444'

    return {
        'as_of': timezone.now(),
        'total_score': round(total_score, 2),
        'max_score': max_score,
        'percentage': pct,
        'rating': rating,
        'rating_label': rating_label,
        'rating_color': rating_color,
        'categories': categories_out,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Views
# ─────────────────────────────────────────────────────────────────────────────

class LiveAuditScoreView(APIView):
    """GET /compliance/audit/live/ — recomputed from scratch every request."""
    permission_classes = [IsSafetyOfficer]

    def get(self, request):
        data = _build_live_score()
        serializer = LiveAuditScoreSerializer(data)
        return Response(serializer.data)


class AuditRecordViewSet(viewsets.ModelViewSet):
    """Historical / draft / submitted audit snapshots."""
    queryset = AuditRecord.objects.prefetch_related('parameter_scores__parameter').all()
    serializer_class = AuditRecordSerializer
    permission_classes = [IsSafetyOfficer]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='snapshot')
    def create_snapshot(self, request):
        """
        Freezes the current live score into a permanent AuditRecord +
        AuditParameterScore rows — used when an examiner wants to record
        an official audit date rather than relying on the always-live view.
        """
        live = _build_live_score()
        record = AuditRecord.objects.create(
            audit_date=timezone.now().date(),
            status='draft',
            total_score=live['total_score'],
            created_by=request.user,
        )
        from .audit_models import AuditParameterScore, AuditParameter
        for cat in live['categories']:
            for param in cat['parameters']:
                try:
                    param_obj = AuditParameter.objects.get(code=param['code'])
                except AuditParameter.DoesNotExist:
                    continue
                AuditParameterScore.objects.create(
                    audit=record, parameter=param_obj,
                    score=param['score'], remarks=param['detail'],
                    auto_computed=param['auto'],
                )
        return Response(
            AuditRecordSerializer(record).data, status=status.HTTP_201_CREATED
        )


class ComplianceAlertViewSet(viewsets.ModelViewSet):
    queryset = ComplianceAlert.objects.all()
    serializer_class = ComplianceAlertSerializer
    permission_classes = [IsSafetyOfficer]
    filterset_fields = ['severity', 'category', 'is_resolved']

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.resolve(request.user)
        return Response({'detail': 'Alert resolved.'})

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        qs = self.get_queryset().filter(is_resolved=False)
        return Response({
            'total_open': qs.count(),
            'critical': qs.filter(severity='critical').count(),
            'warning': qs.filter(severity='warning').count(),
            'info': qs.filter(severity='info').count(),
            'by_category': {
                cat: qs.filter(category=cat).count()
                for cat, _ in ComplianceAlert.CATEGORY
            },
        })


# ─────────────────────────────────────────────────────────────────────────────
# Monthly reports — function-based views, thin wrapper around report_generators
# ─────────────────────────────────────────────────────────────────────────────

def _parse_year_month(request):
    today = timezone.now().date()
    year = int(request.query_params.get('year', today.year))
    month = int(request.query_params.get('month', today.month))
    return year, month


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def spl_monthly_view(request):
    year, month = _parse_year_month(request)
    return Response(rg.spl_monthly_report(year, month))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def aircraft_utilization_view(request):
    year, month = _parse_year_month(request)
    return Response(rg.aircraft_utilization_report(year, month))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_utilization_view(request):
    year, month = _parse_year_month(request)
    return Response(rg.instructor_utilization_report(year, month))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trainee_hours_view(request):
    year, month = _parse_year_month(request)
    return Response(rg.trainee_hours_report(year, month))