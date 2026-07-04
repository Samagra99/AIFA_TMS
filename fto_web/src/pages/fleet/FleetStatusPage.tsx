import { useState } from 'react'
import { useFleetStatus } from '@/api/hooks'
import { useUIStore } from '@/stores'
import { AircraftStatusCard } from '@/components/fleet/AircraftStatusCard'
import { PageLoader, Modal } from '@/components/ui'
import { FerryBufferBar } from '@/components/fleet/FerryBufferBar'
import { RefreshCw, Filter } from 'lucide-react'
import { fmt } from '@/lib/utils'
import type { Aircraft, AircraftStatus } from '@/api/types'

const STATUS_FILTERS: { label: string; value: AircraftStatus | 'all' }[] = [
  { label: 'All',          value: 'all' },
  { label: 'Airworthy',    value: 'airworthy' },
  { label: 'AOG',          value: 'aog' },
  { label: 'Ferry Due',    value: 'ferry_required' },
  { label: 'Maintenance',  value: 'scheduled_maintenance' },
]

export function FleetStatusPage() {
  const { activeBaseId }  = useUIStore()
  const [statusFilter, setStatusFilter] = useState<AircraftStatus | 'all'>('all')
  const [selected, setSelected] = useState<Aircraft | null>(null)
  const { data: fleet, isLoading, refetch, isFetching } = useFleetStatus(activeBaseId)

  const filtered = (fleet ?? []).filter(a => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'ferry_required') return a.ferry_buffer_triggered
    return a.status === statusFilter
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Fleet Status</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {fleet?.length ?? 0} aircraft · live view
          </p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => {
          const count = f.value === 'all'
            ? fleet?.length ?? 0
            : f.value === 'ferry_required'
            ? fleet?.filter(a => a.ferry_buffer_triggered).length ?? 0
            : fleet?.filter(a => a.status === f.value).length ?? 0
          return (
            <button key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}>
              {f.label} <span className="ml-1 opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {isLoading ? (
        <PageLoader />
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(a => (
            <AircraftStatusCard key={a.id} aircraft={a} onClick={() => setSelected(a)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Filter className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-slate-500">No aircraft match the current filter.</p>
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)}
        title={selected ? `${selected.tail_number} — ${selected.aircraft_type_name}` : ''}
        size="md">
        {selected && <AircraftDetailView aircraft={selected} />}
      </Modal>
    </div>
  )
}

function AircraftDetailView({ aircraft: a }: { aircraft: Aircraft }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Row label="Status"       value={a.status.replace(/_/g,' ')} />
        <Row label="Home base"    value={a.home_base_name} />
        <Row label="Current base" value={a.current_base_name} />
        <Row label="Hobbs total"  value={`${fmt.hobbs(a.hobbs_total)} hr`} mono />
        <Row label="Tacho total"  value={`${fmt.hobbs(a.tacho_total)} hr`} mono />
        <Row label="Next annual"  value={a.next_annual_due ?? 'N/A'} />
      </div>

      {a.next_50hr_at && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">50-hr Inspection</p>
          <FerryBufferBar
            hobbsTotal={Number(a.hobbs_total)}
            nextInspAt={Number(a.next_50hr_at)}
            ferryBuffer={0}
          />
        </div>
      )}

      {a.status === 'aog' && a.aog_reason && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 dark:bg-red-950 dark:border-red-800">
          <p className="text-xs font-semibold uppercase text-red-600 mb-1">AOG Reason</p>
          <p className="text-sm text-red-800 dark:text-red-200">{a.aog_reason}</p>
          {a.aog_since && (
            <p className="mt-1 text-xs text-red-500">Grounded: {fmt.datetime(a.aog_since)}</p>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-sm font-medium text-slate-900 dark:text-white capitalize ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}
