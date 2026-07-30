from django.utils import timezone
from django.db.models import Q
from rest_framework.exceptions import ValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from apps.core.permissions import IsDispatcher, IsInstructor, IsFlightOperations
from apps.core.scheduling_engine import SchedulingRuleEngine
from .models import Flight, FlightStatus
from .serializers import FlightSerializer, InstructorDutyLogSerializer


class FlightViewSet(viewsets.ModelViewSet):
    queryset = Flight.objects.select_related(
        "base", "student__user", "instructor__user", "aircraft", "aircraft__current_base"
    ).prefetch_related("exercises__exercise")
    serializer_class = FlightSerializer
    permission_classes = [IsFlightOperations]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "base", "aircraft", "instructor", "student", "flight_type", "is_ferry"]
    ordering_fields = ["scheduled_start"]

    def perform_create(self, serializer):
        data = serializer.validated_data
        start = data.get('scheduled_start')
        end   = data.get('scheduled_end')
        
        # ── THE DOUBLE BOOKING BLOCK ──
        # Find any active flights that overlap with this exact time window
        overlapping_flights = Flight.objects.filter(
            status__in=[FlightStatus.DRAFT, FlightStatus.SCHEDULED, FlightStatus.CONFIRMED, FlightStatus.DISPATCHED, FlightStatus.AIRBORNE],
            scheduled_start__lt=end,
            scheduled_end__gt=start
        )
        
        # Check if the Instructor, Student, or Aircraft are double-booked
        conflict = overlapping_flights.filter(
            (Q(instructor=data.get('instructor')) if data.get('instructor') else Q(pk__isnull=True)) |
            Q(aircraft=data.get('aircraft')) |
            (Q(student=data.get('student')) if data.get('student') else Q(pk__isnull=True))
        ).first()

        if conflict:
            raise ValidationError({
                "conflict": f"Conflict detected! Flight {conflict.id} overlaps. "
                            f"You must suspend or cancel it before scheduling this one."
            })

        user = self.request.user
        flight_date = start.date() if start else None
        today = timezone.now().date()
        
        save_kwargs = {"created_by": user}
        if getattr(user, 'role', '').lower() == 'dispatcher' and flight_date and flight_date > today:
            save_kwargs["status"] = FlightStatus.DRAFT
            
        serializer.save(**save_kwargs)

    @action(detail=True, methods=["post"], url_path="suspend")
    def suspend(self, request, pk=None):
        """Dispatcher suspends a flight to resolve a day-of conflict."""
        flight = self.get_object()
        flight.status = FlightStatus.SUSPENDED
        flight.notes  = f"Suspended at {timezone.now().strftime('%H:%M')} - " + request.data.get("reason", "")
        flight.save(update_fields=["status", "notes", "updated_at"])
        return Response({"detail": "Flight suspended successfully."})

    @action(detail=False, methods=["get"], url_path="daily-roster")
    def daily_roster(self, request):
        """Returns all flights for a given date and base."""
        date_str = request.query_params.get("date", timezone.now().date().isoformat())
        base_id  = request.query_params.get("base_id")
        qs = self.get_queryset().filter(scheduled_start__date=date_str)
        if base_id and base_id.lower() != "all":
            qs = qs.filter(base_id=base_id)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        """Run the scheduling rule engine and confirm the flight if all checks pass."""
        flight = self.get_object()

        cfi_override = request.data.get("cfi_override", False)
        if cfi_override and request.user.role not in ['cfi', 'superadmin']:
            return Response({"detail": "Only a CFI can authorize an override"}, status=403)
        
        serializer = self.get_serializer(
            flight,
            data={"status": FlightStatus.CONFIRMED, "cfi_override": cfi_override},
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({"detail": "Flight confirmed successfully."})

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        flight = self.get_object()
        if flight.status == FlightStatus.AIRBORNE:
            return Response({"detail": "Cannot cancel an airborne flight. Use abort or closeout instead."}, status=400)
        if flight.status == FlightStatus.COMPLETED:
            return Response({"detail": "Cannot cancel a completed flight."}, status=400)

        reason = request.data.get("reason", "Cancelled prior to takeoff.")
        flight.status = FlightStatus.CANCELLED
        flight.cancelled_at = timezone.now()
        flight.cancelled_by = request.user
        flight.cancellation_reason = reason
        flight.save(update_fields=["status", "cancelled_at", "cancelled_by", "cancellation_reason", "updated_at"])

        # If a TechLog exists for this flight and is open, close/invalidate it
        if hasattr(flight, 'tech_log') and flight.tech_log:
            tech_log = flight.tech_log
            if tech_log.status != "closed":
                tech_log.status = "closed"
                tech_log.closed_at = timezone.now()
                tech_log.closed_by = request.user
                tech_log.save(update_fields=["status", "closed_at", "closed_by", "updated_at"])

        return Response({"detail": "Flight cancelled successfully."})

    @action(detail=False, methods=["post"], url_path="check-constraints")
    def check_constraints(self, request):
        """Pre-flight constraint check without saving."""
        from apps.users.models import Student, Instructor
        from apps.infrastructure.models import Aircraft
        student_id    = request.data.get("student_id")
        instructor_id = request.data.get("instructor_id")
        aircraft_id   = request.data.get("aircraft_id")
        duration_min  = int(request.data.get("duration_minutes", 60))
        engine = SchedulingRuleEngine()
        result = engine.check(
            student=Student.objects.get(id=student_id) if student_id else None,
            instructor=Instructor.objects.get(id=instructor_id) if instructor_id else None,
            aircraft=Aircraft.objects.get(id=aircraft_id) if aircraft_id else None,
            duration_minutes=duration_min,
        )
        return Response(result.to_dict())
