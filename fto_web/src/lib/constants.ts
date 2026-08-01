import type { UserRole } from '@/api/types'

/** Which roles can see which nav items. */
export const NAV_ROLES: Record<string, UserRole[]> = {
  dashboard:   ['superadmin','cfi','instructor','dispatcher','camo','safety_officer','finance', 'student', 'doctor'],
  users:       ['superadmin','cfi'],
  fleet:       ['superadmin','cfi','dispatcher','camo'],
  roster:      ['superadmin','cfi','instructor','dispatcher', 'student'],
  dispatch:    ['superadmin','cfi','instructor','dispatcher', 'student', 'doctor'],
  ba_module:   ['superadmin', 'doctor'],
  weather:     ['superadmin', 'cfi', 'instructor', 'dispatcher'],
  students:    ['superadmin','cfi','instructor', 'dispatcher'],
  instructors: ['superadmin','cfi'],
  syllabus:    ['superadmin','cfi','instructor'],
  maintenance: ['superadmin','camo'],
  inventory:   ['superadmin','cfi','camo','dispatcher'],
  compliance:  ['superadmin','cfi','safety_officer'],
  finance:     ['superadmin','cfi','finance'],
  audit:       ['superadmin','cfi','safety_officer'],
  reports:     ['superadmin', 'cfi', 'safety_officer', 'dispatcher'],
}

export const FLIGHT_TYPE_LABELS: Record<string, string> = {
  dual:               'Dual',
  solo:               'Solo',
  cross_country_dual: 'XC Dual',
  cross_country_solo: 'XC Solo',
  night_dual:         'Night Dual',
  night_solo:         'Night Solo',
  instrument:         'Instrument',
  ferry:              'Ferry',
  proficiency_check:  'P-Check',
}

export const SNAG_CATEGORY_LABELS: Record<string, string> = {
  go:          'Go',
  no_go:       'No-Go',
  observation: 'Observation',
}
