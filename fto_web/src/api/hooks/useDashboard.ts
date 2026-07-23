import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { UUID } from '@/api/types'

export interface DashboardStudentRow {
  student_id: UUID
  student_name: string
  batch_number: string | null
  hours_total: string
  last_exercise_code: string | null
  last_exercise_title: string | null
  last_grade: number | null
  last_flown_at: string | null
  medical_expiry: string | null
  spl_expiry: string | null
}

export interface ExpiringItem {
  type: 'cfi_licence' | 'medical' | 'spl'
  label: string
  entity_name: string
  expiry_date: string
  days_left: number
  is_own: boolean
}

export interface AOGAircraftRow {
  aircraft_id: UUID
  tail_number: string
  base_name: string | null
  aog_reason: string | null
  aog_since: string | null
}

export interface InstructorDashboardSummary {
  as_of: string
  hours_flown_today: number
  hours_flown_month: number
  hours_remaining_today: number
  fdtl_daily_cap_hours: number
  students: DashboardStudentRow[]
  expiring_within_60_days: ExpiringItem[]
  aog_aircraft: AOGAircraftRow[]
}

export function useInstructorDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'instructor', 'summary'],
    queryFn: () => apiClient.get<InstructorDashboardSummary>('/dashboard/instructor/summary/').then(r => r.data),
    refetchInterval: 60_000,
  })
}

export interface AvailabilityWindow {
  window: 'last_24h' | 'last_7d' | 'last_28d' | 'last_90d' | 'last_360d'
  window_label: string
  lookback_start: string
  lookback_end: string
  cap_hours: number
  flown_hours: number
  flight_count: number
  remaining_hours: number
  pct_used: number
}

export interface InstructorAvailability {
  instructor_id: UUID
  target_date: string
  windows: AvailabilityWindow[]
}

export function useInstructorAvailability(date: string) {
  return useQuery({
    queryKey: ['dashboard', 'instructor', 'availability', date],
    queryFn: () => apiClient.get<InstructorAvailability>(`/dashboard/instructor/availability/?date=${date}`).then(r => r.data),
    enabled: !!date,
  })
}

export interface StudentLastExercise {
  code: string | null
  title: string | null
  grade: number | null
  passed: boolean | null
  graded_at: string | null
}

export interface StageProgress {
  stage_number: number
  stage_title: string
  passed: number
  total: number
  pct: number
}

export interface CurriculumProgress {
  passed_exercises: number
  total_exercises: number
  progress_pct: number
  stages: StageProgress[]
}

export interface AssignedInstructor {
  instructor_id: UUID
  name: string
  email: string
  cfi_licence_number: string | null
  base_name: string | null
}

export interface StudentDashboardSummary {
  student_id: UUID
  hours_total: string
  hours_pic: string
  hours_dual: string
  hours_solo: string
  target_licence: 'PPL' | 'CPL'
  last_exercise: StudentLastExercise | null
  curriculum_progress: CurriculumProgress
  assigned_instructor: AssignedInstructor | null
}

export function useStudentDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'student', 'summary'],
    queryFn: () => apiClient.get<StudentDashboardSummary>('/dashboard/student/summary/').then(r => r.data),
    refetchInterval: 60_000,
  })
}