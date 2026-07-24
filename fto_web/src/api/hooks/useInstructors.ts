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

export interface InstructorDailyFlyingData {
  instructor_id: string
  instructor_name: string
  start_date: string
  end_date: string
  total_hours: number
  total_sorties: number
  daily_data: Array<{
    date: string
    label: string
    hours: number
    sorties: number
  }>
}

export function useInstructorDailyFlying(id: string, days: number = 30) {
  return useQuery({
    queryKey: ['instructor-daily-flying', id, days],
    queryFn: () => apiClient.get<InstructorDailyFlyingData>(`/users/instructors/${id}/daily-flying/?days=${days}`).then(r => r.data),
    enabled: !!id,
  })
}
