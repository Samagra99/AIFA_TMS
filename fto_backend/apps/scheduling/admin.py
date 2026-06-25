from django.contrib import admin
from .models import Flight, FlightExercise, InstructorDutyLog


class FlightExerciseInline(admin.TabularInline):
    model = FlightExercise
    extra = 0


@admin.register(Flight)
class FlightAdmin(admin.ModelAdmin):
    list_display  = ("aircraft", "instructor", "student", "flight_type", "scheduled_start", "status")
    list_filter   = ("status", "flight_type", "base", "is_ferry")
    search_fields = ("aircraft__tail_number", "student__user__last_name", "instructor__user__last_name")
    inlines       = [FlightExerciseInline]
    readonly_fields = ("created_by",)
