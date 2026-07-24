import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'

export interface AppNotification {
  id: string
  title: string
  message: string
  category: 'rest_rules' | 'fdtl' | 'license_expiry' | 'aircraft_maint' | 'flight_schedule' | 'safety'
  severity: 'info' | 'warning' | 'critical'
  is_read: boolean
  read_at: string | null
  action_url: string | null
  created_at: string
}

export function useNotifications() {
  return useQuery<{ results: AppNotification[]; count: number }>({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications/').then(r => r.data),
    refetchInterval: 30000, // Background poll every 30 seconds
  })
}

export function useUnreadNotificationCount() {
  return useQuery<{ unread_count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiClient.get('/notifications/unread-count/').then(r => r.data),
    refetchInterval: 15000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/notifications/${id}/read/`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post('/notifications/mark-all-read/').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
