# Database Schema

## Core Tables
| Table | App | Description |
|---|---|---|
| `users` | users | All platform users (students, instructors, dispatchers, doctors, etc.) |
| `instructors` | users | Instructor profiles, FDTL counters, ratings |
| `students` | users | Student profiles, logbook totals, solo authorisation |
| `student_documents` | users | Licence, medical, FRTOL scans with version control |
| `bases` | infrastructure | FTO base/airport locations with ferry buffer |
| `runways` | infrastructure | Runway data per base (heading, length) — managed via admin |
| `aircraft_types` | infrastructure | Aircraft type catalog with maintenance intervals |
| `aircraft` | infrastructure | Fleet with hour counters, airworthiness tracking |
| `flights` | scheduling | Flight records with full status lifecycle |
| `flight_exercises` | scheduling | Exercise links per flight |
| `tech_logs` | dispatch | TechLog with compliance snapshot including BA test details |
| `snag_entries` | dispatch | Defect reports with CAMO deferral workflow |
| `ba_equipment` | dispatch | Saved breath analyzer equipment details |
| `ba_test_entries` | dispatch | BA test records (person, result, equipment, time) |
| `maintenance_records` | maintenance | Work orders with status (planned/in_progress/completed) |
| `sortie_grades` | maintenance | Post-flight grading |
| `weather_cache` | weather | METAR/TAF data (auto-fetched and manual entries unified) |
| `ai_suggested_rosters` | rostering | Gemini AI roster suggestions |
