import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export function useInstructorSummary() {
  return useQuery({
    queryKey: ['instructor-summary'],
    queryFn: () => apiClient.get('/dashboard/instructor/summary/').then(r => r.data),
  });
}

export function useInstructorAvailability() {
  return useQuery({
    queryKey: ['instructor-availability'],
    queryFn: () => apiClient.get('/dashboard/instructor/availability/').then(r => r.data),
  });
}

export function useStudentSummary() {
  return useQuery({
    queryKey: ['student-summary'],
    queryFn: () => apiClient.get('/dashboard/student/summary/').then(r => r.data),
  });
}

export function useMaintenanceOverview() {
  return useQuery({
    queryKey: ['maintenance-overview'],
    queryFn: () => apiClient.get('/dashboard/ops/summary/').then(r => r.data),
  });
}
