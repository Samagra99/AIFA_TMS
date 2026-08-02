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
from .serializers import TechLogSerializer, SnagEntrySerializer, CloseoutSerializer, OffBlockSerializer
import time
from .ba_models import BAEquipment, BATestEntry
from .ba_serializers import BAEquipmentSerializer, BATestEntrySerializer
from apps.core.permissions import IsDoctor
from rest_framework import filters

class TechLogViewSet(viewsets.ModelViewSet):
    queryset = TechLog.objects.select_related(
        "flight", "aircraft", "dispatch_cleared_by", "accepted_by"
    ).prefetch_related("snags")
    serializer_class = TechLogSerializer
    permission_classes = [IsFlightOperations]
    filterset_fields = ["status", "aircraft", "flight__base", "flight"]

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'accept_aircraft', 'closeout']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def _populate_tech_log_compliance(self, tech_log):
        from apps.core.scheduling_engine import SchedulingRuleEngine
        from .ba_models import BATestEntry
        from apps.weather.models import WeatherCache
        from datetime import timedelta as td
        
        flight = tech_log.flight
        ba_window = timezone.now() - td(hours=10)
        ba_errors = []
        ba_details = {}

        # 1. Weather fetching
        weather = None
        if flight.base:
            # Check weather for same day and last 3 hours
            weather_window = timezone.now() - td(hours=3)
            today = timezone.localdate()
            weather = WeatherCache.objects.filter(
                icao_code=flight.base.icao_code,
                observation_time__date=today,
                observation_time__gte=weather_window
            ).order_by('-observation_time').first()

            if weather:
                tech_log.weather_snapshot = weather
                tech_log.live_wind_kt = weather.wind_speed_kt
                tech_log.density_altitude_ft = weather.density_altitude_ft

                if flight.base.active_runway and weather.wind_speed_kt is not None and weather.wind_direction_deg is not None:
                    import math
                    angle_diff = abs(weather.wind_direction_deg - flight.base.active_runway.heading_deg)
                    crosswind_kt = abs(weather.wind_speed_kt * math.sin(math.radians(angle_diff)))
                    tech_log.live_crosswind_component_kt = round(crosswind_kt, 1)
                else:
                    tech_log.live_crosswind_component_kt = None

        # 2. BA Logic
        if flight.student:
            student_user = flight.student.user
            student_ba = BATestEntry.objects.filter(
                person=student_user, test_time__gte=ba_window, result='PASS'
            ).order_by('-test_time').first()
            if not student_ba:
                ba_errors.append(f"Missing or failed BA test for student: {student_user.get_full_name()}")
            else:
                ba_details['student'] = {
                    'person': student_user.get_full_name(),
                    'test_serial_number': student_ba.test_serial_number,
                    'equipment_number': student_ba.equipment_number,
                    'test_time': student_ba.test_time.isoformat(),
                    'result': student_ba.result,
                }
        
        if flight.instructor:
            instr_user = flight.instructor.user
            instr_ba = BATestEntry.objects.filter(
                person=instr_user, test_time__gte=ba_window, result='PASS'
            ).order_by('-test_time').first()
            if not instr_ba:
                ba_errors.append(f"Missing or failed BA test for instructor: {instr_user.get_full_name()}")
            else:
                ba_details['instructor'] = {
                    'person': instr_user.get_full_name(),
                    'test_serial_number': instr_ba.test_serial_number,
                    'equipment_number': instr_ba.equipment_number,
                    'test_time': instr_ba.test_time.isoformat(),
                    'result': instr_ba.result,
                }

        tech_log.ba_test_ok = len(ba_errors) == 0
        tech_log.ba_test_details = ba_details

        # 3. Scheduling Rule Engine
        engine = SchedulingRuleEngine()
        result = engine.check(
            student=flight.student,
            instructor=flight.instructor,
            aircraft=flight.aircraft,
            weather=weather,
            duration_minutes=flight.duration_minutes,
            flight_id=flight.id
        )

        checks = {c.name: c.passed for c in result.checks}
        tech_log.student_medical_valid    = checks.get("student_medical_valid")
        tech_log.student_spl_valid        = checks.get("student_spl_valid")
        tech_log.instructor_fdtl_ok       = all(v for k, v in checks.items() if "fdtl" in k)
        tech_log.aircraft_hours_ok        = all(v for k, v in checks.items() if "hr" in k or "annual" in k)
        tech_log.ferry_buffer_ok          = checks.get("aircraft_50hr_ferry_buffer") or checks.get("aircraft_100hr_ferry_buffer")
        tech_log.crosswind_ok             = checks.get("crosswind_limit")
        
        return ba_errors, result

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        role = getattr(self.request.user, "role", None)
        if role not in ["dispatcher", "camo", "superadmin", "administrator"]:
            raise PermissionDenied("Only dispatchers can generate a Tech Log.")
        tech_log = serializer.save(status='open')
        self._populate_tech_log_compliance(tech_log)
        tech_log.save()

    @action(detail=True, methods=["post"], url_path="clear-dispatch")
    def clear_dispatch(self, request, pk=None):
        """Dispatcher clears aircraft for flight — records compliance snapshot."""
        tech_log = self.get_object()
        flight = tech_log.flight

        flight.preflight_briefing_completed = request.data.get("preflight_briefing_completed", flight.preflight_briefing_completed)
        flight.save(update_fields=["preflight_briefing_completed"])

        pin = request.data.get("dispatcher_pin")
        if not pin or not request.user.verify_pin(pin): # Assuming you have a verify_pin method, or adjust to your auth logic
            return Response({"detail": "Invalid Biometric/PIN signature."}, status=403)
            
        ba_errors, result = self._populate_tech_log_compliance(tech_log)

        if ba_errors:
            tech_log.save()
            return Response({
                "detail": "Dispatch blocked: " + "; ".join(ba_errors),
                "ba_errors": ba_errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        if not flight.preflight_briefing_completed:
            tech_log.save()
            return Response({"detail": "Crew has not completed pre-flight briefing."}, status=400)
        
        cfi_override = request.data.get("cfi_override", False)

        has_hard_failures = not result.all_passed
        has_unapproved_soft_blocks = len(result.warnings) > 0 and not cfi_override

        if has_hard_failures or has_unapproved_soft_blocks:
            tech_log.save()
            return Response({"detail": "Dispatch blocked.", "rules": result.to_dict()}, status=status.HTTP_400_BAD_REQUEST)
        
        tech_log.dispatch_cleared_by = request.user
        tech_log.dispatch_cleared_at = timezone.now()
        tech_log.save()

        flight.dispatcher_cleared_by = request.user
        flight.dispatcher_cleared_at = timezone.now()
        flight.status = FlightStatus.DISPATCHED
        flight.save(update_fields=["dispatcher_cleared_by", "dispatcher_cleared_at", "status", "updated_at"])
        return Response({"detail": "Aircraft cleared for flight.", "rules": result.to_dict()})

    @action(detail=True, methods=["post"], url_path="off-block")
    def off_block(self, request, pk=None):
        """Record taxi-out time and mark flight as airborne."""
        tech_log = self.get_object()
        flight = tech_log.flight
        user = request.user
        
        is_assigned_student = (flight.student and flight.student.user == user)
        is_assigned_instructor = (flight.instructor and flight.instructor.user == user)
        is_assigned_secondary = (flight.secondary_instructor and flight.secondary_instructor.user == user)
        
        if not (is_assigned_student or is_assigned_instructor or is_assigned_secondary):
            return Response({"detail": "Only the assigned crew can record off-block time."}, status=403)

        serializer = OffBlockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        tech_log.off_block_time = serializer.validated_data["off_block_time"]
        tech_log.save(update_fields=["off_block_time", "updated_at"])
        
        flight = tech_log.flight
        flight.status = FlightStatus.AIRBORNE
        flight.save(update_fields=["status", "updated_at"])
        
        return Response({"detail": "Off-block time recorded. Flight airborne."})

    @action(detail=True, methods=["post"], url_path="accept-aircraft")
    def accept_aircraft(self, request, pk=None):
        """CFI accepts aircraft on apron (offline-capable endpoint)."""
        tech_log = self.get_object()
        flight = tech_log.flight
        user = request.user

        is_flight_ops = user.role in ["superadmin", "cfi", "instructor", "dispatcher"]
        is_assigned_student = (flight.student and flight.student.user == user)
        is_Solo = flight.is_solo

        if not (is_flight_ops or (is_assigned_student and is_Solo)):
            return Response({"detail": "You do not have permission to accept this aircraft."}, status=403)

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
        return Response({"detail": "Aircraft accepted. Proceed to off-block."})

    @action(detail=True, methods=["post"], url_path="closeout")
    def closeout(self, request, pk=None):
        """Post-flight: log Hobbs/Tacho, report snags, auto-update maintenance clock."""
        tech_log = self.get_object()
        flight = tech_log.flight
        user = request.user

        is_flight_ops = user.role in ["superadmin", "cfi", "instructor", "dispatcher"]
        is_assigned_student = (flight.student and flight.student.user == user)
        is_Solo = flight.is_solo

        if not (is_flight_ops or (is_assigned_student and is_Solo)):
            return Response({"detail": "You do not have permission to close out this flight."}, status=403)

        # M4 Fix: Reject closeout if aircraft has not been accepted on apron
        if tech_log.accepted_at is None:
            return Response(
                {"detail": "Aircraft has not been accepted on the apron yet. Please complete aircraft acceptance before closeout."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CloseoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        crew_pin = data["crew_pin"]
        if not request.user.verify_pin(crew_pin):
            return Response({"detail": "Invalid PIN."}, status=status.HTTP_403_FORBIDDEN)

        hobbs_in  = Decimal(str(data["hobbs_in"]))
        tacho_in  = Decimal(str(data["tacho_in"]))
        off_block = data["off_block_time"]
        on_block  = data["on_block_time"]

        hobbs_out_val = tech_log.hobbs_out if tech_log.hobbs_out is not None else hobbs_in
        tacho_out_val = tech_log.tacho_out if tech_log.tacho_out is not None else tacho_in
        delta_hobbs   = hobbs_in - hobbs_out_val
        delta_tacho   = tacho_in - tacho_out_val
        
        if delta_hobbs < 0:
            return Response({"detail": "Hobbs In cannot be less than Hobbs Out."}, status=400)

        # ── 5-MINUTE TOLERANCE VALIDATION ──
        hobbs_duration_min = int(delta_hobbs * Decimal('60'))
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
        tech_log.flight_duration_minutes = block_duration_min
        tech_log.closed_at              = timezone.now()
        tech_log.closed_by              = request.user

        # Process snags & issue ComplianceAlerts for CAMO
        has_no_go = False
        no_go_snag_desc = ""
        from apps.compliance.models import ComplianceAlert
        for snag_data in data.get("snags", []):
            snag = SnagEntry.objects.create(
                tech_log=tech_log,
                aircraft=tech_log.aircraft,
                reported_by=request.user,
                **snag_data,
            )
            if snag.category == "no_go":
                has_no_go = True
                no_go_snag_desc = snag.description
                ComplianceAlert.objects.create(
                    severity="critical",
                    category="aircraft",
                    title=f"AOG / No-Go Snag Reported: {tech_log.aircraft.tail_number}",
                    description=f"Critical No-Go defect reported by {request.user.get_full_name()}: {snag.description}",
                    entity_type="Aircraft",
                    entity_id=None,
                    entity_name=tech_log.aircraft.tail_number,
                )
            elif snag.category == "go":
                ComplianceAlert.objects.create(
                    severity="warning",
                    category="maintenance",
                    title=f"Deferred Defect Reported: {tech_log.aircraft.tail_number}",
                    description=f"Deferred defect reported: '{snag.description}'. CAMO resolution timeline required.",
                    entity_type="Aircraft",
                    entity_id=None,
                    entity_name=tech_log.aircraft.tail_number,
                )

        tech_log.status = TechLog.Status.AOG if has_no_go else TechLog.Status.CLOSED
        tech_log.save()

        # Update aircraft hours counter
        aircraft = tech_log.aircraft
        aircraft.hobbs_total += delta_hobbs
        aircraft.tacho_total += delta_tacho
        aircraft.save(update_fields=["hobbs_total", "tacho_total", "updated_at"])

        # Update flight status
        tech_log.flight.status = FlightStatus.COMPLETED
        tech_log.flight.save(update_fields=["status", "updated_at"])

        return Response({"detail": "Tech log closed.", "status": tech_log.status, "aog": has_no_go})


class SnagEntryViewSet(viewsets.ModelViewSet):
    queryset = SnagEntry.objects.select_related("aircraft", "reported_by", "camo_approved_by").all()
    serializer_class = SnagEntrySerializer
    permission_classes = [IsFlightOperations]
    filterset_fields = ["category", "aircraft"]

    @action(detail=True, methods=["post"], url_path="set-timeline")
    def set_timeline(self, request, pk=None):
        """CAMO personnel sets or updates resolution timeline & notes for a deferred snag."""
        if request.user.role != "camo":
            return Response({"detail": "Permission denied. Only CAMO personnel can set resolution timelines."}, status=403)

        snag = self.get_object()
        due_date = request.data.get("resolution_due_date")
        camo_notes = request.data.get("camo_notes", "")

        if not due_date:
            return Response({"detail": "resolution_due_date is required."}, status=400)

        snag.resolution_due_date = due_date
        snag.camo_notes          = camo_notes
        snag.camo_approved_by    = request.user
        snag.save(update_fields=["resolution_due_date", "camo_notes", "camo_approved_by", "updated_at"])

        return Response({
            "detail": f"Resolution timeline set for {snag.aircraft.tail_number}.",
            "resolution_due_date": snag.resolution_due_date,
            "camo_notes": snag.camo_notes
        })

    @action(detail=True, methods=["post"], url_path="reclassify-no-go")
    def reclassify_no_go(self, request, pk=None):
        """CAMO personnel reclassifies a deferred snag as NO-GO (AOG), immediately grounding the aircraft."""
        if request.user.role != "camo":
            return Response({"detail": "Permission denied. Only CAMO personnel can ground aircraft or reclassify snags."}, status=403)

        snag = self.get_object()
        camo_notes = request.data.get("camo_notes", "")

        snag.category = SnagCategory.NO_GO
        if camo_notes:
            snag.camo_notes = camo_notes
        snag.camo_approved_by = request.user
        snag.save(update_fields=["category", "camo_notes", "camo_approved_by", "updated_at"])

        # Ground aircraft immediately
        aircraft = snag.aircraft
        aircraft.status = "aog"
        aircraft.aog_reason = f"CAMO Grounding (No-Go): {snag.description[:60]}"
        aircraft.aog_since = timezone.now()
        aircraft.save(update_fields=["status", "aog_reason", "aog_since", "updated_at"])

        from apps.compliance.models import ComplianceAlert
        ComplianceAlert.objects.create(
            severity="critical",
            category="aircraft",
            title=f"Aircraft Grounded by CAMO: {aircraft.tail_number}",
            description=f"CAMO reclassified deferred defect '{snag.description}' as NO-GO (AOG). Aircraft grounded.",
            entity_type="Aircraft",
            entity_id=None,
            entity_name=aircraft.tail_number,
        )

        return Response({
            "detail": f"Snag reclassified as NO-GO. Aircraft {aircraft.tail_number} is now grounded (AOG).",
            "category": snag.category
        })


class BAEquipmentViewSet(viewsets.ModelViewSet):
    queryset = BAEquipment.objects.all()
    serializer_class = BAEquipmentSerializer
    permission_classes = [IsDoctor]
    filterset_fields = ['is_active']


class BATestEntryViewSet(viewsets.ModelViewSet):
    queryset = BATestEntry.objects.select_related('equipment', 'person', 'conducted_by').all()
    serializer_class = BATestEntrySerializer
    permission_classes = [IsDoctor]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['result', 'equipment', 'person']
    search_fields = ['person__first_name', 'person__last_name', 'equipment_number', 'test_serial_number']
    ordering_fields = ['test_time', 'person__last_name', 'result']
    ordering = ['-test_time']

    def perform_create(self, serializer):
        serializer.save(conducted_by=self.request.user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ba_candidates(request):
    from apps.users.models import User
    q = request.query_params.get('q', '').strip()
    qs = User.objects.filter(role__in=['student', 'instructor', 'cfi'], is_active=True)
    if q and len(q) >= 2:
        from django.db.models import Q
        qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(employee_id__icontains=q))
    qs = qs.order_by('first_name', 'last_name')[:20]
    data = [{'id': str(u.id), 'name': u.get_full_name(), 'role': u.role, 'employee_id': u.employee_id} for u in qs]
    return Response(data)
