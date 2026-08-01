# AIFA_TMS — FTO Training Management System

DGCA-compliant Flight Training Organisation management platform for Amravati Flying Academy.

## Architecture
- **Backend:** Django 5.2 LTS + Django REST Framework + Channels (WebSocket)
- **Frontend (Web):** React 18 + TypeScript + Vite
- **Frontend (Mobile):** Expo / React Native + WatermelonDB (offline-first)
- **AI Agent:** Google Gemini (`gemini-2.5-flash`) — server-side roster generation
- **Database:** PostgreSQL 16
- **Cache / Queue:** Redis + Celery
- **Storage:** MinIO (S3-compatible)

## Key Modules
| Module | Description |
|---|---|
| Users | Multi-role auth (Student, Instructor, CFI, Dispatcher, CAMO, Doctor, etc.) |
| Scheduling | Flight booking with DGCA safety rule engine (6 hard constraints) |
| Dispatch | TechLog lifecycle, dispatch clearance, BA hard constraint, PIN verification |
| Breath Analyzer | Doctor-managed BA equipment & test entries, auto-verified at dispatch |
| Rostering | AI-powered daily plan → roster → CFI approval workflow |
| Weather | Auto-fetch + manual METAR/TAF, true crosswind with active runway |
| Maintenance | Work orders with status lifecycle, CRS sign-off with explicit snag linking |
| Compliance | Live DGCA 100-point audit scoring engine |
| Mobile | Offline-first tablet dispatch app with secure token storage |

## Quick Start
See [docs/Deployment.md](docs/Deployment.md) for production deployment.

For local development:
```bash
cd fto_backend
pip install -r requirements/base.txt
python manage.py migrate
python manage.py runserver
```
