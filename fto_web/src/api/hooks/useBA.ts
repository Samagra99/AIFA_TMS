import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../client'
import type { BAEquipment, BATestEntry, BACandidate, PaginatedResponse } from '../types'

export function useBAEquipment() {
  return useQuery({
    queryKey: ['ba-equipment'],
    queryFn: () => apiClient.get<PaginatedResponse<BAEquipment>>('/dispatch/ba-equipment/').then(r => r.data),
  })
}

export function useBATests(filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['ba-tests', filters],
    queryFn: () => {
      const params = new URLSearchParams(filters)
      return apiClient.get<PaginatedResponse<BATestEntry>>(`/dispatch/ba-tests/?${params}`).then(r => r.data)
    },
  })
}

export function useBASearchCandidates(q: string) {
  return useQuery({
    queryKey: ['ba-candidates', q],
    queryFn: () => apiClient.get<BACandidate[]>(`/dispatch/ba-candidates/?q=${q}`).then(r => r.data),
    enabled: q.length >= 2,
  })
}

export function useCreateBAEquipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<BAEquipment>) => apiClient.post('/dispatch/ba-equipment/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ba-equipment'] }),
  })
}

export function useCreateBATest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post('/dispatch/ba-tests/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ba-tests'] }),
  })
}
