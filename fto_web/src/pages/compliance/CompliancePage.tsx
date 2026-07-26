import { useState } from 'react'
import { useOccurrences, useSMSSummary, useHazards, useCloseOccurrence, useMarkDGCASubmitted,
         type OccurrenceReport } from '@/api/hooks/useCompliance'
import { OccurrenceForm } from '@/components/compliance/OccurrenceForm'
import { RiskMatrix }     from '@/components/compliance/RiskMatrix'
import { Card, PageLoader, Modal, Button } from '@/components/ui'
import { ShieldCheck, Plus, CheckCircle2, Send, Lock } from 'lucide-react'
import { fmt } from '@/lib/utils'
import { toast } from 'sonner'

type Tab = 'occurrences' | 'hazards' | 'summary'
const SEV_COLOR: Record<string,string> = {
  low:    'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300',
  medium: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300',
  high:   'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300',
  critical:'bg-red-50 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300',
}

export function CompliancePage() {
  const [tab,          setTab]          = useState<Tab>('occurrences')
  const [showNew,      setShowNew]      = useState(false)
  const [selected,     setSelected]     = useState<OccurrenceReport | null>(null)
  const [sevFilter,    setSevFilter]    = useState('')
  const [closeNotes,   setCloseNotes]   = useState('')
  const [dgcaRef,      setDgcaRef]      = useState('')

  const params = sevFilter ? { severity: sevFilter } : undefined
  const { data: occData,  isLoading: occLoading  } = useOccurrences(params)
  const { data: summary                           } = useSMSSummary()
  const { data: hazData,  isLoading: hazLoading  } = useHazards()
  const closeOcc    = useCloseOccurrence()
  const markDGCA    = useMarkDGCASubmitted()

  const occurrences = occData?.results  ?? []
  const hazards     = hazData?.results  ?? []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Safety & SMS</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">DGCA Safety Management System</p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Report Occurrence
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit dark:border-slate-700 dark:bg-slate-800">
        {([['occurrences','Occurrences'],['hazards','Hazard Register'],['summary','SMS Summary']] as [Tab,string][]).map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab===id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Occurrences ──────────────────────────────────────────────────── */}
      {tab === 'occurrences' && (
        <div className="space-y-4">
          {/* Severity filter */}
          <div className="flex gap-2 flex-wrap">
            {['','low','medium','high','critical'].map(s => (
              <button key={s||'all'} onClick={() => setSevFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  sevFilter===s
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>

          {occLoading ? <PageLoader /> : (
            <Card noPad>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                  <tr>
                    {['Report #','Type','Severity','Date','Description','Status','DGCA',''].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {occurrences.length===0 ? (
                    <tr><td colSpan={8} className="py-16 text-center">
                      <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                      <p className="text-slate-400">No occurrence reports found</p>
                    </td></tr>
                  ) : occurrences.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      onClick={() => setSelected(o)}>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900 dark:text-white">{o.report_number}</td>
                      <td className="px-4 py-3 capitalize text-xs text-slate-600 dark:text-slate-300">{o.occurrence_type.replace(/_/g,' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${SEV_COLOR[o.severity]}`}>
                          {o.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt.date(o.event_datetime)}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-slate-700 dark:text-slate-300" title={o.description}>
                        {o.description}
                      </td>
                      <td className="px-4 py-3">
                        {o.closed_at
                          ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5"/>Closed</span>
                          : o.is_locked
                          ? <span className="flex items-center gap-1 text-xs text-slate-500"><Lock className="h-3.5 w-3.5"/>Locked</span>
                          : <span className="text-xs text-amber-600 font-medium">Open</span>}
                      </td>
                      <td className="px-4 py-3">
                        {o.dgca_submitted
                          ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5"/>Submitted</span>
                          : <span className="text-xs text-slate-400">Pending</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={e=>{e.stopPropagation();setSelected(o)}}
                          className="text-xs text-primary-600 hover:underline">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ── Hazard Register ───────────────────────────────────────────────── */}
      {tab === 'hazards' && (
        hazLoading ? <PageLoader /> :
        <Card>
          <RiskMatrix entries={hazards} />
        </Card>
      )}

      {/* ── SMS Summary ───────────────────────────────────────────────────── */}
      {tab === 'summary' && summary && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Total Reports',  summary.total,          'text-slate-700'],
              ['Open',           summary.open,            'text-amber-600'],
              ['DGCA Submitted', summary.dgca_submitted,  'text-emerald-600'],
              ['Critical',       summary.by_severity.critical,'text-red-600'],
            ].map(([l,v,c]) => (
              <Card key={String(l)} className="text-center">
                <p className={`text-3xl font-bold ${c} dark:text-current`}>{v}</p>
                <p className="mt-1 text-xs text-slate-500">{l}</p>
              </Card>
            ))}
          </div>

          <Card>
            <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">By Severity</p>
            <div className="space-y-3">
              {[['Critical',summary.by_severity.critical,'bg-red-500'],
                ['High',    summary.by_severity.high,    'bg-orange-500'],
                ['Medium',  summary.by_severity.medium,  'bg-amber-500'],
                ['Low',     summary.by_severity.low,     'bg-emerald-500'],
              ].map(([l,v,c]) => (
                <div key={String(l)} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-slate-600 dark:text-slate-400">{l}</span>
                  <div className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className={`h-3 rounded-full ${c} transition-all`}
                      style={{ width: summary.total>0 ? `${(Number(v)/summary.total)*100}%` : '0%' }} />
                  </div>
                  <span className="w-6 text-right font-mono font-bold text-slate-900 dark:text-white">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Occurrence detail modal ───────────────────────────────────────── */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setCloseNotes(''); setDgcaRef('') }}
        title={selected?.report_number ?? ''} size="lg">
        {selected && (
          <div className="space-y-5">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Row label="Type"      value={selected.occurrence_type.replace(/_/g,' ')} />
              <Row label="Severity"  value={<span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${SEV_COLOR[selected.severity]}`}>{selected.severity}</span>} />
              <Row label="Date"      value={fmt.datetime(selected.event_datetime)} />
              <Row label="Location"  value={selected.event_location ?? '—'} />
              <Row label="Submitted" value={fmt.datetime(selected.submitted_at)} />
              <Row label="Locked"    value={selected.is_locked ? '🔒 Yes' : 'No'} />
            </div>

            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-700">
              <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Description</p>
              <p className="text-sm text-slate-800 dark:text-slate-200">{selected.description}</p>
            </div>

            {selected.immediate_actions && (
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-700">
                <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Immediate Actions</p>
                <p className="text-sm text-slate-800 dark:text-slate-200">{selected.immediate_actions}</p>
              </div>
            )}

            {/* Close occurrence */}
            {!selected.closed_at && !selected.is_locked && (
              <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase">Close Occurrence</p>
                <textarea value={closeNotes} onChange={e=>setCloseNotes(e.target.value)} rows={2}
                  placeholder="Corrective actions taken…"
                  className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm dark:border-emerald-700 dark:bg-slate-800 dark:text-white" />
                <Button size="sm" onClick={async()=>{
                  try {
                    await closeOcc.mutateAsync({id:selected.id,corrective_actions:closeNotes})
                    toast.success('Occurrence closed')
                    setSelected(null)
                  } catch { toast.error('Failed to close') }
                }} loading={closeOcc.isPending} disabled={!closeNotes.trim()}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Close Occurrence
                </Button>
              </div>
            )}

            {/* DGCA submission */}
            {!selected.dgca_submitted && (
              <div className="space-y-2 rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950">
                <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase">DGCA Submission</p>
                <input value={dgcaRef} onChange={e=>setDgcaRef(e.target.value)}
                  placeholder="DGCA reference number (if available)"
                  className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm dark:border-primary-700 dark:bg-slate-800 dark:text-white" />
                <Button size="sm" variant="secondary" onClick={async()=>{
                  try {
                    await markDGCA.mutateAsync({id:selected.id,dgca_reference:dgcaRef})
                    toast.success('Marked as submitted to DGCA')
                    setSelected(null)
                  } catch { toast.error('Failed') }
                }} loading={markDGCA.isPending}>
                  <Send className="h-3.5 w-3.5" /> Mark DGCA Submitted
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* New Occurrence Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Report Occurrence" size="lg">
        <OccurrenceForm onSuccess={() => setShowNew(false)} />
      </Modal>
    </div>
  )
}

function Row({ label, value }: { label:string; value:React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="text-sm font-medium text-slate-900 dark:text-white capitalize">{value}</div>
    </div>
  )
}
