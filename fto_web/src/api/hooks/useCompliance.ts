import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface OccurrenceReport {
  id:                   string
  report_number:        string
  base:                 string
  aircraft:             string | null
  occurrence_type:      string
  severity:             'low' | 'medium' | 'high' | 'critical'
  event_datetime:       string
  event_location:       string | null
  description:          string
  immediate_actions:    string | null
  contributing_factors: string[]
  submitted_by:         string
  submitted_at:         string
  closed_at:            string | null
  is_locked:            boolean
  dgca_submitted:       boolean
  dgca_reference:       string | null
}

export interface SMSSummary {
  total:            number
  by_severity:      { critical: number; high: number; medium: number; low: number }
  open:             number
  dgca_submitted:   number
}

export interface HazardEntry {
  id:            string
  base:          string | null
  title:         string
  description:   string
  likelihood:    number
  severity:      number
  risk_score:    number
  controls:      string | null
  status:        string
  owner:         string | null
  review_date:   string | null
  identified_by: string
  identified_at: string
}

// ── Queries ───────────────────────────────────────────────────────────────────
export function useOccurrences(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['occurrences', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return apiClient.get<PaginatedResponse<OccurrenceReport>>(
        `/compliance/occurrences/${qs}`
      ).then(r => r.data)
    },
  })
}

export function useSMSSummary() {
  return useQuery({
    queryKey: ['sms-summary'],
    queryFn: () =>
      apiClient.get<SMSSummary>('/compliance/occurrences/sms-summary/').then(r => r.data),
    staleTime: 5 * 60_000,
  })
}

export function useHazards() {
  return useQuery({
    queryKey: ['hazards'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<HazardEntry>>('/compliance/hazards/').then(r => r.data),
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export function useSubmitOccurrence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<OccurrenceReport>) =>
      apiClient.post<OccurrenceReport>('/compliance/occurrences/', data).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['occurrences'] })
      qc.invalidateQueries({ queryKey: ['sms-summary'] })
    },
  })
}

export function useCloseOccurrence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, corrective_actions }: { id: string; corrective_actions: string }) =>
      apiClient.post(`/compliance/occurrences/${id}/close/`, { corrective_actions })
        .then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['occurrences'] })
    },
  })
}

export function useMarkDGCASubmitted() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dgca_reference }: { id: string; dgca_reference: string }) =>
      apiClient.post(`/compliance/occurrences/${id}/mark-dgca-submitted/`, { dgca_reference })
        .then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['occurrences'] })
    },
  })
}

export function useSubmitHazard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<HazardEntry>) =>
      apiClient.post<HazardEntry>('/compliance/hazards/', data).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['hazards'] })
    },
  })
}
