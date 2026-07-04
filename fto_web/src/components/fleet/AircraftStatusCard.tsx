import { cn, fmt, aircraftStatusColor } from '@/lib/utils'
import { AircraftStatusPill } from '@/components/ui'
import { AlertTriangle } from 'lucide-react'
import type { Aircraft } from '@/api/types'

interface Props { aircraft: Aircraft; onClick?: () => void }

export function AircraftStatusCard({ aircraft: a, onClick }: Props) {
  const { dot } = aircraftStatusColor(a.status)
  const hoursLeft = a.hours_to_next_inspection ? Number(a.hours_to_next_inspection) : null

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800',
        a.status === 'aog'
          ? 'border-red-300 dark:border-red-700'
          : a.ferry_buffer_triggered
          ? 'border-amber-300 dark:border-amber-700'
          : 'border-slate-200 dark:border-slate-700',
        onClick && 'cursor-pointer'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', dot)} />
            <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
              {a.tail_number}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {a.aircraft_type_name}
          </p>
        </div>
        <AircraftStatusPill status={a.status} />
      </div>

      {/* AOG reason */}
      {a.status === 'aog' && a.aog_reason && (
        <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{a.aog_reason}</span>
        </div>
      )}

      {/* Ferry buffer warning */}
      {a.ferry_buffer_triggered && a.status !== 'aog' && (
        <div className="mb-3 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          ⚠ Ferry buffer triggered — return to hub required
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
        <Metric label="Hobbs"  value={fmt.hobbs(a.hobbs_total)} unit="hr" />
        <Metric label="To 50hr" value={a.next_50hr_at ? fmt.hobbs(Number(a.next_50hr_at) - Number(a.hobbs_total)) : '—'} unit="hr"
          warn={hoursLeft !== null && hoursLeft < 5} />
        <Metric label="Base" value={a.current_base_name.split(' ')[0]} />
      </div>
    </div>
  )
}

function Metric({ label, value, unit, warn }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn('font-mono text-sm font-semibold', warn ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100')}>
        {value}<span className="text-xs font-normal text-slate-400">{unit}</span>
      </p>
    </div>
  )
}
