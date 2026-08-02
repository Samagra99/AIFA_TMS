import { useState } from 'react'
import { useDailyRoster, useTechLog, useClearDispatch, useAcceptAircraft, useRecordOffBlock, useCloseout, useCreateTechLog, useSnagEntries, useCancelFlight } from '@/api/hooks'
import { useAuthStore, useUIStore } from '@/stores'
import { Card, Button, PageLoader, FlightStatusPill, Modal } from '@/components/ui'
import { CheckCircle2, XCircle, AlertTriangle, Send } from 'lucide-react'
import { fmt } from '@/lib/utils'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import type { Flight } from '@/api/types'

export function DispatchPage() {
  const { activeBaseId }     = useUIStore()
  const { user }             = useAuthStore()
  const today                = dayjs().format('YYYY-MM-DD')
  const { data: roster, isLoading } = useDailyRoster(today, activeBaseId)
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null)

  // Only show dispatched/confirmed flights — the active dispatch queue
  let active = (roster ?? []).filter(f => ['confirmed','dispatched','airborne'].includes(f.status))
  if (user?.role === 'instructor') {
    // Instructors only see their own flights in the queue
    active = active.filter(f => f.instructor_user_id === user?.id)
  } else if (user?.role === 'student') {
    // Students only see their own flights in the queue
    active = active.filter(f => f.student_user_id === user?.id)
  }
  const pending = (roster ?? []).filter(f => f.status === 'confirmed')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dispatch</h1>
        <p className="text-sm text-slate-500">{dayjs().format('dddd D MMMM')} · {pending.length} pending clearance</p>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Queue */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dispatch Queue</h2>
            {active.length === 0 ? (
              <Card className="py-10 text-center">
                <Send className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400">No active flights</p>
              </Card>
            ) : active.map(f => (
              <button key={f.id} onClick={() => setSelectedFlight(f)}
                className={`w-full rounded-xl border p-4 text-left transition-shadow hover:shadow-md ${
                  selectedFlight?.id === f.id
                    ? 'border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-950'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{f.aircraft_name}</span>
                  <FlightStatusPill status={f.status} />
                </div>
                <p className="text-xs text-slate-500">{fmt.time(f.scheduled_start)} → {fmt.time(f.scheduled_end)}</p>
                {/* Add Crew Names */}
                <p className="text-xs font-medium text-slate-700 mt-1">
                  {f.instructor_name} {f.student_name ? `& ${f.student_name}` : f.secondary_instructor_name ? `& ${f.secondary_instructor_name}` : ''}
                </p>
                <p className="text-xs text-slate-400 capitalize mt-0.5">{f.flight_type.replace(/_/g,' ')}</p>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {selectedFlight ? (
              <DispatchPanel flight={selectedFlight} onDone={() => setSelectedFlight(null)} />
            ) : (
              <Card className="flex flex-col items-center justify-center py-24 text-center">
                <Send className="mb-3 h-10 w-10 text-slate-200" />
                <p className="text-slate-400 text-sm">Select a flight from the queue to dispatch</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DispatchPanel({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const { user } = useAuthStore()
  const isDispatcher = user?.role === 'dispatcher'
  const { data: techLogData, isLoading } = useTechLog(flight.id)
  const createTechLog = useCreateTechLog()
  const clearDispatch = useClearDispatch()
  const acceptAircraft = useAcceptAircraft()
  const recordOffBlock = useRecordOffBlock()
  const closeout = useCloseout()
  const [hobbsOut, setHobbsOut] = useState('')
  const [tachoOut, setTachoOut] = useState('')
  const [hobbsIn,  setHobbsIn]  = useState('')
  const [tachoIn,  setTachoIn]  = useState('')
  const [nilDefects, setNilDefects] = useState(true)
  const [snagDesc,  setSnagDesc]  = useState('')
  const [snagCat,   setSnagCat]   = useState<'go'|'no_go'>('go')
  const [dispatcherPin, setDispatcherPin] = useState('')
  const [briefingDone, setBriefingDone] = useState(flight.preflight_briefing_completed || false)
  const [crewPin, setCrewPin] = useState('')
  const [offBlockTime, setOffBlockTime] = useState(flight.scheduled_start ? dayjs(flight.scheduled_start).format('YYYY-MM-DDTHH:mm') : '')
  const [onBlockTime, setOnBlockTime] = useState(flight.scheduled_end ? dayjs(flight.scheduled_end).format('YYYY-MM-DDTHH:mm') : '')
  const [cfiOverride, setCfiOverride] = useState(false)
  const [, setBlockData] = useState<{ hard: any[], soft: any[]} | null>(null)

  const cancelFlight = useCancelFlight()
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReasonInput, setCancelReasonInput] = useState('')

  const handleCancelDispatchedFlight = async () => {
    if (!cancelReasonInput.trim()) {
      toast.error('Please enter a cancellation reason')
      return
    }
    try {
      await cancelFlight.mutateAsync({ id: flight.id, reason: cancelReasonInput })
      toast.success('Dispatched flight cancelled')
      setShowCancelModal(false)
      onDone()
    } catch (err: any) {
      toast.error('Failed to cancel flight', { description: err?.response?.data?.detail })
    }
  }

  const { data: snagsData } = useSnagEntries(flight.aircraft)
  const activeDeferredSnags = (snagsData ?? []).filter(s => (s.category === 'go' || s.is_deferred) && !s.resolved_at)

  if (isLoading) return <PageLoader />

  const getToleranceWarning = () => {
    if (!hobbsIn || !techLog?.hobbs_out || !offBlockTime || !onBlockTime) return null;
    const hobbsDiffMin = (parseFloat(hobbsIn) - parseFloat(techLog.hobbs_out)) * 60;
    
    // Parse times assuming HH:MM format for today
    const off = dayjs(offBlockTime);
    const on = dayjs(onBlockTime);
    const blockDiffMin = on.diff(off, 'minute');

    const diff = Math.abs(hobbsDiffMin - blockDiffMin);
    if (diff > 5) {
      return `Warning: Hobbs duration (${Math.round(hobbsDiffMin)}m) and Block duration (${Math.round(blockDiffMin)}m) differ by ${Math.round(diff)} mins. Must be within 5 mins to closeout.`;
    }
    return null;
  }

  const techLog = (techLogData as any)?.results ? (techLogData as any).results[0] : techLogData;

  const step = techLog
    ? techLog.accepted_at 
      ? (techLog.off_block_time ? 'closeout' : 'off-block')
      : techLog.dispatch_cleared_at ? 'accept'
      : 'clear'
    : 'create'

  const hasExpiredBA = techLog?.ba_test_details 
    ? Object.values(techLog.ba_test_details).some((d: any) => dayjs().diff(dayjs(d.test_time), 'hour', true) >= 10)
    : false;

  const displayBaTestOk = techLog?.ba_test_ok && !hasExpiredBA;

  const handleClear = async () => {
    try {
      setBlockData(null)
      if (!techLog || !dispatcherPin) { toast.error('PIN required'); return }
      await clearDispatch.mutateAsync({ 
        id: techLog.id, 
        dispatcher_pin: dispatcherPin,
        preflight_briefing_completed: briefingDone,
        cfi_override: cfiOverride
      })
      toast.success('Aircraft cleared for flight')
      setCfiOverride(false)
    } catch (err: any) {
      const rules = err.response?.data?.rules
      if (rules && (!rules.all_passed || rules.warnings?.length > 0)){
        setBlockData({
          hard: rules.blocking_failures || [],
          soft: rules.warnings || []
        })
        toast.error('Dispatch blocked due to rule constraints')
      } else {
        toast.error('Dispatch blocked', { description: err.response?.data?.detail || 'Verification Failed'})
      }
    }
  }

  const handleAccept = async () => {
    try {
      if (!techLog || !hobbsOut || !tachoOut || !crewPin) { toast.error('Enter meters and PIN'); return }
      await acceptAircraft.mutateAsync({ id: techLog.id, hobbs_out: hobbsOut, tacho_out: tachoOut, crew_pin: crewPin })
      toast.success('Aircraft accepted — flight airborne')
    } catch { toast.error('Accept failed - Invalid PIN') }
  }

  const handleRecordOffBlock = async () => {
    try {
      if (!techLog || !offBlockTime) { toast.error('Enter off-block time'); return }
      await recordOffBlock.mutateAsync({ id: techLog.id, off_block_time: dayjs(offBlockTime).toISOString() })
      toast.success('Off-block time recorded — flight airborne')
    } catch { toast.error('Failed to record off-block time') }
  }

  const handleCloseout = async () => {
    try {
      const warning = getToleranceWarning();
      if (warning) { toast.error(warning); return }
      if (!techLog || !hobbsIn || !tachoIn || !onBlockTime) { toast.error('Enter all Hobbs, Tacho, and Block times'); return }
      
      const snags = nilDefects ? [] : [{ description: snagDesc, category: snagCat }]
      await closeout.mutateAsync({ 
        id: techLog.id, 
        hobbs_in: hobbsIn, 
        tacho_in: tachoIn, 
        on_block_time: dayjs(onBlockTime).toISOString(), 
        crew_pin: crewPin,
        nil_defects: nilDefects, 
        snags 
      })
      toast.success(nilDefects ? 'Tech log closed — nil defects' : 'Snag logged.')
      onDone()
    } catch (err: any) { 
      toast.error('Closeout failed', { description: err?.response?.data?.detail }) 
    }
  }

  return (
    <Card>
      {/* ── NEW: STEP 0 (CREATE) ────────────────────────────────────────── */}
      {step === 'create' && (
        <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
          <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
            {/* If you don't have ClipboardCheck from lucide-react imported, you can use any icon or remove this div */}
            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Tech Log Not Found</p>
            <p className="text-xs text-slate-500">Initialize a new Tech Log to begin the dispatch clearance process.</p>
          </div>
          {isDispatcher ? (
            <Button
              onClick={async () => {
                try {
                  // Creates a blank tech log linked to this flight
                  await createTechLog.mutateAsync({ 
                    flight: flight.id,
                    aircraft: flight.aircraft 
                  })
                } catch (err: any) {
                  toast.error("Failed to generate Tech Log")
                }
              }}
              loading={createTechLog.isPending}
            >
              Generate Tech Log
            </Button>
          ) : (
            <p className="text-xs font-medium text-amber-600 mt-2">Only dispatchers can generate a Tech Log. Please contact dispatch.</p>
          )}
        </div>
      )}
      {/* Active Deferred Defect Banner for Crew & Dispatcher */}
      {activeDeferredSnags.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              ⚠️ Active Deferred Defect (Go-Defect) on Aircraft {flight.aircraft_name}
            </h4>
          </div>
          <div className="space-y-2">
            {activeDeferredSnags.map(snag => (
              <div key={snag.id} className="rounded-lg bg-white p-3 text-xs dark:bg-slate-800 border border-amber-200 dark:border-amber-800">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{snag.description}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-slate-500">
                  <span>CAMO Due: <strong>{snag.resolution_due_date ? dayjs(snag.resolution_due_date).format('DD MMM YYYY, hh:mm A') : 'Timeline Pending'}</strong></span>
                  {snag.camo_notes && <span>Notes: <em>{snag.camo_notes}</em></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance snapshot */}
      {techLog && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance Snapshot</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Medical', techLog.student_medical_valid],
              ['SPL',     techLog.student_spl_valid],
              ['FDTL',    techLog.instructor_fdtl_ok],
              ['Aircraft OK',   techLog.aircraft_hours_ok],
              ['Ferry',   techLog.ferry_buffer_ok],
              ['Xwind',   techLog.crosswind_ok],
              ['Crew BA', displayBaTestOk],
            ].map(([label, val]) => (
              <div key={String(label)} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium ${
                val === true ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : val === false ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'bg-slate-50 text-slate-400 dark:bg-slate-800'}`}>
                {val === true ? <CheckCircle2 className="h-3 w-3" />
                  : val === false ? <XCircle className="h-3 w-3" />
                  : <AlertTriangle className="h-3 w-3" />}
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crew BA Details Section */}
      {techLog && techLog.ba_test_details && Object.keys(techLog.ba_test_details).length > 0 && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Crew Breath Analyzer Status</p>
          <div className="space-y-3">
            {Object.entries(techLog.ba_test_details).map(([role, details]: [string, any]) => (
              <div key={role} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="mb-2 sm:mb-0">
                  <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">{role}</span>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>S. No: <strong className="text-slate-700 dark:text-slate-300">{details.test_serial_number}</strong></span>
                    <span>•</span>
                    <span>Eq: {details.equipment_number}</span>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Test Time</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {details.test_time ? dayjs(details.test_time).format('DD MMM, HH:mm') : '-'}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    dayjs().diff(dayjs(details.test_time), 'hour', true) >= 10 ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                    : details.result === 'PASS' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                  }`}>
                    {dayjs().diff(dayjs(details.test_time), 'hour', true) >= 10 ? 'EXPIRED' : details.result}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step UI */}
      {step === 'clear' && (
        isDispatcher ? (
          <div className="space-y-3">
            <StepHeader step={1} label="Dispatcher Clearance" done={false} />
            <p className="text-sm text-slate-600 dark:text-slate-400">Run compliance check and clear aircraft for dispatch.</p>
            <div className="flex gap-6 mb-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={briefingDone} onChange={e => setBriefingDone(e.target.checked)} className="h-4 w-4 rounded" />
                Briefing Completed
              </label>
            </div>
              
            {/* NEW: Dispatcher PIN Input */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Dispatcher PIN *</label>
              <input type="password" value={dispatcherPin} onChange={e => setDispatcherPin(e.target.value)} placeholder="****"
                className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
            </div>
            <Button onClick={handleClear} loading={clearDispatch.isPending}>
              Clear for Dispatch
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="font-bold text-slate-400">1</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Pending Clearance</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">Wait for the dispatcher to clear this aircraft.</p>
            </div>
          </div>
        )
      )}

      {step === 'accept' && (
        isDispatcher ? (
          <div className="flex flex-col items-center justify-center space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
              <span className="font-bold text-blue-700 dark:text-blue-300">2</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Waiting for Crew Acceptance</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">Aircraft cleared. The instructor must now log in and accept the aircraft at the apron.</p>
            </div>
          </div>
        ) : (
        <div className="space-y-4">
          <StepHeader 
              step={2} 
              label={flight.is_solo ? "Student Solo Acceptance" : "Instructor Aircraft Acceptance"} 
              done={false} 
            />
          <p className="text-sm text-slate-600 dark:text-slate-400">PIC records physical meter readings at the aircraft.</p>
          <div className="grid grid-cols-2 gap-4">
            <FloatInput label="Hobbs Out" value={hobbsOut} onChange={setHobbsOut} placeholder="e.g. 1234.5" />
            <FloatInput label="Tacho Out" value={tachoOut} onChange={setTachoOut} placeholder="e.g. 1234.5" />
          </div>
          {/* NEW: Crew PIN Input */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Crew PIN (Acceptance Signature) *</label>
            <input type="password" value={crewPin} onChange={e => setCrewPin(e.target.value)} placeholder="****"
              className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
          </div>
          <Button onClick={handleAccept} loading={acceptAircraft.isPending}>
            Accept Aircraft
          </Button>
        </div>
        )
      )}

      {step === 'off-block' && (
        <div className="space-y-4">
          <StepHeader step={3} label="Taxi Out (Record Off-Block)" done={false} />
          <p className="text-sm text-slate-600 dark:text-slate-400">Record the precise time the aircraft began moving under its own power.</p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Off-Block Time *</label>
            <input type="datetime-local" value={offBlockTime} onChange={e => setOffBlockTime(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
          </div>
          <Button onClick={handleRecordOffBlock} loading={recordOffBlock.isPending}>
            Record Off-Block
          </Button>
        </div>
      )}

      {step === 'closeout' && (
        isDispatcher ? (
          <div className="flex flex-col items-center justify-center space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
              <span className="font-bold text-emerald-700 dark:text-emerald-300">✈</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Flight Airborne</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">The instructor will complete the Tech Log closeout upon arrival.</p>
            </div>
          </div>
        ) : (
        <div className="space-y-4">
          <StepHeader step={4} label="Post-Flight Closeout" done={false} />
          <div className="grid grid-cols-2 gap-4">
            <FloatInput label="Hobbs In" value={hobbsIn} onChange={setHobbsIn} placeholder="e.g. 1235.5" />
            <FloatInput label="Tacho In" value={tachoIn} onChange={setTachoIn} placeholder="e.g. 1235.5" />
          </div>
          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-3 dark:border-slate-700">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">On-Block Time *</label>
              <input type="datetime-local" value={onBlockTime} onChange={e => setOnBlockTime(e.target.value)} required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
            </div>
          </div>
          
          {/* NEW: Real-time Tolerance Warning */}
          {getToleranceWarning() && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
              {getToleranceWarning()}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="nil" checked={nilDefects} onChange={e => setNilDefects(e.target.checked)} className="h-4 w-4 rounded" />
            <label htmlFor="nil" className="text-sm font-medium text-slate-700 dark:text-slate-300">Nil Defects</label>
          </div>
          {!nilDefects && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Snag Entry</p>
              <textarea value={snagDesc} onChange={e => setSnagDesc(e.target.value)} placeholder="Describe the defect…"
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-700 dark:bg-slate-800 dark:text-white" rows={2} />
              <div className="flex gap-3">
                {['go','no_go'].map(c => (
                  <label key={c} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" value={c} checked={snagCat===c} onChange={() => setSnagCat(c as any)} />
                    <span className={c==='no_go'?'text-red-700 font-semibold dark:text-red-300':'text-emerald-700 dark:text-emerald-300'}>
                      {c==='no_go'?'No-Go (AOG)':'Go (Deferred)'}
                    </span>
                  </label>
                ))}
              </div>
              {snagCat==='no_go' && (
                <p className="text-xs text-red-600 font-medium">⚠ Submitting a No-Go snag will immediately ground this aircraft network-wide.</p>
              )}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Crew PIN*
            </label>
            <input 
              type="password" 
              name="crew_pin" 
              required 
              maxLength={6}
              placeholder="••••"
              value={crewPin}
              onChange={e => setCrewPin(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm" 
            />
          </div>
          <Button onClick={handleCloseout} loading={closeout.isPending}
            variant={!nilDefects && snagCat==='no_go' ? 'danger' : 'primary'}>
            {!nilDefects && snagCat==='no_go' ? 'Submit No-Go & Ground Aircraft' : 'Close Tech Log'}
          </Button>
        </div>
        )
      )}

      {/* Cancel Dispatched/Confirmed Flight Footer */}
      {(step === 'clear' || step === 'accept') && (
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowCancelModal(true)}
          >
            Cancel Dispatched Flight
          </Button>
        </div>
      )}

      {/* Cancel Flight Modal */}
      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Dispatched Flight" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Are you sure you want to cancel this flight ({flight.aircraft_name})? This will cancel the flight and close the open Tech Log.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Cancellation Reason *
            </label>
            <input
              type="text"
              value={cancelReasonInput}
              onChange={e => setCancelReasonInput(e.target.value)}
              placeholder="e.g. Weather below minima, crew unwell, slot expired"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <Button variant="secondary" size="sm" onClick={() => setShowCancelModal(false)}>
              Back
            </Button>
            <Button variant="danger" size="sm" onClick={handleCancelDispatchedFlight} loading={cancelFlight.isPending}>
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

function StepHeader({ step, label, done }: { step: number; label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-primary-600 text-white'}`}>
        {done ? '✓' : step}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{label}</h3>
    </div>
  )
}

function FloatInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v:string)=>void; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
      <input type="number" step="0.1" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
    </div>
  )
}
