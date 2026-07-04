"""
Management command: python manage.py seed_data

Seeds the database with:
  - 3 bases (Amravati hub + 2 satellite placeholders)
  - 3 aircraft types (Cessna 152, 172SP, Piper PA-28)
  - 1 superadmin user
  - 3 sample aircraft
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds the database with initial FTO data"

    def handle(self, *args, **options):
        from apps.infrastructure.models import Base, AircraftType, Aircraft

        self.stdout.write("Seeding bases...")
        hub, _ = Base.objects.get_or_create(
            icao_code="VAAM",
            defaults={
                "name": "Amravati (Central Maintenance Hub)",
                "base_type": "hub",
                "latitude": "20.7749",
                "longitude": "77.7480",
                "elevation_ft": 1178,
                "ferry_buffer_hours": "0.00",
            },
        )
        base2, _ = Base.objects.get_or_create(
            icao_code="VATB",
            defaults={
                "name": "Satellite Base 2",
                "base_type": "satellite",
                "latitude": "20.0000",
                "longitude": "78.0000",
                "elevation_ft": 1000,
                "ferry_buffer_hours": "2.50",
            },
        )
        base3, _ = Base.objects.get_or_create(
            icao_code="VATC",
            defaults={
                "name": "Satellite Base 3",
                "base_type": "satellite",
                "latitude": "21.0000",
                "longitude": "79.0000",
                "elevation_ft": 1050,
                "ferry_buffer_hours": "2.50",
            },
        )
        self.stdout.write(self.style.SUCCESS("  ✓ 3 bases created"))

        self.stdout.write("Seeding aircraft types...")
        c152, _ = AircraftType.objects.get_or_create(
            make_model="Cessna 152",
            defaults={
                "icao_designator": "C152",
                "engine_make_model": "Lycoming O-235-L2C",
                "max_crosswind_demo_kt": 15,
                "max_crosswind_student_kt": 10,
                "da_solo_warning_ft": 5500,
            },
        )
        c172, _ = AircraftType.objects.get_or_create(
            make_model="Cessna 172SP",
            defaults={
                "icao_designator": "C172",
                "max_crosswind_demo_kt": 15,
                "max_crosswind_student_kt": 12,
                "da_solo_warning_ft": 6000,
            },
        )
        pa28, _ = AircraftType.objects.get_or_create(
            make_model="Piper PA-28 Archer",
            defaults={
                "icao_designator": "PA28",
                "max_crosswind_demo_kt": 17,
                "max_crosswind_student_kt": 12,
                "da_solo_warning_ft": 6000,
            },
        )
        self.stdout.write(self.style.SUCCESS("  ✓ 3 aircraft types created"))

        self.stdout.write("Seeding sample aircraft...")
        for tail, atype, base, hobbs, next50 in [
            ("VT-FTO", c152, hub,   1234.5, 1250.0),
            ("VT-FTB", c152, hub,   987.2,  1000.0),
            ("VT-FTC", c172, base2, 456.8,  497.5),
        ]:
            Aircraft.objects.get_or_create(
                tail_number=tail,
                defaults={
                    "aircraft_type": atype,
                    "home_base": hub,
                    "current_base": base,
                    "hobbs_total": hobbs,
                    "tacho_total": hobbs,
                    "next_50hr_at": next50,
                    "next_100hr_at": hobbs + 50,
                },
            )
        self.stdout.write(self.style.SUCCESS("  ✓ 3 aircraft created"))

        self.stdout.write("Creating superadmin user...")
        if not User.objects.filter(email="admin@fto.aero").exists():
            User.objects.create_superuser(
                email="admin@fto.aero",
                password="Admin@1234",
                first_name="FTO",
                last_name="Admin",
            )
            self.stdout.write(self.style.SUCCESS("  ✓ admin@fto.aero / Admin@1234"))
        else:
            self.stdout.write("  - Superadmin already exists")

        self.stdout.write(self.style.SUCCESS("\n✅ Seed data complete. Run: docker compose up"))
