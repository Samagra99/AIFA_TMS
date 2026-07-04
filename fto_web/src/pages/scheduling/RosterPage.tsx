import { useState, useCallback } from 'react'
import { useDailyRoster, useConfirmFlight, useCancelFlight, useCreateFlight } from '@/api/hooks/useScheduling'
import { usePlanRequests, type DailyPlanRequest } from '@/api/hooks/useRostering'
import { RosterCalendar }     from '@/components/roster/RosterCalendar'
import { PlanRequestPanel }   from '@/components/roster/PlanRequestPanel'
import { InstructorPlanForm } from '@/components/roster/InstructorPlanForm'
import { AISuggestPanel }     from '@/components/roster/AISuggestPanel'
import { Card, Button, PageLoader, Modal, FlightStatusPill } from '@/components/ui'
import { useUIStore, useAuthStore } from '@/stores'
import { useFleetStatus }          from '@/api/hooks'
import { fmt, flightTypeBadge }    from '@/lib/utils'
import { ChevronLeft, ChevronRight, CalendarDays, Users, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import type { Flight } from '@/api/types'

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

  const { data: roster,    isLoading } = useDailyRoster(date, activeBaseId)
  const { data: fleet                } = useFleetStatus(activeBaseId)
  const { data: reqData              } = usePlanRequests(date)
  const confirmFlight                  = useConfirmFlight()
  const cancelFlight                   = useCancelFlight()
  const createFlight                   = useCreateFlight()

  const isInstructor = user?.role && ['instructor', 'cfi'].includes(user.role)
  const isCFI        = user?.role && ['cfi', 'superadmin', 'dispatcher'].includes(user.role)

  // ── Calendar resources (instructors or aircraft) ──────────────────────────
  const resources = resourceMode === 'instructor'
    ? Array.from(
        new Map(
          (roster ?? [])
            .filter(f => f.status !== 'cancelled')
            .map(f => [f.instructor, {
              id:    f.instructor,
              title: f.instructor_detail?.user_detail
                ? `${f.instructor_detail.user_detail.first_name} ${f.instructor_detail.user_detail.last_name}`
                : f.instructor,
              extendedProps: {
                fdtl_remaining_min: f.instructor_detail?.fdtl_daily_remaining_min,
              },
            }])
        ).values()
      )
    : (fleet ?? [])
        .filter(a => a.status === 'airworthy')
        .map(a => ({
          id:    a.id,
          title: a.tail_number,
          extendedProps: { status: a.status },
        }))

  // ── Active plan request for the selected date ─────────────────────────────
  const activePlanReq = selectedReq ?? reqData?.results?.[0] ?? null

  const onEventDrop = useCallback(async (
    flightId: string, newStart: Date, _newEnd: Date, _newResourceId: string
  ) => {
    // In a full implementation this would PATCH the flight's scheduled_start/end
    toast.info(`Flight moved to ${dayjs(newStart).format('HH:mm')} — save changes to confirm`)
  }, [])

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
              <Button onClick={() => setShowNewFlightModal(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Ad-Hoc Flight
              </Button>
            )}
          <div className="ml-auto flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1
            dark:border-slate-700 dark:bg-slate-800">
            {(['instructor', 'aircraft'] as const).map(m => (
              <button key={m} onClick={() => setResMode(m)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize
                  transition-colors ${
                  resourceMode === m
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
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
            {/* Calendar */}
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border
              border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <RosterCalendar
                date={date}
                flights={roster ?? []}
                resources={resources}
                resourceMode={resourceMode}
                editable={!!isCFI}
                onEventDrop={onEventDrop}
                onEventClick={id => {
                  const f = roster?.find(fl => fl.id === id)
                  if (f) setSelFlight(f)
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
                  {['scheduled','confirmed','dispatched','airborne','completed','cancelled']
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
                        {f.aircraft}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PLANS TAB ────────────────────────────────────────────────── */}
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
              {isInstructor && activePlanReq ? (
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
                  </div>
                  <InstructorPlanForm planRequestId={activePlanReq.id} />
                </div>
              ) : !activePlanReq ? (
                <Card className="flex h-full flex-col items-center justify-center py-24
                  text-center">
                  <Users className="mb-3 h-10 w-10 text-slate-200" />
                  <p className="text-slate-500">
                    {isCFI
                      ? 'Create a plan request to collect instructor plans'
                      : 'No plan request yet for this date'}
                  </p>
                </Card>
              ) : (
                <Card className="flex h-full flex-col items-center justify-center py-24
                  text-center">
                  <CalendarDays className="mb-3 h-10 w-10 text-slate-200" />
                  <p className="text-slate-500">
                    Select a plan request to view details
                  </p>
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
                  toast.success('Switch to Calendar to see the confirmed roster')
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
              {selectedFlight.status === 'scheduled' && (
                <Button onClick={async () => {
                  try {
                    await confirmFlight.mutateAsync(selectedFlight.id)
                    toast.success('Flight confirmed')
                    setSelFlight(null)
                  } catch { toast.error('Constraint check failed') }
                }} loading={confirmFlight.isPending}>
                  Confirm Flight
                </Button>
              )}
              {['scheduled','confirmed'].includes(selectedFlight.status) && (
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
                base_id: activeBaseId,
                aircraft_id: formData.get('aircraft_id'),
                instructor_id: formData.get('instructor_id'),
                student_id: formData.get('student_id') || null,
                flight_type: formData.get('flight_type'),
                scheduled_start: formData.get('scheduled_start'),
                scheduled_end: formData.get('scheduled_end'),
                status: 'confirmed', // Instantly pushes it to the Dispatch page
                notes: 'Ad-hoc flight created by Dispatch'
              })
              
              toast.success('Ad-hoc flight created & confirmed!')
              setShowNewFlightModal(false)
            } catch (err: any) {
              toast.error(err?.response?.data?.detail ?? 'Failed to create flight. Check constraints.')
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Aircraft *</label>
              <select name="aircraft_id" required className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <option value="">Select Airworthy Aircraft...</option>
                {fleet?.filter(a => a.status === 'airworthy').map(a => (
                  <option key={a.id} value={a.id}>{a.tail_number} ({a.aircraft_type_name})</option>
                ))}
              </select>
            </div>
            
            {/* Note: Replace these standard inputs with your actual Instructor/Student Dropdown components if you have them globally available */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Instructor UUID *</label>
              <input type="text" name="instructor_id" required placeholder="Paste Instructor ID" className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Student UUID (Optional)</label>
              <input type="text" name="student_id" placeholder="Leave blank for ferry/positioning" className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Scheduled Start *</label>
                <input type="datetime-local" name="scheduled_start" required className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Scheduled End *</label>
                <input type="datetime-local" name="scheduled_end" required className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
            </div>
          </div>

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
