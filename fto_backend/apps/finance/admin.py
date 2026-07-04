from django.contrib import admin
from .models import BillingRecord, EmiPlan, EmiInstalment


class EmiInstalmentInline(admin.TabularInline):
    model = EmiInstalment
    extra = 0


class EmiPlanInline(admin.TabularInline):
    model = EmiPlan
    extra = 0


@admin.register(BillingRecord)
class BillingRecordAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "student", "billing_type", "amount_inr", "gst_amount", "total_amount_inr", "status")
    list_filter  = ("status", "billing_type")
    inlines      = [EmiPlanInline]


@admin.register(EmiPlan)
class EmiPlanAdmin(admin.ModelAdmin):
    list_display = ("student", "total_instalments", "amount_per_instalment", "start_date")
    inlines      = [EmiInstalmentInline]
