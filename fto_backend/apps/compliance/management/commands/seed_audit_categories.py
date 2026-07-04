"""
Management command: python manage.py seed_audit_categories

Seeds the 7 DGCA FTO ranking categories (100 pts total) and their
22 parameters. scoring_logic_key values here match method names
(score_<key>) implemented in audit_scoring.py exactly — if you add a
new score_xxx() method, add a matching AuditParameter row here too.
"""
from django.core.management.base import BaseCommand
from apps.compliance.audit_models import AuditCategory, AuditParameter


CATEGORIES = [
    dict(code='C1', name='Organisation & Management', max_points=15,
         sort_order=1, icon='Building2',
         description='Post holders, org structure, digital record-keeping.'),
    dict(code='C2', name='Training Programme', max_points=20,
         sort_order=2, icon='GraduationCap',
         description='Syllabus adherence, stage checks, theory exam pass rate.'),
    dict(code='C3', name='Fleet & Airworthiness', max_points=20,
         sort_order=3, icon='Plane',
         description='Aircraft serviceability, maintenance compliance, CRS currency, tech logs.'),
    dict(code='C4', name='Personnel Currency', max_points=15,
         sort_order=4, icon='ShieldCheck',
         description='Instructor and student medical, licence, and rating currency.'),
    dict(code='C5', name='Safety Management', max_points=15,
         sort_order=5, icon='AlertTriangle',
         description='SMS reporting activity, hazard register, DGCA incident reporting.'),
    dict(code='C6', name='Records & Documentation', max_points=10,
         sort_order=6, icon='FileText',
         description='Student records, aircraft logs, FDTL duty records.'),
    dict(code='C7', name='Infrastructure', max_points=5,
         sort_order=7, icon='Home',
         description='Briefing rooms, ground school facilities, simulator availability (manual assessment).'),
]

PARAMETERS = [
    # C1 — 15 pts (5 + 3 auto = 8; remaining 7 manual, examiner-scored)
    dict(category='C1', code='C1.1', name='Post holders filled', max_points=5,
         sort_order=1, auto_scored=True, scoring_logic_key='c1_post_holders',
         description='CFI, Instructor, CAMO, Dispatcher roles all staffed with active accounts.'),
    dict(category='C1', code='C1.2', name='Organisation manual current', max_points=4,
         sort_order=2, auto_scored=False, scoring_logic_key='',
         description='Operations manual reviewed and DGCA-approved within validity period.'),
    dict(category='C1', code='C1.3', name='Chief Instructor authority defined', max_points=3,
         sort_order=3, auto_scored=False, scoring_logic_key='',
         description='CFI authority and responsibilities clearly documented per CAR Section 7.'),
    dict(category='C1', code='C1.4', name='Digital record-keeping active', max_points=3,
         sort_order=4, auto_scored=True, scoring_logic_key='c1_record_keeping',
         description='Platform used for all operational and training records.'),

    # C2 — 20 pts (8 + 6 + 3 auto = 17; remaining 3 manual)
    dict(category='C2', code='C2.1', name='Syllabus adherence', max_points=8,
         sort_order=1, auto_scored=True, scoring_logic_key='c2_syllabus_adherence',
         description='Students progressing through DGCA-approved curriculum without lapse.'),
    dict(category='C2', code='C2.2', name='Stage check completion', max_points=6,
         sort_order=2, auto_scored=True, scoring_logic_key='c2_stage_checks',
         description='Stage / progress test pass rate for attempted proficiency checks.'),
    dict(category='C2', code='C2.3', name='Syllabus document currency', max_points=3,
         sort_order=3, auto_scored=False, scoring_logic_key='',
         description='DGCA-approved syllabus document up to date with latest CAR revisions.'),
    dict(category='C2', code='C2.4', name='Theory exam pass rate', max_points=3,
         sort_order=4, auto_scored=True, scoring_logic_key='c2_theory_pass_rate',
         description='Air Law / Technical theory pass rate ≥ 70% (pending TheoryExamResult model).'),

    # C3 — 20 pts (8 + 5 + 4 + 3 auto = 20, fully automated)
    dict(category='C3', code='C3.1', name='Aircraft availability', max_points=8,
         sort_order=1, auto_scored=True, scoring_logic_key='c3_aircraft_availability',
         description='Fleet serviceability rate — percentage of aircraft not AOG.'),
    dict(category='C3', code='C3.2', name='Maintenance compliance', max_points=5,
         sort_order=2, auto_scored=True, scoring_logic_key='c3_maintenance_compliance',
         description='Scheduled maintenance tasks completed by their due date.'),
    dict(category='C3', code='C3.3', name='CRS currency', max_points=4,
         sort_order=3, auto_scored=True, scoring_logic_key='c3_crs_currency',
         description='No aircraft flying without a valid Certificate of Release to Service.'),
    dict(category='C3', code='C3.4', name='Tech log completeness', max_points=3,
         sort_order=4, auto_scored=True, scoring_logic_key='c3_tech_logs',
         description='Tech logs closed out promptly after every completed flight.'),

    # C4 — 15 pts (4 + 4 + 4 + 3 auto = 15, fully automated)
    dict(category='C4', code='C4.1', name='Instructor medical currency', max_points=4,
         sort_order=1, auto_scored=True, scoring_logic_key='c4_instructor_medical',
         description='Instructor Class 1 medical validity (pending InstructorDocument model).'),
    dict(category='C4', code='C4.2', name='Instructor rating currency', max_points=4,
         sort_order=2, auto_scored=True, scoring_logic_key='c4_instructor_rating',
         description='CFI licence / instructor rating not expired.'),
    dict(category='C4', code='C4.3', name='Student medical currency', max_points=4,
         sort_order=3, auto_scored=True, scoring_logic_key='c4_student_medical',
         description='Student medical certificate (Class 1/2) validity.'),
    dict(category='C4', code='C4.4', name='SPL validity', max_points=3,
         sort_order=4, auto_scored=True, scoring_logic_key='c4_spl_validity',
         description='Student Pilot Licence not expired.'),

    # C5 — 15 pts (5 + 3 + 3 auto = 11; remaining 4 manual)
    dict(category='C5', code='C5.1', name='SMS reporting activity', max_points=5,
         sort_order=1, auto_scored=True, scoring_logic_key='c5_sms_implementation',
         description='Voluntary occurrence reports filed regularly — evidence of active safety culture.'),
    dict(category='C5', code='C5.2', name='Hazard register currency', max_points=3,
         sort_order=2, auto_scored=True, scoring_logic_key='c5_hazard_log',
         description='Hazard entries reviewed by their scheduled review date.'),
    dict(category='C5', code='C5.3', name='Safety risk assessments', max_points=4,
         sort_order=3, auto_scored=False, scoring_logic_key='',
         description='Formal risk assessments conducted for identified hazards (examiner-reviewed).'),
    dict(category='C5', code='C5.4', name='DGCA incident reporting', max_points=3,
         sort_order=4, auto_scored=True, scoring_logic_key='c5_incident_reporting',
         description='All high/critical occurrences reported to DGCA without delay.'),

    # C6 — 10 pts (4 + 3 + 3 auto = 10, fully automated)
    dict(category='C6', code='C6.1', name='Student record completeness', max_points=4,
         sort_order=1, auto_scored=True, scoring_logic_key='c6_student_records',
         description='Digital student training records maintained for every enrolled student.'),
    dict(category='C6', code='C6.2', name='Aircraft log accuracy', max_points=3,
         sort_order=2, auto_scored=True, scoring_logic_key='c6_aircraft_logs',
         description='Digital tech logs accurately reflect every flight and maintenance event.'),
    dict(category='C6', code='C6.3', name='FDTL duty records', max_points=3,
         sort_order=3, auto_scored=True, scoring_logic_key='c6_fdtl_records',
         description='Instructor duty time tracked continuously against DGCA CAR-FTL limits.'),

    # C7 — 5 pts, fully manual (examiner site visit)
    dict(category='C7', code='C7.1', name='Briefing rooms adequate', max_points=2,
         sort_order=1, auto_scored=False, scoring_logic_key='',
         description='Dedicated briefing rooms available at hub and satellite bases.'),
    dict(category='C7', code='C7.2', name='Ground school facilities', max_points=2,
         sort_order=2, auto_scored=False, scoring_logic_key='',
         description='Classroom and ground training infrastructure meets DGCA standards.'),
    dict(category='C7', code='C7.3', name='Simulator / training aids', max_points=1,
         sort_order=3, auto_scored=False, scoring_logic_key='',
         description='FTD/simulator or equivalent training aids available (if applicable to course).'),
]


class Command(BaseCommand):
    help = "Seeds the 7 DGCA audit categories and 22 scoring parameters"

    def handle(self, *args, **options):
        self.stdout.write("Seeding audit categories...")
        cat_map = {}
        for cat_data in CATEGORIES:
            cat, created = AuditCategory.objects.update_or_create(
                code=cat_data['code'], defaults=cat_data
            )
            cat_map[cat.code] = cat
            marker = "✓ created" if created else "- updated"
            self.stdout.write(f"  {marker}: {cat.code} {cat.name} ({cat.max_points} pts)")

        self.stdout.write("\nSeeding audit parameters...")
        for param_data in PARAMETERS:
            cat_code = param_data.pop('category')
            param_data['category'] = cat_map[cat_code]
            param, created = AuditParameter.objects.update_or_create(
                code=param_data['code'], defaults=param_data
            )
            marker = "✓" if created else "-"
            auto_tag = "[AUTO]" if param.auto_scored else "[MANUAL]"
            self.stdout.write(f"  {marker} {param.code} {auto_tag} {param.name} ({param.max_points} pts)")

        total_cat_pts = sum(c['max_points'] for c in CATEGORIES)
        total_param_pts = sum(p['max_points'] for p in PARAMETERS)
        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Seeded {len(CATEGORIES)} categories ({total_cat_pts} pts) and "
            f"{len(PARAMETERS)} parameters ({total_param_pts} pts)"
        ))
        if total_cat_pts != 100:
            self.stdout.write(self.style.WARNING(
                f"⚠ Category points sum to {total_cat_pts}, not 100 — check CATEGORIES list"
            ))
        if total_param_pts != total_cat_pts:
            self.stdout.write(self.style.WARNING(
                f"⚠ Parameter points ({total_param_pts}) don't match category totals "
                f"({total_cat_pts}) — check that every category's parameters sum correctly"
            ))