import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { Student, Instructor } from '@/api/types'

// ─── Student profile edits ────────────────────────────────────────────────────
export interface UpdateStudentPayload {
  spl_number?:            string | null
  spl_issue_date?:        string | null
  spl_expiry?:            string | null
  medical_class?:         1 | 2 | null
  medical_expiry?:        string | null
  frtol_number?:          string | null
  frtol_expiry?:          string | null
  solo_approved?:         boolean
  solo_max_crosswind_kt?: string
  batch_number?:          string | null
  target_licence?:        'PPL' | 'CPL'
}

export function useEditStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateStudentPayload & { id: string }) =>
      apiClient.patch<Student>(`/users/students/${id}/`, data).then(r => r.data),
    onSuccess(_, { id }) {
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['student', id] })
      qc.invalidateQueries({ queryKey: ['student-compliance', id] })
    },
  })
}

// ─── Instructor profile edits ─────────────────────────────────────────────────
export interface UpdateInstructorPayload {
  cfi_licence_number?:          string | null
  cfi_expiry?:                  string | null
  instrument_rating?:           boolean
  multi_engine_rating?:         boolean
  fdtl_daily_remaining_min?:    number
  fdtl_weekly_remaining_min?:   number
  fdtl_monthly_remaining_min?:  number
}

export function useEditInstructor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateInstructorPayload & { id: string }) =>
      apiClient.patch<Instructor>(`/users/instructors/${id}/`, data).then(r => r.data),
    onSuccess(_, { id }) {
      qc.invalidateQueries({ queryKey: ['instructors'] })
      qc.invalidateQueries({ queryKey: ['instructor', id] })
    },
  })
}
