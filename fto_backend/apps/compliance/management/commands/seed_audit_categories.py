"""
compliance/management/commands/seed_audit_categories.py
--------------------------------------------------------
One-time seed that creates all DGCA 100-point FTO ranking
categories and parameters in the database.

Usage:
    python manage.py seed_audit_categories
    python manage.py seed_audit_categories --reset   # drops and re-creates
"""

from django.core.management.base import BaseCommand
from ...models import AuditCategory, AuditParameter

# ─────────────────────────────────────────────────────────────────────────────
# DGCA 100-point FTO Ranking – Master Data
# ─────────────────────────────────────────────────────────────────────────────
#
# Structure: list of (category_dict, [parameter_dicts])
#
# category_dict keys:  code, name, max_points, description, icon, sort_order
# parameter_dict keys: code, name, max_points, description,
#                      auto_scored, scoring_logic_key, sort_order
#
AUDIT_SCHEMA = [
    (
        dict(
            code='C1', name='Organisation & Management',
            max_points=15, sort_order=1, icon='Building2',
            description=(
                'Adequacy of post holders, manuals, communication systems, '
                'and digital record-keeping.'
            )
        ),
        [
            dict(code='C1.1', name='Post holders (CFI / Dy CFI / Chief GI / CAMO Head)',
                 max_points=5, sort_order=1,
                 description='All four mandatory post-holder slots filled with DGCA-approved personnel.',
                 auto_scored=True, scoring_logic_key='c1_post_holders'),
            dict(code='C1.2', name='Operations / Training / Maintenance manuals current',
                 max_points=5, sort_order=2,
                 description='OM, TM and MM are DGCA-approved, distributed and within revision date.',
                 auto_scored=False, scoring_logic_key=''),
            dict(code='C1.3', name='Communication & ATC liaison system',
                 max_points=2, sort_order=3,
                 description='VHF ground station, intercom and ATC coordination procedures in place.',
                 auto_scored=False, scoring_logic_key=''),
            dict(code='C1.4', name='Digital record-keeping system active',
                 max_points=3, sort_order=4,
                 description='All student, aircraft and instructor records maintained digitally.',
                 auto_scored=True, scoring_logic_key='c1_record_keeping'),
        ]
    ),
    (
        dict(
            code='C2', name='Training Programme',
            max_points=20, sort_order=2, icon='GraduationCap',
            description=(
                'DGCA-approved syllabus adherence, stage checks, ground school '
                'coverage and theory examination pass rates.'
            )
        ),
        [
            dict(code='C2.1', name='DGCA-approved syllabus adherence',
                 max_points=8, sort_order=1,
                 description='Students progressing on-track per approved CPL/PPL syllabus schedule.',
                 auto_scored=True, scoring_logic_key='c2_syllabus_adherence'),
            dict(code='C2.2', name='Stage check / progress test completion rate',
                 max_points=6, sort_order=2,
                 description='Mandatory stage checks conducted at prescribed syllabus points.',
                 auto_scored=True, scoring_logic_key='c2_stage_checks'),
            dict(code='C2.3', name='Ground school timetable compliance',
                 max_points=3, sort_order=3,
                 description='DGCA ground school subjects covered per approved timetable.',
                 auto_scored=False, scoring_logic_key=''),
            dict(code='C2.4', name='Air Law / Tech theory exam pass rate',
                 max_points=3, sort_order=4,
                 description='Internal theory examination pass rate ≥ 70 %.',
                 auto_scored=True, scoring_logic_key='c2_theory_pass_rate'),
        ]
    ),
    (
        dict(
            code='C3', name='Fleet & Airworthiness',
            max_points=20, sort_order=3, icon='Plane',
            description=(
                'Aircraft serviceability, maintenance programme compliance, '
                'CRS currency and tech log accuracy.'
            )
        ),
        [
            dict(code='C3.1', name='Aircraft availability (serviceability %)',
                 max_points=8, sort_order=1,
                 description='Percentage of fleet serviceable (non-AOG) at time of audit.',
                 auto_scored=True, scoring_logic_key='c3_aircraft_availability'),
            dict(code='C3.2', name='Scheduled maintenance programme compliance',
                 max_points=5, sort_order=2,
                 description='All due maintenance tasks completed on or before due date.',
                 auto_scored=True, scoring_logic_key='c3_maintenance_compliance'),
            dict(code='C3.3', name='CRS validity – no aircraft without valid CRS',
                 max_points=4, sort_order=3,
                 description='CAMO has issued valid CRS for all airworthy aircraft.',
                 auto_scored=True, scoring_logic_key='c3_crs_currency'),
            dict(code='C3.4', name='Tech log accuracy & completeness',
                 max_points=3, sort_order=4,
                 description='All flights logged in tech log with correct entries.',
                 auto_scored=True, scoring_logic_key='c3_tech_logs'),
        ]
    ),
    (
        dict(
            code='C4', name='Personnel Currency',
            max_points=15, sort_order=4, icon='IdCard',
            description=(
                'Validity of instructor medicals, ratings, '
                'student medicals and SPLs.'
            )
        ),
        [
            dict(code='C4.1', name='Instructor Class 1 medical validity',
                 max_points=4, sort_order=1,
                 description='All active instructors hold valid DGCA Class 1 medical certificates.',
                 auto_scored=True, scoring_logic_key='c4_instructor_medical'),
            dict(code='C4.2', name='FIR / Instructor rating currency',
                 max_points=4, sort_order=2,
                 description='All active instructors hold current FIR / DGCA instructor authorisation.',
                 auto_scored=True, scoring_logic_key='c4_instructor_rating'),
            dict(code='C4.3', name='Student Class 2 medical validity',
                 max_points=4, sort_order=3,
                 description='All active trainees hold valid DGCA Class 2 medical certificates.',
                 auto_scored=True, scoring_logic_key='c4_student_medical'),
            dict(code='C4.4', name='Student SPL & theory exam validity',
                 max_points=3, sort_order=4,
                 description='All student pilot licences current; no expired theory credits.',
                 auto_scored=True, scoring_logic_key='c4_spl_validity'),
        ]
    ),
    (
        dict(
            code='C5', name='Safety Management',
            max_points=15, sort_order=5, icon='ShieldCheck',
            description=(
                'SMS implementation, hazard log currency, safety risk '
                'assessments and DGCA incident/MOR reporting.'
            )
        ),
        [
            dict(code='C5.1', name='SMS – active voluntary safety reporting',
                 max_points=5, sort_order=1,
                 description='Safety Management System implemented; voluntary reports being filed.',
                 auto_scored=True, scoring_logic_key='c5_sms_implementation'),
            dict(code='C5.2', name='Hazard log maintenance & review currency',
                 max_points=3, sort_order=2,
                 description='Hazard register is current; all hazards reviewed within schedule.',
                 auto_scored=True, scoring_logic_key='c5_hazard_log'),
            dict(code='C5.3', name='Safety risk assessments on file',
                 max_points=4, sort_order=3,
                 description='Formal safety risk assessments for all identified hazards.',
                 auto_scored=False, scoring_logic_key=''),
            dict(code='C5.4', name='MOR / incident reporting to DGCA',
                 max_points=3, sort_order=4,
                 description='All accidents and serious incidents reported to DGCA as required by CAR.',
                 auto_scored=True, scoring_logic_key='c5_incident_reporting'),
        ]
    ),
    (
        dict(
            code='C6', name='Records & Documentation',
            max_points=10, sort_order=6, icon='FileText',
            description=(
                'Completeness of student training records, '
                'aircraft tech logs and instructor FDTL records.'
            )
        ),
        [
            dict(code='C6.1', name='Student training records completeness',
                 max_points=4, sort_order=1,
                 description='All student records (logbooks, stage checks, theory) up to date.',
                 auto_scored=True, scoring_logic_key='c6_student_records'),
            dict(code='C6.2', name='Aircraft technical log accuracy',
                 max_points=3, sort_order=2,
                 description='No open entries; all flights logged correctly.',
                 auto_scored=True, scoring_logic_key='c6_aircraft_logs'),
            dict(code='C6.3', name='Instructor FDTL duty time records',
                 max_points=3, sort_order=3,
                 description='FDTL records maintained for all instructors; no gaps.',
                 auto_scored=True, scoring_logic_key='c6_fdtl_records'),
        ]
    ),
    (
        dict(
            code='C7', name='Infrastructure',
            max_points=5, sort_order=7, icon='LayoutDashboard',
            description=(
                'Adequacy of briefing rooms, library, learning resources '
                'and crew rest facilities.'
            )
        ),
        [
            dict(code='C7.1', name='Briefing rooms & classrooms',
                 max_points=2, sort_order=1,
                 description='Dedicated, equipped briefing and classroom facilities on site.',
                 auto_scored=False, scoring_logic_key=''),
            dict(code='C7.2', name='Library & learning resources',
                 max_points=2, sort_order=2,
                 description='Current AIPs, CAARs, tech manuals and e-learning resources available.',
                 auto_scored=False, scoring_logic_key=''),
            dict(code='C7.3', name='Crew rest facilities',
                 max_points=1, sort_order=3,
                 description='Adequate rest room and amenities for crew/students.',
                 auto_scored=False, scoring_logic_key=''),
        ]
    ),
]


class Command(BaseCommand):
    help = 'Seed DGCA 100-point FTO ranking categories and parameters'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset', action='store_true',
            help='Delete all existing audit categories/parameters before seeding'
        )

    def handle(self, *args, **options):
        if options['reset']:
            AuditParameter.objects.all().delete()
            AuditCategory.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared all audit categories and parameters.'))

        for cat_data, param_list in AUDIT_SCHEMA:
            cat, created = AuditCategory.objects.update_or_create(
                code=cat_data['code'],
                defaults={k: v for k, v in cat_data.items() if k != 'code'}
            )
            verb = 'Created' if created else 'Updated'
            self.stdout.write(f"  {verb} category: {cat.code} – {cat.name}")

            for pd in param_list:
                p, p_created = AuditParameter.objects.update_or_create(
                    code=pd['code'],
                    defaults={**{k: v for k, v in pd.items() if k != 'code'}, 'category': cat}
                )
                p_verb = '  ✓' if p_created else '  ↺'
                self.stdout.write(
                    f"    {p_verb} {p.code}: {p.name} "
                    f"({'auto' if p.auto_scored else 'manual'}, {p.max_points} pts)"
                )

        total_pts = sum(c['max_points'] for c, _ in AUDIT_SCHEMA)
        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {AuditCategory.objects.count()} categories, '
            f'{AuditParameter.objects.count()} parameters, '
            f'{total_pts}/100 points configured.'
        ))
