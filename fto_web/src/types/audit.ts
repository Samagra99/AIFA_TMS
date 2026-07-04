// src/types/audit.ts
// TypeScript types for the DGCA Audit Dashboard and monthly reports.

// ─────────────────────────────────────────────────────────────────────────────
// Live audit score  (GET /api/compliance/audit/live/)
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveParameterScore {
  code: string;
  name: string;
  score: number;
  max_score: number;
  percentage: number;
  detail: string;
  auto: boolean;
}

export interface LiveCategoryScore {
  code: string;
  name: string;
  icon: string;
  score: number;
  max_score: number;
  percentage: number;
  parameters: LiveParameterScore[];
}

export type AuditRating = 'excellent' | 'good' | 'satisfactory' | 'unsatisfactory';

export interface LiveAuditScore {
  as_of: string;                   // ISO 8601
  total_score: number;             // 0–100
  max_score: number;               // always 100
  percentage: number;              // 0–100
  rating: AuditRating;
  rating_label: string;
  rating_color: string;            // hex colour
  categories: LiveCategoryScore[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Compliance alerts  (GET /api/compliance/alerts/)
// ─────────────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory =
  | 'medical' | 'aircraft' | 'fdtl' | 'spl'
  | 'training' | 'documentation' | 'safety' | 'maintenance';

export interface ComplianceAlert {
  id: number;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  entity_type: string;
  entity_id: number | null;
  entity_name: string;
  due_date: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by_name: string | null;
  created_at: string;
}

export interface AlertSummary {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report types
// ─────────────────────────────────────────────────────────────────────────────

export type ReportType =
  | 'spl-monthly'
  | 'aircraft-utilization'
  | 'instructor-utilization'
  | 'trainee-hours';

export interface ReportMeta {
  report_type: ReportType;
  year: number;
  month: number;
}

// ── 1. SPL Monthly Report ────────────────────────────────────────────────────

export interface SPLStudent {
  student_id: number;
  name: string;
  enrollment_no: string;
  spl_number: string;
  spl_issued_date: string;
  spl_expiry: string;
  instructor: string;
}

export interface SPLReport extends ReportMeta {
  total_spls_issued: number;
  students: SPLStudent[];
}

// ── 2. Aircraft Utilisation Report ───────────────────────────────────────────

export interface AircraftUtilRow {
  aircraft_id: number;
  registration: string;
  aircraft_type: string;
  base: string;
  status: string;
  available_hours: number;
  actual_hours: number;
  total_flights: number;
  utilization_pct: number;
}

export interface AircraftUtilizationReport extends ReportMeta {
  total_aircraft: number;
  total_available_hours: number;
  total_actual_hours: number;
  total_flights: number;
  fleet_utilization_pct: number;
  aircraft: AircraftUtilRow[];
}

// ── 3. Instructor Utilisation Report ─────────────────────────────────────────

export interface InstructorUtilRow {
  instructor_id: number;
  name: string;
  employee_id: string;
  rating: string;
  dual_hours: number;
  check_hours: number;
  solo_hours: number;
  total_flying_hrs: number;
  duty_hours: number;
  fdtl_flying_pct: number;
  fdtl_duty_pct: number;
  active_students: number;
  total_flights: number;
}

export interface InstructorUtilizationReport extends ReportMeta {
  total_instructors: number;
  total_flying_hours: number;
  total_dual_hours: number;
  total_check_hours: number;
  total_duty_hours: number;
  monthly_flying_limit: number;
  monthly_duty_limit: number;
  instructors: InstructorUtilRow[];
}

// ── 4. Trainee Flying Hours Report ───────────────────────────────────────────

export interface TraineeHoursRow {
  student_id: number;
  name: string;
  enrollment_no: string;
  course_type: string;
  instructor: string;
  month_dual_hours: number;
  month_solo_hours: number;
  month_ifox_hours: number;
  month_check_hours: number;
  month_total_hours: number;
  month_total_flights: number;
  cumulative_hours: number;
  course_required_hours: number;
  progress_pct: number;
}

export interface TraineeHoursReport extends ReportMeta {
  total_students: number;
  month_total_hours: number;
  month_dual_hours: number;
  month_solo_hours: number;
  month_ifox_hours: number;
  month_check_hours: number;
  students: TraineeHoursRow[];
}

export type AnyReport =
  | SPLReport
  | AircraftUtilizationReport
  | InstructorUtilizationReport
  | TraineeHoursReport;
