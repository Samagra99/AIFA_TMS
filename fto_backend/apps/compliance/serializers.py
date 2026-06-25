from rest_framework import serializers
from .models import OccurrenceReport, HazardEntry


class OccurrenceReportSerializer(serializers.ModelSerializer):
    is_locked    = serializers.ReadOnlyField()
    report_number = serializers.ReadOnlyField()

    class Meta:
        model  = OccurrenceReport
        fields = "__all__"
        read_only_fields = ["id", "submitted_at", "created_at", "updated_at", "locked_at"]

    def validate(self, data):
        if self.instance and self.instance.is_locked:
            raise serializers.ValidationError(
                "This occurrence report is locked (> 48 hours) and cannot be modified."
            )
        return data


class HazardEntrySerializer(serializers.ModelSerializer):
    risk_score = serializers.ReadOnlyField()

    class Meta:
        model  = HazardEntry
        fields = "__all__"
        read_only_fields = ["id", "identified_at", "created_at", "updated_at"]
