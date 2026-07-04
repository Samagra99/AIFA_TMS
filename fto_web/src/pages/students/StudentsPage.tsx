import { useState } from 'react'
import { useStudents, useStudentLogbook, useStudentCompliance } from '@/api/hooks'
import { Card, PageLoader, Badge, Modal, Button } from '@/components/ui'
import { Search, CheckCircle2, XCircle, BookOpen } from 'lucide-react'
import { fmt } from '@/lib/utils'
import type { Student } from '@/api/types'

export function StudentsPage() {
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Student | null>(null)
  const { data, isLoading }     = useStudents(search ? { search } : undefined)
  const students                = data?.results ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Students</h1>
        <span className="text-sm text-slate-500">{data?.count ?? 0} enrolled</span>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, SPL, batch…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      </div>

      {/* Table */}
      <Card noPad>
        {isLoading ? <PageLoader /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <tr>
                {['Name','Batch','Target','SPL','Medical','Solo','Logbook',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  onClick={() => setSelected(s)}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {s.user_detail.first_name} {s.user_detail.last_name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{s.batch_number ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={s.target_licence === 'CPL' ? 'primary' : 'default'}>{s.target_licence}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <ComplianceDot valid={s.is_spl_current} label={s.spl_expiry ? fmt.date(s.spl_expiry) : '—'} />
                  </td>
                  <td className="px-4 py-3">
                    <ComplianceDot valid={s.is_medically_current} label={s.medical_expiry ? fmt.date(s.medical_expiry) : '—'} />
                  </td>
                  <td className="px-4 py-3">
                    {s.solo_approved
                      ? <Badge variant="success">Approved</Badge>
                      : <Badge variant="warning">Pending</Badge>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">—</td>
                  <td className="px-4 py-3">
                    <button onClick={e => { e.stopPropagation(); setSelected(s) }}
                      className="text-xs text-primary-600 hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Student detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)}
        title={selected ? `${selected.user_detail.first_name} ${selected.user_detail.last_name}` : ''} size="lg">
        {selected && <StudentDetail student={selected} />}
      </Modal>
    </div>
  )
}

function StudentDetail({ student: s }: { student: Student }) {
  const { data: logbook }    = useStudentLogbook(s.id)
  const { data: compliance } = useStudentCompliance(s.id)

  return (
    <div className="space-y-5">
      {/* Compliance */}
      {compliance && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Document Status</p>
          <div className="grid grid-cols-3 gap-2">
            <ComplianceCard label="SPL"     valid={compliance.spl_valid}     expiry={compliance.spl_expiry} />
            <ComplianceCard label="Medical" valid={compliance.medical_valid} expiry={compliance.medical_expiry} />
            <ComplianceCard label="FRTOL"   valid={compliance.frtol_valid}   expiry={compliance.frtol_expiry} />
          </div>
        </div>
      )}

      {/* Logbook */}
      {logbook && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Logbook Totals
          </p>
          <div className="grid grid-cols-4 gap-3">
            {[
              ['Total', logbook.hours_total],
              ['PIC',   logbook.hours_pic],
              ['Dual',  logbook.hours_dual],
              ['Solo',  logbook.hours_solo],
              ['XC',    logbook.hours_cross_country],
              ['Night', logbook.hours_night],
              ['Instr', logbook.hours_instrument],
            ].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800">
                <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">{Number(v).toFixed(1)}</p>
                <p className="text-xs text-slate-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoRow label="Batch"     value={s.batch_number ?? '—'} />
        <InfoRow label="Enrolled"  value={fmt.date(s.enrollment_date)} />
        <InfoRow label="Target"    value={s.target_licence} />
        <InfoRow label="Solo limit" value={`${s.solo_max_crosswind_kt} kt crosswind`} />
      </div>
    </div>
  )
}

function ComplianceDot({ valid, label }: { valid: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {valid
        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        : <XCircle     className="h-3.5 w-3.5 text-red-500" />}
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}

function ComplianceCard({ label, valid, expiry }: { label: string; valid: boolean; expiry: string | null }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${valid
      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
      : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'}`}>
      <p className={`text-xs font-semibold mb-1 ${valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{label}</p>
      <p className="text-xs text-slate-500">{expiry ? fmt.date(expiry) : '—'}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}
