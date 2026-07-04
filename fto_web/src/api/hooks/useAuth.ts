import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import apiClient from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import type { AuthTokens, User } from '@/api/types'

export function useLogin() {
  const { setTokens } = useAuthStore()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      apiClient.post<AuthTokens>('/auth/token/', creds).then(r => r.data),
    onSuccess(data) {
      setTokens(data.access, data.refresh)
      navigate('/dashboard', { replace: true })
    },
  })
}

export function useLogout() {
  const { logout, refreshToken } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () =>
      apiClient.post('/auth/logout/', { refresh: refreshToken }).catch(() => {}),
    onSettled() {
      logout()
      qc.clear()
      navigate('/login', { replace: true })
    },
  })
}

export function useMe() {
  const { isAuthenticated } = useAuthStore()
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<User>('/auth/me/').then(r => r.data),
    enabled: isAuthenticated(),
    staleTime: 5 * 60 * 1000,
  })
}
