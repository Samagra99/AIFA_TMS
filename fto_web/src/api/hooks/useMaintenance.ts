import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MaintenanceRecord {
  id:                 string
  aircraft:           string
  aircraft_tail?:     string
  tail_number?:       string
  base:               string
  base_name?:         string
  maintenance_type:   string
  performed_at_hours: string
  performed_at_date:  string
  next_due_hours:     string | null
  next_due_date:      string | null
  work_order_number:  string | null
  description:        string
  parts_replaced:     PartReplaced[]
  labour_hours:       string | null
  total_cost_inr:     string | null
  performed_by:       string | null
  ame_licence_number: string | null
  crs_issued:         boolean
  crs_issued_by:      string | null
  crs_issued_at:      string | null
  crs_document_path:  string | null
}

export interface PartReplaced {
  part_number:  string
  description:  string
  serial_number:string
  quantity:     number
  cost_inr:     number
}

export interface AdSbDirective {
  id:                    string
  aircraft:              string
  reference_number:      string
  issuing_authority:     string
  title:                 string
  directive_type:        'AD' | 'SB' | 'SL'
  compliance_status:     string
  compliance_due_date:   string | null
  compliance_due_hours:  string | null
  next_recurrence_date:  string | null
  notes:                 string | null
}

export interface AmeDutyLog {
  id:                   string
  ame_user:             string
  shift_start:          string
  shift_end:            string | null
  base:                 string
  maintenance_record:   string | null
  total_hours:          string | null
}

// ── Queries ───────────────────────────────────────────────────────────────────
export const maintenanceKey = (aircraftId?: string) =>
  ['maintenance', aircraftId ?? 'all'] as const

export function useMaintenanceRecords(aircraftId?: string) {
  return useQuery({
    queryKey: maintenanceKey(aircraftId),
    queryFn: () => {
      const qs = aircraftId ? `?aircraft=${aircraftId}` : ''
      return apiClient.get<PaginatedResponse<MaintenanceRecord>>(
        `/maintenance/records/${qs}`
      ).then(r => r.data)
    },
  })
}

export function useAdSbDirectives(aircraftId?: string) {
  return useQuery({
    queryKey: ['ad-sb', aircraftId ?? 'all'],
    queryFn: () => {
      const qs = aircraftId ? `?aircraft=${aircraftId}` : ''
      return apiClient.get<PaginatedResponse<AdSbDirective>>(
        `/maintenance/directives/${qs}`
      ).then(r => r.data)
    },
  })
}

export function useAmeDutyLogs() {
  return useQuery({
    queryKey: ['ame-duty'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<AmeDutyLog>>('/maintenance/ame-duty/').then(r => r.data),
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export function useIssueCRS() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recordId: string) =>
      apiClient.post<{ detail: string }>(`/maintenance/records/${recordId}/issue-crs/`)
        .then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['maintenance'] })
      qc.invalidateQueries({ queryKey: ['fleet'] })
    },
  })
}

export function useCreateMaintenanceRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<MaintenanceRecord>) =>
      apiClient.post<MaintenanceRecord>('/maintenance/records/', data).then(r => r.data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: ['maintenance'] })
    },
  })
}
