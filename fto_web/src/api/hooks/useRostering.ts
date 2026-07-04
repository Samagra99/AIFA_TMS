import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface InstructorStudentAssignment {
  id:              string
  instructor:      string
  instructor_name: string
  student:         string
  student_name:    string
  base:            string
  base_name:       string
  is_active:       boolean
}

export interface DailyPlanRequest {
  id:               string
  plan_date:        string
  base:             string
  base_name:        string
  base_icao:        string
  deadline:         string
  status:           'open' | 'closed' | 'rostered'
  notes:            string | null
  submitted_count:  number
  total_instructors:number
  created_at:       string
}

export interface PlanEntry {
  id:                     string
  plan:                   string
  student:                string
  student_name:           string
  exercise:               string
  exercise_code:          string
  exercise_title:         string
  exercise_pass_grade:    number
  preferred_start:        string | null
  estimated_duration_min: number
  prereq_met:             boolean
  cfi_override_requested: boolean
  cfi_override_approved:  boolean
  cfi_override_reason:    string | null
  sequence_order:         number
}

export interface InstructorDailyPlan {
  id:                string
  plan_request:      string
  instructor:        string
  instructor_name:   string
  availability_start:string
  availability_end:  string
  status:            'pending' | 'submitted' | 'approved'
  submitted_at:      string | null
  notes:             string | null
  fdtl_remaining:    number
  entries:           PlanEntry[]
}

export interface StudentProgress {
  student_id:          string
  student_name:        string
  spl_valid:           boolean
  medical_valid:       boolean
  hours_total:         string
  last_exercise_code:  string | null
  last_exercise_title: string | null
  last_grade:          number | null
  next_exercise_id:    string | null
  next_exercise_code:  string | null
  next_exercise_title: string | null
  next_prereq_met:     boolean
}

export interface AISuggestedRoster {
  id:          string
  plan_request:string
  suggestion:  RosterSuggestion
  model_used:  string
  confirmed:   boolean
  created_at:  string
}

export interface RosterSuggestion {
  flights: SuggestedFlight[]
  unscheduled: UnscheduledEntry[]
  notes: string
  optimization_score: number
}

export interface SuggestedFlight {
  instructor_id:   string
  instructor_name: string
  student_id:      string
  student_name:    string
  exercise_id:     string
  exercise_code:   string
  aircraft_id:     string
  aircraft_tail:   string
  base_id:         string
  flight_type:     string
  start_time:      string  // "HH:MM"
  end_time:        string
  duration_min:    number
  reason:          string
}

export interface UnscheduledEntry {
  student_name:   string
  exercise_code:  string
  reason:         string
}

// ─── Queries ──────────────────────────────────────────────────────────────────
export const planRequestsKey = (date?: string) => ['plan-requests', date ?? 'all'] as const

export function usePlanRequests(date?: string) {
  return useQuery({
    queryKey: planRequestsKey(date),
    queryFn: () => {
      const qs = date ? `?plan_date=${date}` : ''
      return apiClient.get<{ results: DailyPlanRequest[] }>(
        `/rostering/plan-requests/${qs}`
      ).then(r => r.data)
    },
  })
}

export function usePlanRequest(id: string) {
  return useQuery({
    queryKey: ['plan-request', id],
    queryFn: () => apiClient.get<DailyPlanRequest>(`/rostering/plan-requests/${id}/`).then(r => r.data),
    enabled: !!id,
  })
}

export function usePlanRequestProgress(id: string) {
  return useQuery({
    queryKey: ['plan-request-progress', id],
    queryFn: () => apiClient.get(`/rostering/plan-requests/${id}/progress/`).then(r => r.data),
    enabled: !!id,
    refetchInterval: 30_000,
  })
}

export function useAllPlansForRequest(id: string) {
  return useQuery({
    queryKey: ['all-plans', id],
    queryFn: () =>
      apiClient.get<InstructorDailyPlan[]>(`/rostering/plan-requests/${id}/all-plans/`)
        .then(r => r.data),
    enabled: !!id,
  })
}

export function useMyStudents() {
  return useQuery({
    queryKey: ['my-students'],
    queryFn: () =>
      apiClient.get<StudentProgress[]>('/rostering/instructor-plans/my-students/').then(r => r.data),
  })
}

// export function useMyPlan(planRequestId: string) {
//   return useQuery({
//     queryKey: ['my-plan', planRequestId],
//     queryFn: () =>
//       apiClient.get<{ results: InstructorDailyPlan[] }>(
//         `/rostering/instructor-plans/?plan_request=${planRequestId}`
//       ).then(r => r.data.results[0] ?? null),
//     enabled: !!planRequestId,
//   })
// }

export function useMyPlan(planRequestId: string) {
  return useQuery({
    queryKey: ['my-plan', planRequestId],
    queryFn: () =>
      apiClient.get<InstructorDailyPlan | null>(
        `/rostering/instructor-plans/my-plan/?plan_request=${planRequestId}`
      ).then(r => r.data),
    enabled: !!planRequestId,
  })
}

export function useAssignments() {
  return useQuery({
    queryKey: ['assignments'],
    queryFn: () =>
      apiClient.get<{ results: InstructorStudentAssignment[] }>('/rostering/assignments/')
        .then(r => r.data),
  })
}

export function useLatestAISuggestion(planRequestId: string) {
  return useQuery({
    queryKey: ['ai-suggestion', planRequestId],
    queryFn: () =>
      apiClient.get<AISuggestedRoster>(
        `/rostering/plan-requests/${planRequestId}/latest-ai-suggestion/`
      ).then(r => r.data).catch(() => null),
    enabled: !!planRequestId,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────
export function useCreatePlanRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { plan_date: string; base: string; deadline: string; notes?: string }) =>
      apiClient.post<DailyPlanRequest>('/rostering/plan-requests/', data).then(r => r.data),
    onSuccess() { qc.invalidateQueries({ queryKey: ['plan-requests'] }) },
  })
}

export function useCreateInstructorPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      plan_request: string
      availability_start: string
      availability_end: string
      notes?: string
    }) =>
      apiClient.post<InstructorDailyPlan>('/rostering/instructor-plans/', data).then(r => r.data),
    onSuccess() { qc.invalidateQueries({ queryKey: ['my-plan'] }) },
  })
}

export function useAddPlanEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      plan: string
      student: string
      exercise: string
      preferred_start?: string
      estimated_duration_min?: number
      cfi_override_requested?: boolean
      cfi_override_reason?: string
    }) =>
      apiClient.post<PlanEntry>('/rostering/plan-entries/', data).then(r => r.data),
    onSuccess() { qc.invalidateQueries({ queryKey: ['my-plan'] }) },
  })
}

export function useDeletePlanEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/rostering/plan-entries/${id}/`),
    onSuccess() { qc.invalidateQueries({ queryKey: ['my-plan'] }) },
  })
}

export function useSubmitPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) =>
      apiClient.post(`/rostering/instructor-plans/${planId}/submit/`).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['my-plan'] })
      qc.invalidateQueries({ queryKey: ['plan-request-progress'] })
    },
  })
}

export function useApproveOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) =>
      apiClient.post(`/rostering/plan-entries/${entryId}/approve-override/`).then(r => r.data),
    onSuccess() { qc.invalidateQueries({ queryKey: ['all-plans'] }) },
  })
}

export function useSaveAISuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      planRequestId: string
      suggestion: RosterSuggestion
      prompt_used: string
    }) =>
      apiClient.post<AISuggestedRoster>(
        `/rostering/plan-requests/${data.planRequestId}/save-ai-suggestion/`,
        { suggestion: data.suggestion, prompt_used: data.prompt_used }
      ).then(r => r.data),
    onSuccess() { qc.invalidateQueries({ queryKey: ['ai-suggestion'] }) },
  })
}

export function useConfirmRoster() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      planRequestId: string
      entries: SuggestedFlight[]
      ai_suggestion_id?: string
    }) =>
      apiClient.post(
        `/rostering/plan-requests/${data.planRequestId}/confirm-roster/`,
        { entries: data.entries, ai_suggestion_id: data.ai_suggestion_id }
      ).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['plan-requests'] })
      qc.invalidateQueries({ queryKey: ['roster'] })
      qc.invalidateQueries({ queryKey: ['fleet'] })
    },
  })
}
