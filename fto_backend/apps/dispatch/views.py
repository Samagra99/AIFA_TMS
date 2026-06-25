from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import IsDispatcher, IsInstructor
from apps.scheduling.models import FlightStatus
from .models import TechLog, SnagEntry
from .serializers import TechLogSerializer, SnagEntrySerializer, CloseoutSerializer


class TechLogViewSet(viewsets.ModelViewSet):
    queryset = TechLog.objects.select_related(
        "flight", "aircraft", "dispatch_cleared_by", "accepted_by"
    ).prefetch_related("snags")
    serializer_class = TechLogSerializer
    permission_classes = [IsDispatcher]
    filterset_fields = ["status", "aircraft", "flight__base"]

    @action(detail=True, methods=["post"], url_path="clear-dispatch")
    def clear_dispatch(self, request, pk=None):
        """Dispatcher clears aircraft for flight — records compliance snapshot."""
        tech_log = self.get_object()
        from apps.core.scheduling_engine import SchedulingRuleEngine
        flight = tech_log.flight
        engine = SchedulingRuleEngine()
        result = engine.check(
            student=flight.student,
            instructor=flight.instructor,
            aircraft=flight.aircraft,
            duration_minutes=flight.duration_minutes,
        )
        # Store compliance snapshot
        checks = {c.name: c.passed for c in result.checks}
        tech_log.student_medical_valid    = checks.get("student_medical_valid")
        tech_log.student_spl_valid        = checks.get("student_spl_valid")
        tech_log.instructor_fdtl_ok       = all(v for k, v in checks.items() if "fdtl" in k)
        tech_log.aircraft_hours_ok        = all(v for k, v in checks.items() if "hr" in k or "annual" in k)
        tech_log.ferry_buffer_ok          = checks.get("aircraft_50hr_ferry_buffer") or checks.get("aircraft_100hr_ferry_buffer")
        tech_log.dispatch_cleared_by      = request.user
        tech_log.dispatch_cleared_at      = timezone.now()
        tech_log.save()
        if not result.all_passed:
            return Response({"detail": "Dispatch blocked.", "rules": result.to_dict()}, status=status.HTTP_400_BAD_REQUEST)
        flight.status = FlightStatus.DISPATCHED
        flight.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Aircraft cleared for flight.", "rules": result.to_dict()})

    @action(detail=True, methods=["post"], url_path="accept-aircraft")
    def accept_aircraft(self, request, pk=None):
        """CFI accepts aircraft on apron (offline-capable endpoint)."""
        tech_log = self.get_object()
        tech_log.hobbs_out                = request.data.get("hobbs_out")
        tech_log.tacho_out                = request.data.get("tacho_out")
        tech_log.accepted_by              = request.user
        tech_log.accepted_at              = timezone.now()
        tech_log.acceptance_biometric_ok  = request.data.get("biometric_ok", False)
        tech_log.briefing_acknowledged_by = request.user
        tech_log.briefing_acknowledged_at = timezone.now()
        tech_log.save()
        tech_log.flight.status = FlightStatus.AIRBORNE
        tech_log.flight.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Aircraft accepted. Flight airborne."})

    @action(detail=True, methods=["post"], url_path="closeout")
    def closeout(self, request, pk=None):
        """Post-flight: log Hobbs/Tacho, report snags, auto-update maintenance clock."""
        tech_log = self.get_object()
        serializer = CloseoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        hobbs_in = data["hobbs_in"]
        tacho_in = data["tacho_in"]
        delta_hobbs = hobbs_in - (tech_log.hobbs_out or hobbs_in)

        tech_log.hobbs_in               = hobbs_in
        tech_log.tacho_in               = tacho_in
        tech_log.nil_defects            = data["nil_defects"]
        tech_log.flight_duration_minutes = int(delta_hobbs * 60)
        tech_log.closed_at              = timezone.now()
        tech_log.closed_by              = request.user

        # Process snags
        has_no_go = False
        for snag_data in data.get("snags", []):
            snag = SnagEntry.objects.create(
                tech_log=tech_log,
                aircraft=tech_log.aircraft,
                reported_by=request.user,
                **snag_data,
            )
            if snag.category == "no_go":
                has_no_go = True

        tech_log.status = TechLog.Status.AOG if has_no_go else TechLog.Status.CLOSED
        tech_log.save()

        # Update aircraft hours counter
        aircraft = tech_log.aircraft
        aircraft.hobbs_total += delta_hobbs
        aircraft.tacho_total += (tacho_in - (tech_log.tacho_out or tacho_in))
        aircraft.save(update_fields=["hobbs_total", "tacho_total", "updated_at"])

        # Update flight status
        tech_log.flight.status = FlightStatus.COMPLETED
        tech_log.flight.save(update_fields=["status", "updated_at"])

        return Response({"detail": "Tech log closed.", "status": tech_log.status, "aog": has_no_go})


class SnagEntryViewSet(viewsets.ModelViewSet):
    queryset = SnagEntry.objects.select_related("aircraft", "reported_by").all()
    serializer_class = SnagEntrySerializer
    permission_classes = [IsInstructor]
    filterset_fields = ["category", "aircraft"]
