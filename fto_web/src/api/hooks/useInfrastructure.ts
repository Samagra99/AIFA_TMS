import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { Base, Aircraft, AircraftType, PaginatedResponse } from '@/api/types'

// ── Bases ──────────────────────────────────────────────────────────────────────
export const basesKey = () => ['bases'] as const
export function useBases() {
  return useQuery({
    queryKey: basesKey(),
    queryFn: () => apiClient.get<PaginatedResponse<Base>>('/infrastructure/bases/').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })
}

// ── Aircraft types ─────────────────────────────────────────────────────────────
export function useAircraftTypes() {
  return useQuery({
    queryKey: ['aircraft-types'],
    queryFn: () => apiClient.get<PaginatedResponse<AircraftType>>('/infrastructure/aircraft-types/').then(r => r.data),
    staleTime: 30 * 60 * 1000,
  })
}

// ── Fleet ──────────────────────────────────────────────────────────────────────
export const fleetKey = (baseId?: string | null) => ['fleet', baseId ?? 'all'] as const

export function useFleetStatus(baseId?: string | null) {
  return useQuery({
    queryKey: fleetKey(baseId),
    queryFn: () => {
      const params = baseId ? `?base_id=${baseId}` : ''
      return apiClient.get<Aircraft[]>(`/infrastructure/aircraft/fleet-status/${params}`).then(r => r.data)
    },
    refetchInterval: 60_000, // poll every 60s — WebSocket handles live AOG faster
  })
}

export function useAOGAircraft() {
  return useQuery({
    queryKey: ['fleet', 'aog'],
    queryFn: () => apiClient.get<Aircraft[]>('/infrastructure/aircraft/aog/').then(r => r.data),
    refetchInterval: 30_000,
  })
}

export function useMaintenanceAircraft() {
  return useQuery({
    queryKey: ['fleet', 'scheduled_maintenance'],
    queryFn: () => apiClient.get<Aircraft[]>('/infrastructure/aircraft/maintenance/').then(r => r.data),
    refetchInterval: 30_000,
  })
}

export function useAircraft(id: string) {
  return useQuery({
    queryKey: ['aircraft', id],
    queryFn: () => apiClient.get<Aircraft>(`/infrastructure/aircraft/${id}/`).then(r => r.data),
    enabled: !!id,
  })
}
