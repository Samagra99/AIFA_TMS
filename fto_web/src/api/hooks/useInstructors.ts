import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { Instructor, PaginatedResponse } from '@/api/types'

export function useInstructors(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['instructors', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return apiClient.get<PaginatedResponse<Instructor>>(`/users/instructors/${qs}`).then(r => r.data)
    },
  })
}

export function useInstructor(id: string) {
  return useQuery({
    queryKey: ['instructor', id],
    queryFn: () => apiClient.get<Instructor>(`/users/instructors/${id}/`).then(r => r.data),
    enabled: !!id,
  })
}
