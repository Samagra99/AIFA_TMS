import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(relativeTime)
dayjs.extend(utc)
dayjs.extend(timezone)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fmt = {
  date:     (s: string) => dayjs(s).format('DD MMM YYYY'),
  time:     (s: string) => dayjs(s).format('HH:mm'),
  datetime: (s: string) => dayjs(s).format('DD MMM HH:mm'),
  fromNow:  (s: string) => dayjs(s).fromNow(),
  hobbs:    (n: string | number) => Number(n).toFixed(1),
  hours:    (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`,
  inr:      (n: string | number) => `₹${Number(n).toLocaleString('en-IN')}`,
}

export function flightTypeBadge(ft: string): string {
  const map: Record<string, string> = {
    dual:               'Dual',
    solo:               'Solo',
    cross_country_dual: 'XC Dual',
    cross_country_solo: 'XC Solo',
    night_dual:         'Night D',
    night_solo:         'Night S',
    instrument:         'Instrument',
    ferry:              'Ferry',
    proficiency_check:  'P-Check',
  }
  return map[ft] ?? ft
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    scheduled:   'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    confirmed:   'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200',
    dispatched:  'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200',
    airborne:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
    completed:   'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
    cancelled:   'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
    aborted:     'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
  }
  return map[status] ?? 'bg-slate-100 text-slate-600'
}

export function aircraftStatusColor(status: string) {
  const map: Record<string, { pill: string; dot: string }> = {
    airworthy:            { pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500' },
    aog:                  { pill: 'bg-red-50 text-red-700 border border-red-300 dark:bg-red-950 dark:text-red-400',    dot: 'bg-red-500 animate-pulse-dot' },
    scheduled_maintenance:{ pill: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400', dot: 'bg-amber-500' },
    ferry_required:       { pill: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950 dark:text-orange-400', dot: 'bg-orange-500' },
    deregistered:         { pill: 'bg-slate-100 text-slate-500 border border-slate-200', dot: 'bg-slate-400' },
  }
  return map[status] ?? map.airworthy
}

export function roleName(role: string): string {
  const map: Record<string, string> = {
    superadmin:     'Super Admin',
    cfi:            'Chief FI',
    instructor:     'Instructor',
    dispatcher:     'Dispatcher',
    student:        'Student',
    camo:           'CAMO',
    safety_officer: 'Safety Officer',
    finance:        'Finance',
    doctor:         'Doctor',
  }
  return map[role] ?? role
}
