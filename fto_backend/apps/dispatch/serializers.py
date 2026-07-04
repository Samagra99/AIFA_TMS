from django.utils import timezone
from rest_framework import serializers
from .models import TechLog, SnagEntry, SnagCategory


class SnagEntrySerializer(serializers.ModelSerializer):
    triggers_aog = serializers.ReadOnlyField()

    class Meta:
        model = SnagEntry
        fields = "__all__"
        read_only_fields = ["id", "reported_at", "created_at", "updated_at", "aircraft"]


class TechLogSerializer(serializers.ModelSerializer):
    snags = SnagEntrySerializer(many=True, read_only=True)

    class Meta:
        model = TechLog
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "flight_duration_minutes"]

    def validate(self, data):
        # Enforce hobbs_in >= hobbs_out
        hobbs_in  = data.get("hobbs_in",  getattr(self.instance, "hobbs_in",  None))
        hobbs_out = data.get("hobbs_out", getattr(self.instance, "hobbs_out", None))
        if hobbs_in is not None and hobbs_out is not None and hobbs_in < hobbs_out:
            raise serializers.ValidationError("hobbs_in must be ≥ hobbs_out.")
        return data


class CloseoutSerializer(serializers.Serializer):
    """POST /tech-logs/{id}/closeout/ — post-flight data entry."""
    hobbs_in      = serializers.DecimalField(max_digits=8, decimal_places=1)
    tacho_in      = serializers.DecimalField(max_digits=8, decimal_places=1)
    nil_defects   = serializers.BooleanField()
    snags         = SnagEntrySerializer(many=True, required=False)
