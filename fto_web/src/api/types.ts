// ─── Shared ────────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type UUID = string

// ─── Auth ─────────────────────────────────────────────────────────────────────
export type UserRole =
  | 'superadmin' | 'cfi' | 'instructor' | 'dispatcher'
  | 'student'    | 'camo' | 'safety_officer' | 'finance'

export interface TokenPayload {
  user_id:       UUID
  role:          UserRole
  full_name:     string
  home_base_id:  UUID | null
  token_version: number
  exp:           number
}

export interface AuthTokens {
  access:  string
  refresh: string
}

export interface User {
  id:               UUID
  email:            string
  phone:            string | null
  first_name:       string
  last_name:        string
  role:             UserRole
  home_base:        UUID | null
  is_active:        boolean
  created_at:       string
}

// ─── Infrastructure ────────────────────────────────────────────────────────────
export type BaseType = 'hub' | 'satellite'

export interface Base {
  id:                  UUID
  name:                string
  icao_code:           string
  iata_code:           string | null
  base_type:           BaseType
  ferry_buffer_hours:  string
  latitude:            string
  longitude:           string
  elevation_ft:        number
  is_active:           boolean
  is_hub:              boolean
}

export interface AircraftType {
  id:                       UUID
  make_model:               string
  icao_designator:          string | null
  max_crosswind_student_kt: string
  max_crosswind_demo_kt:    string
  da_solo_warning_ft:       number
  interval_50hr:            string
  interval_100hr:           string
  interval_annual_months:   number
}

export type AircraftStatus =
  | 'airworthy' | 'aog' | 'scheduled_maintenance'
  | 'ferry_required' | 'deregistered'

export interface Aircraft {
  id:                       UUID
  tail_number:              string
  aircraft_type:            UUID
  aircraft_type_name:       string
  aircraft_type_detail?:    AircraftType
  home_base:                UUID
  home_base_name:           string
  current_base:             UUID
  current_base_name:        string
  status:                   AircraftStatus
  aog_reason:               string | null
  aog_since:                string | null
  hobbs_total:              string
  tacho_total:              string
  next_50hr_at:             string | null
  next_100hr_at:            string | null
  next_annual_due:          string | null
  ferry_buffer_triggered:   boolean
  hours_to_next_inspection: string | null
  is_active:                boolean
}

// ─── Users ─────────────────────────────────────────────────────────────────────
export interface Instructor {
  id:                         UUID
  user:                       UUID
  user_detail:                User
  cfi_licence_number:         string | null
  cfi_expiry:                 string | null
  fdtl_daily_remaining_min:   number
  fdtl_weekly_remaining_min:  number
  fdtl_monthly_remaining_min: number
  fdtl_daily_remaining_hrs:   number
  instrument_rating:          boolean
  multi_engine_rating:        boolean
}

export interface Student {
  id:                   UUID
  user:                 UUID
  user_detail:          User
  spl_number:           string | null
  spl_issue_date:       string | null
  spl_expiry:           string | null
  medical_class:        1 | 2 | null
  medical_expiry:       string | null
  frtol_number:         string | null
  frtol_expiry:         string | null
  solo_approved:        boolean
  solo_max_crosswind_kt: string
  batch_number:         string | null
  enrollment_date:      string
  target_licence:       'PPL' | 'CPL'
  is_medically_current: boolean
  is_spl_current:       boolean
}

export interface StudentLogbook {
  id:                UUID
  hours_total:       string
  hours_pic:         string
  hours_dual:        string
  hours_solo:        string
  hours_cross_country: string
  hours_night:       string
  hours_instrument:  string
}

export interface StudentCompliance {
  student_id:    UUID
  name:          string
  spl_valid:     boolean
  spl_expiry:    string | null
  medical_valid: boolean
  medical_expiry:string | null
  frtol_valid:   boolean
  frtol_expiry:  string | null
  solo_approved: boolean
}

// ─── Scheduling ────────────────────────────────────────────────────────────────
export type FlightType =
  | 'dual' | 'solo' | 'cross_country_dual' | 'cross_country_solo'
  | 'night_dual' | 'night_solo' | 'instrument' | 'ferry' | 'proficiency_check'

export type FlightStatus =
  | 'scheduled' | 'confirmed' | 'dispatched'
  | 'airborne'  | 'completed' | 'cancelled' | 'aborted'

export interface Flight {
  id:                 UUID
  base:               UUID
  student:            UUID | null
  student_detail?:    Student
  instructor:         UUID
  instructor_detail?: Instructor
  aircraft:           UUID
  aircraft_detail?:   Aircraft
  flight_type:        FlightType
  is_ferry:           boolean
  scheduled_start:    string
  scheduled_end:      string
  status:             FlightStatus
  duration_minutes:   number
  is_solo:            boolean
  cancellation_reason: string | null
  notes:              string | null
  created_at:         string
}

// ─── Scheduling Rule Engine ────────────────────────────────────────────────────
export interface RuleCheckResult {
  rule:   string
  detail: string
}

export interface SchedulingCheckResult {
  all_passed:       boolean
  blocking_failures: RuleCheckResult[]
  warnings:          RuleCheckResult[]
}

// ─── Dispatch ──────────────────────────────────────────────────────────────────
export type TechLogStatus = 'open' | 'closed' | 'aog'
export type SnagCategory  = 'go' | 'no_go' | 'observation'

export interface SnagEntry {
  id:           UUID
  tech_log:     UUID
  aircraft:     UUID
  description:  string
  category:     SnagCategory
  ata_chapter:  string | null
  triggers_aog: boolean
  reported_by:  UUID
  reported_at:  string
  resolved_at:  string | null
}

export interface TechLog {
  id:                       UUID
  flight:                   UUID
  aircraft:                 UUID
  hobbs_out:                string | null
  tacho_out:                string | null
  hobbs_in:                 string | null
  tacho_in:                 string | null
  flight_duration_minutes:  number | null
  dispatch_cleared_by:      UUID | null
  dispatch_cleared_at:      string | null
  accepted_by:              UUID | null
  accepted_at:              string | null
  briefing_acknowledged_at: string | null
  density_altitude_ft:      number | null
  crosswind_ok:             boolean | null
  ferry_buffer_ok:          boolean | null
  student_medical_valid:    boolean | null
  student_spl_valid:        boolean | null
  instructor_fdtl_ok:       boolean | null
  nil_defects:              boolean | null
  status:                   TechLogStatus
  snags:                    SnagEntry[]
}

// ─── Weather ───────────────────────────────────────────────────────────────────
export interface WeatherCache {
  id:                  UUID
  icao_code:           string
  metar_raw:           string | null
  visibility_m:        number | null
  taf_raw:             string | null
  wind_direction_deg:  number | null
  wind_speed_kt:       number | null
  wind_gust_kt:        number | null
  temp_celsius:        string | null
  qnh_hpa:             string | null
  density_altitude_ft: number | null
  observation_time:    string
  fetched_at:          string
  is_stale:            boolean
}

export interface BriefingPacket {
  weather: WeatherCache | null
  notams:  Array<{ id: UUID; notam_id: string; notam_text: string; effective_from: string | null; effective_to: string | null }>
  stale:   boolean
}

// ─── WebSocket events ──────────────────────────────────────────────────────────
export type WSEventType = 'aog' | 'flight_update' | 'weather_update'

export interface WSAOGEvent {
  event:              'aog'
  aircraft_id:        UUID
  tail_number:        string
  reason:             string
  timestamp:          string
  flights_cancelled:  number
}

export type WSEvent = WSAOGEvent | { event: string; [key: string]: unknown }
