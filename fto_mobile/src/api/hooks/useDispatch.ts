import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import type { TechLog, SnagEntry, PaginatedResponse } from '../../types'

export function useTechLog(flightId: string) {
  return useQuery({
    queryKey: ['tech-log', flightId],
    queryFn: () =>
      apiClient.get<{ results: TechLog[] }>(`/dispatch/tech-logs/?flight=${flightId}`)
        .then(r => r.data.results[0] ?? null),
    enabled: !!flightId,
  })
}

export function useClearDispatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dispatcher_pin, preflight_briefing_completed, ba_test_cleared, cfi_override }: { id: string; dispatcher_pin: string; preflight_briefing_completed: boolean; ba_test_cleared: boolean; cfi_override: boolean }) =>
      apiClient.post(`/dispatch/tech-logs/${id}/clear-dispatch/`, { dispatcher_pin, preflight_briefing_completed, ba_test_cleared, cfi_override }).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['tech-log'] })
      qc.invalidateQueries({ queryKey: ['roster'] })
    },
  })
}

export function useAcceptAircraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, hobbs_out, tacho_out, crew_pin }: { id: string; hobbs_out: string; tacho_out: string; crew_pin: string }) =>
      apiClient.post(`/dispatch/tech-logs/${id}/accept-aircraft/`, { hobbs_out, tacho_out, crew_pin }).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['tech-log'] })
    },
  })
}

export function useCloseout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { 
      id: string; 
      hobbs_in: string; 
      tacho_in: string; 
      on_block_time: string;
      crew_pin: string; 
      nil_defects: boolean; 
      snags?: unknown[] 
    }) =>
      apiClient.post(`/dispatch/tech-logs/${id}/closeout/`, body).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['tech-log'] })
      qc.invalidateQueries({ queryKey: ['fleet'] })
      qc.invalidateQueries({ queryKey: ['roster'] })
      qc.invalidateQueries({ queryKey: ['snags'] })
    },
  })
}

export function useCreateTechLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { flight: string; aircraft: string }) =>
      apiClient.post<TechLog>('/dispatch/tech-logs/', data).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['tech-log'] })
    },
  })
}

export function useDeferredSnags(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['snags', 'deferred', params],
    queryFn: () => {
      const q = new URLSearchParams({ category: 'go', ...params }).toString()
      return apiClient.get<PaginatedResponse<SnagEntry>>(`/dispatch/snags/?${q}`).then(r => r.data)
    },
  })
}

export function useSetDeferredSnagTimeline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, resolution_due_date, camo_notes }: { id: string; resolution_due_date: string; camo_notes?: string }) =>
      apiClient.post(`/dispatch/snags/${id}/set-timeline/`, { resolution_due_date, camo_notes }).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['snags'] })
      qc.invalidateQueries({ queryKey: ['fleet'] })
    },
  })
}

export function useReclassifyNoGo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, camo_notes }: { id: string; camo_notes?: string }) =>
      apiClient.post(`/dispatch/snags/${id}/reclassify-no-go/`, { camo_notes }).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['snags'] })
      qc.invalidateQueries({ queryKey: ['fleet'] })
      qc.invalidateQueries({ queryKey: ['aircraft'] })
    },
  })
}

export function useRecordOffBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, off_block_time }: { id: string; off_block_time: string }) =>
      apiClient.post(`/dispatch/tech-logs/${id}/record-off-block/`, { off_block_time }).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['tech-log'] })
      qc.invalidateQueries({ queryKey: ['roster'] })
    },
  })
}
