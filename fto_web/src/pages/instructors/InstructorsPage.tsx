import { useState } from 'react'
import { useInstructors, useInstructorLogbookEntries } from '@/api/hooks/useInstructors'
import { useAssignments } from '@/api/hooks/useRostering'
import { Card, PageLoader, Badge, Modal, Button } from '@/components/ui'
import { EditInstructorForm } from '@/components/instructors/EditInstructorForm'
import { InstructorDailyFlyingChart } from '@/components/instructors/InstructorDailyFlyingChart'
import { AssignmentForm }     from '@/components/roster/AssignmentForm'
import { ImportEGCALogbookModal } from '@/components/users/ImportEGCALogbookModal'
import { DGCAPilotLogbookModal }  from '@/components/logbook/DGCAPilotLogbookModal'
import { DocumentViewerModal }    from '@/components/documents/DocumentViewerModal'
import { UploadDocumentModal }    from '@/components/documents/UploadDocumentModal'
import { Search, Pencil, ShieldCheck, AlertTriangle, Clock, Users, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, FileSpreadsheet, Plane, Printer, FileText, Upload } from 'lucide-react'
import { useAuthStore } from '@/stores'
import { cn, fmt } from '@/lib/utils'
import type { Instructor, UserDocument } from '@/api/types'
import apiClient from '@/api/client'
import { toast } from 'sonner'

export function InstructorsPage() {
  const [search, setSearch]                 = useState('')
  const [page, setPage]                     = useState(1)
  const [ordering, setOrdering]             = useState('user__first_name')
  const [selected, setSelected]             = useState<Instructor | null>(null)
  const [editing, setEditing]               = useState<Instructor | null>(null)
  const [assigning, setAssigning]           = useState<Instructor | null>(null)
  const [importingInstructor, setImportingInstructor] = useState<Instructor | null>(null)
  const [logbookInstructor, setLogbookInstructor]   = useState<Instructor | null>(null)
  const [viewDocsInstructor, setViewDocsInstructor] = useState<Instructor | null>(null)
  const [uploadDocsInstructor, setUploadDocsInstructor] = useState<Instructor | null>(null)
  const [docsList, setDocsList]             = useState<UserDocument[]>([])

  const openDocsViewer = async (instructor: Instructor) => {
    try {
      const resp = await apiClient.get(`/users/instructors/${instructor.id}/documents/`)
      setDocsList(resp.data)
      setViewDocsInstructor(instructor)
    } catch (err: any) {
      toast.error('Failed to load documents')
    }
  }

  const { data: logbookData } = useInstructorLogbookEntries(logbookInstructor?.id ?? '')

  const queryParams: Record<string, string> = {
    page: String(page),
    ordering: ordering,
  }
  if (search) queryParams.search = search

  const { data, isLoading } = useInstructors(queryParams)
  const instructors          = data?.results ?? []
  const totalCount           = data?.count ?? 0
  const pageSize             = 50
  const totalPages           = Math.ceil(totalCount / pageSize) || 1

  const { user }             = useAuthStore()
  const canEdit   = user?.role ? ['superadmin', 'cfi'].includes(user.role) : false
  const canAssign = user?.role ? ['superadmin', 'cfi'].includes(user.role) : false

  // All active assignments, fetched once — used to count/list students per instructor.
  const { data: assignmentsData } = useAssignments()
  const assignments = assignmentsData?.results ?? []
  const studentsFor = (instructorId: string) =>
    assignments.filter(a => a.instructor === instructorId && a.is_active)

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
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Instructors</h1>
        <span className="text-sm text-slate-500">{totalCount} on staff</span>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input 
          value={search} 
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, CFI licence…"
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
                  CFI Licence
                </th>
                <th onClick={() => handleSort('cfi_expiry')} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer select-none">
                  Expiry {renderSortIcon('cfi_expiry')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ratings
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Students
                </th>
                <th onClick={() => handleSort('fdtl_daily_remaining_min')} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 cursor-pointer select-none">
                  FDTL Today {renderSortIcon('fdtl_daily_remaining_min')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {instructors.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400">No instructors found</td></tr>
              ) : instructors.map(i => {
                const students = studentsFor(i.id)
                return (
                  <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => setSelected(i)}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {i.user_detail.first_name} {i.user_detail.last_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {i.fir_licence_number ?? i.cfi_licence_number ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ExpiryDot expiry={i.fir_expiry || i.cfi_expiry || null} />
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
                        <button onClick={e => { e.stopPropagation(); setSelected(i) }} className="text-xs text-primary-600 hover:underline">View</button>
                        {canEdit && (
                          <button onClick={e => { e.stopPropagation(); setEditing(i) }} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
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

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(page - 1) * pageSize + 1}</span> to <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(page * pageSize, totalCount)}</span> of <span className="font-semibold text-slate-700 dark:text-slate-300">{totalCount}</span> instructors
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

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)}
        title={selected ? `${selected.user_detail.first_name} ${selected.user_detail.last_name}` : ''}
        size="xl">
        {selected && (
          <div className="space-y-5">
            <InstructorDetail instructor={selected} />
            <InstructorDailyFlyingChart
              instructorId={selected.id}
              instructorName={`${selected.user_detail.first_name} ${selected.user_detail.last_name}`}
            />
            <StudentRoster
              students={studentsFor(selected.id)}
              canAssign={canAssign}
              onAssignClick={() => { setAssigning(selected); setSelected(null) }}
            />
            <div className="flex flex-wrap justify-between items-center border-t border-slate-200 pt-4 gap-2 dark:border-slate-700">
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setLogbookInstructor(selected); setSelected(null) }} className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Print Logbook
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { openDocsViewer(selected); setSelected(null) }} className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Scanned Credentials
                </Button>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setUploadDocsInstructor(selected); setSelected(null) }} className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Upload Document
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setImportingInstructor(selected); setSelected(null) }} className="gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Import eGCA
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(selected); setSelected(null) }} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Document Viewer Modal */}
      {viewDocsInstructor && (
        <DocumentViewerModal
          open={!!viewDocsInstructor}
          onClose={() => setViewDocsInstructor(null)}
          userName={`${viewDocsInstructor.user_detail.first_name} ${viewDocsInstructor.user_detail.last_name}`}
          documents={docsList}
        />
      )}

      {/* Upload Document Modal */}
      {uploadDocsInstructor && (
        <UploadDocumentModal
          open={!!uploadDocsInstructor}
          onClose={() => setUploadDocsInstructor(null)}
          targetType="instructor"
          targetId={uploadDocsInstructor.id}
          userName={`${uploadDocsInstructor.user_detail.first_name} ${uploadDocsInstructor.user_detail.last_name}`}
          onSuccess={() => {
            toast.success('Document uploaded!')
          }}
        />
      )}

      {/* DGCA Logbook Modal */}
      {logbookInstructor && (
        <DGCAPilotLogbookModal
          open={!!logbookInstructor}
          onClose={() => setLogbookInstructor(null)}
          pilotName={logbookData?.pilot_name || `${logbookInstructor.user_detail.first_name} ${logbookInstructor.user_detail.last_name}`}
          licenceNumber={logbookData?.licence_number || logbookInstructor.cfi_licence_number || 'Active'}
          role={logbookData?.role || 'Instructor Pilot'}
          entries={logbookData?.entries || []}
        />
      )}

      {/* Import eGCA Logbook Modal */}
      {importingInstructor && (
        <ImportEGCALogbookModal
          open={!!importingInstructor}
          onClose={() => setImportingInstructor(null)}
          targetType="instructor"
          targetId={importingInstructor.id}
          pilotName={`${importingInstructor.user_detail.first_name} ${importingInstructor.user_detail.last_name}`}
        />
      )}

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
  const firType = i.fir_rating_type || 'FIR'
  const firNumber = i.fir_licence_number || i.cfi_licence_number || '—'
  const firExpiry = i.fir_expiry || i.cfi_expiry

  return (
    <div className="space-y-5">
      {/* Licence & ratings */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Licence & Ratings
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoRow label={`${firType} Licence #`} value={firNumber} />
          <InfoRow label={`${firType} Expiry`} value={firExpiry ? fmt.date(firExpiry) : '—'} />
          <InfoRow label="Medical Class 1 Expiry" value={i.medical_class1_expiry ? fmt.date(i.medical_class1_expiry) : '—'} />
          
          <InfoRow label="CPL / ATPL #" value={i.cpl_atpl_number ?? '—'} />
          <InfoRow label="CPL / ATPL Expiry" value={i.cpl_atpl_expiry ? fmt.date(i.cpl_atpl_expiry) : '—'} />
          <InfoRow label="IR Expiry" value={i.ir_expiry ? fmt.date(i.ir_expiry) : '—'} />

          <InfoRow label="FRTOL(R) #" value={i.frtol_number ?? '—'} />
          <InfoRow label="FRTOL Expiry" value={i.frtol_expiry ? fmt.date(i.frtol_expiry) : '—'} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {i.instrument_rating && (
            <span className="flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1
              text-xs font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
              <ShieldCheck className="h-3 w-3" /> Instrument Rating
            </span>
          )}
          {i.multi_engine_rating && (
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1
              text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              <ShieldCheck className="h-3 w-3" /> Multi-Engine Rating
            </span>
          )}
          {Number(i.hours_multi_engine || 0) > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1
              text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Plane className="h-3 w-3" /> ME Hours: {Number(i.hours_multi_engine).toFixed(1)} hrs
            </span>
          )}
        </div>
      </div>

      {/* Endorsed Aircraft Types */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
          <Plane className="h-3.5 w-3.5" /> Aircraft Endorsements / Type Ratings
        </p>
        <div className="flex flex-wrap gap-2">
          {i.type_ratings_detail && i.type_ratings_detail.length > 0 ? (
            i.type_ratings_detail.map(t => {
              const showIcao = t.icao_designator && t.icao_designator !== t.make_model
              return (
                <span key={t.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Plane className="h-3 w-3 text-primary-500" />
                  {t.make_model}{showIcao ? ` (${t.icao_designator})` : ''}
                </span>
              )
            })
          ) : (
            <span className="text-xs text-slate-400">No specific aircraft type endorsements recorded</span>
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
