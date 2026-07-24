import { useState } from 'react'
import { useStudents, useStudentLogbook, useStudentCompliance } from '@/api/hooks'
import { useAssignments } from '@/api/hooks/useRostering'
import { Card, PageLoader, Badge, Modal, Button } from '@/components/ui'
import { EditStudentForm } from '@/components/students/EditStudentForm'
import { AssignmentForm }  from '@/components/roster/AssignmentForm'
import { ImportEGCALogbookModal } from '@/components/users/ImportEGCALogbookModal'
import { Search, CheckCircle2, XCircle, BookOpen, Pencil, UserPlus, GraduationCap, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { useAuthStore } from '@/stores'
import { fmt } from '@/lib/utils'
import type { Student } from '@/api/types'

export function StudentsPage() {
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const [ordering, setOrdering]         = useState('user__first_name')
  const [selected, setSelected]         = useState<Student | null>(null)
  const [editing, setEditing]           = useState<Student | null>(null)
  const [assigning, setAssigning]       = useState<Student | null>(null)
  const [importingStudent, setImportingStudent] = useState<Student | null>(null)
  
  const queryParams: Record<string, string> = {
    page: String(page),
    ordering: ordering,
  }
  if (search) queryParams.search = search

  const { data, isLoading }     = useStudents(queryParams)
  const students                = data?.results ?? []
  const totalCount              = data?.count ?? 0
  const pageSize                = 50
  const totalPages              = Math.ceil(totalCount / pageSize) || 1

  const { user }             = useAuthStore()
  const canEdit   = user?.role ? ['superadmin', 'cfi', 'dispatcher'].includes(user.role) : false
  const canAssign = user?.role ? ['superadmin', 'cfi'].includes(user.role) : false

   // All active assignments — used to look up "who is this student's instructor"
  const { data: assignmentsData } = useAssignments()
  const assignments = assignmentsData?.results ?? []
  const instructorFor = (studentId: string) =>
    assignments.find(a => a.student === studentId && a.is_active)

  const handleSort = (field: string) => {
    if (ordering === field) {
      setOrdering(`-${field}`)
    } else if (ordering === `-${field}`) {
      setOrdering(field)
    } else {
      setOrdering(field)
    }
    setPage(1)
  }

  const renderSortIcon = (field: string) => {
    if (ordering === field) return <ArrowUp className="inline h-3 w-3 ml-1 text-primary-600" />
    if (ordering === `-${field}`) return <ArrowDown className="inline h-3 w-3 ml-1 text-primary-600" />
    return <ArrowUpDown className="inline h-3 w-3 ml-1 text-slate-300 hover:text-slate-500" />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Students</h1>
        <span className="text-sm text-slate-500">{totalCount} enrolled</span>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input 
          value={search} 
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, SPL, batch…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" 
        />
      </div>

      {/* Table */}
      <Card noPad>
        {isLoading ? <PageLoader /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <tr>
                <th onClick={() => handleSort('user__first_name')} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer select-none">
                  Name {renderSortIcon('user__first_name')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Instructor
                </th>
                <th onClick={() => handleSort('batch_number')} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer select-none">
                  Batch {renderSortIcon('batch_number')}
                </th>
                <th onClick={() => handleSort('target_licence')} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer select-none">
                  Target {renderSortIcon('target_licence')}
                </th>
                <th onClick={() => handleSort('spl_expiry')} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer select-none">
                  SPL {renderSortIcon('spl_expiry')}
                </th>
                <th onClick={() => handleSort('medical_expiry')} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer select-none">
                  Medical {renderSortIcon('medical_expiry')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Solo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No students found.
                  </td>
                </tr>
              ) : (
                students.map(s => {
                  const assignment = instructorFor(s.id)
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => setSelected(s)}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {s.user_detail.first_name} {s.user_detail.last_name}
                      </td>
                      <td className="px-4 py-3">
                        {assignment ? (
                          <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <GraduationCap className="h-3.5 w-3.5 text-primary-500" />
                            {assignment.instructor_name}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                        )}
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={e => { e.stopPropagation(); setSelected(s) }} className="text-xs text-primary-600 hover:underline">View</button>
                          {canEdit && (
                            <button onClick={e => { e.stopPropagation(); setEditing(s) }} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                              <Pencil className="h-3 w-3" /> Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(page - 1) * pageSize + 1}</span> to <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(page * pageSize, totalCount)}</span> of <span className="font-semibold text-slate-700 dark:text-slate-300">{totalCount}</span> students
            </p>
            <div className="flex items-center gap-2">
              <Button 
                variant="secondary" 
                size="xs" 
                disabled={!data?.previous || page <= 1} 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Button>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Page {page} of {totalPages}
              </span>
              <Button 
                variant="secondary" 
                size="xs" 
                disabled={!data?.next || page >= totalPages} 
                onClick={() => setPage(p => p + 1)}
                className="gap-1"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Student detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)}
        title={selected ? `${selected.user_detail.first_name} ${selected.user_detail.last_name}` : ''} size="lg">
        {selected && (
          <div className="space-y-4">
            <StudentDetail
              student={selected}
              assignment={instructorFor(selected.id)}
              canAssign={canAssign}
              onAssignClick={() => { setAssigning(selected); setSelected(null) }}
            />
            {canEdit && (
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <Button size="sm" variant="secondary" onClick={() => { setImportingStudent(selected); setSelected(null) }} className="gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Import eGCA Logbook
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setEditing(selected); setSelected(null) }} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit Details
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Import eGCA Logbook Modal */}
      {importingStudent && (
        <ImportEGCALogbookModal
          open={!!importingStudent}
          onClose={() => setImportingStudent(null)}
          targetType="student"
          targetId={importingStudent.id}
          pilotName={`${importingStudent.user_detail.first_name} ${importingStudent.user_detail.last_name}`}
        />
      )}

      {/* Student edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.user_detail.first_name} ${editing.user_detail.last_name}` : ''}
        size="lg">
        {editing && (
          <EditStudentForm student={editing} onSuccess={() => setEditing(null)} />
        )}
      </Modal>

      {/* Assign instructor modal */}
      <Modal open={!!assigning} onClose={() => setAssigning(null)}
        title={assigning ? `Assign Instructor — ${assigning.user_detail.first_name} ${assigning.user_detail.last_name}` : ''}
        size="md">
        {assigning && (
          <AssignmentForm presetStudent={assigning} onSuccess={() => setAssigning(null)} />
        )}
      </Modal>
    </div>
  )
}

function StudentDetail({
  student: s, assignment, canAssign, onAssignClick,
}: {
  student: Student
  assignment?: { instructor_name: string; base_name: string }
  canAssign: boolean
  onAssignClick: () => void
}) {
  const { data: logbook }    = useStudentLogbook(s.id)
  const { data: compliance } = useStudentCompliance(s.id)

  return (
    <div className="space-y-5">
       {/* Assigned instructor */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Assigned Instructor
        </p>
        {assignment ? (
          <div className="flex items-center justify-between rounded-xl border border-primary-200
            bg-primary-50 px-4 py-3 dark:border-primary-800 dark:bg-primary-950">
            <div className="flex items-center gap-2.5">
              <GraduationCap className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <div>
                <p className="text-sm font-semibold text-primary-900 dark:text-primary-100">
                  {assignment.instructor_name}
                </p>
                <p className="text-xs text-primary-600 dark:text-primary-400">{assignment.base_name}</p>
              </div>
            </div>
            {canAssign && (
              <button onClick={onAssignClick} className="text-xs font-medium text-primary-700
                hover:underline dark:text-primary-300">
                Reassign
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-amber-200
            bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              No instructor assigned yet
            </p>
            {canAssign && (
              <Button size="xs" onClick={onAssignClick} className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> Assign
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* Compliance */}
      {compliance && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Document Status</p>
          <div className="grid grid-cols-3 gap-2">
            <ComplianceCard label="SPL"     valid={compliance.spl_valid}     expiry={compliance.spl_expiry} />
            <ComplianceCard label="Medical" valid={compliance.medical_valid} expiry={compliance.medical_expiry} />
            <ComplianceCard label="FRTOL(R)"   valid={compliance.frtol_valid}   expiry={compliance.frtol_expiry} />
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
        <InfoRow label="Solo X-wind limit" value={`${s.solo_max_crosswind_kt} kt crosswind`} />
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
