"""
apps/dashboard/views.py
-------------------------
Purpose-built read endpoints for the Instructor and Student dashboards.
"""
import logging
from datetime import date, datetime, timedelta

from django.db.models import Sum, Count, F, ExpressionWrapper, DurationField, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

log = logging.getLogger(__name__)

FDTL_LIMITS = {
    'last_24h':  8,
    'last_7d':   30,
    'last_28d':  100,
    'last_90d':  270,
    'last_360d': 1000,
}

EXPIRY_WARNING_DAYS = 60


def _duration_annotation():
    return ExpressionWrapper(
        F('scheduled_end') - F('scheduled_start'),
        output_field=DurationField(),
    )


def _td_hours(td) -> float:
    return (td.total_seconds() / 3600.0) if td else 0.0


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_summary(request):
    from apps.users.models import Instructor
    from apps.rostering.models import InstructorStudentAssignment
    from apps.maintenance.models import SortieGrade
    from apps.scheduling.models import Flight, FlightStatus
    from apps.infrastructure.models import Aircraft

    try:
        instructor = request.user.instructor_profile
    except Exception:
        return Response({'detail': 'This account has no instructor profile.'}, status=403)

    today = timezone.now().date()
    month_start = today.replace(day=1)
    now = timezone.now()

    today_agg = Flight.objects.filter(
        instructor=instructor,
        scheduled_start__date=today,
        status=FlightStatus.COMPLETED,
    ).annotate(duration=_duration_annotation()).aggregate(total=Sum('duration'))
    hours_today = round(_td_hours(today_agg['total']), 1)

    month_agg = Flight.objects.filter(
        instructor=instructor,
        scheduled_start__date__gte=month_start,
        scheduled_start__date__lte=today,
        status=FlightStatus.COMPLETED,
    ).annotate(duration=_duration_annotation()).aggregate(total=Sum('duration'))
    hours_month = round(_td_hours(month_agg['total']), 1)

    daily_cap_remaining = max(0.0, FDTL_LIMITS['last_24h'] - hours_today)
    counter_remaining = round(instructor.fdtl_daily_remaining_min / 60.0, 1)
    hours_remaining_today = round(min(daily_cap_remaining, counter_remaining), 1)

    assignments = InstructorStudentAssignment.objects.filter(
        instructor=instructor, is_active=True
    ).select_related('student__user')

    student_ids = [a.student_id for a in assignments]
    # Fetch all grades for these students ordered by graded_at desc
    all_grades = SortieGrade.objects.filter(
        student_id__in=student_ids
    ).select_related('exercise').order_by('-graded_at')

    # Group by student id to get the latest grade
    latest_grades = {}
    for grade in all_grades:
        if grade.student_id not in latest_grades:
            latest_grades[grade.student_id] = grade

    students_out = []
    for a in assignments:
        student = a.student
        last_grade = latest_grades.get(student.id)
        students_out.append({
            'student_id':         str(student.id),
            'student_name':       student.user.get_full_name(),
            'batch_number':       student.batch_number,
            'hours_total':        str(student.hours_total),
            'last_exercise_code': last_grade.exercise.exercise_code if last_grade else None,
            'last_exercise_title':last_grade.exercise.title if last_grade else None,
            'last_grade':         last_grade.grade if last_grade else None,
            'last_flown_at':      last_grade.graded_at.isoformat() if last_grade else None,
            'medical_expiry':     str(student.medical_expiry) if student.medical_expiry else None,
            'spl_expiry':         str(student.spl_expiry) if student.spl_expiry else None,
        })
    students_out.sort(key=lambda s: s['student_name'])

    warning_cutoff = today + timedelta(days=EXPIRY_WARNING_DAYS)
    expiring = []

    if instructor.fir_expiry and today <= instructor.fir_expiry <= warning_cutoff:
        expiring.append({
            'type': 'cfi_licence', 'label': 'Your AFIR / FIR Licence',
            'entity_name': request.user.get_full_name(),
            'expiry_date': str(instructor.fir_expiry),
            'days_left': (instructor.fir_expiry - today).days,
            'is_own': True,
        })

    for a in assignments:
        student = a.student
        if student.medical_expiry and today <= student.medical_expiry <= warning_cutoff:
            expiring.append({
                'type': 'medical', 'label': 'Medical Certificate',
                'entity_name': student.user.get_full_name(),
                'expiry_date': str(student.medical_expiry),
                'days_left': (student.medical_expiry - today).days,
                'is_own': False,
            })
        if student.spl_expiry and today <= student.spl_expiry <= warning_cutoff:
            expiring.append({
                'type': 'spl', 'label': 'Student Pilot Licence',
                'entity_name': student.user.get_full_name(),
                'expiry_date': str(student.spl_expiry),
                'days_left': (student.spl_expiry - today).days,
                'is_own': False,
            })
    expiring.sort(key=lambda e: e['days_left'])

    aog_aircraft = Aircraft.objects.filter(is_active=True, status='aog').select_related('current_base')
    aog_out = [{
        'aircraft_id': str(a.id), 'tail_number': a.tail_number,
        'base_name': a.current_base.name if a.current_base else None,
        'aog_reason': a.aog_reason,
        'aog_since': a.aog_since.isoformat() if a.aog_since else None,
    } for a in aog_aircraft]

    return Response({
        'as_of': now.isoformat(),
        'hours_flown_today': hours_today,
        'hours_flown_month': hours_month,
        'hours_remaining_today': hours_remaining_today,
        'fdtl_daily_cap_hours': FDTL_LIMITS['last_24h'],
        'students': students_out,
        'expiring_within_60_days': expiring,
        'aog_aircraft': aog_out,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_availability(request):
    from apps.core.fdtl_utils import calculate_instructor_fdtl

    try:
        instructor = request.user.instructor_profile
    except Exception:
        return Response({'detail': 'This account has no instructor profile.'}, status=403)

    date_str = request.query_params.get('date')
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'date must be YYYY-MM-DD'}, status=400)
    else:
        target_date = timezone.now().date()

    results = calculate_instructor_fdtl(instructor, target_date)

    return Response({
        'instructor_id': str(instructor.id),
        'target_date': str(target_date),
        'windows': results,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_summary(request):
    from apps.maintenance.models import SortieGrade
    from apps.rostering.models import InstructorStudentAssignment
    from apps.syllabus.models import SyllabusStage

    try:
        student = request.user.student_profile
    except Exception:
        return Response({'detail': 'This account has no student profile.'}, status=403)

    last_grade = (
        SortieGrade.objects.filter(student=student)
        .select_related('exercise').order_by('-graded_at').first()
    )

    stages = SyllabusStage.objects.filter(
        licence_type=student.target_licence
    ).prefetch_related('lessons__exercises')

    all_exercises = [ex for stage in stages for lesson in stage.lessons.all() for ex in lesson.exercises.all()]
    passed_grades = {
        g.exercise_id: g.grade
        for g in SortieGrade.objects.filter(student=student).select_related('exercise').order_by('graded_at')
    }
    passed_count = sum(1 for ex in all_exercises if ex.id in passed_grades and passed_grades[ex.id] >= ex.pass_grade)
    total_count = len(all_exercises)
    progress_pct = round(passed_count / total_count * 100, 1) if total_count else 0

    stage_progress = []
    for stage in stages:
        stage_exercises = [ex for lesson in stage.lessons.all() for ex in lesson.exercises.all()]
        stage_passed = sum(1 for ex in stage_exercises if ex.id in passed_grades and passed_grades[ex.id] >= ex.pass_grade)
        stage_progress.append({
            'stage_number': stage.stage_number,
            'stage_title': stage.title,
            'passed': stage_passed,
            'total': len(stage_exercises),
            'pct': round(stage_passed / len(stage_exercises) * 100, 1) if stage_exercises else 0,
        })

    assignment = (
        InstructorStudentAssignment.objects.filter(student=student, is_active=True)
        .select_related('instructor__user', 'base').first()
    )
    instructor_out = None
    if assignment:
        instructor_out = {
            'instructor_id': str(assignment.instructor.id),
            'name': assignment.instructor.user.get_full_name(),
            'email': assignment.instructor.user.email,
            'fir_licence_number': assignment.instructor.fir_licence_number,
            'base_name': assignment.base.name if assignment.base else None,
        }

    return Response({
        'student_id': str(student.id),
        'hours_total': str(student.hours_total),
        'hours_pic': str(student.hours_pic),
        'hours_dual': str(student.hours_dual),
        'hours_solo': str(student.hours_solo),
        'target_licence': student.target_licence.code if student.target_licence else None,
        'last_exercise': {
            'code': last_grade.exercise.exercise_code if last_grade else None,
            'title': last_grade.exercise.title if last_grade else None,
            'grade': last_grade.grade if last_grade else None,
            'passed': (last_grade.grade >= last_grade.exercise.pass_grade) if last_grade else None,
            'graded_at': last_grade.graded_at.isoformat() if last_grade else None,
        } if last_grade else None,
        'curriculum_progress': {
            'passed_exercises': passed_count,
            'total_exercises': total_count,
            'progress_pct': progress_pct,
            'stages': stage_progress,
        },
        'assigned_instructor': instructor_out,
    })