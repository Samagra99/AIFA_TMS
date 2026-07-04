from django.contrib import admin
from .models import (
    InstructorStudentAssignment, DailyPlanRequest,
    InstructorDailyPlan, InstructorDailyPlanEntry, AISuggestedRoster,
)


@admin.register(InstructorStudentAssignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display  = ("instructor", "student", "base", "is_active", "assigned_date")
    list_filter   = ("base", "is_active")
    search_fields = ("instructor__user__last_name", "student__user__last_name")


class PlanInline(admin.TabularInline):
    model  = InstructorDailyPlan
    extra  = 0
    fields = ("instructor", "status", "availability_start", "availability_end", "submitted_at")
    readonly_fields = ("submitted_at",)


@admin.register(DailyPlanRequest)
class PlanRequestAdmin(admin.ModelAdmin):
    list_display = ("plan_date", "base", "status", "deadline", "created_by")
    list_filter  = ("status", "base")
    inlines      = [PlanInline]


class EntryInline(admin.TabularInline):
    model  = InstructorDailyPlanEntry
    extra  = 0
    fields = ("student", "exercise", "preferred_start", "prereq_met",
              "cfi_override_requested", "cfi_override_approved")
    readonly_fields = ("prereq_met",)


@admin.register(InstructorDailyPlan)
class InstructorDailyPlanAdmin(admin.ModelAdmin):
    list_display = ("instructor", "plan_request", "status", "submitted_at")
    list_filter  = ("status",)
    inlines      = [EntryInline]


@admin.register(AISuggestedRoster)
class AISuggestedRosterAdmin(admin.ModelAdmin):
    list_display    = ("plan_request", "model_used", "confirmed", "confirmed_at", "created_at")
    list_filter     = ("confirmed", "model_used")
    readonly_fields = ("prompt_used", "suggestion", "confirmed_at", "confirmed_by")
