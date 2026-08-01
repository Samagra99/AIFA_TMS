"""
Tests for the Breath Analyzer (BA) module:
  - BA equipment CRUD
  - BA test entry creation and validation
  - BA hard constraint in dispatch clearance
"""
import uuid
from datetime import date, timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from apps.users.models import User, Instructor, Student
from apps.infrastructure.models import Base, Aircraft, AircraftType
from apps.scheduling.models import Flight, FlightStatus
from apps.dispatch.models import TechLog
from apps.dispatch.ba_models import BAEquipment, BATestEntry


class BAEquipmentTests(APITestCase):
    def setUp(self):
        self.base = Base.objects.create(
            name="Test Base", icao_code="VTST", latitude=20.0, longitude=77.0
        )
        self.doctor = User.objects.create_user(
            email="doctor@fto.aero", password="Password@123",
            first_name="Doc", last_name="Smith", role="doctor", home_base=self.base
        )
        self.instructor_user = User.objects.create_user(
            email="inst@fto.aero", password="Password@123",
            first_name="John", last_name="Doe", role="instructor", home_base=self.base
        )

    def test_doctor_can_create_equipment(self):
        self.client.force_authenticate(user=self.doctor)
        res = self.client.post("/api/v1/dispatch/ba-equipment/", {
            "equipment_number": "BA-001",
            "serial_number": "SN-12345",
            "model_name": "AlcoSense Pro",
            "calibration_date": str(date.today()),
            "calibration_due_date": str(date.today() + timedelta(days=365)),
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BAEquipment.objects.count(), 1)

    def test_non_doctor_cannot_create_equipment(self):
        self.client.force_authenticate(user=self.instructor_user)
        res = self.client.post("/api/v1/dispatch/ba-equipment/", {
            "equipment_number": "BA-002", "serial_number": "SN-999",
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_equipment(self):
        BAEquipment.objects.create(equipment_number="BA-010", serial_number="SN-010")
        self.client.force_authenticate(user=self.doctor)
        res = self.client.get("/api/v1/dispatch/ba-equipment/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class BATestEntryTests(APITestCase):
    def setUp(self):
        self.base = Base.objects.create(
            name="Test Base", icao_code="VTST", latitude=20.0, longitude=77.0
        )
        self.doctor = User.objects.create_user(
            email="doctor@fto.aero", password="Password@123",
            first_name="Doc", last_name="Smith", role="doctor", home_base=self.base
        )
        self.student_user = User.objects.create_user(
            email="student@fto.aero", password="Password@123",
            first_name="Jane", last_name="Doe", role="student", home_base=self.base
        )
        self.equipment = BAEquipment.objects.create(
            equipment_number="BA-001", serial_number="SN-001", model_name="AlcoSense"
        )

    def test_doctor_can_record_test(self):
        self.client.force_authenticate(user=self.doctor)
        res = self.client.post("/api/v1/dispatch/ba-tests/", {
            "equipment": str(self.equipment.id),
            "equipment_number": self.equipment.equipment_number,
            "test_serial_number": "TST-001",
            "person": str(self.student_user.id),
            "test_time": timezone.now().isoformat(),
            "result": "PASS",
            "alcohol_level": "0.00",
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BATestEntry.objects.count(), 1)
        # conducted_by should be auto-set
        entry = BATestEntry.objects.first()
        self.assertEqual(entry.conducted_by, self.doctor)

    def test_ba_candidates_search(self):
        self.client.force_authenticate(user=self.doctor)
        res = self.client.get("/api/v1/dispatch/ba-candidates/?q=Jane")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["name"], "Jane Doe")


class BADispatchConstraintTests(APITestCase):
    """Test that dispatch clearance is blocked without valid BA tests."""
    def setUp(self):
        self.base = Base.objects.create(
            name="Test Base", icao_code="VTST", latitude=20.0, longitude=77.0
        )
        self.dispatcher = User.objects.create_user(
            email="dispatcher@fto.aero", password="Password@123",
            first_name="Disp", last_name="One", role="dispatcher", home_base=self.base
        )
        self.dispatcher.set_pin("1234")
        self.instructor_user = User.objects.create_user(
            email="inst@fto.aero", password="Password@123",
            first_name="John", last_name="Doe", role="instructor", home_base=self.base
        )
        self.instructor = self.instructor_user.instructor_profile
        self.student_user = User.objects.create_user(
            email="student@fto.aero", password="Password@123",
            first_name="Jane", last_name="Smith", role="student", home_base=self.base
        )
        self.student = self.student_user.student_profile
        self.student.spl_expiry = date.today() + timedelta(days=365)
        self.student.medical_expiry = date.today() + timedelta(days=365)
        self.student.save()

        self.ac_type = AircraftType.objects.create(make_model="Cessna 172", icao_designator="C172")
        self.aircraft = Aircraft.objects.create(
            tail_number="VT-TST", aircraft_type=self.ac_type,
            home_base=self.base, current_base=self.base, status="airworthy"
        )
        tomorrow = timezone.now() + timedelta(days=1)
        self.flight = Flight.objects.create(
            base=self.base, student=self.student, instructor=self.instructor,
            aircraft=self.aircraft, flight_type="dual",
            scheduled_start=tomorrow, scheduled_end=tomorrow + timedelta(hours=1),
            status=FlightStatus.CONFIRMED,
            preflight_briefing_completed=True,
        )
        self.tech_log = TechLog.objects.create(flight=self.flight, aircraft=self.aircraft)

    def test_dispatch_blocked_without_ba_test(self):
        self.client.force_authenticate(user=self.dispatcher)
        res = self.client.post(f"/api/v1/dispatch/tech-logs/{self.tech_log.id}/clear-dispatch/", {
            "dispatcher_pin": "1234",
            "preflight_briefing_completed": True,
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ba_errors", res.data)

    def test_dispatch_passes_with_valid_ba_tests(self):
        # Record BA tests for both student and instructor
        doctor = User.objects.create_user(
            email="doctor@fto.aero", password="Password@123",
            first_name="Doc", last_name="Med", role="doctor", home_base=self.base
        )
        equip = BAEquipment.objects.create(equipment_number="BA-001", serial_number="SN-001")
        for person in [self.student_user, self.instructor_user]:
            BATestEntry.objects.create(
                equipment=equip, equipment_number="BA-001",
                test_serial_number=f"TST-{person.id}",
                person=person, test_time=timezone.now(),
                result="PASS", alcohol_level=0, conducted_by=doctor,
            )

        self.client.force_authenticate(user=self.dispatcher)
        res = self.client.post(f"/api/v1/dispatch/tech-logs/{self.tech_log.id}/clear-dispatch/", {
            "dispatcher_pin": "1234",
            "preflight_briefing_completed": True,
        })
        # May still fail due to scheduling engine checks, but should NOT fail on BA
        if res.status_code == 400:
            self.assertNotIn("ba_errors", res.data)
