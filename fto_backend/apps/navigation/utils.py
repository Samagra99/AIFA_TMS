"""
Navigation utility helpers.
"""
from typing import Optional


def resolve_landing_airport(flight) -> Optional[object]:
    """Best-effort landing airport for a persisted flight, given its route (if any)."""
    route = getattr(flight, "cross_country_route", None)
    if route is None:
        return None
    if route.is_triangular:
        return route.departure_airport
    return route.destination_airport


def resolve_landing_airport_for_scheduling(route_obj_or_id=None, is_triangular=False) -> Optional[object]:
    """
    Resolve landing airport during flight scheduling/validation when flight instance may not be saved yet.
    """
    if not route_obj_or_id:
        return None

    from apps.navigation.models import CrossCountryRoute
    route = route_obj_or_id
    if isinstance(route, str):
        try:
            route = CrossCountryRoute.objects.select_related('departure_airport', 'destination_airport').get(id=route_obj_or_id)
        except Exception:
            return None
    elif not hasattr(route, 'is_triangular'):
        # Might be a UUID
        try:
            route = CrossCountryRoute.objects.select_related('departure_airport', 'destination_airport').get(id=str(route))
        except Exception:
            return None

    if getattr(route, 'is_triangular', False):
        return getattr(route, 'departure_airport', None)
    return getattr(route, 'destination_airport', None)
