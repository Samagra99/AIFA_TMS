import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications/').then(r => r.data),
    refetchInterval: 60_000,
  });
}
