import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { WeatherCache, BriefingPacket } from '../../types';

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
