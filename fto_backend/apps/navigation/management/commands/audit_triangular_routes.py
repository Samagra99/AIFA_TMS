from django.core.management.base import BaseCommand
from apps.navigation.models import CrossCountryRoute


class Command(BaseCommand):
    help = "Audits existing CrossCountryRoute rows with is_triangular=True where destination_airport != departure_airport."

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Auto-convert the mismatched destination into a RouteLeg (preserving turn-point) and set destination = departure',
        )

    def handle(self, *args, **options):
        routes = CrossCountryRoute.objects.filter(is_triangular=True).select_related(
            'departure_airport', 'destination_airport'
        )

        inconsistent = []
        for r in routes:
            if r.departure_airport_id != r.destination_airport_id:
                inconsistent.append(r)

        if not inconsistent:
            self.stdout.write(self.style.SUCCESS("All triangular routes have matching departure and destination airports."))
            return

        self.stdout.write(self.style.WARNING(f"Found {len(inconsistent)} triangular route(s) with destination != departure:"))
        for r in inconsistent:
            self.stdout.write(
                f"- [ID {r.id}] '{r.name}': Departure={r.departure_airport.icao_code} ({r.departure_airport.name}) | Destination={r.destination_airport.icao_code} ({r.destination_airport.name})"
            )

        if options.get('fix'):
            from apps.navigation.models import RouteLeg
            self.stdout.write(self.style.NOTICE("Applying automatic correction with turn-point preservation..."))
            fixed_count = 0
            for r in inconsistent:
                old_dest = r.destination_airport
                # Add old_dest as a route leg if not already present
                existing_leg = RouteLeg.objects.filter(route=r, airport=old_dest).exists()
                if not existing_leg:
                    max_seq = r.legs.count()
                    RouteLeg.objects.create(
                        route=r,
                        sequence=max_seq + 1,
                        airport=old_dest,
                    )
                    self.stdout.write(f"  Added {old_dest.icao_code} as Leg #{max_seq + 1} for '{r.name}'")

                r.destination_airport = r.departure_airport
                r.save(update_fields=['destination_airport', 'updated_at'])
                fixed_count += 1
            self.stdout.write(self.style.SUCCESS(f"Successfully corrected {fixed_count} route(s)."))
        else:
            self.stdout.write(
                self.style.NOTICE("Run with '--fix' to preserve turn-points as RouteLegs and align destination = departure.")
            )
