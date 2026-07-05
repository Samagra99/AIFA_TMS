import { useState } from 'react'
import { useDailyRoster, useTechLog, useClearDispatch, useAcceptAircraft, useCloseout } from '@/api/hooks'
import { useUIStore } from '@/stores'
import { Card, Button, PageLoader, FlightStatusPill, Modal } from '@/components/ui'
import { CheckCircle2, XCircle, AlertTriangle, Send } from 'lucide-react'
import { fmt } from '@/lib/utils'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import type { Flight, TechLog } from '@/api/types'

export function DispatchPage() {
  const { activeBaseId }     = useUIStore()
  const today                = dayjs().format('YYYY-MM-DD')
  const { data: roster, isLoading } = useDailyRoster(today, activeBaseId)
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null)

  // Only show dispatched/confirmed flights — the active dispatch queue
  const active = (roster ?? []).filter(f => ['confirmed','dispatched','airborne'].includes(f.status))
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
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{f.aircraft}</span>
                  <FlightStatusPill status={f.status} />
                </div>
                <p className="text-xs text-slate-500">{fmt.time(f.scheduled_start)} → {fmt.time(f.scheduled_end)}</p>
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
  const { data: techLog, isLoading } = useTechLog(flight.id)
  const clearDispatch = useClearDispatch()
  const acceptAircraft = useAcceptAircraft()
  const closeout = useCloseout()
  const [hobbsOut, setHobbsOut] = useState('')
  const [tachoOut, setTachoOut] = useState('')
  const [hobbsIn,  setHobbsIn]  = useState('')
  const [tachoIn,  setTachoIn]  = useState('')
  const [nilDefects, setNilDefects] = useState(true)
  const [snagDesc,  setSnagDesc]  = useState('')
  const [snagCat,   setSnagCat]   = useState<'go'|'no_go'>('go')
  const [dispatcherPin, setDispatcherPin] = useState('')
  const [crewPin, setCrewPin] = useState('')
  const [offBlockTime, setOffBlockTime] = useState('')
  const [onBlockTime, setOnBlockTime] = useState('')

  if (isLoading) return <PageLoader />

  const getToleranceWarning = () => {
    if (!hobbsIn || !techLog?.hobbs_out || !offBlockTime || !onBlockTime) return null;
    const hobbsDiffMin = (parseFloat(hobbsIn) - parseFloat(techLog.hobbs_out)) * 60;
    
    // Parse times assuming HH:MM format for today
    const off = new Date(`1970-01-01T${offBlockTime}:00Z`).getTime();
    const on = new Date(`1970-01-01T${onBlockTime}:00Z`).getTime();
    const blockDiffMin = (on - off) / 60000;

    const diff = Math.abs(hobbsDiffMin - blockDiffMin);
    if (diff > 5) {
      return `Warning: Hobbs duration (${Math.round(hobbsDiffMin)}m) and Block duration (${Math.round(blockDiffMin)}m) differ by ${Math.round(diff)} mins. Must be within 5 mins to closeout.`;
    }
    return null;
  }

  const step = techLog
    ? techLog.accepted_at ? 'closeout'
      : techLog.dispatch_cleared_at ? 'accept'
      : 'clear'
    : 'create'

  const handleClear = async () => {
    try {
      if (!techLog || !dispatcherPin) { toast.error('PIN required'); return }
      await clearDispatch.mutateAsync({ id: techLog.id, dispatcher_pin: dispatcherPin })
      toast.success('Aircraft cleared for flight')
    } catch (err: any) {
      toast.error('Dispatch blocked', { description: err.response?.data?.detail || 'Verification failed.' })
    }
  }

  const handleAccept = async () => {
    try {
      if (!techLog || !hobbsOut || !tachoOut || !crewPin) { toast.error('Enter meters and PIN'); return }
      await acceptAircraft.mutateAsync({ id: techLog.id, hobbs_out: hobbsOut, tacho_out: tachoOut, crew_pin: crewPin })
      toast.success('Aircraft accepted — flight airborne')
    } catch { toast.error('Accept failed - Invalid PIN') }
  }

  const handleCloseout = async () => {
    try {
      const warning = getToleranceWarning();
      if (warning) { toast.error(warning); return }
      if (!techLog || !hobbsIn || !tachoIn || !offBlockTime || !onBlockTime) { toast.error('Enter all Hobbs, Tacho, and Block times'); return }
      
      const snags = nilDefects ? [] : [{ description: snagDesc, category: snagCat }]
      await closeout.mutateAsync({ 
        id: techLog.id, 
        hobbs_in: hobbsIn, 
        tacho_in: tachoIn, 
        off_block_time: offBlockTime, 
        on_block_time: onBlockTime, 
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
      {/* Compliance snapshot */}
      {techLog && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance Snapshot</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Medical', techLog.student_medical_valid],
              ['SPL',     techLog.student_spl_valid],
              ['FDTL',    techLog.instructor_fdtl_ok],
              ['STATUS',   techLog.status.toUpperCase()],
              ['Ferry',   techLog.ferry_buffer_ok],
              ['Xwind',   techLog.crosswind_ok],
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

      {/* Step UI */}
      {step === 'clear' && (
        <div className="space-y-3">
          <StepHeader step={1} label="Dispatcher Clearance" done={false} />
          <p className="text-sm text-slate-600 dark:text-slate-400">Run compliance check and clear aircraft for dispatch.</p>
          <div className="flex gap-4 mb-4">
            <div className={`flex items-center gap-2 text-sm ${flight.preflight_briefing_completed ? 'text-emerald-600' : 'text-slate-400'}`}>
              {flight.preflight_briefing_completed ? <CheckCircle2 /> : <XCircle />} Briefing
            </div>
            <div className={`flex items-center gap-2 text-sm ${flight.ba_test_cleared ? 'text-emerald-600' : 'text-slate-400'}`}>
              {flight.ba_test_cleared ? <CheckCircle2 /> : <XCircle />} BA Test
            </div>
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
      )}

      {step === 'accept' && (
        <div className="space-y-4">
          <StepHeader step={2} label="CFI Aircraft Acceptance" done={false} />
          <p className="text-sm text-slate-600 dark:text-slate-400">CFI records physical meter readings at the aircraft.</p>
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
      )}

      {step === 'closeout' && (
        <div className="space-y-4">
          <StepHeader step={3} label="Post-Flight Closeout" done={false} />
          <div className="grid grid-cols-2 gap-4">
            <FloatInput label="Hobbs In" value={hobbsIn} onChange={setHobbsIn} placeholder="e.g. 1235.5" />
            <FloatInput label="Tacho In" value={tachoIn} onChange={setTachoIn} placeholder="e.g. 1235.5" />
          </div>
          {/* NEW: Block Time Inputs */}
          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 dark:border-slate-700">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Off-Block Time *</label>
              <input type="time" value={offBlockTime} onChange={e => setOffBlockTime(e.target.value)} required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">On-Block Time *</label>
              <input type="time" value={onBlockTime} onChange={e => setOnBlockTime(e.target.value)} required
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
          <Button onClick={handleCloseout} loading={closeout.isPending}
            variant={!nilDefects && snagCat==='no_go' ? 'danger' : 'primary'}>
            {!nilDefects && snagCat==='no_go' ? 'Submit No-Go & Ground Aircraft' : 'Close Tech Log'}
          </Button>
        </div>
      )}
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
