from rest_framework import serializers
from .models import BillingRecord, EmiPlan, EmiInstalment


class EmiInstalmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EmiInstalment
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class EmiPlanSerializer(serializers.ModelSerializer):
    instalments = EmiInstalmentSerializer(many=True, read_only=True)

    class Meta:
        model  = EmiPlan
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class BillingRecordSerializer(serializers.ModelSerializer):
    gst_amount       = serializers.ReadOnlyField()
    total_amount_inr = serializers.ReadOnlyField()
    student_name     = serializers.CharField(source="student.user.get_full_name", read_only=True)
    emi_plans        = EmiPlanSerializer(many=True, read_only=True)

    class Meta:
        model  = BillingRecord
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
