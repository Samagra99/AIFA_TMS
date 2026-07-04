from django.contrib import admin
from .models import MaintenanceRecord, AdSbDirective, AmeDutyLog, SortieGrade


@admin.register(MaintenanceRecord)
class MaintenanceRecordAdmin(admin.ModelAdmin):
    list_display = ("aircraft", "maintenance_type", "performed_at_date", "crs_issued", "performed_by")
    list_filter  = ("maintenance_type", "crs_issued", "base")
    search_fields = ("aircraft__tail_number", "work_order_number")
    readonly_fields = ("crs_issued_at",)


@admin.register(AdSbDirective)
class AdSbAdmin(admin.ModelAdmin):
    list_display = ("aircraft", "directive_type", "reference_number", "compliance_status", "compliance_due_date")
    list_filter  = ("directive_type", "compliance_status")


@admin.register(SortieGrade)
class SortieGradeAdmin(admin.ModelAdmin):
    list_display = ("student", "exercise", "grade", "graded_by", "graded_at", "is_locked")
    list_filter  = ("grade",)
    readonly_fields = ("graded_at", "locked_at")
