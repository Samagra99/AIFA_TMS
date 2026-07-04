import { cn } from '@/lib/utils'

interface Props {
  hobbsTotal:    number
  nextInspAt:    number | null
  ferryBuffer:   number
  className?:    string
}

export function FerryBufferBar({ hobbsTotal, nextInspAt, ferryBuffer, className }: Props) {
  if (!nextInspAt) return null
  const total    = nextInspAt
  const remaining = nextInspAt - hobbsTotal
  const pct      = Math.max(0, Math.min(100, (remaining / (total * 0.2)) * 100))
  const isCritical = remaining <= ferryBuffer
  const isWarning  = remaining <= ferryBuffer * 1.5

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-xs text-slate-500">
        <span>Hours remaining</span>
        <span className={cn('font-mono font-semibold', isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-700')}>
          {remaining.toFixed(1)} hr
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={cn('h-2 rounded-full transition-all', isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isCritical && (
        <p className="text-xs text-red-600 font-medium">⚠ Below ferry buffer ({ferryBuffer} hr) — schedule return</p>
      )}
    </div>
  )
}
