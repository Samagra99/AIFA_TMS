from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from apps.core.permissions import IsDispatcher, IsInstructor, IsFlightOperations
from apps.scheduling.models import FlightStatus
from datetime import timedelta
from .models import TechLog, SnagEntry
from .serializers import TechLogSerializer, SnagEntrySerializer, CloseoutSerializer
import time


class TechLogViewSet(viewsets.ModelViewSet):
    queryset = TechLog.objects.select_related(
        "flight", "aircraft", "dispatch_cleared_by", "accepted_by"
    ).prefetch_related("snags")
    serializer_class = TechLogSerializer
    permission_classes = [IsFlightOperations]
    filterset_fields = ["status", "aircraft", "flight__base", "flight"]

    @action(detail=True, methods=["post"], url_path="clear-dispatch")
    def clear_dispatch(self, request, pk=None):
        """Dispatcher clears aircraft for flight — records compliance snapshot."""
        tech_log = self.get_object()
        from apps.core.scheduling_engine import SchedulingRuleEngine
        flight = tech_log.flight

        flight.preflight_briefing_completed = request.data.get("preflight_briefing_completed", flight.preflight_briefing_completed)
        flight.ba_test_cleared = request.data.get("ba_test_cleared", flight.ba_test_cleared)
        flight.save(update_fields=["preflight_briefing_completed", "ba_test_cleared"])

        pin = request.data.get("dispatcher_pin")
        if not pin or not request.user.verify_pin(pin): # Assuming you have a verify_pin method, or adjust to your auth logic
            return Response({"detail": "Invalid Biometric/PIN signature."}, status=403)
            
        if not flight.preflight_briefing_completed or not flight.ba_test_cleared:
            return Response({"detail": "Crew has not completed BA tests and Briefings."}, status=400)
        
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
        flight.dispatcher_cleared_by = request.user
        flight.dispatcher_cleared_at = timezone.now()
        flight.status = FlightStatus.DISPATCHED
        flight.save(update_fields=["dispatcher_cleared_by", "dispatcher_cleared_at", "status", "updated_at"])
        return Response({"detail": "Aircraft cleared for flight.", "rules": result.to_dict()})

    @action(detail=True, methods=["post"], url_path="accept-aircraft")
    def accept_aircraft(self, request, pk=None):
        """CFI accepts aircraft on apron (offline-capable endpoint)."""
        tech_log = self.get_object()

        pin = request.data.get("crew_pin")
        if not pin or not request.user.verify_pin(pin):
            return Response({"detail": "Invalid Biometric/PIN signature."}, status=403)
        
        tech_log.hobbs_out                = request.data.get("hobbs_out")
        tech_log.tacho_out                = request.data.get("tacho_out")
        tech_log.accepted_by              = request.user
        tech_log.accepted_at              = timezone.now()
        tech_log.acceptance_biometric_ok  = True
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

        crew_pin = data["crew_pin"]
        if getattr(request.user, 'pin', None) != crew_pin and not request.user.verify_pin(crew_pin):
            return Response({"detail": "Invalid PIN."}, status=status.HTTP_403_FORBIDDEN)

        hobbs_in  = Decimal(str(data["hobbs_in"]))
        tacho_in  = Decimal(str(data["tacho_in"]))
        off_block = data["off_block_time"]
        on_block  = data["on_block_time"]

        delta_hobbs = data["hobbs_in"] - tech_log.hobbs_out
        
        if delta_hobbs < 0:
            return Response({"detail": "Hobbs In cannot be less than Hobbs Out."}, status=400)

        # ── 5-MINUTE TOLERANCE VALIDATION ──
        hobbs_duration_min = int((hobbs_in - (tech_log.hobbs_out or hobbs_in)) * Decimal('60'))
        block_duration_min = int((on_block - off_block).total_seconds() / 60)

        if abs(hobbs_duration_min - block_duration_min) > 5:
            return Response({
                "detail": f"Time discrepancy! Hobbs duration ({hobbs_duration_min}m) and "
                          f"Block duration ({block_duration_min}m) differ by more than 5 minutes."
            }, status=status.HTTP_400_BAD_REQUEST)

        tech_log.hobbs_in               = hobbs_in
        tech_log.tacho_in               = tacho_in
        tech_log.off_block_time         = off_block
        tech_log.on_block_time          = on_block
        tech_log.nil_defects            = data["nil_defects"]
        tech_log.flight_duration_minutes = block_duration_min # or use hobbs_duration_min, depending on your business logic 
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
    permission_classes = [IsFlightOperations]
    filterset_fields = ["category", "aircraft"]
