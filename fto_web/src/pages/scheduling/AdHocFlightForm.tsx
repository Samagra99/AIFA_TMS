import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { useCheckConstraints, useCreateFlight, useFSTDDevices } from '@/api/hooks/useScheduling'
import { useCrossCountryRoutes } from '@/api/hooks/useNavigation'
// unused import removed
import dayjs from 'dayjs'
import { toast } from 'sonner'
import Select from 'react-select'
interface AdHocFlightFormProps {
  activeBaseId?: string | null
  user: any
  fleet: any[]
  instructors: any[]
  students: any[]
  exercises: any[]
  prefilledSlot: any
  onSuccess: () => void
  onCancel: () => void
}

export function AdHocFlightForm({
  activeBaseId,
  user,
  fleet,
  instructors,
  students,
  exercises,
  prefilledSlot,
  onSuccess,
  onCancel,
}: AdHocFlightFormProps) {
  const [flightType, setFlightType] = useState<'dual' | 'solo'>('dual')
  const [exerciseId, setExerciseId] = useState<string>(prefilledSlot?.exerciseId || '')
  
  const [p1, setP1] = useState<string>(prefilledSlot?.resourceId ? `instructor_${prefilledSlot.resourceId}` : '')
  const [p2p3, setP2p3] = useState<string>(prefilledSlot?.studentId ? `student_${prefilledSlot.studentId}` : '')
  const [isExternalP1, setIsExternalP1] = useState(false)
  const [externalP1Name, setExternalP1Name] = useState('')

  const [aircraftId, setAircraftId] = useState<string>(prefilledSlot?.resourceId || '') // prefilled if aircraft
  
  const [scheduledStart, setScheduledStart] = useState<string>(prefilledSlot?.start || dayjs().format('YYYY-MM-DDTHH:mm'))
  const [scheduledEnd, setScheduledEnd] = useState<string>(prefilledSlot?.end || dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'))

  const [flags, setFlags] = useState({
    is_cross_country: false,
    is_night: false,
    is_instrument_simulated: false,
    is_instrument_actual: false,
    is_skill_test: false,
    is_simulator: false,
    is_ferry: false,
  })

  const [cfiOverride, setCfiOverride] = useState(false)
  const [overrideMode, setOverrideMode] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  // Cross-country route selection
  const [crossCountryRouteId, setCrossCountryRouteId] = useState<string>('')
  const { data: ccRoutes = [] } = useCrossCountryRoutes()
  const { data: fstdDevices = [] } = useFSTDDevices()

  const selectedRoute = useMemo(() => ccRoutes.find((r: any) => r.id === crossCountryRouteId), [ccRoutes, crossCountryRouteId])
  const selectedAircraft = useMemo(() => fleet?.find((a: any) => a.id === aircraftId), [fleet, aircraftId])
  const aircraftMaxRange = selectedAircraft?.aircraft_type_detail?.max_range_nm || selectedAircraft?.max_range_nm
  const showRangeWarning = flags.is_cross_country && selectedRoute?.total_distance_nm && aircraftMaxRange && Number(selectedRoute.total_distance_nm) > Number(aircraftMaxRange)
  const checkConstraints = useCheckConstraints()
  const createFlight = useCreateFlight()

  // Dynamic filter for Exercises
  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      // Exclude ground events and knowledge tests from Ad-Hoc Flight Form
      if (ex.is_ground_event || ex.is_knowledge_test) return false;
      
      if (flightType === 'dual') return ['dual', 'either'].includes(ex.default_flight_type)
      return ['solo', 'either'].includes(ex.default_flight_type)
    })
  }, [exercises, flightType])

  // Dynamic filter for Aircraft
  const filteredFleet = useMemo(() => {
    const airworthy = fleet.filter(a => a.status === 'airworthy')
    if (flags.is_simulator) {
      return airworthy.filter(a => a.aircraft_type_name?.toLowerCase().includes('simulator') || a.aircraft_type_name?.toLowerCase().includes('fstd'))
    }
    return airworthy.filter(a => !a.aircraft_type_name?.toLowerCase().includes('simulator') && !a.aircraft_type_name?.toLowerCase().includes('fstd'))
  }, [fleet, flags.is_simulator])

  // Populate flags when exercise changes
  useEffect(() => {
    const ex = exercises.find(e => e.id === exerciseId)
    if (ex) {
      setFlags({
        is_cross_country: ex.default_is_cross_country || false,
        is_night: ex.default_is_night || false,
        is_instrument_simulated: ex.default_is_instrument_simulated || false,
        is_instrument_actual: ex.default_is_instrument_actual || false,
        is_skill_test: ex.default_is_skill_test || false,
        is_simulator: ex.default_is_simulator || false,
        is_ferry: false,
      })
    }
  }, [exerciseId, exercises])

  // Reset P2/P3 when flight type changes to solo
  useEffect(() => {
    if (flightType === 'solo') {
      setP2p3('')
    }
  }, [flightType])

  // Constraints Checking Logic
  const [blockData, setBlockData] = useState<{ hard: any[], soft: any[] } | null>(null)

  useEffect(() => {
    const runCheck = async () => {
      if (!aircraftId || !scheduledStart || !scheduledEnd) {
        setBlockData(null)
        setOverrideMode(false)
        return
      }

      let reqStudent: string | undefined = undefined
      let reqInstructor: string | undefined = undefined
      let reqSecInstructor: string | undefined = undefined

      if (flightType === 'dual') {
        reqInstructor = isExternalP1 ? undefined : p1.replace('instructor_', '')
        if (p2p3.startsWith('student_')) reqStudent = p2p3.replace('student_', '')
        if (p2p3.startsWith('instructor_')) reqSecInstructor = p2p3.replace('instructor_', '')
      } else {
        if (p1.startsWith('student_')) reqStudent = p1.replace('student_', '')
        if (p1.startsWith('instructor_')) reqInstructor = p1.replace('instructor_', '')
      }

      const durationMinutes = dayjs(scheduledEnd).diff(dayjs(scheduledStart), 'minute')
      if (durationMinutes <= 0) return

      try {
        const res = await checkConstraints.mutateAsync({
          student_id: reqStudent || undefined,
          instructor_id: reqInstructor || undefined,
          secondary_instructor_id: reqSecInstructor || undefined,
          aircraft_id: aircraftId || undefined,
          exercise_id: exerciseId || undefined,
          duration_minutes: durationMinutes,
          is_solo: flightType === 'solo'
        })

        if (!res.all_passed) {
          const hard = res.hard_failures || res.blocking_failures || []
          const soft = res.soft_failures || res.warnings || []
          setBlockData({ hard, soft })

          if (hard.length > 0) {
            setOverrideMode(false)
          } else if (soft.length > 0) {
            setOverrideMode(true)
          }
        } else {
          setBlockData(null)
          setOverrideMode(false)
        }
      } catch (err) {
        console.error("Constraint check error:", err)
      }
    }

    const timer = setTimeout(() => {
      runCheck()
    }, 500) // Debounce

    return () => clearTimeout(timer)
  }, [flightType, p1, p2p3, isExternalP1, aircraftId, exerciseId, scheduledStart, scheduledEnd])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let payloadFlightType = flightType
    let reqStudent: string | undefined = undefined
    let reqInstructor: string | undefined = undefined
    let reqSecInstructor: string | undefined = undefined

    if (flightType === 'dual') {
      reqInstructor = isExternalP1 ? undefined : p1.replace('instructor_', '')
      if (p2p3.startsWith('student_')) {
        reqStudent = p2p3.replace('student_', '')
        payloadFlightType = 'dual'
      }
      if (p2p3.startsWith('instructor_')) {
        reqSecInstructor = p2p3.replace('instructor_', '')
        payloadFlightType = 'instructor_dual' as any
      }
    } else {
      payloadFlightType = 'solo'
      if (p1.startsWith('student_')) reqStudent = p1.replace('student_', '')
      if (p1.startsWith('instructor_')) reqInstructor = p1.replace('instructor_', '')
    }

    const payload: any = {
      base: activeBaseId ?? undefined,
      flight_type: payloadFlightType,
      is_cross_country: flags.is_cross_country,
      is_night: flags.is_night,
      is_instrument_simulated: flags.is_instrument_simulated,
      is_instrument_actual: flags.is_instrument_actual,
      is_skill_test: flags.is_skill_test,
      is_simulator: flags.is_simulator,
      is_ferry: flags.is_ferry,
      is_external_p1: isExternalP1,
      external_p1_name: isExternalP1 ? externalP1Name : undefined,
      aircraft: aircraftId,
      instructor: reqInstructor,
      student: reqStudent,
      secondary_instructor: reqSecInstructor,
      exercise_id: exerciseId || undefined,
      cross_country_route: crossCountryRouteId || undefined,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      notes: 'Ad-hoc flight created by Dispatch'
    }

    try {
      if (overrideMode) {
        await createFlight.mutateAsync({
          ...payload,
          status: 'draft',
          override_requested: true,
          override_reason: overrideReason
        } as any)
        toast.success('Sent to CFI for Approval!')
      } else {
        const isFutureDate = dayjs(payload.scheduled_start).isAfter(dayjs(), 'day')
        const initialStatus = (user?.role === 'dispatcher' && isFutureDate) ? 'draft' : 'confirmed'

        await createFlight.mutateAsync({
          ...payload,
          status: initialStatus,
          cfi_override: cfiOverride
        } as any)
        toast.success(initialStatus === 'draft' ? 'Flight created!' : 'Ad-hoc flight confirmed!')
      }

      onSuccess()
    } catch (err: any) {
      const errorData = err?.response?.data;
      const rulesData = errorData?.scheduling_rules || errorData?.errors?.scheduling_rules || errorData?.rules;
      const rules = Array.isArray(rulesData) ? rulesData[0] : rulesData;

      if (rules && (!rules.all_passed || rules.warnings?.length > 0 || rules.soft_failures?.length > 0)) {
        const hard = rules.hard_failures || rules.blocking_failures || [];
        const soft = rules.soft_failures || rules.warnings || [];
        setBlockData({ hard, soft });

        if (hard.length > 0) {
          setOverrideMode(false);
          toast.error('Flight blocked by hard constraints. Cannot be scheduled.');
        } else if (soft.length > 0) {
          setOverrideMode(true);
          toast.error('Flight blocked by soft rules. Request override?');
        }
      } else {
        const fallbackMsg = errorData?.conflict
          || errorData?.errors?.conflict
          || errorData?.detail
          || errorData?.errors?.detail
          || 'Failed to create flight. Check constraints or conflicts.'
        toast.error(fallbackMsg)
      }
    }
  }

  const exerciseOptions = [
    { value: '', label: 'None / Routine Flight' },
    ...filteredExercises.map(ex => ({
      value: ex.id,
      label: `${ex.exercise_code} - ${ex.title}`
    }))
  ]

  const aircraftOptions = flags.is_simulator
    ? fstdDevices.map((sim: any) => ({
        value: sim.id,
        label: `${sim.device_id} (${sim.device_type})`
      }))
    : filteredFleet.map(ac => ({
        value: ac.id,
        label: `${ac.tail_number} (${ac.aircraft_type?.make_model})`
      }))

  const p1Options = []
  if (isExternalP1) {
    p1Options.push({
      label: "Instructors",
      options: instructors.map(instructor => ({
        value: `instructor_${instructor.id}`,
        label: `${instructor.user_detail?.first_name} ${instructor.user_detail?.last_name} ${instructor.cfi_licence_number ? `(CFI Lic: ${instructor.cfi_licence_number})` : ''}`
      }))
    })
  } else {
    p1Options.push({
      label: "Students",
      options: students.map(student => ({
        value: `student_${student.id}`,
        label: `${student.user_detail?.first_name} ${student.user_detail?.last_name} ${student.spl_number ? `(SPL: ${student.spl_number})` : ''}`
      }))
    })
    p1Options.push({
      label: "Instructors (Self-Fly)",
      options: instructors.map(instructor => ({
        value: `instructor_${instructor.id}`,
        label: `${instructor.user_detail?.first_name} ${instructor.user_detail?.last_name}`
      }))
    })
  }

  const p2Options = [
    { value: '', label: 'None' },
    {
      label: "Students (P3)",
      options: students
        .filter(student => `student_${student.id}` !== p1)
        .map(student => ({
          value: `student_${student.id}`,
          label: `${student.user_detail?.first_name} ${student.user_detail?.last_name} ${student.spl_number ? `(SPL: ${student.spl_number})` : ''}`
        }))
    },
    {
      label: "Instructors (P2)",
      options: instructors
        .filter(instructor => `instructor_${instructor.id}` !== p1)
        .map(instructor => ({
          value: `instructor_${instructor.id}`,
          label: `${instructor.user_detail?.first_name} ${instructor.user_detail?.last_name}`
        }))
    }
  ]

  const getSelectedOption = (opts: any[], val: string) => {
    for (const group of opts) {
      if (group.value === val) return group
      if (group.options) {
        const found = group.options.find((o: any) => o.value === val)
        if (found) return found
      }
    }
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        {/* FLIGHT TYPE */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Flight Type *</label>
          <select
            value={flightType}
            onChange={e => setFlightType(e.target.value as 'dual'|'solo')}
            className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800 font-semibold"
          >
            <option value="dual">Dual</option>
            <option value="solo">Solo</option>
          </select>
        </div>

        {/* Exercise Selection */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Exercise</label>
          <Select
            value={exerciseOptions.find(o => o.value === exerciseId) || null}
            onChange={(option: any) => setExerciseId(option ? option.value : '')}
            options={exerciseOptions}
            placeholder="Select Exercise..."
            className="text-sm"
            classNames={{
              control: () => "rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800",
              menu: () => "dark:bg-slate-800 dark:text-slate-200",
              option: ({ isFocused }) => isFocused ? "dark:bg-slate-700" : "dark:bg-slate-800",
              singleValue: () => "dark:text-slate-200",
            }}
          />
        </div>

        {/* FLIGHT FLAGS */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(flags).map(([key, val]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <input 
                type="checkbox" 
                checked={val} 
                onChange={e => setFlags(f => ({ ...f, [key]: e.target.checked }))} 
                className="h-4 w-4 text-primary-600 focus:ring-primary-500" 
              />
              {key.replace('is_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </label>
          ))}
        </div>

        {/* Navigation Route selector — available for both cross-country and local short-nav flights */}
        {ccRoutes.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Navigation Route (optional)</label>
            <select value={crossCountryRouteId} onChange={e => setCrossCountryRouteId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="">— Select a saved route —</option>
              {ccRoutes.map((r: any) => (
                <option key={r.id} value={r.id}>{r.name} ({r.departure_icao} → {r.destination_icao})</option>
              ))}
            </select>
            {showRangeWarning && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                ⚠️ Route distance ({selectedRoute?.total_distance_nm} NM) exceeds aircraft maximum range ({aircraftMaxRange} NM). Ensure adequate fuel stops are planned.
              </div>
            )}
          </div>
        )}

        {/* P1 */}
        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Pilot in Command (P1) *
          </label>

          {flightType === 'dual' && (
             <label className="flex items-center gap-2 text-xs mb-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
               <input 
                 type="checkbox" 
                 checked={isExternalP1} 
                 onChange={e => setIsExternalP1(e.target.checked)}
                 className="h-3 w-3 text-primary-600 focus:ring-primary-500" 
               />
               External P1 / DGCA Examiner
             </label>
          )}

          {isExternalP1 && flightType === 'dual' ? (
            <input 
              type="text" 
              required
              value={externalP1Name}
              onChange={e => setExternalP1Name(e.target.value)}
              placeholder="Enter Examiner Name..."
              className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-900" 
            />
          ) : (
            <Select 
              value={getSelectedOption(p1Options, p1)}
              onChange={(option: any) => setP1(option ? option.value : '')}
              options={p1Options}
              placeholder="Select Pilot..."
              className="text-sm"
              classNames={{
                control: () => "rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800",
                menu: () => "dark:bg-slate-800 dark:text-slate-200",
                option: (state) => state.isFocused ? "dark:bg-slate-700" : ""
              }}
              styles={{
                control: (base) => ({
                  ...base,
                  borderColor: 'var(--tw-border-opacity)',
                  borderRadius: '0.5rem',
                  padding: '2px',
                  backgroundColor: 'transparent'
                }),
                menu: (base) => ({ ...base, zIndex: 50 })
              }}
              isSearchable
            />
          )}
        </div>

        {/* P2/P3 */}
        {flightType === 'dual' && (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Second Pilot / Student (P2 / P3)
            </label>
            <Select 
              value={getSelectedOption(p2Options, p2p3) || p2Options[0]}
              onChange={(option: any) => setP2p3(option ? option.value : '')}
              options={p2Options}
              placeholder="Select P2/P3..."
              className="text-sm"
              classNames={{
                control: () => "rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800",
                menu: () => "dark:bg-slate-800 dark:text-slate-200",
                option: (state) => state.isFocused ? "dark:bg-slate-700" : ""
              }}
              styles={{
                control: (base) => ({
                  ...base,
                  borderColor: 'var(--tw-border-opacity)',
                  borderRadius: '0.5rem',
                  padding: '2px',
                  backgroundColor: 'transparent'
                }),
                menu: (base) => ({ ...base, zIndex: 50 })
              }}
              isSearchable
            />
          </div>
        )}

        {/* Aircraft / Simulator */}
        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Aircraft / Simulator *
          </label>
          <Select
            value={aircraftOptions.find((o: any) => o.value === aircraftId) || null}
            onChange={(option: any) => setAircraftId(option ? option.value : '')}
            options={aircraftOptions}
            placeholder="Select Aircraft/Simulator..."
            className="text-sm"
            classNames={{
              control: () => "rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800",
              menu: () => "dark:bg-slate-800 dark:text-slate-200",
              option: ({ isFocused }) => isFocused ? "dark:bg-slate-700" : "dark:bg-slate-800",
              singleValue: () => "dark:text-slate-200",
            }}
          />
        </div>

        {/* CFI OVERRIDE CHECKBOX */}
        {user?.role && ['cfi', 'superadmin'].includes(user.role) && (
          <div className="col-span-2 pt-3 pb-1 border-t border-slate-100 dark:border-slate-700">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={cfiOverride} onChange={e => setCfiOverride(e.target.checked)} className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500" />
              Override Syllabus Prerequisites (CFI Only)
            </label>
            <p className="text-xs text-slate-500 ml-6 mt-1">
              Bypass the hard block to allow scheduling this exercise even if prerequisites were not passed.
            </p>
          </div>
        )}

        {/* TIMES */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Scheduled Start *</label>
            <input type="datetime-local" required value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Scheduled End *</label>
            <input type="datetime-local" required value={scheduledEnd} onChange={e => setScheduledEnd(e.target.value)} className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          </div>
        </div>
      </div>

      {blockData && (blockData.hard.length > 0 || blockData.soft.length > 0) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <h4 className="text-sm font-bold text-red-800 dark:text-red-200 mb-2">Compliance Check Failed</h4>

          {blockData.hard.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider dark:text-red-400">Hard Constraints (Cannot Override)</span>
              <ul className="list-disc pl-5 text-xs text-red-700 dark:text-red-300 mb-3 space-y-1 mt-1">
                {blockData.hard.map((rule: any, idx: number) => (
                  <li key={idx}>{rule.detail || rule.rule}</li>
                ))}
              </ul>
            </div>
          )}

          {blockData.soft.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider dark:text-amber-500">Soft Constraints (CFI Override Permitted)</span>
              <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-300 space-y-1 mt-1">
                {blockData.soft.map((rule: any, idx: number) => (
                  <li key={idx}>{rule.detail || rule.rule}</li>
                ))}
              </ul>
            </div>
          )}

          {overrideMode && blockData.hard.length === 0 && (
            <div className="mt-4 pt-3 border-t border-red-200/50">
              <label className="mb-1 block text-xs font-medium text-amber-800 dark:text-amber-400">Reason for CFI Override Request *</label>
              <textarea
                required
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="Explain why this flight should be approved..."
                className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button
          type="submit"
          loading={createFlight.isPending}
          className="flex-1"
          variant={overrideMode ? 'danger' : 'primary'}
          disabled={blockData?.hard ? blockData.hard.length > 0 : false}
        >
          {overrideMode ? 'Send Request to CFI' : 'Create & Confirm'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
