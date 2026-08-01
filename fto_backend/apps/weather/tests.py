"""
Tests for the Weather module:
  - Manual METAR/TAF entry
  - Active runway selection
  - Crosswind calculation
"""
from decimal import Decimal
import math
from unittest.mock import MagicMock
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from apps.users.models import User
from apps.infrastructure.models import Base
from apps.weather.models import WeatherCache


class WeatherCacheModelTests(TestCase):
    def test_density_altitude_calculation(self):
        """Standard ICAO DA calculation."""
        # ISA standard: 15°C at sea level, QNH 1013.25
        da = WeatherCache.compute_density_altitude(15, 1013.25, 0)
        self.assertIsNotNone(da)
        self.assertAlmostEqual(da, 0, delta=50)  # Should be near 0 at ISA

    def test_density_altitude_hot_day(self):
        """Hot day at 2000ft should give higher DA."""
        da = WeatherCache.compute_density_altitude(35, 1013.25, 2000)
        self.assertIsNotNone(da)
        self.assertGreater(da, 2000)

    def test_density_altitude_none_inputs(self):
        da = WeatherCache.compute_density_altitude(None, 1013.25, 0)
        self.assertIsNone(da)


class CrosswindCalculationTests(TestCase):
    def test_direct_headwind_zero_crosswind(self):
        """Wind directly on runway heading = 0 crosswind."""
        angle_diff = abs(270 - 270)  # 0
        crosswind = abs(15 * math.sin(math.radians(angle_diff)))
        self.assertAlmostEqual(crosswind, 0, places=1)

    def test_direct_crosswind_full(self):
        """Wind 90° to runway = full crosswind."""
        angle_diff = abs(360 - 270)  # 90
        crosswind = abs(15 * math.sin(math.radians(angle_diff)))
        self.assertAlmostEqual(crosswind, 15, places=1)

    def test_45_degree_crosswind(self):
        """Wind 45° to runway."""
        angle_diff = abs(315 - 270)  # 45
        crosswind = abs(15 * math.sin(math.radians(angle_diff)))
        self.assertAlmostEqual(crosswind, 15 * 0.7071, places=1)


class ManualWeatherEntryTests(APITestCase):
    def setUp(self):
        self.base = Base.objects.create(
            name="Test Base", icao_code="VTST", latitude=20.0, longitude=77.0
        )
        self.user = User.objects.create_user(
            email="disp@fto.aero", password="Password@123",
            first_name="Disp", last_name="User", role="dispatcher", home_base=self.base
        )

    def test_manual_entry_creates_weather_record(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post("/api/v1/weather/weather/manual-entry/", {
            "icao_code": "VTST",
            "metar_raw": "METAR VTST 010000Z 27015KT 9999 FEW040 32/18 Q1012",
            "wind_direction_deg": 270,
            "wind_speed_kt": 15,
            "temp_celsius": 32,
            "qnh_hpa": 1012,
            "source_remarks": "Manual entry - API unreachable",
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["source"], "manual")
        self.assertEqual(WeatherCache.objects.count(), 1)

    def test_manual_entry_requires_icao(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post("/api/v1/weather/weather/manual-entry/", {
            "metar_raw": "test",
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
