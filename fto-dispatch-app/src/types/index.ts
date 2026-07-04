// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  base: string;
}

export type UserRole =
  | 'CFI'        // Chief Flight Instructor
  | 'INSTRUCTOR'
  | 'DISPATCHER'
  | 'CAMO'
  | 'ADMIN';

// ─── Aircraft ─────────────────────────────────────────────────────────────────

export type AircraftStatus = 'SERVICEABLE' | 'AOG' | 'MAINTENANCE' | 'FERRY' | 'UNKNOWN';

export interface AircraftData {
  id: string;
  remoteId: string;
  registration: string;        // e.g. VT-XYZ
  type: string;                // C172, PA28, DA40
  base: string;                // AMRAVATI, SAT1, SAT2
  status: AircraftStatus;
  totalAirframeHours: number;
  hoursSince100h: number;
  hoursSinceAnnual: number;
  remainingHours: number;      // Hours until next 100h/annual
  ferryBufferHours: number;    // Blocked when remaining ≤ this (default 2.5)
  isFerryBlocked: boolean;
  lastCrsDate: number | null;  // Unix ms
  openSnagsCount: number;
  syncedAt: number | null;
}

// ─── Flights ──────────────────────────────────────────────────────────────────

export type FlightStatus =
  | 'SCHEDULED'
  | 'DISPATCHED'
  | 'AIRBORNE'
  | 'COMPLETE'
  | 'CANCELLED'
  | 'AOG';

export type FlightType = 'DUAL' | 'SOLO' | 'CHECK' | 'IFOX' | 'LOCAL_SOLO';

export interface FlightData {
  id: string;             // Local WatermelonDB ID
  remoteId: string;       // Django backend ID
  aircraftRegistration: string;
  aircraftType: string;
  instructorName: string;
  studentName: string;
  scheduledStart: number; // Unix ms
  scheduledEnd: number;   // Unix ms
  flightType: FlightType;
  exerciseNumber: string;
  exerciseName: string;
  base: string;
  status: FlightStatus;
  syncedAt: number | null;
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export type DispatchStatus = 'PENDING' | 'PRE_FLIGHT' | 'BRIEFING' | 'RELEASED' | 'CANCELLED';
export type WeatherDecision = 'GO' | 'NO_GO';

export interface PreflightCheck {
  id: string;
  label: string;
  category: 'FUEL' | 'ENGINE' | 'AIRFRAME' | 'DOCUMENTS' | 'PERFORMANCE' | 'GROUND';
  checked: boolean;
}

export interface WeatherData {
  station: string;        // ICAO code e.g. VAAW
  metar: string;          // Raw METAR string
  wind: {
    direction: number;    // Degrees magnetic
    speed: number;        // Knots
    gust?: number;
  };
  qnh: number;            // hPa
  visibility: number;     // km
  ceiling: number | null; // feet AGL, null if CAVOK
  temperature: number;    // Celsius
  dewpoint: number;
  conditions: string[];   // e.g. ['FEW030', 'BKN080']
  fetchedAt: number;      // Unix ms
}

export interface DispatchRecordData {
  id: string;
  remoteId: string | null;
  flightId: string;
  remoteFlightId: string | null;

  // Step 1 – Pre-flight
  preflightChecks: PreflightCheck[];
  preflightNotes: string;
  preflightCompletedAt: number | null;
  preflightBy: string | null;

  // Step 2 – Weather briefing
  weatherData: WeatherData | null;
  notamAcknowledged: boolean;
  weatherDecision: WeatherDecision | null;
  weatherCompletedAt: number | null;

  // Step 3 – Release
  releasedBy: string | null;
  releasedAt: number | null;
  releaseSignature: string | null; // SVG path data
  etaMinutes: number | null;

  // Meta
  status: DispatchStatus;
  isSynced: boolean;
  createdAt: number;
  updatedAt: number;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export type AlertType = 'AOG' | 'SNAG' | 'WEATHER' | 'FDTL' | 'MEDICAL';
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AlertData {
  id: string;
  remoteId: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  aircraftRegistration: string | null;
  affectedFlightsCount: number;
  isRead: boolean;
  isResolved: boolean;
  createdAt: number;      // Unix ms
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncModel = 'dispatch_records';

export interface SyncQueueItemData {
  id: string;
  model: SyncModel;
  operation: SyncOperation;
  recordId: string;
  payload: Record<string, unknown>;
  attempts: number;
  lastError: string | null;
  createdAt: number;
}

// ─── Sync API response format ─────────────────────────────────────────────────

export interface SyncPullResponse {
  flights: ServerFlight[];
  aircraft: ServerAircraft[];
  alerts: ServerAlert[];
  weather: Record<string, WeatherData>;  // keyed by ICAO station
  serverTime: number;
}

export interface ServerFlight {
  id: number;
  aircraft_registration: string;
  aircraft_type: string;
  instructor_name: string;
  student_name: string;
  scheduled_start: string;   // ISO 8601
  scheduled_end: string;
  flight_type: FlightType;
  exercise_number: string;
  exercise_name: string;
  base: string;
  status: FlightStatus;
}

export interface ServerAircraft {
  id: number;
  registration: string;
  type: string;
  base: string;
  status: AircraftStatus;
  total_airframe_hours: number;
  hours_since_100h: number;
  hours_since_annual: number;
  remaining_hours: number;
  ferry_buffer_hours: number;
  is_ferry_blocked: boolean;
  last_crs_date: string | null;
  open_snags_count: number;
}

export interface ServerAlert {
  id: number;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  aircraft_registration: string | null;
  affected_flights_count: number;
  is_resolved: boolean;
  created_at: string;
}

// ─── WebSocket messages ───────────────────────────────────────────────────────

export type WsMessageType =
  | 'aog_alert'
  | 'flight_status_update'
  | 'weather_alert'
  | 'roster_change';

export interface WsMessage {
  type: WsMessageType;
  payload: Record<string, unknown>;
}

export interface WsAogPayload {
  aircraft_registration: string;
  registration: string;
  snag_description: string;
  affected_flight_ids: number[];
  created_at: string;
}
