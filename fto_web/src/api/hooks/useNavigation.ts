import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Airport {
  id: string
  icao_code: string
  iata_code?: string
  name: string
  city?: string
  latitude: string
  longitude: string
  elevation_ft: number
  country: string
  has_fuel: boolean
  has_customs: boolean
  is_verified: boolean
  is_active: boolean
  remarks?: string
  base?: string | null
  base_name?: string
}

export interface RouteLeg {
  id: string
  route: string
  sequence: number
  airport?: string
  airport_icao?: string
  airport_name?: string
  waypoint_name?: string
  latitude?: string
  longitude?: string
  leg_distance_nm?: string
}

export interface RouteAlternate {
  id: string
  route: string
  airport: string
  airport_icao?: string
  airport_name?: string
  alternate_type: 'takeoff' | 'enroute' | 'destination'
}

export interface RouteNearbyAirport {
  id: string
  route: string
  airport: string
  airport_icao?: string
  airport_name?: string
  notes?: string
}

export interface CrossCountryRoute {
  id: string
  name: string
  departure_airport: string
  departure_icao: string
  departure_name: string
  destination_airport: string
  destination_icao: string
  destination_name: string
  is_triangular: boolean
  total_distance_nm?: string
  is_active: boolean
  created_by?: string
  created_by_name?: string
  legs: RouteLeg[]
  alternates: RouteAlternate[]
  nearby_airports: RouteNearbyAirport[]
}

export interface BriefingPacket {
  route_id: string
  route_name: string
  airports: {
    icao_code: string
    weather: any | null
    weather_stale: boolean
    notams: any[]
  }[]
}

// ─── Airport Hooks ────────────────────────────────────────────────────────────
export function useAirports(search?: string) {
  return useQuery({
    queryKey: ['airports', search],
    queryFn: () =>
      apiClient.get<{ results: Airport[] }>('/navigation/airports/', {
        params: { search, page_size: 200 }
      }).then(r => r.data.results ?? r.data),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateAirport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Airport>) =>
      apiClient.post<Airport>('/navigation/airports/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['airports'] }),
  })
}

export function useUpdateAirport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Airport> & { id: string }) =>
      apiClient.patch<Airport>(`/navigation/airports/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['airports'] }),
  })
}

// ─── Cross-Country Route Hooks ─────────────────────────────────────────────────
export function useCrossCountryRoutes() {
  return useQuery({
    queryKey: ['cc-routes'],
    queryFn: () =>
      apiClient.get<{ results: CrossCountryRoute[] }>('/navigation/routes/', {
        params: { page_size: 200 }
      }).then(r => r.data.results ?? r.data),
  })
}

export function useCreateRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CrossCountryRoute>) =>
      apiClient.post<CrossCountryRoute>('/navigation/routes/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-routes'] }),
  })
}

export function useUpdateRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CrossCountryRoute> & { id: string }) =>
      apiClient.patch<CrossCountryRoute>(`/navigation/routes/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-routes'] }),
  })
}

export function useDeleteRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/navigation/routes/${id}/`, { is_active: false }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-routes'] }),
  })
}

export function useRouteBriefing(routeId: string | null) {
  return useQuery({
    queryKey: ['route-briefing', routeId],
    queryFn: () =>
      apiClient.get<BriefingPacket>(`/navigation/routes/${routeId}/briefing/`).then(r => r.data),
    enabled: !!routeId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useRefreshBriefing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (routeId: string) =>
      apiClient.post(`/navigation/routes/${routeId}/briefing/refresh/`).then(r => r.data),
    onSuccess: (_data, routeId) => {
      // Invalidate briefing after a brief delay to let Celery fetch complete
      setTimeout(() => qc.invalidateQueries({ queryKey: ['route-briefing', routeId] }), 3000)
    },
  })
}

// ─── Sub-resource mutations ───────────────────────────────────────────────────
export function useCreateRouteLeg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<RouteLeg>) =>
      apiClient.post<RouteLeg>('/navigation/route-legs/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-routes'] }),
  })
}

export function useDeleteRouteLeg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/navigation/route-legs/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-routes'] }),
  })
}

export function useCreateAlternate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<RouteAlternate>) =>
      apiClient.post<RouteAlternate>('/navigation/alternates/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-routes'] }),
  })
}

export function useDeleteAlternate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/navigation/alternates/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-routes'] }),
  })
}

export function useCreateNearby() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<RouteNearbyAirport>) =>
      apiClient.post<RouteNearbyAirport>('/navigation/nearby/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-routes'] }),
  })
}

export function useDeleteNearby() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/navigation/nearby/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-routes'] }),
  })
}
