"""
Serializers that translate the FTO backend's internal models into the
exact shape the React Native tablet dispatch app expects.

The tablet app was built independently with different field names — this
module is the translation layer. Nothing in the core models changes.
"""
from rest_framework import serializers
from apps.scheduling.models import Flight, FlightStatus
from apps.infrastructure.models import Aircraft
from apps.dispatch.models import SnagEntry, SnagCategory


class AircraftSyncSerializer(serializers.ModelSerializer):
    """
    Tablet expects:  registration, type, status, hobbsHours,
                     isFerryBlocked, aogReason, baseId
    """
    registration  = serializers.CharField(source="tail_number")
    type          = serializers.CharField(source="aircraft_type.make_model")
    hobbsHours    = serializers.DecimalField(source="hobbs_total", max_digits=8, decimal_places=1)
    isFerryBlocked = serializers.SerializerMethodField()
    aogReason     = serializers.CharField(source="aog_reason", allow_null=True)
    baseId        = serializers.UUIDField(source="current_base_id")
    baseName      = serializers.CharField(source="current_base.name")

    class Meta:
        model  = Aircraft
        fields = [
            "id", "registration", "type", "status",
            "hobbsHours", "isFerryBlocked", "aogReason",
            "baseId", "baseName",
        ]

    def get_isFerryBlocked(self, obj):
        return obj.ferry_buffer_triggered


class FlightSyncSerializer(serializers.ModelSerializer):
    """
    Tablet expects: id, aircraftId, aircraftRegistration, instructorName,
                    studentName, exerciseCode, scheduledStart, scheduledEnd,
                    status, baseId, flightType, isFerry
    """
    aircraftId           = serializers.UUIDField(source="aircraft_id")
    aircraftRegistration = serializers.CharField(source="aircraft.tail_number")
    instructorName       = serializers.SerializerMethodField()
    studentName          = serializers.SerializerMethodField()
    exerciseCode         = serializers.SerializerMethodField()
    scheduledStart       = serializers.DateTimeField(source="scheduled_start")
    scheduledEnd         = serializers.DateTimeField(source="scheduled_end")
    baseId               = serializers.UUIDField(source="base_id")
    flightType           = serializers.CharField(source="flight_type")
    isFerry              = serializers.BooleanField(source="is_ferry")

    class Meta:
        model  = Flight
        fields = [
            "id", "aircraftId", "aircraftRegistration",
            "instructorName", "studentName", "exerciseCode",
            "scheduledStart", "scheduledEnd", "status",
            "baseId", "flightType", "isFerry",
        ]

    def get_instructorName(self, obj):
        return obj.instructor.user.get_full_name()

    def get_studentName(self, obj):
        return obj.student.user.get_full_name() if obj.student else None

    def get_exerciseCode(self, obj):
        # Return the first planned exercise code if available
        first = obj.exercises.select_related("exercise").first()
        return first.exercise.exercise_code if first else None


class AlertSyncSerializer(serializers.ModelSerializer):
    """
    Maps SnagEntry (no_go category) to the SafetyAlert shape the tablet expects.
    Tablet expects: id, aircraftId, aircraftRegistration, type,
                    description, createdAt, isResolved, affectedFlightIds
    """
    aircraftId           = serializers.UUIDField(source="aircraft_id")
    aircraftRegistration = serializers.CharField(source="aircraft.tail_number")
    type                 = serializers.SerializerMethodField()
    description          = serializers.CharField()
    createdAt            = serializers.DateTimeField(source="reported_at")
    isResolved           = serializers.SerializerMethodField()
    affectedFlightIds    = serializers.SerializerMethodField()

    class Meta:
        model  = SnagEntry
        fields = [
            "id", "aircraftId", "aircraftRegistration",
            "type", "description", "createdAt",
            "isResolved", "affectedFlightIds",
        ]

    def get_type(self, obj):
        return "AOG" if obj.category == SnagCategory.NO_GO else "SNAG"

    def get_isResolved(self, obj):
        return obj.resolved_at is not None

    def get_affectedFlightIds(self, obj):
        # Return IDs of future cancelled flights for this aircraft
        from apps.scheduling.models import Flight
        from apps.scheduling.models import Flight
        return [
            str(fid) for fid in Flight.objects.filter(
                aircraft=obj.aircraft,
                status="cancelled",
                cancelled_at__gte=obj.reported_at,
            ).values_list("id", flat=True)[:20]
        ]
