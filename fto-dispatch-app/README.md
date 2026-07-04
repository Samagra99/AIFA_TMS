# FTO Dispatch — React Native Tablet App

Offline-first apron dispatch tablet for Amravati Flight Training Organisation.
Built with Expo 51 + WatermelonDB + Expo Router.

---

## Features

| Feature | Description |
|---|---|
| **Offline-first** | WatermelonDB (SQLite) stores all data locally. Dispatch works without connectivity. |
| **3-step dispatch wizard** | Pre-flight checklist → Weather briefing (Go/No-Go) → Release + signature |
| **AOG block** | Aircraft marked AOG cannot be dispatched — hard block with clear error |
| **Real-time alerts** | WebSocket connection to Django Channels for instant AOG broadcast |
| **DGCA pre-flight checklist** | 22-item checklist covering fuel, engine, airframe, documents, performance, ground |
| **SVG signature capture** | Dispatcher draws signature on-screen for the release step |
| **Ferry buffer enforcement** | Aircraft at satellite bases show FERRY HOLD when remaining hours ≤ buffer |
| **Auto-sync** | Pulls data on launch + every 5 minutes. Pushes queued mutations when back online |
| **Tablet + phone** | Responsive layout adapts for 7"+ tablets (3-column grids) and phones (2-column) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Expo Router (file-based navigation)                    │
│  ├── (auth)/login          → JWT login                 │
│  ├── (app)/index           → Today's flights            │
│  ├── (app)/fleet           → Fleet status grid          │
│  ├── (app)/alerts          → AOG / snag alert feed      │
│  └── dispatch/[id]         → 3-step dispatch wizard     │
└─────────────────────────────────────────────────────────┘
           │ reads / writes
┌──────────▼───────────────────────────────────────────────┐
│  WatermelonDB (expo-sqlite adapter)                       │
│  Tables: flights, aircraft, dispatch_records,             │
│          fto_alerts, sync_queue                           │
└────────────────┬─────────────────┬───────────────────────┘
                 │ pullAll()        │ pushPending()
          ┌──────▼──────┐   ┌──────▼──────┐
          │  Django API  │   │  Sync Queue  │
          │  /api/...    │   │  (offline    │
          │              │   │   mutations) │
          └──────────────┘   └─────────────┘
                 │ WebSocket
          ┌──────▼──────────────────────────┐
          │  Django Channels                │
          │  ws/dispatch/ → AOG broadcast   │
          └─────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Expo CLI: `npm install -g @expo/cli`
- EAS CLI: `npm install -g eas-cli` (for device builds)
- Android Studio (for Android emulator) or Xcode (for iOS simulator)

### 1. Install dependencies

```bash
cd fto-dispatch-app
npm install
```

### 2. Configure environment

Create `.env.local` at the project root:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
EXPO_PUBLIC_WS_URL=ws://192.168.1.100:8000
```

> **Note:** Use your Django server's LAN IP (not `localhost`) so the device/emulator can reach it.

### 3. Prebuild (required for WatermelonDB native modules)

```bash
npx expo prebuild --clean
```

This generates `android/` and `ios/` native folders.

### 4a. Run on Android

```bash
npx expo run:android
```

### 4b. Run on iOS (macOS only)

```bash
npx expo run:ios
```

---

## Django Backend Integration

The app expects the following API endpoints on your existing Django backend:

### Pull endpoint (GET)

```
GET /api/dispatch/sync/pull/?since=<unix_ms>

Response:
{
  "flights": [ ServerFlight, ... ],
  "aircraft": [ ServerAircraft, ... ],
  "alerts": [ ServerAlert, ... ],
  "weather": { "VAAW": WeatherData },
  "server_time": 1234567890000
}
```

Add this view to your `dispatch` Django app:

```python
# dispatch/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from .models import ScheduledFlight
from maintenance.models import Aircraft
from compliance.models import SafetyAlert
import time

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sync_pull(request):
    since_ms = int(request.query_params.get('since', 0))
    since = timezone.datetime.fromtimestamp(since_ms / 1000, tz=timezone.utc) if since_ms else None

    # Today's flights (and tomorrow for pre-dawn dispatch)
    today = timezone.now().date()
    flights_qs = ScheduledFlight.objects.filter(
        scheduled_start__date__gte=today,
        scheduled_start__date__lte=today + timedelta(days=1),
    )

    return Response({
        'flights': FlightSyncSerializer(flights_qs, many=True).data,
        'aircraft': AircraftSyncSerializer(Aircraft.objects.all(), many=True).data,
        'alerts': AlertSyncSerializer(
            SafetyAlert.objects.filter(is_resolved=False), many=True
        ).data,
        'weather': {},   # Populated by your weather Celery task
        'server_time': int(time.time() * 1000),
    })
```

### Push endpoint (POST)

```
POST /api/dispatch/records/

Body: serialized DispatchRecord
```

This maps to your existing `DispatchRecord` DRF viewset.

### WebSocket (Django Channels)

The app connects to `ws://<host>/ws/dispatch/?token=<jwt>`.

Your existing `AOGConsumer` should send:

```python
# In your signal handler for No-Go snag:
async_to_sync(channel_layer.group_send)(
    'dispatch',
    {
        'type': 'aog.alert',
        'aircraft_registration': aircraft.registration,
        'snag_description': snag.description,
        'affected_flight_ids': list(affected_ids),
        'created_at': datetime.now().isoformat(),
    }
)
```

The app routes `type: 'aog_alert'` messages to the alert store + local DB.

---

## Production Build

### EAS Build (recommended)

```bash
# Configure project
eas build:configure

# Build for Android (APK for sideloading on tablets)
eas build --platform android --profile preview

# Build for iOS (TestFlight)
eas build --platform ios --profile preview
```

### `eas.json`

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://fto.yourdomain.com",
        "EXPO_PUBLIC_WS_URL": "wss://fto.yourdomain.com"
      }
    },
    "production": {
      "android": { "buildType": "aab" }
    }
  }
}
```

---

## Key Domain Rules Encoded

| Rule | Where enforced |
|---|---|
| Aircraft AOG → dispatch blocked | `dispatch/[id].tsx` guard — shows blocking screen |
| Ferry buffer → FERRY HOLD badge | `AircraftCard.tsx` + `useAircraftFleet` `isFerryBlocked` |
| Pre-flight all-items-checked before proceeding | `PreFlightStep.tsx` `canProceed` gate |
| VFR minima check (5 km vis, 1500 ft ceiling) | `WeatherStep.tsx` `meetsVfr` indicator |
| NOTAM must be acknowledged | `WeatherStep.tsx` `notamAck` required |
| Dispatcher signature required for release | `ReleaseStep.tsx` `hasSignature` gate |
| Offline mutations queued | `sync_queue` WatermelonDB table + `enqueueSync()` |

---

## Sync Behaviour

| Scenario | Behaviour |
|---|---|
| App opens (online) | Pull all today's flights, aircraft, alerts from server |
| App opens (offline) | Loads from local WatermelonDB — full functionality |
| Dispatch completed (online) | Saves locally + immediate push attempt |
| Dispatch completed (offline) | Saves locally, queues in `sync_queue`, syncs on next reconnect |
| AOG alert received (WebSocket) | Saves to `fto_alerts` table + Zustand store → shows banner instantly |
| Pull runs every 5 minutes | Background refresh when app is in foreground and connected |

---

## File Structure

```
fto-dispatch-app/
├── app/
│   ├── _layout.tsx              # Root layout (auth gate)
│   ├── (auth)/login.tsx         # Login screen
│   ├── (app)/
│   │   ├── _layout.tsx          # Tab navigator
│   │   ├── index.tsx            # Dashboard — today's flights
│   │   ├── fleet.tsx            # Fleet status by base
│   │   └── alerts.tsx           # AOG / SNAG alert feed
│   └── dispatch/[id].tsx        # 3-step dispatch wizard
└── src/
    ├── theme/colors.ts          # Aviation dark theme tokens
    ├── types/index.ts           # All TypeScript interfaces
    ├── db/                      # WatermelonDB (schema, models, instance)
    ├── services/                # API, sync, WebSocket services
    ├── store/                   # Zustand (auth, alerts)
    ├── hooks/                   # useFlights, useAircraftFleet, useNetworkStatus
    └── components/
        ├── ui/                  # Button, Badge
        ├── FlightCard.tsx
        ├── AircraftCard.tsx
        ├── AlertCard.tsx
        ├── OfflineBanner.tsx
        ├── SyncStatusBar.tsx
        └── dispatch/
            ├── ProgressSteps.tsx
            ├── PreFlightStep.tsx   # 22-item DGCA checklist
            ├── WeatherStep.tsx     # METAR + Go/No-Go
            └── ReleaseStep.tsx     # SVG signature + release
```

---

## Troubleshooting

**WatermelonDB setup error on first launch**
Run `npx expo prebuild --clean` again and ensure `expo-sqlite` plugin is in `app.json`.

**Cannot connect to API (ECONNREFUSED)**
Use your machine's LAN IP (e.g. `192.168.1.x`), not `localhost`. Android emulator uses `10.0.2.2` instead.

**Signature canvas not responding on Android**
This is a known issue with PanResponder inside ScrollView on some Android versions.
The `WeatherStep` and `PreFlightStep` use `keyboardShouldPersistTaps="handled"` to mitigate this. The ReleaseStep signature canvas is not inside a ScrollView to avoid the conflict.

**WebSocket connection drops after ~30 seconds**
The service sends a `ping` frame every 30s to keep the connection alive. Ensure your Django Channels layer and nginx `proxy_read_timeout` are set to at least 60s.
