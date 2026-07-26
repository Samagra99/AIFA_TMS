import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export function useSyllabusStages() {
  return useQuery({
    queryKey: ['syllabus-stages'],
    queryFn: () => apiClient.get('/syllabus/stages/').then(r => r.data),
  });
}

export function useSyllabusExercises(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['syllabus-exercises', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return apiClient.get(`/syllabus/exercises/${qs}`).then(r => r.data);
    },
  });
}
