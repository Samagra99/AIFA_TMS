# API Reference

Base URL: `/api/v1/`

## Authentication
- `POST /api/auth/token/` — Obtain JWT (access + refresh)
- `POST /api/auth/token/refresh/` — Refresh access token
- `POST /api/auth/logout/` — Blacklist refresh token

## Core Modules

### Users & Roles
- `GET/POST /api/users/` — User management (Admin/CFI)
- `GET /api/users/me/` — Current user profile
- `POST /api/users/set-pin/` — Set operational dispatch PIN
- Roles: `superadmin`, `cfi`, `instructor`, `dispatcher`, `student`, `camo`, `safety_officer`, `finance`, `doctor`

### Infrastructure
- `GET/POST /api/infrastructure/bases/` — Base management
- `GET/POST /api/infrastructure/aircraft-types/` — Aircraft type catalog
- `GET/POST /api/infrastructure/aircraft/` — Fleet management
- Runways: Managed via Django Admin (inline on Base)

### Scheduling
- `GET/POST /api/scheduling/flights/` — Flight CRUD with safety rule engine validation
- Scheduling Rule Engine enforces: Medical/SPL validity, FDTL, Ferry buffer, AOG, CoA/Biennial, 7-day rest

### Dispatch
- `GET/POST /api/dispatch/tech-logs/` — Tech log lifecycle
- `POST /api/dispatch/tech-logs/{id}/clear-dispatch/` — Dispatch clearance (with BA hard constraint)
- `POST /api/dispatch/tech-logs/{id}/accept-aircraft/` — Aircraft acceptance
- `POST /api/dispatch/tech-logs/{id}/closeout/` — Post-flight closeout

### Breath Analyzer (BA)
- `GET/POST /api/dispatch/ba-equipment/` — BA equipment management (Doctor)
- `GET/POST /api/dispatch/ba-tests/` — BA test entries with search, filter, sort, pagination (Doctor)
- `GET /api/dispatch/ba-candidates/?q=search` — Search students/instructors for BA test
- BA test is auto-fetched and enforced as hard constraint during dispatch clearance

### Rostering
- `GET/POST /api/rostering/daily-plans/` — Daily plan request lifecycle
- `POST /api/rostering/daily-plans/{id}/confirm-roster/` — Confirm roster (with rule engine)
- `POST /api/rostering/daily-plans/{id}/approve-roster/` — CFI approves roster
- `POST /api/rostering/daily-plans/{id}/save-ai-suggestion/` — Save Gemini AI roster suggestion

### Weather
- `GET /api/weather/latest/?icao=VAAU` — Latest METAR/TAF
- `GET /api/weather/briefing-packet/?baseid=...` — Pre-flight briefing packet
- `POST /api/weather/manual-entry/` — Manual METAR/TAF entry
- `POST /api/weather/set-active-runway/` — Set active runway for a base

### Maintenance
- `GET/POST /api/maintenance/records/` — Maintenance records with status (planned/in_progress/completed)
- CRS sign-off resolves only explicitly linked snags

### Compliance
- `GET /api/compliance/audit-scores/` — Live DGCA 100-point audit scoring
- `GET /api/compliance/alerts/` — Compliance alerts

### AI Integration
- AI agent: **Google Gemini** (`gemini-2.5-flash`) — server-side only, API key never exposed to browser
