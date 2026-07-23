from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/",        admin.site.urls),
    path("api/schema/",   SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/",     SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),

    # App APIs
    path("api/v1/auth/",          include("apps.users.urls")),
    path("api/v1/infrastructure/", include("apps.infrastructure.urls")),
    path("api/v1/users/",         include("apps.users.urls_users")),
    path("api/v1/syllabus/",      include("apps.syllabus.urls")),
    path("api/v1/scheduling/",    include("apps.scheduling.urls")),
    path("api/v1/dispatch/",      include("apps.dispatch.urls")),
    path("api/v1/maintenance/",   include("apps.maintenance.urls")),
    path("api/v1/inventory/",     include("apps.inventory.urls")),
    path("api/v1/compliance/",    include("apps.compliance.urls")),
    path("api/v1/finance/",       include("apps.finance.urls")),
    path("api/v1/weather/",       include("apps.weather.urls")),
    path("api/v1/rostering/",     include("apps.rostering.urls")),
    path("api/v1/dashboard/",     include("apps.dashboard.urls")),
]

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
