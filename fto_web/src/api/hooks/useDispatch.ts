import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { TechLog } from '@/api/types'

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
    // NEW: Added dispatcher_pin
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
    // NEW: Added crew_pin (we'll map this to biometric_ok/PIN validation on the backend if needed)
    mutationFn: ({ id, hobbs_out, tacho_out, crew_pin }: { id: string; hobbs_out: string; tacho_out: string; crew_pin: string }) =>
      apiClient.post(`/dispatch/tech-logs/${id}/accept-aircraft/`, { hobbs_out, tacho_out, crew_pin }).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['tech-log'] })
    },
  })
}

export function useRecordOffBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, off_block_time }: { id: string; off_block_time: string }) =>
      apiClient.post(`/dispatch/tech-logs/${id}/off-block/`, { off_block_time }).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['tech-log'] })
      qc.invalidateQueries({ queryKey: ['roster'] })
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
