import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { Student, StudentLogbook, StudentCompliance, PaginatedResponse } from '@/api/types'

export function useStudents(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['students', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : ''
      return apiClient.get<PaginatedResponse<Student>>(`/users/students/${qs}`).then(r => r.data)
    },
  })
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: ['student', id],
    queryFn: () => apiClient.get<Student>(`/users/students/${id}/`).then(r => r.data),
    enabled: !!id,
  })
}

export function useStudentLogbook(id: string) {
  return useQuery({
    queryKey: ['student-logbook', id],
    queryFn: () => apiClient.get<StudentLogbook>(`/users/students/${id}/logbook/`).then(r => r.data),
    enabled: !!id,
  })
}

export function useStudentCompliance(id: string) {
  return useQuery({
    queryKey: ['student-compliance', id],
    queryFn: () => apiClient.get<StudentCompliance>(`/users/students/${id}/compliance/`).then(r => r.data),
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useStudentLogbookEntries(id: string) {
  return useQuery({
    queryKey: ['student-logbook-entries', id],
    queryFn: () => apiClient.get<{
      pilot_name: string
      licence_number: string
      role: string
      entries: any[]
    }>(`/users/students/${id}/logbook-entries/`).then(r => r.data),
    enabled: !!id,
  })
}
