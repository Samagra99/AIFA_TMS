from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.users.models import Student
from apps.maintenance.models import SortieGrade


class Command(BaseCommand):
    help = "Recalculates logbook hours for all students from baseline previous_hours_* and graded sorties."

    def handle(self, *args, **options):
        students = Student.objects.all()
        self.stdout.write(f"Recalculating logbooks for {students.count()} students...")

        recalculated_count = 0

        for student in students:
            # Baseline hours
            tot_hrs = Decimal(str(student.previous_hours_total or 0))
            pic_hrs = Decimal(str(student.previous_hours_pic or 0))
            p1_us_hrs = Decimal(str(getattr(student, 'previous_hours_p1_us', 0) or 0))
            dual_hrs = Decimal(str(student.previous_hours_dual or 0))
            solo_hrs = Decimal(str(student.previous_hours_solo or 0))
            xc_hrs = Decimal(str(getattr(student, 'previous_hours_cross_country', 0) or 0))
            night_hrs = Decimal(str(getattr(student, 'previous_hours_night', 0) or 0))
            inst_hrs = Decimal(str(getattr(student, 'previous_hours_instrument', 0) or 0))
            me_hrs = Decimal(str(getattr(student, 'previous_hours_multi_engine', 0) or 0))

            # Fetch all graded sorties for this student
            grades = SortieGrade.objects.filter(student=student).select_related('flight', 'flight__tech_log', 'flight__aircraft', 'exercise')

            for grade in grades:
                flight = grade.flight
                if not flight or not hasattr(flight, 'tech_log') or not flight.tech_log:
                    continue

                duration_min = flight.tech_log.flight_duration_minutes or 0
                if duration_min <= 0:
                    continue

                dur_hrs = Decimal(str(duration_min)) / Decimal("60")
                ft = flight.flight_type
                exercise = getattr(flight, 'exercise', None) or getattr(grade, 'exercise', None)
                is_p1_us = bool((exercise and getattr(exercise, 'log_as_p1_us', False)) or (ft == "dgca_flight_test"))

                tot_hrs += dur_hrs

                if is_p1_us:
                    p1_us_hrs += dur_hrs
                    pic_hrs   += dur_hrs
                    solo_hrs  += dur_hrs
                elif ft in ("solo", "cross_country_solo", "night_solo"):
                    pic_hrs   += dur_hrs
                    solo_hrs  += dur_hrs
                else:
                    dual_hrs  += dur_hrs

                if "cross_country" in ft:
                    xc_hrs += dur_hrs
                if "night" in ft:
                    night_hrs += dur_hrs
                if "instrument" in ft or ft == "fstd_instrument":
                    inst_hrs += dur_hrs

                is_me = False
                if flight.aircraft and hasattr(flight.aircraft, 'aircraft_type_detail') and flight.aircraft.aircraft_type_detail:
                    if getattr(flight.aircraft.aircraft_type_detail, 'is_multi_engine', False):
                        is_me = True
                if ft == "dual_multi_engine" or is_me:
                    me_hrs += dur_hrs

            # Update student record
            student.hours_total = tot_hrs
            student.hours_pic = pic_hrs
            student.hours_p1_us = p1_us_hrs
            student.hours_dual = dual_hrs
            student.hours_solo = solo_hrs
            student.hours_cross_country = xc_hrs
            student.hours_night = night_hrs
            student.hours_instrument = inst_hrs
            if hasattr(student, 'hours_multi_engine'):
                student.hours_multi_engine = me_hrs

            student.save()
            recalculated_count += 1
            full_name = student.user.get_full_name() if student.user else str(student.id)
            self.stdout.write(
                f"Updated {full_name}: Total={tot_hrs:.1f}h, Dual={dual_hrs:.1f}h, Solo={solo_hrs:.1f}h, PIC={pic_hrs:.1f}h, P1 U/S={p1_us_hrs:.1f}h"
            )

        self.stdout.write(self.style.SUCCESS(f"Successfully recalculated logbooks for {recalculated_count} students."))
