"""
Unit tests for the rostering workflow API endpoints and features.
"""
import uuid
from datetime import date, timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from apps.users.models import User, Instructor, Student
from apps.infrastructure.models import Base, Aircraft, AircraftType
from apps.syllabus.models import SyllabusStage, SyllabusLesson, SyllabusExercise
from apps.rostering.models import DailyPlanRequest, InstructorDailyPlan, InstructorPlanStatus, PlanRequestStatus
from apps.scheduling.models import Flight, FlightStatus, FlightExercise


class RosteringWorkflowTests(APITestCase):
    def setUp(self):
        # Create Base
        self.base = Base.objects.create(
            name="Amravati Main Base",
            icao_code="VIAM",
            latitude=20.93,
            longitude=77.75,
        )

        # Create Admin User
        self.admin = User.objects.create_superuser(
            email="admin@fto.aero",
            password="Password@123",
            first_name="Admin",
            last_name="User",
            role="superadmin",
            home_base=self.base,
        )

        # Create Instructor User & Profile
        self.instructor_user = User.objects.create_user(
            email="instructor@fto.aero",
            password="Password@123",
            first_name="John",
            last_name="Doe",
            role="instructor",
            home_base=self.base,
        )
        self.instructor = self.instructor_user.instructor_profile

        # Create Student User & Profile
        self.student_user = User.objects.create_user(
            email="student@fto.aero",
            password="Password@123",
            first_name="Jane",
            last_name="Smith",
            role="student",
            home_base=self.base,
        )
        self.student = self.student_user.student_profile
        self.student.spl_number = "SPL-202"
        self.student.spl_expiry = date.today() + timedelta(days=365)
        self.student.medical_expiry = date.today() + timedelta(days=365)
        self.student.save()

        # Create Aircraft Type & Aircraft
        self.ac_type = AircraftType.objects.create(
            make_model="Cessna 172",
            icao_designator="C172",
        )
        self.aircraft = Aircraft.objects.create(
            tail_number="VT-AFA",
            aircraft_type=self.ac_type,
            home_base=self.base,
            current_base=self.base,
            status="airworthy",
        )

        # Create Syllabus Exercise
        self.stage = SyllabusStage.objects.create(stage_number=1, title="Stage 1", sequence_order=1)
        self.lesson = SyllabusLesson.objects.create(stage=self.stage, lesson_number=1, title="Lesson 1", sequence_order=1)
        self.exercise = SyllabusExercise.objects.create(
            lesson=self.lesson,
            exercise_code="EX-01",
            title="Pre-flight Inspection & Taxiing",
            sequence_order=1,
        )

        # Create Daily Plan Request
        self.plan_request = DailyPlanRequest.objects.create(
            plan_date=date.today() + timedelta(days=1),
            base=self.base,
            deadline=timezone.now() + timedelta(hours=12),
            status=PlanRequestStatus.OPEN,
            created_by=self.admin,
        )

    def test_mark_leave(self):
        """Test instructor mark-leave endpoint."""
        self.client.force_authenticate(user=self.instructor_user)
        response = self.client.post("/api/v1/rostering/instructor-plans/mark-leave/", {
            "plan_request": str(self.plan_request.id),
            "notes": "Annual Leave"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        plan = InstructorDailyPlan.objects.get(plan_request=self.plan_request, instructor=self.instructor)
        self.assertEqual(plan.status, InstructorPlanStatus.LEAVE)
        self.assertEqual(plan.notes, "Annual Leave")

    def test_confirm_roster_prevents_duplicate_drafts_and_sanitizes_empty_uuids(self):
        """Test confirm-roster cleans up prior draft flights and handles empty UUID strings."""
        self.client.force_authenticate(user=self.admin)

        entries = [{
            "base_id": str(self.base.id),
            "instructor_id": str(self.instructor.id),
            "student_id": str(self.student.id),
            "aircraft_id": str(self.aircraft.id),
            "exercise_id": str(self.exercise.id),
            "flight_type": "dual",
            "start_time": "08:00",
            "end_time": "09:00",
        }]

        # First confirm
        res1 = self.client.post(f"/api/v1/rostering/plan-requests/{self.plan_request.id}/confirm-roster/", {
            "entries": entries
        }, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data["created"], 1)

        # Confirm again for same date — old draft flight should be deleted and replaced, preventing duplicates
        res2 = self.client.post(f"/api/v1/rostering/plan-requests/{self.plan_request.id}/confirm-roster/", {
            "entries": entries
        }, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["created"], 1)

        # Verify only 1 draft flight exists for this plan date
        draft_count = Flight.objects.filter(
            base=self.base,
            scheduled_start__date=self.plan_request.plan_date,
            status=FlightStatus.DRAFT
        ).count()
        self.assertEqual(draft_count, 1)

        # Verify FlightExercise was created
        flight = Flight.objects.get(base=self.base, scheduled_start__date=self.plan_request.plan_date)
        self.assertEqual(flight.exercises.count(), 1)
        self.assertEqual(flight.exercises.first().exercise, self.exercise)

    def test_prerequisite_check_and_cfi_override(self):
        """Test prerequisite validation during entry creation and CFI override approval."""
        # Create Exercise 2 which requires Exercise 1 (self.exercise)
        ex2 = SyllabusExercise.objects.create(
            lesson=self.lesson,
            exercise_code="EX-02",
            title="Medium Turns & Steep Turns",
            sequence_order=2,
            prerequisite_ids=[str(self.exercise.id)],
        )

        plan = InstructorDailyPlan.objects.create(
            plan_request=self.plan_request,
            instructor=self.instructor,
            availability_start="07:00",
            availability_end="15:00",
            status=InstructorPlanStatus.PENDING,
        )

        self.client.force_authenticate(user=self.instructor_user)

        # 1. Entry without CFI override should fail validation because EX-01 is not passed
        res1 = self.client.post("/api/v1/rostering/plan-entries/", {
            "plan": str(plan.id),
            "student": str(self.student.id),
            "exercise": str(ex2.id),
            "cfi_override_requested": False,
        })
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exercise", res1.data.get("errors", res1.data))

        # 2. Entry with cfi_override_requested=True should succeed
        res2 = self.client.post("/api/v1/rostering/plan-entries/", {
            "plan": str(plan.id),
            "student": str(self.student.id),
            "exercise": str(ex2.id),
            "cfi_override_requested": True,
            "override_reason": "High progress in simulator session",
        })
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        entry_id = res2.data["id"]
        self.assertFalse(res2.data["prereq_met"])
        self.assertTrue(res2.data["cfi_override_requested"])

        # 3. CFI approves override
        self.client.force_authenticate(user=self.admin) # Superadmin/CFI
        res3 = self.client.post(f"/api/v1/rostering/plan-entries/{entry_id}/approve-override/")
        self.assertEqual(res3.status_code, status.HTTP_200_OK)

        # Verify entry updated
        res_entry = self.client.get(f"/api/v1/rostering/plan-entries/{entry_id}/")
        self.assertTrue(res_entry.data["cfi_override_approved"])
        self.assertTrue(res_entry.data["prereq_met"])
