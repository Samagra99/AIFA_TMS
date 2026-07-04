from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from apps.core.permissions import IsDispatcher, IsInstructor
from apps.core.scheduling_engine import SchedulingRuleEngine
from .models import Flight, FlightStatus
from .serializers import FlightSerializer, InstructorDutyLogSerializer


class FlightViewSet(viewsets.ModelViewSet):
    queryset = Flight.objects.select_related(
        "base", "student__user", "instructor__user", "aircraft", "aircraft__current_base"
    ).prefetch_related("exercises__exercise")
    serializer_class = FlightSerializer
    permission_classes = [IsDispatcher]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "base", "aircraft", "instructor", "student", "flight_type", "is_ferry"]
    ordering_fields = ["scheduled_start"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

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
        engine = SchedulingRuleEngine()
        result = engine.check(
            student=flight.student,
            instructor=flight.instructor,
            aircraft=flight.aircraft,
            duration_minutes=flight.duration_minutes,
            is_solo=flight.is_solo,
        )
        if not result.all_passed:
            return Response({"scheduling_rules": result.to_dict()}, status=status.HTTP_400_BAD_REQUEST)
        flight.status = FlightStatus.CONFIRMED
        flight.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Flight confirmed.", "scheduling_rules": result.to_dict()})

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        flight = self.get_object()
        reason = request.data.get("reason", "")
        flight.status = FlightStatus.CANCELLED
        flight.cancelled_at = timezone.now()
        flight.cancelled_by = request.user
        flight.cancellation_reason = reason
        flight.save(update_fields=["status","cancelled_at","cancelled_by","cancellation_reason","updated_at"])
        return Response({"detail": "Flight cancelled."})

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
