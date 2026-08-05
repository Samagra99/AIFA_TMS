import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { WeatherCache, BriefingPacket, WeatherEntry } from '../../types';

export function useWeather(icao?: string) {
  return useQuery({
    queryKey: ['weather', icao],
    queryFn: () => apiClient.get<WeatherCache[]>(`/weather/metar/${icao ? `?icao_code=${icao}` : ''}`).then(r => r.data),
    enabled: !!icao,
    refetchInterval: 30_000,
  });
}

export function useNotams(icao?: string) {
  return useQuery({
    queryKey: ['notams', icao],
    queryFn: () => apiClient.get(`/weather/notams/${icao ? `?icao_code=${icao}` : ''}`).then(r => r.data),
    enabled: !!icao,
  });
}

export function useWeatherLatest(icao?: string, baseId?: string) {
  return useQuery({
    queryKey: ['weather-latest', icao, baseId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (icao) params.set('icao', icao)
      if (baseId) params.set('baseid', baseId)
      return apiClient.get<WeatherEntry>(`/weather/metar/latest/?${params.toString()}`).then(r => r.data)
    },
    enabled: !!(icao || baseId),
    refetchInterval: 5 * 60_000,
  })
}
