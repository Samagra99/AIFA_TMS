import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export function useSortieGrades(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['sortie-grades', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return apiClient.get(`/maintenance/grades/${qs}`).then(r => r.data);
    },
  });
}

export function useCreateGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      flight: string;
      student: string;
      exercise: string;
      grade: number;
      instructor_notes?: string;
    }) => apiClient.post('/maintenance/grades/', data).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['sortie-grades'] });
      qc.invalidateQueries({ queryKey: ['my-students'] });
    },
  });
}
