import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SyllabusExercise {
  id:                              string
  lesson:                          string
  exercise_code:                   string
  title:                           string
  description:                     string | null
  default_flight_type:             string
  default_is_cross_country:        boolean
  default_is_night:                boolean
  default_is_instrument_simulated: boolean
  default_is_instrument_actual:    boolean
  default_is_simulator:            boolean
  default_is_skill_test:           boolean
  default_is_instructional:        boolean
  is_ground_event:                 boolean
  prerequisite_ids:                string[]
  pass_grade:                      number
  sequence_order:                  number
}

export interface SyllabusLesson {
  id:             string
  stage:          string
  lesson_number:  number
  title:          string
  sequence_order: number
  exercises:      SyllabusExercise[]
}

export interface LicenceType {
  id:          string
  code:        string
  name:        string
  description: string | null
  is_active:   boolean
}

export interface SyllabusStage {
  id:             string
  licence_type:   string
  stage_number:   number
  title:          string
  description:    string | null
  sequence_order: number
  lessons:        SyllabusLesson[]
}

export interface SortieGrade {
  id:              string
  flight:          string
  exercise:        string
  exercise_title:  string
  student:         string
  grade:           number
  instructor_notes:string | null
  graded_by:       string
  graded_at:       string
  locked_at:       string | null
  passed:          boolean
  is_locked:       boolean
}

export interface StudentExerciseProgress {
  exercise_id:    string
  exercise_code:  string
  title:          string
  best_grade:     number | null
  attempts:       number
  passed:         boolean
  locked:         boolean  // prerequisites not met
}

// ── Queries ───────────────────────────────────────────────────────────────────
export const licenceTypesKey = () => ['licence-types'] as const

export function useLicenceTypes() {
  return useQuery({
    queryKey: licenceTypesKey(),
    queryFn: () => apiClient.get<PaginatedResponse<LicenceType>>('/syllabus/licence-types/').then(r => r.data),
    staleTime: 30 * 60_000,
  })
}

export const stagesKey = (licenceType?: string) => ['syllabus-stages', licenceType ?? 'all'] as const

export function useSyllabusStages(licenceType?: string) {
  return useQuery({
    queryKey: stagesKey(licenceType),
    queryFn: () => {
      const qs = licenceType ? `?licence_type=${licenceType}` : ''
      return apiClient.get<PaginatedResponse<SyllabusStage>>(`/syllabus/stages/${qs}`)
        .then(r => r.data)
    },
    staleTime: 60 * 60_000, // curriculum rarely changes
  })
}

export function useSortieGrades(studentId?: string, flightId?: string) {
  return useQuery({
    queryKey: ['grades', studentId, flightId],
    queryFn: () => {
      const params: Record<string, string> = {}
      if (studentId) params.student = studentId
      if (flightId)  params.flight  = flightId
      const qs = Object.keys(params).length
        ? '?' + new URLSearchParams(params).toString()
        : ''
      return apiClient.get<PaginatedResponse<SortieGrade>>(`/maintenance/grades/${qs}`)
        .then(r => r.data)
    },
    enabled: !!(studentId || flightId),
  })
}

export const exercisesKey = (params?: Record<string, any>) => ['syllabus-exercises', params] as const

export function useSyllabusExercises(params?: Record<string, any>) {
  return useQuery({
    queryKey: exercisesKey(params),
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return apiClient.get<PaginatedResponse<SyllabusExercise>>(`/syllabus/exercises/${qs}`)
        .then(r => r.data)
    },
    staleTime: 60 * 60_000,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export function useSubmitGrades() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (grades: Array<{
      flight:           string
      exercise:         string
      student:          string
      grade:            number
      instructor_notes: string
    }>) =>
      Promise.all(
        grades.map(g =>
          apiClient.post<SortieGrade>('/maintenance/grades/', g).then(r => r.data)
        )
      ),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['grades'] })
      qc.invalidateQueries({ queryKey: ['student-logbook'] })
    },
  })
}
