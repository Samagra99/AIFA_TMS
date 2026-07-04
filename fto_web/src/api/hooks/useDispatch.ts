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
    mutationFn: (techLogId: string) =>
      apiClient.post(`/dispatch/tech-logs/${techLogId}/clear-dispatch/`).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['tech-log'] })
      qc.invalidateQueries({ queryKey: ['roster'] })
    },
  })
}

export function useAcceptAircraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, hobbs_out, tacho_out }: { id: string; hobbs_out: string; tacho_out: string }) =>
      apiClient.post(`/dispatch/tech-logs/${id}/accept-aircraft/`, { hobbs_out, tacho_out }).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['tech-log'] })
    },
  })
}

export function useCloseout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; hobbs_in: string; tacho_in: string; nil_defects: boolean; snags?: unknown[] }) =>
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
