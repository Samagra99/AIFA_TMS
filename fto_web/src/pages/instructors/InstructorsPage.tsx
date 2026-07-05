import { useState } from 'react'
import { useInstructors } from '@/api/hooks/useInstructors'
import { useAssignments } from '@/api/hooks/useRostering'
import { Card, PageLoader, Badge, Modal, Button } from '@/components/ui'
import { EditInstructorForm } from '@/components/instructors/EditInstructorForm'
import { AssignmentForm }     from '@/components/roster/AssignmentForm'
import { Search, Pencil, ShieldCheck, AlertTriangle, Clock, Users, UserPlus } from 'lucide-react'
import { useAuthStore } from '@/stores'
import { cn, fmt } from '@/lib/utils'
import type { Instructor } from '@/api/types'

export function InstructorsPage() {
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<Instructor | null>(null)
  const [editing, setEditing]     = useState<Instructor | null>(null)
  const [assigning, setAssigning] = useState<Instructor | null>(null)

  const { data, isLoading } = useInstructors(search ? { search } : undefined)
  const instructors          = data?.results ?? []
  const { user }             = useAuthStore()
  const canEdit   = user?.role ? ['superadmin', 'cfi'].includes(user.role) : false
  const canAssign = user?.role ? ['superadmin', 'cfi'].includes(user.role) : false

  // All active assignments, fetched once — used to count/list students per instructor.
  const { data: assignmentsData } = useAssignments()
  const assignments = assignmentsData?.results ?? []
  const studentsFor = (instructorId: string) =>
    assignments.filter(a => a.instructor === instructorId && a.is_active)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Instructors</h1>
        <span className="text-sm text-slate-500">{data?.count ?? 0} on staff</span>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, CFI licence…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm
            dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      </div>

      {/* Table */}
      <Card noPad>
        {isLoading ? <PageLoader /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <tr>
                {['Name', 'CFI Licence', 'Expiry', 'Ratings', 'Students', 'FDTL Today', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase
                    tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {instructors.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400">No instructors found</td></tr>
              ) : instructors.map(i => {
                const students = studentsFor(i.id)
                return (
                  <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    onClick={() => setSelected(i)}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {i.user_detail.first_name} {i.user_detail.last_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {i.cfi_licence_number ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ExpiryDot expiry={i.cfi_expiry} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {i.instrument_rating && <Badge variant="primary">IR</Badge>}
                        {i.multi_engine_rating && <Badge variant="default">ME</Badge>}
                        {!i.instrument_rating && !i.multi_engine_rating && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {students.length}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <FdtlBar remainingMin={i.fdtl_daily_remaining_min} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={e => { e.stopPropagation(); setSelected(i) }}
                          className="text-xs text-primary-600 hover:underline">View</button>
                        {canEdit && (
                          <button onClick={e => { e.stopPropagation(); setEditing(i) }}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700
                              dark:text-slate-400 dark:hover:text-slate-200">
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)}
        title={selected ? `${selected.user_detail.first_name} ${selected.user_detail.last_name}` : ''}
        size="lg">
        {selected && (
          <div className="space-y-5">
            <InstructorDetail instructor={selected} />
            <StudentRoster
              students={studentsFor(selected.id)}
              canAssign={canAssign}
              onAssignClick={() => { setAssigning(selected); setSelected(null) }}
            />
            {canEdit && (
              <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
                <Button size="sm" variant="secondary"
                  onClick={() => { setEditing(selected); setSelected(null) }} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit Details
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.user_detail.first_name} ${editing.user_detail.last_name}` : ''}
        size="lg">
        {editing && (
          <EditInstructorForm instructor={editing} onSuccess={() => setEditing(null)} />
        )}
      </Modal>

      {/* Assign student modal */}
      <Modal open={!!assigning} onClose={() => setAssigning(null)}
        title={assigning ? `Assign Student — ${assigning.user_detail.first_name} ${assigning.user_detail.last_name}` : ''}
        size="md">
        {assigning && (
          <AssignmentForm presetInstructor={assigning} onSuccess={() => setAssigning(null)} />
        )}
      </Modal>
    </div>
  )
}

function InstructorDetail({ instructor: i }: { instructor: Instructor }) {
  return (
    <div className="space-y-5">
      {/* Licence & ratings */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Licence & Ratings
        </p>
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="CFI Licence #" value={i.cfi_licence_number ?? '—'} />
          <InfoRow label="Expiry" value={i.cfi_expiry ? fmt.date(i.cfi_expiry) : '—'} />
        </div>
        <div className="mt-3 flex gap-2">
          {i.instrument_rating && (
            <span className="flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1
              text-xs font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
              <ShieldCheck className="h-3 w-3" /> Instrument Rating
            </span>
          )}
          {i.multi_engine_rating && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1
              text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              <ShieldCheck className="h-3 w-3" /> Multi-Engine Rating
            </span>
          )}
          {!i.instrument_rating && !i.multi_engine_rating && (
            <span className="text-xs text-slate-400">No additional ratings on file</span>
          )}
        </div>
      </div>

      {/* FDTL */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> FDTL Remaining
        </p>
        <div className="grid grid-cols-3 gap-3">
          <FdtlCard label="Daily" remainingMin={i.fdtl_daily_remaining_min} capHours={8} />
          <FdtlCard label="Weekly" remainingMin={i.fdtl_weekly_remaining_min} capHours={30} />
          <FdtlCard label="Monthly" remainingMin={i.fdtl_monthly_remaining_min} capHours={100} />
        </div>
      </div>
    </div>
  )
}

function StudentRoster({
  students, canAssign, onAssignClick,
}: {
  students: Array<{ id: string; student_name: string; base_name: string }>
  canAssign: boolean
  onAssignClick: () => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Assigned Students ({students.length})
        </p>
        {canAssign && (
          <button onClick={onAssignClick}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
            <UserPlus className="h-3.5 w-3.5" /> Assign Student
          </button>
        )}
      </div>
      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6
          text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-400">No students assigned yet</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {students.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border
              border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {a.student_name}
              </span>
              <span className="text-xs text-slate-400">{a.base_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExpiryDot({ expiry }: { expiry: string | null }) {
  if (!expiry) return <span className="text-xs text-slate-400">—</span>
  const isExpired = new Date(expiry) < new Date()
  return (
    <div className="flex items-center gap-1.5">
      {isExpired
        ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
        : <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
      <span className={cn('text-xs', isExpired ? 'text-red-600 font-medium' : 'text-slate-500')}>
        {fmt.date(expiry)}
      </span>
    </div>
  )
}

function FdtlBar({ remainingMin }: { remainingMin: number }) {
  const pct = Math.min(100, (remainingMin / 480) * 100) // 480 min = 8hr daily cap
  const isLow = remainingMin < 120
  return (
    <div className="w-24">
      <div className="mb-0.5 flex justify-between text-xs">
        <span className={cn('font-mono font-semibold', isLow ? 'text-amber-600' : 'text-slate-600 dark:text-slate-300')}>
          {Math.floor(remainingMin / 60)}h{remainingMin % 60 > 0 ? `${remainingMin % 60}m` : ''}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={cn('h-1.5 rounded-full transition-all', isLow ? 'bg-amber-500' : 'bg-emerald-500')}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function FdtlCard({ label, remainingMin, capHours }: { label: string; remainingMin: number; capHours: number }) {
  const remainingHours = remainingMin / 60
  const pct = Math.min(100, (remainingHours / capHours) * 100)
  const isLow = pct < 25
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center
      dark:border-slate-700 dark:bg-slate-800">
      <p className={cn('font-mono text-lg font-bold', isLow ? 'text-amber-600' : 'text-slate-900 dark:text-white')}>
        {remainingHours.toFixed(1)}h
      </p>
      <p className="text-xs text-slate-500">{label} · of {capHours}h cap</p>
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
