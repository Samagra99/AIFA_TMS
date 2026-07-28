from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from apps.core.permissions import IsCAMO, IsInstructor, IsDispatcher
from .models import MaintenanceRecord, AdSbDirective, AmeDutyLog, SortieGrade
from .serializers import (
    MaintenanceRecordSerializer, AdSbDirectiveSerializer,
    AmeDutyLogSerializer, SortieGradeSerializer,
)


class MaintenanceRecordViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.select_related(
        "aircraft", "base", "performed_by", "crs_issued_by"
    ).all()
    serializer_class = MaintenanceRecordSerializer
    permission_classes = [IsCAMO]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["aircraft", "maintenance_type", "crs_issued", "base"]
    search_fields = ["work_order_number", "aircraft__tail_number"]

    @action(detail=True, methods=["post"], url_path="issue-crs")
    def issue_crs(self, request, pk=None):
        record = self.get_object()
        if not request.user.role in ("superadmin", "camo"):
            return Response({"detail": "Only CAMO personnel can issue a CRS."}, status=403)
        record.crs_issued    = True
        record.crs_issued_by = request.user
        record.crs_issued_at = timezone.now()
        record.save(update_fields=["crs_issued", "crs_issued_by", "crs_issued_at", "updated_at"])

        # Also resolve all open snags (both deferred and no-go) for this aircraft
        from apps.dispatch.models import SnagEntry
        open_snags = SnagEntry.objects.filter(aircraft=record.aircraft, resolved_at__isnull=True)
        resolved_count = open_snags.count()
        for snag in open_snags:
            snag.resolved_at = timezone.now()
            snag.resolved_by = request.user
            snag.resolution_notes = f"Resolved via CRS Work Order: {record.work_order_number or record.description[:60]}"
            snag.maintenance_record = record
            snag.save(update_fields=["resolved_at", "resolved_by", "resolution_notes", "maintenance_record", "updated_at"])

        return Response({
            "detail": f"CRS issued. {record.aircraft.tail_number} is now airworthy and {resolved_count} defect(s) resolved.",
            "resolved_defects": resolved_count
        })


class AdSbDirectiveViewSet(viewsets.ModelViewSet):
    queryset = AdSbDirective.objects.select_related("aircraft").all()
    serializer_class = AdSbDirectiveSerializer
    permission_classes = [IsCAMO]
    filterset_fields = ["aircraft", "compliance_status", "directive_type"]


class AmeDutyLogViewSet(viewsets.ModelViewSet):
    queryset = AmeDutyLog.objects.select_related("ame_user", "base").all()
    serializer_class = AmeDutyLogSerializer
    permission_classes = [IsCAMO]
    filterset_fields = ["base", "ame_user"]


class SortieGradeViewSet(viewsets.ModelViewSet):
    queryset = SortieGrade.objects.select_related(
        "flight", "exercise", "student__user", "graded_by__user"
    ).all()
    serializer_class = SortieGradeSerializer
    permission_classes = [IsInstructor]
    filterset_fields = ["student", "flight", "exercise"]

    def perform_create(self, serializer):
        serializer.save(graded_by=self.request.user.instructor_profile)

    @action(detail=True, methods=["post"], url_path="lock")
    def lock_grade(self, request, pk=None):
        grade = self.get_object()
        if grade.is_locked:
            return Response({"detail": "Already locked."}, status=400)
        grade.locked_at = timezone.now()
        grade.save(update_fields=["locked_at"])
        return Response({"detail": "Grade locked."})
