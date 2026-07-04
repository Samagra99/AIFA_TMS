"""
compliance/audit_urls.py
-------------------------
Include this from your main compliance/urls.py:

    from django.urls import include, path
    urlpatterns = [
        # … existing compliance urls …
        path('', include('compliance.audit_urls')),
    ]

Or from the project-level urls.py:
    path('api/compliance/', include('compliance.audit_urls')),
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .audit_views import (
    AuditHistoryView,
    ComplianceAlertViewSet,
    LiveAuditScoreView,
    MonthlyReportView,
)

router = DefaultRouter()
router.register(r'alerts', ComplianceAlertViewSet, basename='compliance-alert')

urlpatterns = [
    # ── Audit score ──────────────────────────────────────────────────────────
    path('audit/live/',      LiveAuditScoreView.as_view(),  name='audit-live-score'),
    path('audit/history/',   AuditHistoryView.as_view(),    name='audit-history'),
    path('audit/snapshot/',  AuditHistoryView.as_view(),    name='audit-snapshot'),

    # ── Compliance alerts (router) ───────────────────────────────────────────
    path('', include(router.urls)),

    # ── Monthly reports ──────────────────────────────────────────────────────
    path(
        'reports/<str:report_type>/',
        MonthlyReportView.as_view(),
        name='monthly-report'
    ),
]
