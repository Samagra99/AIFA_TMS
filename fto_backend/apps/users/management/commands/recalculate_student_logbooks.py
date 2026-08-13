from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.users.models import Student
from apps.scheduling.models import Flight, FlightStatus
from apps.dispatch.models import InstrumentTimeEntry


class Command(BaseCommand):
    help = "Recalculates logbook hours for all students from baseline previous_hours_* and completed flights."

    def handle(self, *args, **options):
        students = Student.objects.select_related("user").all()
        self.stdout.write(f"Recalculating logbooks for {students.count()} students...")

        recalculated_count = 0

        for student in students:
            # Baseline hours
            tot_hrs      = Decimal(str(student.previous_hours_total or 0))
            pic_hrs      = Decimal(str(student.previous_hours_pic or 0))
            p1_us_hrs    = Decimal(str(student.previous_hours_p1_us or 0))
            dual_hrs     = Decimal(str(student.previous_hours_dual or 0))
            solo_hrs     = Decimal(str(student.previous_hours_solo or 0))
            xc_dual_hrs  = Decimal(str(student.previous_hours_cross_country_dual or 0))
            xc_pic_hrs   = Decimal(str(student.previous_hours_cross_country_pic or 0))
            day_hrs_tot  = Decimal("0.0")
            night_hrs_tot = Decimal(str(student.previous_hours_night or 0))
            inst_sim_hrs = Decimal(str(student.previous_hours_instrument_simulated or 0))
            inst_act_hrs = Decimal(str(student.previous_hours_instrument_actual or 0))
            fstd_hrs     = Decimal(str(student.previous_hours_fstd or 0))
            me_hrs       = Decimal(str(student.previous_hours_multi_engine or 0))

            # Fetch all completed flights for this student with tech logs
            flights = Flight.objects.filter(
                student=student,
                status=FlightStatus.COMPLETED
            ).select_related('tech_log', 'aircraft', 'aircraft__aircraft_type').order_by('scheduled_start')

            for flight in flights:
                tl = getattr(flight, 'tech_log', None)
                if not tl:
                    continue

                duration_min = tl.flight_duration_minutes or 0
                if duration_min <= 0:
                    continue

                dur_hrs = Decimal(str(duration_min)) / Decimal("60.0")
                fl_day_hrs = Decimal(str(flight.day_hours or 0))
                fl_night_hrs = Decimal(str(flight.night_hours or 0))
                if fl_day_hrs == 0 and fl_night_hrs == 0:
                    fl_day_hrs = dur_hrs

                tot_hrs += dur_hrs
                day_hrs_tot += fl_day_hrs
                night_hrs_tot += fl_night_hrs

                is_me = bool(flight.aircraft and flight.aircraft.aircraft_type and flight.aircraft.aircraft_type.is_multi_engine)
                if is_me:
                    me_hrs += dur_hrs

                if getattr(flight, 'is_simulator', False):
                    fstd_hrs += dur_hrs

                is_cc = getattr(flight, 'is_cross_country', False) and not getattr(tl, 'cc_terminated_early', False)

                if flight.flight_type == "solo":
                    pic_hrs += dur_hrs
                    solo_hrs += dur_hrs
                    if is_cc:
                        xc_pic_hrs += dur_hrs
                else:
                    dual_hrs += dur_hrs
                    if is_cc:
                        xc_dual_hrs += dur_hrs

                # Instrument time from InstrumentTimeEntry
                for entry in InstrumentTimeEntry.objects.filter(tech_log=tl, person=student.user):
                    mins_hrs = Decimal(str(entry.minutes)) / Decimal("60.0")
                    if entry.time_kind == 'simulated':
                        inst_sim_hrs += mins_hrs
                    else:
                        inst_act_hrs += mins_hrs

            # Update student record
            student.hours_total                 = round(tot_hrs, 1)
            student.hours_pic                   = round(pic_hrs, 1)
            student.hours_p1_us                 = round(p1_us_hrs, 1)
            student.hours_dual                  = round(dual_hrs, 1)
            student.hours_solo                  = round(solo_hrs, 1)
            student.hours_cross_country_dual    = round(xc_dual_hrs, 1)
            student.hours_cross_country_pic     = round(xc_pic_hrs, 1)
            student.hours_day                   = round(day_hrs_tot, 1)
            student.hours_night                 = round(night_hrs_tot, 1)
            student.hours_instrument_simulated  = round(inst_sim_hrs, 1)
            student.hours_instrument_actual     = round(inst_act_hrs, 1)
            student.hours_fstd                  = round(fstd_hrs, 1)
            student.hours_multi_engine          = round(me_hrs, 1)

            student.save(update_fields=[
                "hours_total", "hours_pic", "hours_p1_us", "hours_dual", "hours_solo",
                "hours_cross_country_dual", "hours_cross_country_pic", "hours_day", "hours_night",
                "hours_instrument_simulated", "hours_instrument_actual", "hours_fstd", "hours_multi_engine",
                "updated_at"
            ])
            recalculated_count += 1
            full_name = student.user.get_full_name() if student.user else str(student.id)
            self.stdout.write(
                f"Updated {full_name}: Total={student.hours_total}h, Dual={student.hours_dual}h, Solo={student.hours_solo}h, PIC={student.hours_pic}h, CC Dual={student.hours_cross_country_dual}h, CC PIC={student.hours_cross_country_pic}h"
            )

        self.stdout.write(self.style.SUCCESS(f"Successfully recalculated logbooks for {recalculated_count} students."))
