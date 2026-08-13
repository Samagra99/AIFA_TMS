import { useState, useCallback, useMemo, useRef } from 'react'
import { useDailyRoster, useConfirmFlight, useCancelFlight, useUpdateFlight, useStartSimulator, useCloseoutSimulator } from '@/api/hooks/useScheduling'
import {
  usePlanRequests,
  useSubmitRosterForReview,
  useApproveRoster,
  useRejectRoster,
  useAllPlansForRequest
} from '@/api/hooks/useRostering'
import { useSyllabusStages } from '@/api/hooks/useSyllabus'
import { RosterCalendar } from '@/components/roster/RosterCalendar'
import { PlanRequestPanel } from '@/components/roster/PlanRequestPanel'
import { InstructorPlanForm } from '@/components/roster/InstructorPlanForm'
import { AISuggestPanel } from '@/components/roster/AISuggestPanel'
import { Card, Button, PageLoader, Modal, FlightStatusPill } from '@/components/ui'
import { useUIStore, useAuthStore } from '@/stores'
import { useFleetStatus } from '@/api/hooks'
import { fmt, flightTypeBadge } from '@/lib/utils'
import { ChevronLeft, ChevronRight, CalendarDays, Users, Sparkles, Plus, ClipboardCheck, User, BookOpen, Clock } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import type { Flight } from '@/api/types'
import { PrintableRosterModal } from '@/components/roster/PrintableRosterModal'
import { useStudents } from '@/api/hooks/useStudents'
import { useInstructors } from '@/api/hooks/useInstructors'
import { AdHocFlightForm } from './AdHocFlightForm'

type Tab = 'calendar' | 'plans' | 'ai'

export function RosterPage() {
  const { user } = useAuthStore()
  const { activeBaseId } = useUIStore()
  const [tab, setTab] = useState<Tab>('calendar')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [resourceMode, setResMode] = useState<'instructor' | 'aircraft'>('instructor')
  const [selectedFlight, setSelFlight] = useState<Flight | null>(null)
  const [selectedReqID, setSelReqID] = useState<string | null>(null)
  const [showNewFlightModal, setShowNewFlightModal] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [rejectComments, setRejectComments] = useState('') // NEW: CFI Rejection comments
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'unplanned' | 'planned'>('unplanned')

  const [prefilledSlot, setPrefilledSlot] = useState<{ start: string, end: string, resourceId: string, studentId?: string, exerciseId?: string } | null>(null)

  // NEW: Dynamic Form States handled in AdHocFlightForm

  const { data: roster, isLoading } = useDailyRoster(date, activeBaseId)
  const { data: fleet } = useFleetStatus(activeBaseId)
  const { data: studentsData } = useStudents()
  const { data: instructorsData } = useInstructors()
  const { data: reqData } = usePlanRequests(date)

  const confirmFlight = useConfirmFlight()
  const cancelFlight = useCancelFlight()
  const updateFlight = useUpdateFlight()
  const startSimulator = useStartSimulator()
  const closeoutSimulator = useCloseoutSimulator()

  // NEW HOOKS
  const submitDraft = useSubmitRosterForReview()
  const approveRoster = useApproveRoster()
  const rejectRoster = useRejectRoster()

  // ── Form State ────────────────────────────────────────────────────────────
  const isInstructor = user?.role && ['instructor', 'cfi'].includes(user.role)
  const isCFI = user?.role && ['cfi', 'superadmin', 'dispatcher'].includes(user.role)

  // ── Active plan request for the selected date ─────────────────────────────
  const activePlanReq = useMemo(() => {
    if (!reqData?.results || reqData.results.length === 0) return null
    if (selectedReqID) {
      return reqData.results.find(r => r.id === selectedReqID) ?? reqData.results[0]
    }
    return reqData.results[0]
  }, [reqData, selectedReqID])

  // NEW: Fetch all submitted plans for the draggable sidebar
  const { data: allPlans } = useAllPlansForRequest(activePlanReq?.id ?? '')
  const externalEventsRef = useRef<HTMLDivElement>(null)

  // Annotate each plan entry with isPlanned status by cross-referencing roster flights
  const annotatedEntries = useMemo(() => {
    if (!allPlans) return []
    const rosterFlights = (roster ?? []).filter(f => f.status !== 'cancelled')
    return allPlans.flatMap(plan =>
      plan.entries.map(entry => {
        // A plan entry is "planned" if there's a non-cancelled flight for the same student + exercise
        const isPlanned = rosterFlights.some(f =>
          f.student === entry.student &&
          f.exercises?.some(fe => fe.exercise === entry.exercise)
        )
        return {
          ...entry,
          instructor_id: plan.instructor,
          instructor_name: plan.instructor_name,
          isPlanned,
        }
      })
    )
  }, [allPlans, roster])

  // Apply sidebar filter
  const draggableEntries = useMemo(() => {
    if (sidebarFilter === 'all') return annotatedEntries
    if (sidebarFilter === 'planned') return annotatedEntries.filter(e => e.isPlanned)
    return annotatedEntries.filter(e => !e.isPlanned) // 'unplanned'
  }, [annotatedEntries, sidebarFilter])

  // NEW: Flatten syllabus stages to provide a clean list of exercises for the Ad-Hoc Modal
  const { data: stagesData } = useSyllabusStages()
  const allExercises = useMemo(() => {
    return stagesData?.results?.flatMap(stage =>
      stage.lessons.flatMap(lesson => lesson.exercises)
    ) || []
  }, [stagesData])

  // ── Calendar resource search & filtering state ──────────────────────────────
  const [resourceSearch, setResourceSearch] = useState('')

  // ── Calendar resources (instructors or aircraft) ──────────────────────────
  const resources = useMemo(() => {
    const q = resourceSearch.trim().toLowerCase()
    if (resourceMode === 'instructor') {
      const list = (instructorsData?.results ?? []).filter(i => {
        if (!q) return true
        const name = i.user_detail ? `${i.user_detail.first_name} ${i.user_detail.last_name}` : ''
        return name.toLowerCase().includes(q)
      })

      // Sort alphabetically by instructor name
      list.sort((a, b) => {
        const nameA = a.user_detail ? `${a.user_detail.first_name} ${a.user_detail.last_name}` : ''
        const nameB = b.user_detail ? `${b.user_detail.first_name} ${b.user_detail.last_name}` : ''
        return nameA.localeCompare(nameB)
      })

      return list.map(i => ({
        id: i.id,
        title: i.user_detail ? `${i.user_detail.first_name} ${i.user_detail.last_name}` : i.id,
        extendedProps: { fdtl_remaining_min: i.fdtl_daily_remaining_hrs ? i.fdtl_daily_remaining_hrs * 60 : undefined }
      }))
    } else {
      const list = (fleet ?? []).filter(a => {
        if (a.status !== 'airworthy') return false
        if (!q) return true
        const tailMatch = a.tail_number.toLowerCase().includes(q)
        const typeMatch = (a.aircraft_type_name ?? '').toLowerCase().includes(q)
        return tailMatch || typeMatch
      })

      // Sort alphabetically by aircraft_type_name first, then tail_number
      list.sort((a, b) => {
        const typeA = a.aircraft_type_name || ''
        const typeB = b.aircraft_type_name || ''
        if (typeA !== typeB) return typeA.localeCompare(typeB)
        return a.tail_number.localeCompare(b.tail_number)
      })

      return list.map(a => ({
        id: a.id,
        title: a.tail_number,
        group: a.aircraft_type_name || 'General Fleet',
        extendedProps: {
          status: a.status,
          hours_remaining: a.hours_to_next_inspection ? parseFloat(a.hours_to_next_inspection) : undefined,
          ferry_buffer_triggered: (a as any).ferry_buffer_triggered ?? false,
        }
      }))
    }
  }, [resourceMode, instructorsData, fleet, resourceSearch])


  const onEventDrop = useCallback(async (
    flightId: string, newStart: Date, newEnd: Date, newResourceId: string
  ) => {
    try {
      // Determine what the new resource ID represents based on the current calendar view
      const payload: any = {
        scheduled_start: newStart.toISOString(),
        scheduled_end: newEnd.toISOString()
      };

      if (resourceMode === 'instructor') {
        payload.instructor = newResourceId;
      } else {
        payload.aircraft = newResourceId;
      }

      await updateFlight.mutateAsync({
        id: flightId,
        ...payload
      });

      toast.success(`Flight moved successfully!`);
    } catch (err: any) {
      toast.error('Failed to move flight', {
        description: err?.response?.data?.conflict ?? 'Constraint check failed or conflict detected.'
      });

      // If it fails, React Query invalidating the 'roster' key 
      // will automatically snap the event back to its original DB position!
    }
  }, [resourceMode, updateFlight])

  const moveDay = (d: number) => setDate(dayjs(date).add(d, 'day').format('YYYY-MM-DD'))

  const resetFormState = () => {
    setShowNewFlightModal(false)
    setPrefilledSlot(null)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">

      {/* ── Top bar: date nav + tab switcher + resource toggle ────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => moveDay(-1)}
            className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50
              dark:border-slate-700 dark:hover:bg-slate-800">
            <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm
              font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800
              dark:text-slate-200" />
          <button onClick={() => moveDay(1)}
            className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50
              dark:border-slate-700 dark:hover:bg-slate-800">
            <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button onClick={() => setDate(dayjs().format('YYYY-MM-DD'))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm
              text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800
              dark:text-slate-300">
            Today
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1
          dark:border-slate-700 dark:bg-slate-800">
          {([
            ['calendar', 'Calendar', CalendarDays],
            ['plans', 'Instructor Plans', Users],
            // Only include the AI tab if the user is a dispatcher
            user?.role === 'dispatcher' ? ['ai', 'AI Roster', Sparkles] : null,
          ].filter(Boolean) as [Tab, string, React.ComponentType<{ className?: string }>][]).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm
                font-medium transition-colors ${tab === id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}>
              <Icon className="h-4 w-4" />
              {label}
              {id === 'ai' && (
                <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[9px]
                  font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                  AI
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Resource toggle (calendar tab only) */}
        {tab === 'calendar' && (
          <div className="ml-auto flex items-center gap-3">
            {isCFI && (
              <Button onClick={() => { setPrefilledSlot(null); setShowNewFlightModal(true); }} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Ad-Hoc Flight
              </Button>
            )}
            <div className="ml-auto flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
              {(['instructor', 'aircraft'] as const).map(m => (
                <button key={m} onClick={() => { setResMode(m); setResourceSearch(''); }}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${resourceMode === m ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Content area ──────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden">

        {/* ── CALENDAR TAB ─────────────────────────────────────────────── */}
        {tab === 'calendar' && (
          isLoading ? <PageLoader /> :
            <div className="flex h-full gap-4 overflow-hidden">
              {/* NEW: The External Draggable Sidebar for Dispatchers */}
              {user?.role === 'dispatcher' && (
                <div className="w-64 shrink-0 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span>Instructor Plans</span>
                      <span className="rounded-full bg-primary-100 dark:bg-primary-950 px-2 py-0.5 text-xs font-bold text-primary-700 dark:text-primary-300">
                        {draggableEntries.length}
                      </span>
                    </h3>
                    <div className="flex gap-1 mt-2">
                      {(['unplanned', 'planned', 'all'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setSidebarFilter(f)}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize transition-colors ${sidebarFilter === f
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                            }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5" ref={externalEventsRef}>
                    {draggableEntries.map(entry => (
                      <div
                        key={entry.id}
                        className={`${entry.isPlanned ? '' : 'fc-external-event cursor-grab'} rounded-xl border ${entry.isPlanned ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30 opacity-60' : 'border-primary-200 bg-white dark:border-primary-800 dark:bg-slate-900'} p-3 shadow-sm hover:shadow-md transition-all space-y-1.5`}
                        data-plan={JSON.stringify(entry)}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {entry.instructor_name}
                          </span>
                          <span className="rounded-md bg-primary-100 dark:bg-primary-950 px-2 py-0.5 font-mono text-xs font-bold text-primary-700 dark:text-primary-300 shrink-0">
                            {entry.exercise_code}
                          </span>
                          {entry.isPlanned && (
                            <span className="rounded-md bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                              Planned ✓
                            </span>
                          )}
                        </div>

                        {/* Student Name */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 font-semibold">
                          <User className="h-3.5 w-3.5 text-primary-500 shrink-0" />
                          <span className="truncate">{entry.student_name}</span>
                        </div>

                        {/* Planned Exercise Title */}
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate flex items-center gap-1">
                          <BookOpen className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{entry.exercise_title || entry.exercise_code}</span>
                        </div>

                        {/* Preferred Start Time */}
                        {entry.preferred_start && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>Pref: {entry.preferred_start} ({entry.estimated_duration_min ?? 60}m)</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {draggableEntries.length === 0 && (
                      <div className="text-center text-xs text-slate-400 p-6">No pending submitted plans.</div>
                    )}
                  </div>
                </div>
              )}
              {/* Calendar */}
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border
              border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <RosterCalendar
                  key={date}
                  date={date}
                  flights={roster ?? []}
                  resources={resources}
                  resourceMode={resourceMode}
                  resourceSearch={resourceSearch}
                  onResourceSearchChange={setResourceSearch}
                  editable={!!isCFI}
                  externalEventsRef={externalEventsRef}
                  onEventDrop={onEventDrop}
                  onEventClick={id => {
                    const f = roster?.find(fl => fl.id === id)
                    if (f) setSelFlight(f)
                  }}
                  // NEW: Open the Ad-Hoc modal when the dispatcher highlights an empty timeslot
                  onTimeSlotSelect={(start, end, resourceId) => {
                    setPrefilledSlot({
                      start: dayjs(start).format('YYYY-MM-DDTHH:mm'),
                      end: dayjs(end).format('YYYY-MM-DDTHH:mm'),
                      resourceId
                    })
                    setShowNewFlightModal(true)
                  }}
                  onExternalDrop={(info) => {
                    // FIX: Parse the data directly from the DOM element's data-plan attribute
                    const planRaw = info.draggedEl.getAttribute('data-plan');
                    const planData = planRaw ? JSON.parse(planRaw) : null;

                    // Pre-fill the modal with BOTH the calendar time and the plan details
                    setPrefilledSlot({
                      start: dayjs(info.date).format('YYYY-MM-DDTHH:mm'),
                      end: dayjs(info.date).add(planData?.estimated_duration_min || 60, 'minute').format('YYYY-MM-DDTHH:mm'),
                      resourceId: info.resource?.id || planData?.instructor_id || '',
                      studentId: planData?.student || '',
                      exerciseId: planData?.exercise || ''
                    })
                    setShowNewFlightModal(true)
                  }}
                />
              </div>

              {/* Side summary */}
              <div className="w-64 shrink-0 space-y-3 overflow-y-auto">
                <Card className="!p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Summary
                  </p>
                  <div className="space-y-1">
                    {['draft', 'scheduled', 'confirmed', 'dispatched', 'airborne', 'completed', 'cancelled', 'suspended']
                      .map(s => {
                        const n = (roster ?? []).filter(f => f.status === s).length
                        return n > 0 ? (
                          <div key={s} className="flex items-center justify-between text-xs">
                            <span className="capitalize text-slate-500">{s}</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{n}</span>
                          </div>
                        ) : null
                      })}
                  </div>
                </Card>

                {/* Compact flight list */}
                <div className="space-y-1.5">
                  {(roster ?? [])
                    .filter(f => f.status !== 'cancelled')
                    .map(f => (
                      <button key={f.id} onClick={() => setSelFlight(f)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3
                        py-2.5 text-left hover:border-primary-300 hover:shadow-sm
                        dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-mono text-xs font-bold text-slate-700
                          dark:text-slate-200">
                            {fmt.time(f.scheduled_start)}
                          </span>
                          <FlightStatusPill status={f.status} />
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] mr-1
                          dark:bg-slate-700">
                            {flightTypeBadge(f.flight_type)}
                          </span>
                          {f.aircraft_name}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
        )}

        {/* ── PLANS TAB (CFI REVIEW HUB) ────────────────────────────────────────────────── */}
        {tab === 'plans' && (
          <div className="flex h-full gap-6 overflow-hidden">
            {/* Left: plan request list (CFI) */}
            {isCFI && (
              <div className="w-80 shrink-0 overflow-y-auto">
                <PlanRequestPanel
                  onSelectRequest={(req) => setSelReqID(req?.id ?? null)}
                  selectedRequestId={activePlanReq?.id}
                />
              </div>
            )}

            {/* Right: instructor's own submission OR CFI overview */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activePlanReq ? (
                <div>
                  <div className="mb-4 rounded-xl border border-primary-200 bg-primary-50
                    px-4 py-3 dark:border-primary-800 dark:bg-primary-950">
                    <p className="text-sm font-semibold text-primary-900 dark:text-primary-100">
                      Plan Request — {fmt.date(activePlanReq.plan_date)}
                    </p>
                    <p className="text-xs text-primary-700 dark:text-primary-300">
                      Deadline: {fmt.datetime(activePlanReq.deadline)}
                    </p>
                    {activePlanReq.notes && (
                      <p className="mt-1 text-xs italic text-primary-600 dark:text-primary-400">
                        "{activePlanReq.notes}"
                      </p>
                    )}

                    {/* NEW: CFI / Dispatcher Action Bar */}
                    {user?.role === 'dispatcher' && ((activePlanReq.status === 'open' && (roster ?? []).some(f => f.status === 'draft')) || activePlanReq.status === 'closed' || activePlanReq.status === 'rejected_by_cfi') && (
                      <div className="mt-4 pt-4 border-t border-primary-200 dark:border-primary-800">
                        <Button
                          onClick={async () => {
                            await submitDraft.mutateAsync(activePlanReq.id)
                            toast.success("Draft roster sent to CFI for approval")
                          }}
                          loading={submitDraft.isPending}
                        >
                          Submit Draft to CFI for Approval
                        </Button>
                      </div>
                    )}

                    {(user?.role === 'cfi' || user?.role === 'superadmin') && activePlanReq.status === 'pending_cfi_approval' && (
                      <div className="mt-4 pt-4 border-t border-primary-200 dark:border-primary-800 flex gap-2">
                        <input
                          type="text"
                          placeholder="Rejection comments..."
                          value={rejectComments}
                          onChange={e => setRejectComments(e.target.value)}
                          className="flex-1 rounded-lg border border-primary-200 px-3 py-2 text-sm text-black"
                        />
                        <Button variant="danger"
                          onClick={async () => {
                            if (!rejectComments) { toast.error("Comments required to reject"); return; }
                            await rejectRoster.mutateAsync({ id: activePlanReq.id, comments: rejectComments })
                            toast.success("Returned to dispatcher")
                            setSelReqID(activePlanReq.id)
                          }}
                          loading={rejectRoster.isPending}
                        >
                          Reject
                        </Button>
                        <Button variant="primary"
                          onClick={async () => {
                            await approveRoster.mutateAsync({ id: activePlanReq.id })
                            toast.success("Roster Approved & Confirmed!")
                            setSelReqID(activePlanReq.id)
                          }}
                          loading={approveRoster.isPending}
                        >
                          Approve Roster
                        </Button>
                      </div>
                    )}

                    {activePlanReq.status === 'rostered' && user?.role === 'dispatcher' && (
                      <div className="mt-4 pt-4 border-t border-primary-200 dark:border-primary-800">
                        <Button variant="primary" onClick={() => setShowPrintModal(true)}>Print Final Roster</Button>
                      </div>
                    )}
                  </div>

                  {activePlanReq.cfi_comments && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
                      <p className="text-xs font-bold text-red-800 dark:text-red-200">CFI Comments:</p>
                      <p className="text-sm text-red-700 dark:text-red-300">{activePlanReq.cfi_comments}</p>
                    </div>
                  )}

                  {/* Body Content */}
                  {isInstructor ? (
                    <InstructorPlanForm
                      planRequestId={activePlanReq.id}
                      planRequestStatus={activePlanReq.status}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center dark:border-slate-700 dark:bg-slate-800/20">
                      <ClipboardCheck className="mb-4 h-12 w-12 text-slate-300" />
                      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Dispatcher Overview</h3>
                      <p className="mt-2 max-w-md text-sm text-slate-500">
                        Instructors are submitting their individual plans for this date.
                        To build the roster, switch to the <strong>AI Roster</strong> tab to auto-generate it, or use the <strong>Calendar</strong> tab to manually drag and drop flights.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="flex h-full flex-col items-center justify-center py-24 text-center">
                  <CalendarDays className="mb-3 h-10 w-10 text-slate-200" />
                  <p className="text-slate-500">Select a plan request to view details</p>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── AI ROSTER TAB ────────────────────────────────────────────── */}
        {tab === 'ai' && user?.role !== 'instructor' && (
          <div className="h-full overflow-y-auto">
            {activePlanReq ? (
              <AISuggestPanel
                planRequestId={activePlanReq.id}
                planDate={activePlanReq.plan_date}
                baseId={activePlanReq.base}
                baseIcao={activePlanReq.base_icao}
                onRosterConfirmed={() => {
                  setTab('calendar')
                  toast.success('Switch to Calendar to see the Draft Roster')
                }}
              />
            ) : (
              <Card className="flex h-full flex-col items-center justify-center py-32 text-center">
                <Sparkles className="mb-3 h-12 w-12 text-slate-200" />
                <p className="text-slate-600 dark:text-slate-400 font-medium">
                  No active plan request for {fmt.date(date)}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Go to the Plans tab and create a request first
                </p>
                <Button className="mt-4" variant="secondary" onClick={() => setTab('plans')}>
                  Go to Plans
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ── Flight detail modal ──────────────────────────────────────────── */}
      <Modal
        open={!!selectedFlight}
        onClose={() => setSelFlight(null)}
        title={selectedFlight
          ? `Flight — ${fmt.datetime(selectedFlight.scheduled_start)}`
          : ''}
        size="md"
      >
        {selectedFlight && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Aircraft', selectedFlight.aircraft_name],
                ['Type', flightTypeBadge(selectedFlight.flight_type)],
                ['Instructor', selectedFlight.instructor_name],
                selectedFlight.secondary_instructor_name ? ['Secondary Instructor', selectedFlight.secondary_instructor_name] : ['Student', selectedFlight.student_name ?? 'N/A'],
                ['Exercise', selectedFlight.exercises && selectedFlight.exercises.length > 0
                  ? selectedFlight.exercises.map(e => e.exercise_title).join(', ')
                  : 'None'],
                ['Scheduled Start', fmt.datetime(selectedFlight.scheduled_start)],
                ['Scheduled End', fmt.datetime(selectedFlight.scheduled_end)],
                ['Duration', fmt.hours(selectedFlight.duration_minutes)],
                ['Ferry', selectedFlight.is_ferry ? 'Yes' : 'No'],
              ].map(([l, v]) => (
                <div key={String(l)}>
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="font-medium text-slate-900 dark:text-white capitalize">{v}</p>
                </div>
              ))}
            </div>

            <FlightStatusPill status={selectedFlight.status} />

            {/* NEW: Show the Dispatcher's Override Request reason to the CFI */}
            {selectedFlight.override_requested && (
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800 mb-4">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Dispatcher Override Request:</p>
                <p className="text-sm text-amber-700 dark:text-amber-200 italic">"{selectedFlight.override_reason}"</p>
              </div>
            )}

            <div className="flex gap-3">
              {/* NEW: Pass the override flag when CFI confirms */}
              {selectedFlight.status === 'draft' && ['cfi', 'superadmin'].includes(user?.role ?? '') && (
                <Button
                  onClick={async () => {
                    try {
                      await confirmFlight.mutateAsync({
                        id: selectedFlight.id,
                        cfi_override: selectedFlight.override_requested
                      })
                      toast.success('Flight Approved & Confirmed')
                      setSelFlight(null)
                    } catch (err: any) {
                      toast.error('Confirmation failed', { description: err?.response?.data?.detail })
                    }
                  }}
                  loading={confirmFlight.isPending}
                  variant={selectedFlight.override_requested ? 'danger' : 'primary'}
                >
                  {selectedFlight.override_requested ? 'Approve Override & Confirm' : 'Confirm Individually'}
                </Button>
              )}
              
              {/* Simulator Bypass Buttons */}
              {selectedFlight.is_simulator && ['scheduled', 'confirmed'].includes(selectedFlight.status) && (
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await startSimulator.mutateAsync({ id: selectedFlight.id })
                      toast.success('Simulator session started')
                      setSelFlight(null)
                    } catch (err: any) {
                      toast.error('Failed to start session', { description: err?.response?.data?.detail })
                    }
                  }}
                  loading={startSimulator.isPending}
                >
                  Start Simulator Session
                </Button>
              )}
              {selectedFlight.is_simulator && selectedFlight.status === 'airborne' && (
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await closeoutSimulator.mutateAsync({ id: selectedFlight.id })
                      toast.success('Simulator session closed out')
                      setSelFlight(null)
                    } catch (err: any) {
                      toast.error('Failed to close session', { description: err?.response?.data?.detail })
                    }
                  }}
                  loading={closeoutSimulator.isPending}
                >
                  End Simulator Session
                </Button>
              )}

              {['draft', 'scheduled', 'confirmed'].includes(selectedFlight.status) && (
                <Button variant="danger" onClick={async () => {
                  await cancelFlight.mutateAsync({ id: selectedFlight.id, reason: 'Cancelled via roster' })
                  toast.success('Flight cancelled')
                  setSelFlight(null)
                }}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Ad-Hoc Flight Modal ────────────────────────────────────────────── */}
      <Modal
        open={showNewFlightModal}
        onClose={resetFormState}
        title="Create Ad-Hoc Flight (Confirmed)"
        size="md"
      >
        <AdHocFlightForm
          activeBaseId={activeBaseId}
          user={user}
          fleet={fleet ?? []}
          instructors={instructorsData?.results ?? []}
          students={studentsData?.results ?? []}
          exercises={allExercises}
          prefilledSlot={prefilledSlot}
          onSuccess={() => {
            setShowNewFlightModal(false)
            setPrefilledSlot(null)
          }}
          onCancel={() => {
            setShowNewFlightModal(false)
            setPrefilledSlot(null)
          }}
        />
      </Modal>

      {/* ── Printable Roster Modal ────────────────────────────────────────── */}
      <PrintableRosterModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        planRequest={activePlanReq}
        flights={roster ?? []}
      />
    </div>
  )
}