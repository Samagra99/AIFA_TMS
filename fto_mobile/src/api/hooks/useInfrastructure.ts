import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { Base, Aircraft, AircraftType, PaginatedResponse } from '../../types';

export function useBases() {
  return useQuery({
    queryKey: ['bases'],
    queryFn: () => apiClient.get<{ results: Base[] }>('/infrastructure/bases/').then(r => r.data),
  });
}

export function useAircraft(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['aircraft', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return apiClient.get<PaginatedResponse<Aircraft>>(`/infrastructure/aircraft/${qs}`).then(r => r.data);
    },
  });
}

export function useAircraftDetail(id: string) {
  return useQuery({
    queryKey: ['aircraft', id],
    queryFn: () => apiClient.get<Aircraft>(`/infrastructure/aircraft/${id}/`).then(r => r.data),
    enabled: !!id,
  });
}

export function useAircraftTypes() {
  return useQuery({
    queryKey: ['aircraft-types'],
    queryFn: () => apiClient.get<{ results: AircraftType[] }>('/infrastructure/aircraft-types/').then(r => r.data),
  });
}
