from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Instructor, Student, StudentDocument


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display   = ("email", "get_full_name", "role", "home_base", "is_active")
    list_filter    = ("role", "is_active", "home_base")
    search_fields  = ("email", "first_name", "last_name")
    ordering       = ("email",)
    fieldsets      = (
        (None,          {"fields": ("email", "password")}),
        ("Personal",    {"fields": ("first_name", "last_name", "phone")}),
        ("FTO",         {"fields": ("role", "home_base", "token_version")}),
        ('Operational PIN', {'fields': ("dispatch_pin",)}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups")}),
    )
    add_fieldsets  = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2", "role", "first_name", "last_name")}),
    )
    readonly_fields = ("dispatch_pin",)


@admin.register(Instructor)
class InstructorAdmin(admin.ModelAdmin):
    list_display = ("user", "fir_licence_number", "fir_expiry", "fdtl_daily_remaining_min", "instrument_rating")
    search_fields = ("user__first_name", "user__last_name", "fir_licence_number", "cpl_atpl_number")


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display  = ("user", "batch_number", "target_licence", "spl_expiry", "medical_expiry", "solo_approved")
    list_filter   = ("target_licence", "solo_approved", "medical_class")
    search_fields = ("user__first_name", "user__last_name", "spl_number", "batch_number")
    readonly_fields = ("hours_total", "hours_pic", "hours_dual", "hours_cross_country_pic",
                       "hours_cross_country_dual", "hours_night", "hours_fstd", 
                       "hours_instrument_simulated", "hours_instrument_actual")


@admin.register(StudentDocument)
class StudentDocumentAdmin(admin.ModelAdmin):
    list_display = ("student", "document_type", "expiry_date", "status", "is_superseded")
    list_filter  = ("document_type", "status", "is_superseded")
