import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { WeatherCache, BriefingPacket } from '@/api/types'

export function useWeather(activeBaseId: string | null | undefined) {
  return useQuery({
    queryKey: ['weather', activeBaseId],
    queryFn: () => apiClient.get<WeatherCache>(`/weather/metar/latest/?baseid=${activeBaseId}`).then(r => r.data),
    enabled: !!activeBaseId && activeBaseId !== 'all',
    refetchInterval: 30 * 60 * 1000, // 30 min — matches backend Celery task
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
