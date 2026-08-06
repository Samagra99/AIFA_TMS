"""
Tests for dispatch closeout endpoint including M4 fix.
"""
from datetime import date, timedelta
from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from apps.users.models import User, Instructor, Student
from apps.infrastructure.models import Base, Aircraft, AircraftType
from apps.scheduling.models import Flight, FlightStatus
from apps.dispatch.models import TechLog


class CloseoutTests(APITestCase):
    def setUp(self):
        self.base = Base.objects.create(
            name="Test Base", icao_code="VTST", latitude=20.0, longitude=77.0
        )
        self.instructor_user = User.objects.create_user(
            email="inst@fto.aero", password="Password@123",
            first_name="John", last_name="Doe", role="instructor", home_base=self.base
        )
        self.instructor_user.set_pin("1234")
        self.instructor = self.instructor_user.instructor_profile
        self.student_user = User.objects.create_user(
            email="student@fto.aero", password="Password@123",
            first_name="Jane", last_name="Smith", role="student", home_base=self.base
        )
        self.student = self.student_user.student_profile

        self.ac_type = AircraftType.objects.create(make_model="Cessna 172", icao_designator="C172")
        self.aircraft = Aircraft.objects.create(
            tail_number="VT-TST", aircraft_type=self.ac_type,
            home_base=self.base, current_base=self.base, status="airworthy",
            hobbs_total=Decimal("100.0"), tacho_total=Decimal("100.0"),
        )
        tomorrow = timezone.now() + timedelta(days=1)
        self.flight = Flight.objects.create(
            base=self.base, student=self.student, instructor=self.instructor,
            aircraft=self.aircraft, flight_type="dual",
            scheduled_start=tomorrow, scheduled_end=tomorrow + timedelta(hours=1),
            status=FlightStatus.AIRBORNE,
        )
        self.tech_log = TechLog.objects.create(
            flight=self.flight, aircraft=self.aircraft,
            hobbs_out=Decimal("100.0"), tacho_out=Decimal("100.0"),
        )

    def test_closeout_rejected_when_not_accepted(self):
        """M4 Fix: Closeout blocked if accepted_at is None."""
        self.client.force_authenticate(user=self.instructor_user)
        now = timezone.now()
        res = self.client.post(f"/api/v1/dispatch/tech-logs/{self.tech_log.id}/closeout/", {
            "hobbs_in": "101.0",
            "tacho_in": "101.0",
            "off_block_time": now.isoformat(),
            "on_block_time": (now + timedelta(hours=1)).isoformat(),
            "crew_pin": "1234",
            "nil_defects": True,
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("accepted", res.data["detail"].lower())

    def test_closeout_succeeds_when_accepted(self):
        """Normal closeout after acceptance."""
        self.tech_log.accepted_at = timezone.now()
        self.tech_log.accepted_by = self.instructor_user
        self.tech_log.save()

        self.tech_log.off_block_time = timezone.now() - timedelta(hours=1)
        self.tech_log.save()
        
        self.client.force_authenticate(user=self.instructor_user)
        now = timezone.now()
        res = self.client.post(f"/api/v1/dispatch/tech-logs/{self.tech_log.id}/closeout/", {
            "hobbs_in": "101.0",
            "tacho_in": "101.0",
            "off_block_time": self.tech_log.off_block_time.isoformat(),
            "on_block_time": now.isoformat(),
            "crew_pin": "1234",
            "nil_defects": True,
        })
        if res.status_code != status.HTTP_200_OK:
            print("Response:", res.data)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
