from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from apps.core.permissions import IsSafetyOfficer, IsInstructor
from .models import OccurrenceReport, HazardEntry
from .serializers import OccurrenceReportSerializer, HazardEntrySerializer


class OccurrenceReportViewSet(viewsets.ModelViewSet):
    queryset = OccurrenceReport.objects.select_related(
        "base", "aircraft", "submitted_by", "investigating_officer"
    ).all()
    serializer_class = OccurrenceReportSerializer
    permission_classes = [IsInstructor]
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["severity", "occurrence_type", "base", "dgca_submitted"]
    search_fields    = ["report_number", "description"]
    ordering_fields  = ["submitted_at", "event_datetime", "severity"]

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        report = self.get_object()
        if report.is_locked:
            return Response({"detail": "Report is locked."}, status=400)
        report.closed_at = timezone.now()
        report.closed_by = request.user
        report.corrective_actions = request.data.get("corrective_actions", "")
        report.save(update_fields=["closed_at", "closed_by", "corrective_actions"])
        return Response({"detail": "Report closed."})

    @action(detail=True, methods=["post"], url_path="mark-dgca-submitted")
    def dgca_submitted(self, request, pk=None):
        report = self.get_object()
        report.dgca_submitted    = True
        report.dgca_submitted_at = timezone.now()
        report.dgca_reference    = request.data.get("dgca_reference", "")
        report.save(update_fields=["dgca_submitted", "dgca_submitted_at", "dgca_reference"])
        return Response({"detail": "Marked as submitted to DGCA."})

    @action(detail=False, methods=["get"], url_path="sms-summary")
    def sms_summary(self, request):
        from django.db.models import Count, Q
        qs = self.get_queryset()
        return Response({
            "total": qs.count(),
            "by_severity": {
                "critical": qs.filter(severity="critical").count(),
                "high":     qs.filter(severity="high").count(),
                "medium":   qs.filter(severity="medium").count(),
                "low":      qs.filter(severity="low").count(),
            },
            "open":           qs.filter(closed_at__isnull=True).count(),
            "dgca_submitted": qs.filter(dgca_submitted=True).count(),
        })


class HazardEntryViewSet(viewsets.ModelViewSet):
    queryset = HazardEntry.objects.select_related("base", "owner", "identified_by").all()
    serializer_class = HazardEntrySerializer
    permission_classes = [IsSafetyOfficer]
    filterset_fields = ["status", "base"]
    ordering_fields  = ["-identified_at"]

    def perform_create(self, serializer):
        serializer.save(identified_by=self.request.user)
