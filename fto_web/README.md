# Amravati FTO — Web Frontend

React 18 + TypeScript + Tailwind CSS · Vite · TanStack Query · Zustand

## Quick Start

### Prerequisites
- Node.js 20+ (install via https://nodejs.org)
- Backend running on `http://localhost:8000` (see `fto_backend/`)

### 1. Install dependencies
```powershell
cd fto_web
npm install
```

### 2. Start the dev server
```powershell
npm run dev
```

Open **http://localhost:5173**

Login with: `admin@fto.aero` / `Admin@1234`

---

## Architecture

```
src/
├── api/
│   ├── client.ts      Axios instance — JWT injection + silent refresh interceptor
│   ├── types.ts       TypeScript interfaces mirroring all Django models
│   └── hooks/         TanStack Query hooks per domain
│       ├── useAuth.ts        login, logout, /me
│       ├── useInfrastructure fleet status, bases, aircraft
│       ├── useScheduling     daily roster, confirm/cancel flights, constraint check
│       ├── useDispatch       tech log lifecycle (clear → accept → closeout)
│       ├── useStudents       student profiles, logbook, compliance
│       └── useWeather        METAR cache, briefing packet
│
├── stores/
│   ├── authStore.ts   JWT tokens + decoded user (persisted to localStorage)
│   └── uiStore.ts     theme, active base, sidebar state, AOG alert queue
│
├── routes/
│   ├── index.tsx       createBrowserRouter — all page routes
│   ├── ProtectedRoute  redirects to /login if no valid token
│   └── RoleGuard       shows /unauthorized if wrong role
│
├── layouts/
│   ├── AppLayout       main shell — sidebar + topbar + AOG banner + toast
│   ├── AuthLayout      centered wrapper for login
│   ├── Sidebar         collapsible nav, role-filtered links, base switcher
│   └── TopBar          base selector, theme toggle, AOG alert count, logout
│
├── components/
│   ├── ui/             Button, Badge, Card, Modal, Spinner, StatusPill
│   ├── fleet/          AircraftStatusCard, FerryBufferBar
│   └── scheduling/     ConstraintBadge (shows pass/fail per DGCA rule)
│
├── hooks/
│   ├── useWebSocket    auto-reconnecting WebSocket with exponential backoff
│   ├── useAOGSocket    subscribes to /ws/fleet/ and routes AOG events to UI
│   └── useTheme        syncs html.dark class with Zustand on load
│
├── pages/
│   ├── auth/LoginPage          JWT login form with Zod validation
│   ├── dashboard/DashboardPage KPI strip + AOG list + today's roster summary
│   ├── fleet/FleetStatusPage   Grid of aircraft cards, status filter tabs, detail modal
│   ├── scheduling/RosterPage   Day-view roster table, constraint check + confirm modal
│   ├── dispatch/DispatchPage   3-step dispatch loop (clear → accept → closeout + snag)
│   └── students/StudentsPage   Student table, logbook totals, document compliance
│
└── lib/
    ├── utils.ts    cn(), fmt helpers, status colour maps
    └── constants.ts role-to-nav-item access map, label maps
```

## Key Patterns

### Authentication flow
1. `LoginPage` posts credentials → receives `{ access, refresh }` JWT pair
2. `authStore.setTokens()` decodes the access token payload and stores user info
3. Axios request interceptor attaches `Authorization: Bearer <access>` to every call
4. On 401 response, interceptor silently calls `/auth/token/refresh/`, replays the queue of failed requests
5. If refresh also fails, `authStore.logout()` is called → redirect to `/login`

### Real-time AOG alerts
1. `useAOGSocket` (mounted in `AppLayout`) subscribes to `ws://localhost:8000/ws/fleet/`
2. On `{ event: "aog" }` message: adds to `uiStore.aogAlerts`, fires a persistent toast, invalidates fleet + roster queries
3. `AppLayout` renders a red banner for the first active alert with a dismiss button
4. `TopBar` shows a pulsing count badge

### DGCA Constraint Check (scheduling)
`ConstraintBadge` component renders the result of `POST /scheduling/flights/check-constraints/` or a confirm attempt:
- Green panel when `all_passed: true`
- Red panel listing each blocking failure with the rule name and human-readable detail
- Amber warnings (non-blocking — e.g. density altitude) shown separately

### Ferry Buffer (fleet)
`AircraftStatusCard` highlights aircraft in amber when `ferry_buffer_triggered: true`.  
`FerryBufferBar` shows a colour-coded progress bar: green → amber → red as hours drain.

## Available Scripts
```powershell
npm run dev       # Vite dev server with HMR
npm run build     # TypeScript check + production build
npm run preview   # Preview production build locally
npm run typecheck # TypeScript type-check only (no emit)
npm run lint      # ESLint
```

## Environment Variables (`.env`)
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_BASE_URL=ws://localhost:8000
VITE_APP_NAME=Amravati FTO
```
The Vite dev server proxies `/api` and `/ws` to `localhost:8000`, so the `.env` values
are only needed for production builds pointing to a real server.

## Completed Screens (Phase 1)
| Screen | Route | Status |
|--------|-------|--------|
| Login | `/login` | ✅ |
| Dashboard | `/dashboard` | ✅ |
| Fleet Status | `/fleet` | ✅ |
| Daily Roster | `/roster` | ✅ |
| Dispatch Loop | `/dispatch` | ✅ |
| Student Management | `/students` | ✅ |

## Planned Screens (Phase 2–4)
| Screen | Route | Phase |
|--------|-------|-------|
| Syllabus & Grading | `/syllabus` | 2 |
| Maintenance (CAMO) | `/maintenance` | 3 |
| Inventory | `/inventory` | 3 |
| Safety & SMS | `/compliance` | 3 |
| Finance / Billing | `/finance` | 4 |
| DGCA Audit Dashboard | `/reports` | 4 |
