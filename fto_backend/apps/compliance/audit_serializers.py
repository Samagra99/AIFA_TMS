"""
compliance/audit_serializers.py
--------------------------------
DRF serializers for the DGCA audit models.
"""

from rest_framework import serializers
from .audit_models import (
    AuditCategory, AuditParameter, AuditRecord,
    AuditParameterScore, ComplianceAlert,
)


class AuditParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AuditParameter
        fields = [
            'id', 'code', 'name', 'max_points',
            'description', 'auto_scored', 'scoring_logic_key',
        ]


class AuditCategorySerializer(serializers.ModelSerializer):
    parameters = AuditParameterSerializer(many=True, read_only=True)

    class Meta:
        model  = AuditCategory
        fields = ['id', 'code', 'name', 'max_points', 'description', 'icon', 'parameters']


class AuditParameterScoreSerializer(serializers.ModelSerializer):
    parameter_code = serializers.CharField(source='parameter.code', read_only=True)
    parameter_name = serializers.CharField(source='parameter.name', read_only=True)
    max_points     = serializers.IntegerField(source='parameter.max_points', read_only=True)

    class Meta:
        model  = AuditParameterScore
        fields = [
            'id', 'parameter', 'parameter_code', 'parameter_name',
            'max_points', 'score', 'remarks', 'auto_computed',
        ]


class AuditRecordSerializer(serializers.ModelSerializer):
    rating         = serializers.SerializerMethodField()
    rating_label   = serializers.SerializerMethodField()
    rating_color   = serializers.CharField(read_only=True)
    percentage     = serializers.FloatField(read_only=True)
    parameter_scores = AuditParameterScoreSerializer(many=True, read_only=True)

    class Meta:
        model  = AuditRecord
        fields = [
            'id', 'audit_date', 'status', 'total_score', 'percentage',
            'rating', 'rating_label', 'rating_color',
            'auditor_name', 'auditor_designation', 'remarks',
            'created_at', 'updated_at', 'parameter_scores',
        ]

    def get_rating(self, obj):
        return obj.rating[0]

    def get_rating_label(self, obj):
        return obj.rating[1]


class ComplianceAlertSerializer(serializers.ModelSerializer):
    resolved_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ComplianceAlert
        fields = [
            'id', 'severity', 'category', 'title', 'description',
            'entity_type', 'entity_id', 'entity_name',
            'due_date', 'is_resolved', 'resolved_at', 'resolved_by_name',
            'created_at',
        ]
        read_only_fields = ['created_at', 'resolved_at']

    def get_resolved_by_name(self, obj):
        if obj.resolved_by:
            return obj.resolved_by.get_full_name()
        return None


# ── Lightweight serializer for the live-score endpoint ────────────────────────

class LiveParameterScoreSerializer(serializers.Serializer):
    """Non-model serializer – populated by AuditScoringEngine.compute_all()"""
    code       = serializers.CharField()
    name       = serializers.CharField()
    score      = serializers.FloatField()
    max_score  = serializers.IntegerField()
    detail     = serializers.CharField()
    auto       = serializers.BooleanField()
    percentage = serializers.FloatField()


class LiveCategoryScoreSerializer(serializers.Serializer):
    code       = serializers.CharField()
    name       = serializers.CharField()
    icon       = serializers.CharField()
    score      = serializers.FloatField()
    max_score  = serializers.IntegerField()
    percentage = serializers.FloatField()
    parameters = LiveParameterScoreSerializer(many=True)


class LiveAuditScoreSerializer(serializers.Serializer):
    as_of       = serializers.DateTimeField()
    total_score = serializers.FloatField()
    max_score   = serializers.IntegerField()
    percentage  = serializers.FloatField()
    rating      = serializers.CharField()
    rating_label = serializers.CharField()
    rating_color = serializers.CharField()
    categories  = LiveCategoryScoreSerializer(many=True)
