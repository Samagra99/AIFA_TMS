from django.urls import path
from rest_framework.routers import DefaultRouter
from .audit_views import (
    LiveAuditScoreView, AuditRecordViewSet, ComplianceAlertViewSet,
    spl_monthly_view, aircraft_utilization_view,
    instructor_utilization_view, trainee_hours_view,
)

router = DefaultRouter()
router.register('audit/records', AuditRecordViewSet, basename='audit-record')
router.register('alerts', ComplianceAlertViewSet, basename='compliance-alert')

urlpatterns = router.urls + [
    path('audit/live/', LiveAuditScoreView.as_view(), name='audit-live'),
    path('reports/spl-monthly/', spl_monthly_view, name='report-spl-monthly'),
    path('reports/aircraft-utilization/', aircraft_utilization_view, name='report-aircraft-util'),
    path('reports/instructor-utilization/', instructor_utilization_view, name='report-instructor-util'),
    path('reports/trainee-hours/', trainee_hours_view, name='report-trainee-hours'),
]