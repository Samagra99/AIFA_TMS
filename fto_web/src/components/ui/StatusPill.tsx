import { cn, statusColor, aircraftStatusColor } from '@/lib/utils'
import type { AircraftStatus, FlightStatus } from '@/api/types'

export function FlightStatusPill({ status }: { status: FlightStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', statusColor(status))}>
      {status}
    </span>
  )
}

export function AircraftStatusPill({ status }: { status: AircraftStatus }) {
  const { pill, dot } = aircraftStatusColor(status)
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', pill)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {status === 'aog' ? 'AOG' : status.replace(/_/g, ' ')}
    </span>
  )
}
