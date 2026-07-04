import { useState } from 'react'
import { useMaintenanceRecords, useAdSbDirectives, useAmeDutyLogs, type MaintenanceRecord } from '@/api/hooks/useMaintenance'
import { useFleetStatus } from '@/api/hooks'
import { CRSModal }        from '@/components/maintenance/CRSModal'
import { NewRecordForm }   from '@/components/maintenance/NewRecordForm'
import { Card, PageLoader, Modal, Button, Badge } from '@/components/ui'
import { useAuthStore } from '@/stores'
import { fmt } from '@/lib/utils'
import { Wrench, Plus, ShieldCheck, AlertTriangle, Filter } from 'lucide-react'

type Tab = 'records' | 'directives' | 'duty'

export function MaintenancePage() {
  const [tab,           setTab]           = useState<Tab>('records')
  const [filterAircraft,setFilterAircraft] = useState('')
  const [showNewRecord, setShowNewRecord]  = useState(false)
  const [crsTarget,     setCrsTarget]      = useState<MaintenanceRecord | null>(null)

  const { user }              = useAuthStore()
  const isCAMO                = user?.role && ['superadmin','camo','cfi'].includes(user.role)
  const { data: fleet }       = useFleetStatus()
  const { data: records, isLoading: recLoading } = useMaintenanceRecords(filterAircraft || undefined)
  const { data: directives,   isLoading: dirLoading } = useAdSbDirectives(filterAircraft || undefined)
  const { data: dutyLogs,     isLoading: dutyLoading } = useAmeDutyLogs()

  const recs = records?.results   ?? []
  const dirs = directives?.results ?? []
  const duty = dutyLogs?.results  ?? []

  const pendingCRS     = recs.filter(r => !r.crs_issued).length
  const pendingAD      = dirs.filter(d => d.compliance_status === 'pending').length
  const overdueAD      = dirs.filter(d => {
    if (!d.compliance_due_date) return false
    return new Date(d.compliance_due_date) < new Date()
  }).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Maintenance — CAMO</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">CAR-ML airworthiness management</p>
        </div>
        {isCAMO && (
          <Button onClick={() => setShowNewRecord(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> New Record
          </Button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <KPI icon={Wrench}       label="Pending CRS"    value={pendingCRS}  color={pendingCRS>0  ?'text-amber-600':'text-slate-400'} />
        <KPI icon={AlertTriangle} label="Pending ADs"   value={pendingAD}   color={pendingAD>0   ?'text-amber-600':'text-slate-400'} />
        <KPI icon={AlertTriangle} label="Overdue ADs"   value={overdueAD}   color={overdueAD>0   ?'text-red-600'  :'text-slate-400'} />
      </div>

      {/* Aircraft filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-slate-400" />
        <select value={filterAircraft} onChange={e => setFilterAircraft(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <option value="">All Aircraft</option>
          {fleet?.map(a => <option key={a.id} value={a.id}>{a.tail_number} — {a.aircraft_type_name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit dark:border-slate-700 dark:bg-slate-800">
        {([['records','Records'],['directives','AD/SB Directives'],['duty','AME Duty Log']] as [Tab,string][]).map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Records tab ─────────────────────────────────────────────────── */}
      {tab === 'records' && (
        recLoading ? <PageLoader /> :
        <Card noPad>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <tr>
                {['Aircraft','Type','Date','Hours','Next Due','Work Order','CRS',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {recs.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400">No maintenance records found</td></tr>
              ) : recs.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{r.tail_number ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">{r.maintenance_type.replace(/_/g,' ')}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmt.date(r.performed_at_date)}</td>
                  <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">{r.performed_at_hours} hr</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.next_due_hours ? `${r.next_due_hours} hr` : ''}
                    {r.next_due_date  ? ` / ${fmt.date(r.next_due_date)}` : ''}
                    {!r.next_due_hours && !r.next_due_date && '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.work_order_number ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.crs_issued
                      ? <Badge variant="success">Issued</Badge>
                      : <Badge variant="warning">Pending</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {isCAMO && !r.crs_issued && (
                      <button onClick={() => setCrsTarget(r)}
                        className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:underline">
                        <ShieldCheck className="h-3.5 w-3.5" /> Issue CRS
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── AD/SB tab ───────────────────────────────────────────────────── */}
      {tab === 'directives' && (
        dirLoading ? <PageLoader /> :
        <Card noPad>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <tr>
                {['Reference','Type','Authority','Title','Status','Due Date','Due Hours'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {dirs.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400">No directives found</td></tr>
              ) : dirs.map(d => {
                const isOverdue = d.compliance_due_date && new Date(d.compliance_due_date) < new Date()
                return (
                  <tr key={d.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800 ${isOverdue ? 'bg-red-50/40 dark:bg-red-950/20' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900 dark:text-white">{d.reference_number}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                        d.directive_type==='AD' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'}`}>
                        {d.directive_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{d.issuing_authority}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-slate-700 dark:text-slate-300" title={d.title}>{d.title}</td>
                    <td className="px-4 py-3 capitalize">
                      <span className={`text-xs font-semibold ${
                        d.compliance_status==='complied' ? 'text-emerald-600' :
                        d.compliance_status==='pending'  ? (isOverdue?'text-red-600':'text-amber-600') : 'text-slate-400'}`}>
                        {d.compliance_status.replace(/_/g,' ')}
                        {isOverdue && d.compliance_status==='pending' && ' ⚠'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{d.compliance_due_date ? fmt.date(d.compliance_due_date) : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.compliance_due_hours ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── AME Duty tab ────────────────────────────────────────────────── */}
      {tab === 'duty' && (
        dutyLoading ? <PageLoader /> :
        <Card noPad>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <tr>
                {['AME','Shift Start','Shift End','Base','Hours'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {duty.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-slate-400">No duty logs found</td></tr>
              ) : duty.map(d => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{d.ame_user}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fmt.datetime(d.shift_start)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.shift_end ? fmt.datetime(d.shift_end) : <span className="text-emerald-600 font-medium">On duty</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{d.base}</td>
                  <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">{d.total_hours ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* CRS Modal */}
      {crsTarget && (
        <CRSModal record={crsTarget} open={!!crsTarget} onClose={() => setCrsTarget(null)} />
      )}

      {/* New Record Modal */}
      <Modal open={showNewRecord} onClose={() => setShowNewRecord(false)}
        title="New Maintenance Record" size="xl">
        <NewRecordForm onSuccess={() => setShowNewRecord(false)} />
      </Modal>
    </div>
  )
}

function KPI({ icon:Icon, label, value, color }: { icon:React.ComponentType<{className?:string}>; label:string; value:number; color:string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`rounded-xl bg-slate-100 p-3 dark:bg-slate-700 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </Card>
  )
}
