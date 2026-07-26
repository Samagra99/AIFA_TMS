import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import type { Flight, SchedulingCheckResult, PaginatedResponse } from '../../types'

export const rosterKey = (date: string, baseId?: string | null) =>
  ['roster', date, baseId ?? 'all'] as const

export function useDailyRoster(date: string, baseId?: string | null) {
  return useQuery({
    queryKey: rosterKey(date, baseId),
    queryFn: () => {
      const params = new URLSearchParams({ date })
      if (baseId) params.set('base_id', baseId)
      return apiClient.get<Flight[]>(`/scheduling/flights/daily-roster/?${params}`).then(r => r.data)
    },
    staleTime: 30_000,
  })
}

export function useFlights(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['flights', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return apiClient.get<PaginatedResponse<Flight>>(`/scheduling/flights/${qs}`).then(r => r.data)
    },
  })
}

export function useFlight(id: string) {
  return useQuery({
    queryKey: ['flight', id],
    queryFn: () => apiClient.get<Flight>(`/scheduling/flights/${id}/`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCheckConstraints() {
  return useMutation({
    mutationFn: (payload: {
      student_id?:    string
      instructor_id?: string
      aircraft_id?:   string
      duration_minutes: number
    }) =>
      apiClient
        .post<SchedulingCheckResult>('/scheduling/flights/check-constraints/', payload)
        .then(r => r.data),
  })
}

export function useConfirmFlight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; cfi_override?: boolean }) =>
      apiClient.post<{ detail: string; scheduling_rules: SchedulingCheckResult }>(
        `/scheduling/flights/${data.id}/confirm/`, { cfi_override: data.cfi_override }
      ).then(r => r.data),
    onSuccess(_, variables) {
      qc.invalidateQueries({ queryKey: ['flight', variables.id] })
      qc.invalidateQueries({ queryKey: ['roster'] })
    },
  })
}

export function useCancelFlight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/scheduling/flights/${id}/cancel/`, { reason }).then(r => r.data),
    onSuccess(_, { id }) {
      qc.invalidateQueries({ queryKey: ['flight', id] })
      qc.invalidateQueries({ queryKey: ['roster'] })
    },
  })
}

export function useCreateFlight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Flight>) =>
      apiClient.post<Flight>('/scheduling/flights/', data).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['roster'] })
      qc.invalidateQueries({ queryKey: ['flights'] })
    },
  })
}

export function useSuspendFlight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/scheduling/flights/${id}/suspend/`, { reason }).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['roster'] })
    },
  })
}

export function useUpdateFlight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { 
      id: string; 
      scheduled_start: string; 
      scheduled_end: string; 
      instructor?: string; 
      aircraft?: string; 
    }) =>
      apiClient.patch(`/scheduling/flights/${id}/`, data).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['roster'] })
    },
  })
}
