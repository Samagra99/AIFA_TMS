import { useState, useCallback, useMemo, useRef } from 'react'
import { useDailyRoster, useConfirmFlight, useCancelFlight, useCreateFlight, useUpdateFlight } from '@/api/hooks/useScheduling'
import { 
  usePlanRequests, 
  useSubmitRosterForReview, 
  useApproveRoster, 
  useRejectRoster, 
  useAllPlansForRequest,
  type DailyPlanRequest 
} from '@/api/hooks/useRostering'
import { useSyllabusStages } from '@/api/hooks/useSyllabus'
import { RosterCalendar }     from '@/components/roster/RosterCalendar'
import { PlanRequestPanel }   from '@/components/roster/PlanRequestPanel'
import { InstructorPlanForm } from '@/components/roster/InstructorPlanForm'
import { AISuggestPanel }     from '@/components/roster/AISuggestPanel'
import { Card, Button, PageLoader, Modal, FlightStatusPill } from '@/components/ui'
import { useUIStore, useAuthStore } from '@/stores'
import { useFleetStatus }          from '@/api/hooks'
import { fmt, flightTypeBadge }    from '@/lib/utils'
import { ChevronLeft, ChevronRight, CalendarDays, Users, Sparkles, Plus, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import type { Flight } from '@/api/types'
import { useStudents } from '@/api/hooks/useStudents'
import { useInstructors } from '@/api/hooks/useInstructors'

type Tab = 'calendar' | 'plans' | 'ai'

export function RosterPage() {
  const { user }                      = useAuthStore()
  const { activeBaseId }              = useUIStore()
  const [tab,           setTab]       = useState<Tab>('calendar')
  const [date,          setDate]      = useState(dayjs().format('YYYY-MM-DD'))
  const [resourceMode,  setResMode]   = useState<'instructor' | 'aircraft'>('instructor')
  const [selectedFlight,setSelFlight] = useState<Flight | null>(null)
  const [selectedReq,   setSelReq]    = useState<DailyPlanRequest | null>(null)
  const [showNewFlightModal, setShowNewFlightModal] = useState(false)
  const [rejectComments, setRejectComments] = useState('') // NEW: CFI Rejection comments

  const [prefilledSlot, setPrefilledSlot] = useState<{start: string, end: string, resourceId: string, studentId?: string, exerciseId?: string} | null>(null)
  const { data: roster,    isLoading } = useDailyRoster(date, activeBaseId)
  const { data: fleet                } = useFleetStatus(activeBaseId)
  const { data: studentsData } = useStudents()
  const { data: instructorsData } = useInstructors()
  const { data: reqData              } = usePlanRequests(date)
  
  const confirmFlight                  = useConfirmFlight()
  const cancelFlight                   = useCancelFlight()
  const createFlight                   = useCreateFlight()
  const updateFlight = useUpdateFlight()

  // NEW HOOKS
  const submitDraft = useSubmitRosterForReview()
  const approveRoster = useApproveRoster()
  const rejectRoster = useRejectRoster()

  const isInstructor = user?.role && ['instructor', 'cfi'].includes(user.role)
  const isCFI        = user?.role && ['cfi', 'superadmin', 'dispatcher'].includes(user.role)

    // ── Active plan request for the selected date ─────────────────────────────
  const activePlanReq = selectedReq ?? reqData?.results?.[0] ?? null

  // NEW: Fetch all submitted plans for the draggable sidebar
  const { data: allPlans } = useAllPlansForRequest(activePlanReq?.id ?? '')
  const externalEventsRef = useRef<HTMLDivElement>(null)

  // Flatten plans into individual draggable entries
  const draggableEntries = useMemo(() => {
    if (!allPlans) return []
    return allPlans.flatMap(plan => 
      plan.entries.map(entry => ({
        ...entry,
        instructor_id: plan.instructor,
        instructor_name: plan.instructor_name
      }))
    )
  }, [allPlans])

  // NEW: Flatten syllabus stages to provide a clean list of exercises for the Ad-Hoc Modal
  const { data: stagesData } = useSyllabusStages()
  const allExercises = useMemo(() => {
    return stagesData?.results?.flatMap(stage =>
      stage.lessons.flatMap(lesson => lesson.exercises)
    ) || []
  }, [stagesData])
  
  // ── Calendar resources (instructors or aircraft) ──────────────────────────
  const resources = resourceMode === 'instructor'
    ? (instructorsData?.results ?? []).map(i => ({
        id: i.id,
        title: i.user_detail ? `${i.user_detail.first_name} ${i.user_detail.last_name}` : i.id,
        extendedProps: { fdtl_remaining_min: i.fdtl_daily_remaining_hrs ? i.fdtl_daily_remaining_hrs * 60 : undefined }
      }))
    : (fleet ?? []).filter(a => a.status === 'airworthy').map(a => ({
        id: a.id,
        title: a.tail_number,
        extendedProps: { status: a.status }
      }))


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
            ['calendar', 'Calendar',     CalendarDays],
            ['plans',    'Instructor Plans', Users],
            ['ai',       'AI Roster',    Sparkles],
          ] as [Tab, string, React.ComponentType<{className?:string}>][]).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm
                font-medium transition-colors ${
                tab === id
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
              <button key={m} onClick={() => setResMode(m)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  resourceMode === m ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
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
              <div className="w-56 shrink-0 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Instructor Plans</h3>
                  <p className="text-xs text-slate-500">Drag onto schedule</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2" ref={externalEventsRef}>
                  {draggableEntries.map(entry => (
                    <div 
                      key={entry.id}
                      className="fc-external-event cursor-grab rounded-lg border border-primary-200 bg-white p-2 shadow-sm hover:shadow dark:border-primary-800 dark:bg-slate-900"
                      data-plan={JSON.stringify(entry)}
                    >
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {entry.instructor_name}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate">{entry.student_name}</span>
                        <span className="font-semibold text-primary-600">{entry.exercise_code}</span>
                      </div>
                    </div>
                  ))}
                  {draggableEntries.length === 0 && (
                    <div className="text-center text-xs text-slate-400 p-4">No pending plans.</div>
                  )}
                </div>
              </div>
            )}
            {/* Calendar */}
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border
              border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <RosterCalendar
                date={date}
                flights={roster ?? []}
                resources={resources}
                resourceMode={resourceMode}
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
                  // Extract the plan data from the dropped element
                  const planData = info.draggedEl.extendedProps?.planData;
                  
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
                  {['draft','scheduled','confirmed','dispatched','airborne','completed','cancelled','suspended']
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
                    <button key={f.aircraft_detail?.tail_number} onClick={() => setSelFlight(f)}
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
                        {f.aircraft}
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
                  onSelectRequest={setSelReq}
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
                    {user?.role === 'dispatcher' && activePlanReq.status === 'open' && (
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
                          }}
                          loading={rejectRoster.isPending}
                        >
                          Reject
                        </Button>
                        <Button variant="primary" 
                          onClick={async () => {
                            await approveRoster.mutateAsync({ id: activePlanReq.id })
                            toast.success("Roster Approved & Confirmed!")
                          }}
                          loading={approveRoster.isPending}
                        >
                          Approve Roster
                        </Button>
                      </div>
                    )}
                    
                    {activePlanReq.status === 'rostered' && user?.role === 'dispatcher' && (
                       <div className="mt-4 pt-4 border-t border-primary-200 dark:border-primary-800">
                         <Button variant="primary" onClick={() => window.print()}>Print Final Roster</Button>
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
                    <InstructorPlanForm planRequestId={activePlanReq.id} />
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
        {tab === 'ai' && (
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
                ['Aircraft',  selectedFlight.aircraft],
                ['Type',      flightTypeBadge(selectedFlight.flight_type)],
                ['Start',     fmt.datetime(selectedFlight.scheduled_start)],
                ['End',       fmt.datetime(selectedFlight.scheduled_end)],
                ['Duration',  fmt.hours(selectedFlight.duration_minutes)],
                ['Ferry',     selectedFlight.is_ferry ? 'Yes' : 'No'],
              ].map(([l, v]) => (
                <div key={String(l)}>
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="font-medium text-slate-900 dark:text-white capitalize">{v}</p>
                </div>
              ))}
            </div>

            <FlightStatusPill status={selectedFlight.status} />

            <div className="flex gap-3">
              {/* Note: In the new flow, bulk flights are confirmed by CFI via the RosterActions bar. 
                  This button remains here for individual fallbacks if needed, but the main flow uses the bulk approve. */}
              {selectedFlight.status === 'draft' && ['cfi', 'superadmin'].includes(user?.role ?? '') && (
                <Button onClick={async () => {
                  try {
                    await confirmFlight.mutateAsync(selectedFlight.id)
                    toast.success('Flight manually confirmed')
                    setSelFlight(null)
                  } catch { toast.error('Constraint check failed') }
                }} loading={confirmFlight.isPending}>
                  Confirm Individually
                </Button>
              )}
              {['draft','scheduled','confirmed'].includes(selectedFlight.status) && (
                <Button variant="danger" onClick={async () => {
                  await cancelFlight.mutateAsync({
                    id: selectedFlight.id, reason: 'Cancelled via roster'
                  })
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
        onClose={() => setShowNewFlightModal(false)}
        title="Create Ad-Hoc Flight (Confirmed)"
        size="md"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            
            try {
              await createFlight.mutateAsync({
                base: activeBaseId ?? undefined,              
                // FIX: Change the keys on the left to match the Flight interface
                aircraft: formData.get('aircraft_id') as string,
                instructor: formData.get('instructor_id') as string,
                student: (formData.get('student_id') as string) || undefined,
                secondary_instructor: (formData.get('secondary_instructor_id') as string) || undefined,
                exercise_id: (formData.get('exercise_id') as string) || undefined,
                flight_type: formData.get('flight_type') as Flight['flight_type'],
                scheduled_start: formData.get('scheduled_start') as string,
                scheduled_end: formData.get('scheduled_end') as string,
                status: 'confirmed',
                notes: 'Ad-hoc flight created by Dispatch'
              }as any)
              
              toast.success('Ad-hoc flight created & confirmed!')
              setShowNewFlightModal(false)
            setPrefilledSlot(null)
            } catch (err: any) {
              const ruleErrors = err?.response?.data?.scheduling_rules?.blocking_failures?.map((f: any) => f.detail).join(' ')
              toast.error(err?.response?.data?.conflict ?? ruleErrors ?? err?.response?.data?.detail ?? 'Failed to create flight. Check constraints or conflicts.')
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Aircraft *</label>
              <select name="aircraft_id" required defaultValue={resourceMode === 'aircraft' ? prefilledSlot?.resourceId : ''} className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <option value="">Select Airworthy Aircraft...</option>
                {fleet?.filter(a => a.status === 'airworthy').map(a => (
                  <option key={a.id} value={a.id}>{a.tail_number} ({a.aircraft_type_name})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Instructor *</label>
              <select name="instructor_id" required defaultValue={resourceMode === 'instructor' ? prefilledSlot?.resourceId : ''} className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <option value="">Select Instructor...</option>
                {instructorsData?.results?.map(instructor => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.user_detail?.first_name} {instructor.user_detail?.last_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Student</label>
              <select name="student_id" className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                {studentsData?.results?.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.user_detail?.first_name} {student.user_detail?.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Secondary Instructor / Check Pilot</label>
                <select name="secondary_instructor_id" className="w-full rounded-lg border border-slate-200 p-2 text-sm">
                  <option value="">None</option>
                  {instructorsData?.results?.map(instructor => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.user_detail?.first_name} {instructor.user_detail?.last_name}
                    </option>
                  ))}
                </select>
              </div>

            
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Flight Type *</label>
              <select name="flight_type" required className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <option value="dual">Dual</option>
                <option value="solo">Solo</option>
                <option value="cross_country_dual">Cross-Country Dual</option>
                <option value="cross_country_solo">Cross-Country Solo</option>
                <option value="night_dual">Night Dual</option>
                <option value="night_solo">Night Solo</option>
                <option value="instrument">Instrument</option>
                <option value="ferry">Ferry</option>
                <option value="proficiency_check">Proficiency Check</option>
              </select>
            </div>

            {/* NEW: Exercise Dropdown for Prerequisites */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Exercise</label>
                <select name="exercise_id" defaultValue={prefilledSlot?.exerciseId ?? ''} className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <option value="">None / Routine Flight</option>
                  {allExercises.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.exercise_code} - {ex.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Scheduled Start *</label>
                <input type="datetime-local" name="scheduled_start" required defaultValue={prefilledSlot?.start} className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Scheduled End *</label>
                <input type="datetime-local" name="scheduled_end" required defaultValue={prefilledSlot?.end} className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
            </div>
          {/* </div> */}

          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button type="submit" loading={createFlight.isPending} className="flex-1">
              Create & Confirm
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewFlightModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}