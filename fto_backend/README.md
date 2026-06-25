# Amravati FTO Management Platform — Backend

Django 4.2 + PostgreSQL + Redis + Celery + Django Channels

## Windows Quick Start (Docker Desktop required)

### 1. Install prerequisites
- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) — enable WSL 2 backend
- Git for Windows

### 2. Clone and configure
```powershell
git clone <repo-url>
cd fto_backend

# Copy env file and edit secrets
copy .env.example .env
```
Open `.env` and set a strong `DJANGO_SECRET_KEY` (50+ random characters).

### 3. Start all services
```powershell
docker compose up --build
```
First build takes ~3–5 minutes. Subsequent starts take ~15 seconds.

### 4. Run migrations and seed data
Open a second terminal:
```powershell
docker compose exec api python manage.py migrate
docker compose exec api python manage.py seed_data
```

### 5. Access the platform
| Service | URL |
|---------|-----|
| API root | http://localhost:8000/api/v1/ |
| Swagger UI | http://localhost:8000/api/docs/ |
| Django Admin | http://localhost:8000/admin/ |
| MinIO Console | http://localhost:9001/ |

**Admin credentials (after seed_data):**  
Email: `admin@fto.aero` / Password: `Admin@1234`

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Django (Daphne ASGI)  :8000                            │
│  ├── REST API  (DRF + simplejwt)                        │
│  └── WebSockets (Django Channels → Redis)               │
├─────────────────────────────────────────────────────────┤
│  Celery Worker  — background tasks                       │
│  ├── weather queue  → fetch METAR every 30 min          │
│  ├── notifications  → expiry alerts, AOG push           │
│  └── default        → FDTL reset, document locking      │
├─────────────────────────────────────────────────────────┤
│  Celery Beat  — scheduled task dispatcher               │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL 16  :5432                                   │
│  Redis 7        :6379                                   │
│  MinIO          :9000 / :9001                           │
└─────────────────────────────────────────────────────────┘
```

## App Structure

| App | Purpose |
|-----|---------|
| `apps.core` | Abstract models, RBAC permissions, Scheduling Rule Engine, WebSocket consumers |
| `apps.infrastructure` | Base, AircraftType, Aircraft — fleet registry |
| `apps.users` | Custom User, Instructor, Student, JWT auth |
| `apps.syllabus` | DGCA-approved curriculum tree |
| `apps.scheduling` | Flight roster, constraint checking |
| `apps.dispatch` | Tech Log, Snag Entry, AOG cascade signal |
| `apps.maintenance` | Maintenance records, CRS, AD/SB, Sortie grades |
| `apps.inventory` | Hub-and-spoke parts management |
| `apps.compliance` | SMS Occurrence register, Hazard register |
| `apps.finance` | INR billing, GST invoices, EMI plans |
| `apps.weather` | METAR/NOTAM cache + Celery fetch tasks |

## Key Safety Rules (Scheduling Engine)

`apps/core/scheduling_engine.py` evaluates all DGCA hard constraints before any flight is confirmed:

1. **Student Medical** — must be current (not expired)
2. **Student SPL** — must be current
3. **Instructor FDTL** — daily / weekly / monthly remaining must cover the flight duration
4. **Aircraft AOG** — status must be `airworthy`
5. **50-hr / 100-hr Inspection Buffer** — remaining hours must cover flight + ferry buffer
6. **Crosswind / Density Altitude** — solo flights checked against student limits + METAR

## Celery Periodic Tasks
Configure in Django Admin → **Periodic Tasks** after first migration:

| Task | Schedule |
|------|----------|
| `apps.weather.tasks.fetch_weather_all_bases` | Every 30 minutes |
| `apps.weather.tasks.alert_expiring_documents` | Daily 06:00 IST |
| `apps.weather.tasks.reset_instructor_fdtl_daily` | Daily 04:00 IST |
| `apps.weather.tasks.lock_old_occurrence_reports` | Daily 02:00 IST |
| `apps.weather.tasks.lock_old_sortie_grades` | Daily 03:00 IST |

## API Authentication

All endpoints require `Authorization: Bearer <access_token>`.

```bash
# Get token
curl -X POST http://localhost:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fto.aero","password":"Admin@1234"}'

# Use token
curl http://localhost:8000/api/v1/infrastructure/aircraft/ \
  -H "Authorization: Bearer <access_token>"
```

JWT payload includes: `user_id`, `role`, `home_base_id`, `token_version`.

## Next Steps
- Frontend: React 18 + TypeScript (`packages/web`)
- Tablet App: React Native + Expo + WatermelonDB (`packages/mobile`)
