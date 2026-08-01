import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { WeatherCache, BriefingPacket, WeatherEntry, PaginatedResponse, Runway } from '@/api/types'

export function useWeather(activeBaseId: string | null | undefined) {
  return useQuery({
    queryKey: ['weather', activeBaseId],
    queryFn: () => apiClient.get<WeatherCache>(`/weather/metar/latest/?baseid=${activeBaseId}`).then(r => r.data),
    enabled: !!activeBaseId && activeBaseId !== 'all',
    refetchInterval: 30 * 60 * 1000, // 30 min - matches backend Celery task
    staleTime:       25 * 60 * 1000,
  })
}

export function useBriefingPacket(icao: string) {
  return useQuery({
    queryKey: ['briefing', icao],
    queryFn: () => apiClient.get<BriefingPacket>(`/weather/metar/briefing-packet/?icao=${icao}`).then(r => r.data),
    enabled: !!icao,
    refetchInterval: 30 * 60 * 1000,
  })
}

export function useWeatherLatest(icao?: string, baseId?: string) {
  return useQuery({
    queryKey: ['weather-latest', icao, baseId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (icao) params.set('icao', icao)
      if (baseId) params.set('baseid', baseId)
      return apiClient.get<WeatherEntry>(`/weather/metar/latest/?${params}`).then(r => r.data)
    },
    enabled: !!(icao || baseId),
    refetchInterval: 5 * 60_000,
  })
}

export function useWeatherHistory(icao?: string) {
  return useQuery({
    queryKey: ['weather-history', icao],
    queryFn: () => apiClient.get<PaginatedResponse<WeatherEntry>>(`/weather/metar/?icao_code=${icao}`).then(r => r.data),
    enabled: !!icao,
  })
}

export function useManualWeatherEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post('/weather/metar/manual-entry/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weather-latest'] })
      qc.invalidateQueries({ queryKey: ['weather-history'] })
    },
  })
}

export function useSetActiveRunway() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { base_id: string; runway_id: string }) => apiClient.post('/weather/metar/set-active-runway/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weather-latest'] })
      qc.invalidateQueries({ queryKey: ['bases'] })
    },
  })
}

export function useRunways(baseId?: string) {
  return useQuery({
    queryKey: ['runways', baseId],
    queryFn: () => apiClient.get<PaginatedResponse<Runway>>(`/infrastructure/runways/?base=${baseId}`).then(r => r.data),
    enabled: !!baseId,
  })
}
