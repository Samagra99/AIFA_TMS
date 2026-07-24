import os
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from apps.users.models import User, Student, Instructor
from apps.infrastructure.models import Base

class UserSecurityAndImportTests(APITestCase):
    def setUp(self):
        self.base = Base.objects.create(name="Amravati Base", icao_code="VIAM", latitude=20.93, longitude=77.75)
        self.admin = User.objects.create_superuser(
            email="admin@fto.aero", password="Password@123", first_name="Admin", last_name="User", role="superadmin"
        )
        self.student_user = User.objects.create_user(
            email="student@fto.aero", password="Password@123", first_name="Student", last_name="Pilot", role="student"
        )
        self.student = self.student_user.student_profile
        self.instructor_user = User.objects.create_user(
            email="instructor@fto.aero", password="Password@123", first_name="Instructor", last_name="Pilot", role="instructor"
        )
        self.instructor = self.instructor_user.instructor_profile

    def test_self_pin_setting(self):
        """Test authenticated user setting their own operational PIN."""
        self.client.force_authenticate(user=self.instructor_user)
        res = self.client.post("/api/v1/auth/me/pin/", {"pin": "1234"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        self.instructor_user.refresh_from_db()
        self.assertTrue(self.instructor_user.dispatch_pin is not None)

    def test_admin_cannot_set_other_user_pin(self):
        """Test SuperAdmin attempting to set another user's PIN is blocked."""
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f"/api/v1/users/list/{self.instructor_user.id}/set-pin/", {"pin": "5678"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_import_egca_logbook_sample_file(self):
        """Test importing the sample eGCA Excel file placed in e:\\AIFA."""
        sample_path = r"e:\AIFA\SAMAGRA AGRAWAL(IPLTM2020000569) 23_07_26 Excel.xls"
        if not os.path.exists(sample_path):
            self.skipTest("Sample excel file not found in e:\\AIFA")

        self.client.force_authenticate(user=self.admin)
        with open(sample_path, "rb") as f:
            res = self.client.post(f"/api/v1/users/students/{self.student.id}/import-egca-logbook/", {"file": f}, format="multipart")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["imported_count"], 1071)
        self.student.refresh_from_db()
        self.assertGreater(self.student.previous_hours_total, 0)
