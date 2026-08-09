from rest_framework.routers import DefaultRouter
from .views import (
    AirportViewSet, CrossCountryRouteViewSet,
    RouteLegViewSet, RouteAlternateViewSet, RouteNearbyAirportViewSet,
)

router = DefaultRouter()
router.register('airports',   AirportViewSet,           basename='airport')
router.register('routes',     CrossCountryRouteViewSet, basename='cross-country-route')
router.register('route-legs', RouteLegViewSet,          basename='route-leg')
router.register('alternates', RouteAlternateViewSet,    basename='route-alternate')
router.register('nearby',     RouteNearbyAirportViewSet, basename='route-nearby')

urlpatterns = router.urls
