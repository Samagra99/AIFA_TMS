import uuid
from django.db import models
from apps.core.models import TimeStampedModel


class Airport(TimeStampedModel):
    """Generic airport record — covers all Indian aerodromes, not just FTO bases."""
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    icao_code     = models.CharField(max_length=4, unique=True, db_index=True)
    iata_code     = models.CharField(max_length=3, blank=True, null=True)
    name          = models.CharField(max_length=150)
    city          = models.CharField(max_length=100, blank=True, null=True)
    latitude      = models.DecimalField(max_digits=9, decimal_places=6)
    longitude     = models.DecimalField(max_digits=9, decimal_places=6)
    elevation_ft  = models.IntegerField(default=0)
    country       = models.CharField(max_length=2, default='IN')
    # Link back to FTO base if this airport is one of ours
    base          = models.ForeignKey(
        'infrastructure.Base', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='airport_record'
    )
    has_fuel      = models.BooleanField(default=True)
    has_customs   = models.BooleanField(default=False)
    is_verified   = models.BooleanField(
        default=True,
        help_text='False for airports pending CFI review'
    )
    is_active     = models.BooleanField(default=True)
    remarks       = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'airports'
        ordering = ['icao_code']

    def __str__(self):
        return f'{self.icao_code} — {self.name}'


class CrossCountryRoute(TimeStampedModel):
    """A reusable cross-country route template, selected at flight scheduling time."""
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name                = models.CharField(max_length=150, help_text='e.g. VAOP-VAUD-VAOP Triangular')
    departure_airport   = models.ForeignKey(
        Airport, on_delete=models.PROTECT, related_name='routes_departing'
    )
    destination_airport = models.ForeignKey(
        Airport, on_delete=models.PROTECT, related_name='routes_arriving'
    )
    is_triangular       = models.BooleanField(
        default=False,
        help_text='True if route returns to departure via a turn-point'
    )
    total_distance_nm   = models.DecimalField(
        max_digits=6, decimal_places=1, null=True, blank=True
    )
    is_active           = models.BooleanField(default=True)
    created_by          = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_routes'
    )

    class Meta:
        db_table = 'cross_country_routes'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.departure_airport.icao_code} → {self.destination_airport.icao_code})'


class RouteLeg(TimeStampedModel):
    """Ordered intermediate turn-points/waypoints for multi-leg routes."""
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route           = models.ForeignKey(
        CrossCountryRoute, on_delete=models.CASCADE, related_name='legs'
    )
    sequence        = models.SmallIntegerField(help_text='1-based ordering of this leg')
    airport         = models.ForeignKey(
        Airport, null=True, blank=True,
        on_delete=models.PROTECT, related_name='+'
    )
    waypoint_name   = models.CharField(
        max_length=100, blank=True, null=True,
        help_text='Non-airport turn point e.g. VOR, reporting point'
    )
    latitude        = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude       = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    leg_distance_nm = models.DecimalField(
        max_digits=6, decimal_places=1, null=True, blank=True
    )

    class Meta:
        db_table = 'route_legs'
        ordering = ['route', 'sequence']
        unique_together = [('route', 'sequence')]

    def __str__(self):
        label = self.airport.icao_code if self.airport else self.waypoint_name
        return f'{self.route.name} Leg {self.sequence}: {label}'


class RouteAlternate(TimeStampedModel):
    """Designated alternate airports for a route (takeoff / enroute / destination)."""
    class AlternateType(models.TextChoices):
        TAKEOFF     = 'takeoff',     'Takeoff Alternate'
        ENROUTE     = 'enroute',     'Enroute Alternate'
        DESTINATION = 'destination', 'Destination Alternate'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route          = models.ForeignKey(
        CrossCountryRoute, on_delete=models.CASCADE, related_name='alternates'
    )
    airport        = models.ForeignKey(
        Airport, on_delete=models.PROTECT, related_name='+'
    )
    alternate_type = models.CharField(
        max_length=20, choices=AlternateType.choices
    )

    class Meta:
        db_table = 'route_alternates'
        ordering = ['route', 'alternate_type']

    def __str__(self):
        return f'{self.route.name} [{self.alternate_type}] → {self.airport.icao_code}'


class RouteNearbyAirport(TimeStampedModel):
    """Precautionary diversion options along the route."""
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route   = models.ForeignKey(
        CrossCountryRoute, on_delete=models.CASCADE, related_name='nearby_airports'
    )
    airport = models.ForeignKey(
        Airport, on_delete=models.PROTECT, related_name='+'
    )
    notes   = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = 'route_nearby_airports'

    def __str__(self):
        return f'{self.route.name} nearby: {self.airport.icao_code}'
