import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { User, UserRole, PaginatedResponse, UUID } from '@/api/types'

export interface CreateUserPayload {
  email:      string
  phone?:     string
  first_name: string
  last_name:  string
  role:       UserRole
  home_base?: UUID | null
  password:   string
}

export interface UpdateUserPayload {
  first_name?: string
  last_name?:  string
  phone?:      string
  home_base?:  UUID | null
  is_active?:  boolean
}

export function useUsersList(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['users-list', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return apiClient.get<PaginatedResponse<User>>(`/users/list/${qs}`).then(r => r.data)
    },
  })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => apiClient.get<User>(`/users/list/${id}/`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateUserPayload) =>
      apiClient.post<User>('/users/list/', data).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['users-list'] })
      qc.invalidateQueries({ queryKey: ['instructors'] })
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['assignments'] })
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateUserPayload & { id: string }) =>
      apiClient.patch<User>(`/users/list/${id}/`, data).then(r => r.data),
    onSuccess(_, { id }) {
      qc.invalidateQueries({ queryKey: ['users-list'] })
      qc.invalidateQueries({ queryKey: ['user', id] })
    },
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/users/list/${id}/`, { is_active: false }).then(r => r.data),
    onSuccess() { qc.invalidateQueries({ queryKey: ['users-list'] }) },
  })
}

export function useReactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/users/list/${id}/`, { is_active: true }).then(r => r.data),
    onSuccess() { qc.invalidateQueries({ queryKey: ['users-list'] }) },
  })
}

// ── Role-specific profile field updates ───────────────────────────────────────
export function useUpdateInstructorProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      apiClient.patch(`/users/instructors/${id}/`, data).then(r => r.data),
    onSuccess() { qc.invalidateQueries({ queryKey: ['instructors'] }) },
  })
}

export function useUpdateStudentProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      apiClient.patch(`/users/students/${id}/`, data).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['student'] })
    },
  })
}

// ── Security & Authentication Management ─────────────────────────────────────
export function useSetMyPin() {
  return useMutation({
    mutationFn: (pin: string) =>
      apiClient.post('/auth/me/pin/', { pin }).then(r => r.data),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { old_password?: string; new_password: string }) =>
      apiClient.put('/users/me/password/', data).then(r => r.data),
  })
}

export function useAdminResetPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, new_password }: { userId: string; new_password: string }) =>
      apiClient.post(`/users/list/${userId}/admin-reset-password/`, { new_password }).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['users-list'] })
    },
  })
}