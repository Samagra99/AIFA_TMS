import datetime
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from apps.users.models import User, Student
from apps.infrastructure.models import Base, Aircraft, AircraftType
from apps.scheduling.models import Flight, FlightStatus, FlightType
from apps.core.models import Notification, NotificationCategory, NotificationSeverity
from apps.core.scheduling_engine import SchedulingRuleEngine

class NotificationAndRestRuleTests(APITestCase):
    def setUp(self):
        self.base = Base.objects.create(name="Amravati Base", icao_code="VIAM", latitude=20.93, longitude=77.75)
        self.ac_type = AircraftType.objects.create(make_model="Cessna 172")
        self.aircraft = Aircraft.objects.create(tail_number="VT-AFA", aircraft_type=self.ac_type, home_base=self.base, current_base=self.base)

        self.student_user = User.objects.create_user(
            email="student_test@fto.aero", password="Password@123", first_name="Rest", last_name="Student", role="student"
        )
        self.student = self.student_user.student_profile
        self.student.spl_expiry = timezone.now().date() + datetime.timedelta(days=180)
        self.student.medical_expiry = timezone.now().date() + datetime.timedelta(days=180)
        self.student.save()

    def test_notification_creation_and_api(self):
        """Test creating a notification and reading it via API."""
        notif = Notification.objects.create(
            user=self.student_user,
            title="Test Alert",
            message="This is a test alert message.",
            category=NotificationCategory.REST_RULES,
            severity=NotificationSeverity.WARNING
        )

        self.client.force_authenticate(user=self.student_user)

        # Unread count
        res = self.client.get("/api/v1/notifications/unread-count/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["unread_count"], 1)

        # Mark as read
        res = self.client.post(f"/api/v1/notifications/{notif.id}/read/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        notif.refresh_from_db()
        self.assertTrue(notif.is_read)

    def test_student_7_day_continuous_flight_hard_block(self):
        """Test student flying 6 consecutive days is HARD BLOCKED on day 7."""
        today = timezone.now().date()
        engine = SchedulingRuleEngine()

        # Create flights on 6 consecutive preceding days (day -6 through day -1)
        for i in range(1, 7):
            flight_date = today - datetime.timedelta(days=i)
            start_dt = timezone.make_aware(datetime.datetime.combine(flight_date, datetime.time(9, 0)))
            end_dt = timezone.make_aware(datetime.datetime.combine(flight_date, datetime.time(10, 0)))
            Flight.objects.create(
                base=self.base,
                student=self.student,
                aircraft=self.aircraft,
                flight_type=FlightType.SOLO,
                scheduled_start=start_dt,
                scheduled_end=end_dt,
                status=FlightStatus.COMPLETED
            )

        # Test checking target flight for today (Day 7)
        res = engine.check(
            student=self.student,
            aircraft=self.aircraft,
            scheduled_start=timezone.now(),
            scheduled_end=timezone.now() + datetime.timedelta(hours=1),
            cfi_override=True # Even with CFI override, it MUST be hard blocked!
        )

        self.assertFalse(res.all_passed)
        blocking_names = [c.name for c in res.blocking_failures]
        self.assertIn("student_7_day_continuous_flight_block", blocking_names)

        block_check = next(c for c in res.blocking_failures if c.name == "student_7_day_continuous_flight_block")
        self.assertTrue(block_check.is_hard_block)
        self.assertIn("Mandatory Rest Violation", block_check.detail)
