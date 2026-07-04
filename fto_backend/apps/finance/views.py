from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from apps.core.permissions import IsFinance
from .models import BillingRecord, EmiPlan, EmiInstalment, PaymentStatus
from .serializers import BillingRecordSerializer, EmiPlanSerializer, EmiInstalmentSerializer


class BillingRecordViewSet(viewsets.ModelViewSet):
    queryset = BillingRecord.objects.select_related("student__user", "created_by").prefetch_related("emi_plans__instalments").all()
    serializer_class = BillingRecordSerializer
    permission_classes = [IsFinance]
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["status", "billing_type", "student"]
    search_fields    = ["invoice_number", "student__user__first_name", "student__user__last_name"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        record = self.get_object()
        record.status           = PaymentStatus.PAID
        record.paid_at          = timezone.now()
        record.payment_method   = request.data.get("payment_method", "")
        record.payment_reference = request.data.get("payment_reference", "")
        record.save(update_fields=["status","paid_at","payment_method","payment_reference","updated_at"])
        return Response({"detail": "Payment recorded."})

    @action(detail=False, methods=["get"], url_path="outstanding")
    def outstanding(self, request):
        qs = self.get_queryset().filter(status__in=[PaymentStatus.PENDING, PaymentStatus.OVERDUE])
        return Response(BillingRecordSerializer(qs, many=True).data)


class EmiPlanViewSet(viewsets.ModelViewSet):
    queryset = EmiPlan.objects.select_related("student__user").prefetch_related("instalments").all()
    serializer_class = EmiPlanSerializer
    permission_classes = [IsFinance]
    filterset_fields = ["student"]

    def perform_create(self, serializer):
        plan = serializer.save()
        # Auto-generate instalment rows
        from datetime import timedelta
        from dateutil.relativedelta import relativedelta
        rows = []
        for i in range(1, plan.total_instalments + 1):
            due = plan.start_date + relativedelta(months=i - 1)
            rows.append(EmiInstalment(
                emi_plan=plan,
                instalment_number=i,
                due_date=due,
                amount_inr=plan.amount_per_instalment,
            ))
        EmiInstalment.objects.bulk_create(rows)
