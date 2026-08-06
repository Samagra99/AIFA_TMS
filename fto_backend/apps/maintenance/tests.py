import datetime
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from apps.users.models import User, Student, Instructor
from apps.infrastructure.models import Base, Aircraft, AircraftType
from apps.syllabus.models import SyllabusStage, SyllabusLesson, SyllabusExercise
from apps.scheduling.models import Flight, FlightExercise, FlightType, FlightStatus
from apps.maintenance.models import SortieGrade

class SortieGradePermissionsAndValidationTests(APITestCase):
    def setUp(self):
        self.base = Base.objects.create(name="Amravati Base", icao_code="VIAM", latitude=20.93, longitude=77.75)
        self.ac_type = AircraftType.objects.create(make_model="Cessna 172")
        self.aircraft = Aircraft.objects.create(tail_number="VT-AFA", aircraft_type=self.ac_type, home_base=self.base, current_base=self.base)

        # Users
        self.student_user = User.objects.create_user(
            email="student1@fto.aero", password="Password@123", first_name="Sam", last_name="Student", role="student"
        )
        self.student = self.student_user.student_profile

        self.inst1_user = User.objects.create_user(
            email="inst1@fto.aero", password="Password@123", first_name="Instructor", last_name="One", role="instructor"
        )
        self.inst1 = self.inst1_user.instructor_profile

        self.inst2_user = User.objects.create_user(
            email="inst2@fto.aero", password="Password@123", first_name="Instructor", last_name="Two", role="instructor"
        )
        self.inst2 = self.inst2_user.instructor_profile

        from apps.syllabus.models import LicenceType
        self.licence, _ = LicenceType.objects.get_or_create(code="CPL", defaults={"name": "Commercial Pilot Licence"})
        
        # Syllabus Exercise
        self.stage = SyllabusStage.objects.create(licence_type=self.licence, stage_number=1, title="Stage 1", sequence_order=1)
        self.lesson = SyllabusLesson.objects.create(stage=self.stage, lesson_number=1, title="Lesson 1", sequence_order=1)
        self.exercise1 = SyllabusExercise.objects.create(
            lesson=self.lesson, exercise_code="EX-01", title="Pre-Flight Inspection", default_flight_type="dual", sequence_order=1
        )
        self.exercise2 = SyllabusExercise.objects.create(
            lesson=self.lesson, exercise_code="EX-02", title="Taxiing", default_flight_type="dual", sequence_order=2
        )

        now = timezone.now()
        # Dual Flight with Instructor 1
        self.dual_flight = Flight.objects.create(
            base=self.base,
            student=self.student,
            instructor=self.inst1,
            aircraft=self.aircraft,
            flight_type=FlightType.DUAL,
            scheduled_start=now - datetime.timedelta(hours=2),
            scheduled_end=now - datetime.timedelta(hours=1),
            status=FlightStatus.COMPLETED,
        )
        FlightExercise.objects.create(flight=self.dual_flight, exercise=self.exercise1)

        # Solo Flight
        self.solo_flight = Flight.objects.create(
            base=self.base,
            student=self.student,
            instructor=None,
            aircraft=self.aircraft,
            flight_type=FlightType.SOLO,
            scheduled_start=now - datetime.timedelta(hours=4),
            scheduled_end=now - datetime.timedelta(hours=3),
            status=FlightStatus.COMPLETED,
        )
        FlightExercise.objects.create(flight=self.solo_flight, exercise=self.exercise1)

    def test_dual_flight_grading_by_conducted_instructor(self):
        """Test Instructor 1 (who conducted the dual sortie) can grade it successfully."""
        self.client.force_authenticate(user=self.inst1_user)
        payload = {
            "flight": str(self.dual_flight.id),
            "exercise": str(self.exercise1.id),
            "student": str(self.student.id),
            "grade": 4,
            "instructor_notes": "Good handling.",
        }
        res = self.client.post("/api/v1/maintenance/grades/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_dual_flight_grading_by_different_instructor_blocked(self):
        """Test Instructor 2 (who did NOT conduct the dual sortie) is blocked from grading it."""
        self.client.force_authenticate(user=self.inst2_user)
        payload = {
            "flight": str(self.dual_flight.id),
            "exercise": str(self.exercise1.id),
            "student": str(self.student.id),
            "grade": 4,
            "instructor_notes": "Attempted grading.",
        }
        res = self.client.post("/api/v1/maintenance/grades/", payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Permission Denied", str(res.data))

    def test_solo_flight_grading_by_any_instructor(self):
        """Test any instructor can grade a solo flight."""
        self.client.force_authenticate(user=self.inst2_user)
        payload = {
            "flight": str(self.solo_flight.id),
            "exercise": str(self.exercise1.id),
            "student": str(self.student.id),
            "grade": 5,
            "instructor_notes": "Excellent solo flight.",
        }
        res = self.client.post("/api/v1/maintenance/grades/", payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_exercise_unattached_to_flight_blocked(self):
        """Test grading an exercise that was not included in the flight is blocked."""
        self.client.force_authenticate(user=self.inst1_user)
        payload = {
            "flight": str(self.dual_flight.id),
            "exercise": str(self.exercise2.id), # EX-02 not in dual_flight
            "student": str(self.student.id),
            "grade": 4,
        }
        res = self.client.post("/api/v1/maintenance/grades/", payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("was not included in Flight", str(res.data))
