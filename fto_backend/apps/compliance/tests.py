import datetime
from django.test import TestCase
from rest_framework.test import APIClient
from apps.users.models import User
from apps.compliance import report_generators as rg


class CustomDateReportsTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='safety@test.com',
            password='password123',
            role='safety_officer'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_report_generators_custom_date_range(self):
        start_date = datetime.date(2026, 7, 1)
        end_date = datetime.date(2026, 7, 15)

        # 1. SPL Report
        spl_res = rg.spl_monthly_report(start_date, end_date)
        self.assertEqual(spl_res['start_date'], '2026-07-01')
        self.assertEqual(spl_res['end_date'], '2026-07-15')

        # 2. Aircraft Utilisation Report
        ac_res = rg.aircraft_utilization_report(start_date, end_date)
        self.assertEqual(ac_res['num_days'], 15)
        self.assertEqual(ac_res['start_date'], '2026-07-01')

        # 3. Instructor Utilisation Report
        ins_res = rg.instructor_utilization_report(start_date, end_date)
        self.assertEqual(ins_res['num_days'], 15)
        self.assertEqual(ins_res['monthly_flying_limit'], 50.0)  # 100 * 15/30

        # 4. Trainee Hours Report
        trainee_res = rg.trainee_hours_report(start_date, end_date)
        self.assertEqual(trainee_res['start_date'], '2026-07-01')

    def test_report_api_endpoints_custom_date_range(self):
        response = self.client.get('/api/v1/compliance/reports/aircraft-utilization/?start_date=2026-07-01&end_date=2026-07-15')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['num_days'], 15)
        self.assertEqual(data['start_date'], '2026-07-01')
        self.assertEqual(data['end_date'], '2026-07-15')
