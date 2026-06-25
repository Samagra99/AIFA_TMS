"""Role-based access control permissions for the FTO platform."""
from rest_framework.permissions import BasePermission


class IsAdminOrCFI(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("superadmin", "cfi")


class IsDispatcher(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            "superadmin", "cfi", "dispatcher"
        )


class IsCAMO(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("superadmin", "camo")


class IsSafetyOfficer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            "superadmin", "safety_officer", "cfi"
        )


class IsInstructor(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            "superadmin", "cfi", "instructor"
        )


class IsFinance(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            "superadmin", "finance", "cfi"
        )


class SameBaseOrAdmin(BasePermission):
    """User can only access resources belonging to their home base, unless admin/cfi."""
    def has_object_permission(self, request, view, obj):
        if request.user.role in ("superadmin", "cfi"):
            return True
        obj_base_id = getattr(obj, "base_id", None) or getattr(
            getattr(obj, "base", None), "id", None
        )
        return str(obj_base_id) == str(request.user.home_base_id)
