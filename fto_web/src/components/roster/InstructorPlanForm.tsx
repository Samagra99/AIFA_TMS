import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useMyStudents, useMyPlan, useCreateInstructorPlan,
  useAddPlanEntry, useDeletePlanEntry, useSubmitPlan, useMarkLeave,
  type StudentProgress,
} from '@/api/hooks/useRostering'
import { useSyllabusStages } from '@/api/hooks/useSyllabus'
import { Button, Card, Badge, Spinner } from '@/components/ui'
import {
  CheckCircle2, AlertTriangle, Plus, Trash2,
  Clock, BookOpen, User, ChevronDown, Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import apiClient from '@/api/client'

interface Props {
  planRequestId: string
  planRequestStatus?: string
}

const availSchema = z.object({
  availability_start: z.string().min(1, 'Required'),
  availability_end: z.string().min(1, 'Required'),
  notes: z.string().optional(),
})
type AvailForm = z.infer<typeof availSchema>

export function InstructorPlanForm({ planRequestId, planRequestStatus }: Props) {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [extraStudents, setExtraStudents] = useState<StudentProgress[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StudentProgress[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [onLeave, setOnLeave] = useState(false);

  const [pendingEntry, setPendingEntry] = useState<{
    studentProgress: StudentProgress
    exerciseId: string
    exerciseCode: string
    exerciseTitle: string
    prereqMet: boolean
    isBuffer: boolean // NEW: Track if it's a buffer exercise
    preferredStart: string
    overrideReason: string
  } | null>(null)

  const { data: students, isLoading: studLoading } = useMyStudents()
  const { data: plan, isLoading: planLoading } = useMyPlan(planRequestId)
  const { data: stagesData } = useSyllabusStages()

  const createPlan = useCreateInstructorPlan()
  const addEntry = useAddPlanEntry()
  const deleteEntry = useDeletePlanEntry()
  const submitPlan = useSubmitPlan()
  const markLeave = useMarkLeave()

  const { register, handleSubmit, formState: { errors } } = useForm<AvailForm>({
    resolver: zodResolver(availSchema),
    defaultValues: {
      availability_start: '06:00',
      availability_end: '14:00',
    },
  })

  const onCreatePlan = async (data: AvailForm) => {
    try {
      await createPlan.mutateAsync({ plan_request: planRequestId, ...data })
      toast.success('Availability set — now add your sorties below')
    } catch { toast.error('Failed to create plan') }
  }

  const onAddEntry = async () => {
    if (!pendingEntry || !plan) return

    // NEW: Buffer exercises automatically bypass the override requirement
    const needsOverride = !pendingEntry.prereqMet && !pendingEntry.isBuffer

    if (needsOverride && !pendingEntry.overrideReason.trim()) {
      toast.error('CFI override reason is required when prerequisite is not met')
      return
    }

    try {
      await addEntry.mutateAsync({
        plan: plan.id,
        student: pendingEntry.studentProgress.student_id,
        exercise: pendingEntry.exerciseId,
        preferred_start: pendingEntry.preferredStart || undefined,
        cfi_override_requested: needsOverride,
        cfi_override_reason: needsOverride ? pendingEntry.overrideReason : undefined,
      })
      toast.success(`Sortie added: ${pendingEntry.studentProgress.student_name} — ${pendingEntry.exerciseCode}`)
      setPendingEntry(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.exercise?.[0] ?? 'Failed to add sortie')
    }
  }

  const onSubmitPlan = async () => {
    if (!plan) return
    try {
      await submitPlan.mutateAsync(plan.id)
      toast.success('Plan submitted to scheduling officer')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Submission failed')
    }
  }

  const searchUnassignedStudent = async () => {
    if (searchQuery.length < 2) return
    setIsSearching(true)
    try {
      const res = await apiClient.get<StudentProgress[]>(`/rostering/instructor-plans/search-students/?q=${encodeURIComponent(searchQuery)}`)
      setSearchResults(res.data)
    } catch (err) {
      toast.error('Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const addExtraStudent = (student: StudentProgress) => {
    const alreadyAssigned = (students ?? []).find(s => s.student_id === student.student_id)
    const alreadyAdded = extraStudents.find(s => s.student_id === student.student_id)
    if (alreadyAssigned || alreadyAdded) {
      toast.info('Student is already in your planning list')
    } else {
      setExtraStudents(prev => [...prev, student])
      toast.success(`${student.student_name} added to planning list`)
    }
    setSearchResults([])
    setSearchQuery('')
  }

  // UPDATED: Extract exercises and include the is_buffer flag
  const exercises = stagesData?.results.flatMap(s =>
    s.lessons.flatMap(l => l.exercises)
  ) ?? []

  const allStudents = [...(students ?? []), ...extraStudents]

  if (studLoading || planLoading) return (
    <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
  )

  const isRequestClosed = ['closed', 'pending_cfi_approval', 'rostered'].includes(planRequestStatus ?? '')
  const isPlanLocked = isRequestClosed || plan?.status === 'submitted' || plan?.status === 'approved' || plan?.status === 'leave'

  // Determine if the current pending entry needs a CFI override box
  const pendingNeedsOverride = pendingEntry && !pendingEntry.prereqMet && !pendingEntry.isBuffer;

  return (
    <div className="space-y-6">
      {/* ── Step 1: Set availability ─────────────────────────────────────── */}
      {!plan ? (
        isRequestClosed ? (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Plan Request Closed
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Submissions are closed for this date. No further availability or sortie plans can be submitted.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
              Step 1 — Set your availability window
            </p>
            <p className="mb-4 text-xs text-slate-500">
              Tell the scheduling officer when you are available to fly tomorrow.
            </p>
            <form onSubmit={handleSubmit(onCreatePlan)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Available from *
                  </label>
                  <input type="time" {...register('availability_start')}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                    dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
                  {errors.availability_start &&
                    <p className="mt-0.5 text-xs text-red-600">{errors.availability_start.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Available until *
                  </label>
                  <input type="time" {...register('availability_end')}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                    dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
                  {errors.availability_end &&
                    <p className="mt-0.5 text-xs text-red-600">{errors.availability_end.message}</p>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Notes (optional)</label>
                <textarea {...register('notes')} rows={2}
                  placeholder="E.g. prefer morning slots, available for cross-country only after 08:00…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                  dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
              </div>
              <Button type="submit" loading={createPlan.isPending}>
                Set Availability
              </Button>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="leave"
                  checked={onLeave || (plan && (plan as any).status === 'leave')}
                  onChange={async (e) => {
                    const isChecked = e.target.checked;
                    setOnLeave(isChecked);
                    if (isChecked) {
                      try {
                        await markLeave.mutateAsync({ plan_request: planRequestId, notes: 'Instructor on leave' });
                        toast.success('Marked as ON LEAVE for this date');
                      } catch {
                        toast.error('Failed to update leave status');
                      }
                    }
                  }}
                />
                <label htmlFor="leave" className="text-sm font-bold text-red-700">Mark as ON LEAVE for this day</label>
              </div>
            </form>
          </Card>
        )
      ) : (
        <Card className={cn(
          'flex items-center justify-between',
          isPlanLocked && 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
        )}>
          <div className="flex items-center gap-3">
            <Clock className={`h-5 w-5 ${isPlanLocked ? 'text-emerald-600' : 'text-primary-600'}`} />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {plan.availability_start} — {plan.availability_end}
              </p>
              <p className="text-xs text-slate-500">Your availability window</p>
            </div>
          </div>
          <Badge variant={
            plan.status === 'approved' ? 'success' :
              plan.status === 'submitted' ? 'primary' : 'default'
          }>
            {plan.status.toUpperCase()}
          </Badge>
        </Card>
      )}

      {/* ── Step 2: Add sortie entries ───────────────────────────────────── */}
      {plan && !isPlanLocked && (
        <>
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              Step 2 — Plan your sorties
            </p>
            <div className="space-y-3">
              {(allStudents ?? []).map(s => (
                <StudentCard
                  key={s.student_id}
                  student={s}
                  exercises={exercises as any}
                  isExpanded={expandedStudent === s.student_id}
                  onToggle={() =>
                    setExpandedStudent(expandedStudent === s.student_id ? null : s.student_id)
                  }
                  onSelectExercise={(exId, exCode, exTitle, prereqMet, isBuffer) =>
                    setPendingEntry({
                      studentProgress: s,
                      exerciseId: exId,
                      exerciseCode: exCode,
                      exerciseTitle: exTitle,
                      prereqMet,
                      isBuffer, // NEW
                      preferredStart: '',
                      overrideReason: '',
                    })
                  }
                />
              ))}
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Add Unassigned Student (Check Rides)
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or enrollment number..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchUnassignedStudent()}
                    className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <Button variant="secondary" onClick={searchUnassignedStudent} loading={isSearching}>
                  Search
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800 space-y-1">
                  {searchResults.map(res => (
                    <div key={res.student_id} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{res.student_name}</p>
                        <p className="text-xs text-slate-500">Total Hours: {res.hours_total} hr</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => addExtraStudent(res)}>
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pending entry confirmation */}
          {pendingEntry && (
            <Card className="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950">
              <p className="mb-3 text-sm font-semibold text-primary-900 dark:text-primary-100">
                Add sortie: {pendingEntry.studentProgress.student_name}
              </p>
              <div className="mb-3 rounded-lg bg-white px-4 py-3 dark:bg-slate-800">
                <p className="font-mono text-sm font-bold text-primary-600">
                  {pendingEntry.exerciseCode} {pendingEntry.isBuffer && "(Buffer Exercise)"}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{pendingEntry.exerciseTitle}</p>

                {pendingEntry.prereqMet || pendingEntry.isBuffer
                  ? <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {pendingEntry.isBuffer ? "Buffer Exercise (No Prereqs)" : "Prerequisites met"}
                  </p>
                  : <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> Previous exercise not yet passed — CFI override needed
                  </p>}
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Preferred start time (optional)
                </label>
                <input type="time"
                  value={pendingEntry.preferredStart}
                  onChange={e => setPendingEntry(prev => prev ? ({ ...prev, preferredStart: e.target.value }) : null)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm
                    dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
              </div>

              {/* NEW: Dynamic Justification Box (skips if isBuffer is true) */}
              {pendingNeedsOverride && (
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-bold text-amber-700 dark:text-amber-300">
                    CFI Override Reason * (required)
                  </label>
                  <textarea
                    value={pendingEntry.overrideReason}
                    onChange={e => setPendingEntry(prev => prev ? ({ ...prev, overrideReason: e.target.value }) : null)}
                    rows={2}
                    placeholder="Explain why this student should attempt this exercise despite not passing the prerequisite…"
                    className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm
                      dark:border-amber-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={onAddEntry} loading={addEntry.isPending} size="sm">
                  <Plus className="h-3.5 w-3.5" /> Add to Plan
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setPendingEntry(null)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {/* Current entries */}
          {plan.entries.length > 0 && (
            <Card>
              <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                Your Plan ({plan.entries.length} sortie{plan.entries.length > 1 ? 's' : ''})
              </p>
              <div className="space-y-2">
                {plan.entries.map(entry => (
                  <div key={entry.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200
                      bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {entry.student_name}
                        </span>
                        <span className="font-mono text-xs text-primary-600 dark:text-primary-400">
                          {entry.exercise_code}
                        </span>
                        {/* Status Badges */}
                        {!entry.prereq_met && !entry.cfi_override_approved && !entry.is_buffer && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold
                            text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                            Override Pending
                          </span>
                        )}
                        {entry.cfi_override_approved && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold
                            text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                            Override ✓
                          </span>
                        )}
                        {entry.is_buffer && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold
                            text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Buffer
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{entry.exercise_title}</p>
                      {entry.preferred_start && (
                        <p className="text-xs text-slate-400">
                          <Clock className="mr-1 inline h-3 w-3" />
                          Preferred: {entry.preferred_start}
                        </p>
                      )}
                    </div>
                    <button onClick={() => deleteEntry.mutate(entry.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50
                        hover:text-red-600 dark:hover:bg-red-950">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <Button onClick={onSubmitPlan} loading={submitPlan.isPending} className="w-full">
                  Submit Plan to Scheduling Officer
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Submitted state */}
      {isPlanLocked && plan && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                Plan submitted
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {plan?.entries.length} sortie{(plan?.entries.length ?? 0) > 1 ? 's' : ''} submitted.
                The scheduling officer will generate the roster.
              </p>
            </div>
          </div>
          {plan?.entries && plan.entries.length > 0 && (
            <div className="mt-4 space-y-1">
              {plan.entries.map(e => (
                <div key={e.id} className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                  <span className="font-mono">{e.exercise_code}</span>
                  <span>—</span>
                  <span>{e.student_name}</span>
                  {e.cfi_override_approved &&
                    <span className="text-xs text-emerald-600">(override approved)</span>}
                  {e.is_buffer &&
                    <span className="text-xs text-blue-600">(buffer)</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ── NEW: Student card with Custom Searchable Dropdown ─────────────────────────────
function StudentCard({
  student, exercises, isExpanded, onToggle, onSelectExercise,
}: {
  student: StudentProgress
  exercises: Array<{ id: string; exercise_code: string; title: string; prerequisite_ids: string[]; is_buffer: boolean }>
  isExpanded: boolean
  onToggle: () => void
  onSelectExercise: (id: string, code: string, title: string, prereqMet: boolean, isBuffer: boolean) => void
}) {
  const isCompliant = student.spl_valid && student.medical_valid

  // Custom Search State for the Exercise Dropdown
  const [exSearch, setExSearch] = useState('')

  // Filter and limit to 50 items for performance
  const filteredExercises = useMemo(() => {
    if (!exSearch) return exercises.slice(0, 50);
    const lowerQ = exSearch.toLowerCase();
    return exercises.filter(ex =>
      ex.title.toLowerCase().includes(lowerQ) ||
      ex.exercise_code.toLowerCase().includes(lowerQ)
    ).slice(0, 50);
  }, [exercises, exSearch]);

  // Compute prereqMet per exercise for this student
  const computePrereqMet = (ex: { id: string; prerequisite_ids: string[]; is_buffer: boolean }) => {
    if (ex.is_buffer) return true
    const prereqs = ex.prerequisite_ids || []
    if (prereqs.length === 0) return true
    const passedIds = student.passed_exercise_ids || []
    return prereqs.every(pid => passedIds.includes(String(pid)))
  }

  return (
    <div className={cn(
      'rounded-xl border transition-colors',
      isExpanded
        ? 'border-primary-300 dark:border-primary-700'
        : 'border-slate-200 dark:border-slate-700',
      !isCompliant && 'opacity-60'
    )}>
      <button onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left">
        {/* Compliance dot */}
        <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full',
          isCompliant ? 'bg-emerald-500' : 'bg-red-500')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white">{student.student_name}</span>
            {!student.spl_valid &&
              <span className="rounded bg-red-100 px-1.5 text-xs text-red-700">SPL expired</span>}
            {!student.medical_valid &&
              <span className="rounded bg-red-100 px-1.5 text-xs text-red-700">Medical expired</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
            <span>{student.hours_total} hr total</span>
            {student.last_exercise_code && (
              <span className="flex items-center gap-1">
                Last: <span className="font-mono text-slate-600 dark:text-slate-400">
                  {student.last_exercise_code}
                </span>
                {student.last_grade && (
                  <span className={cn('font-semibold',
                    student.last_grade >= 3 ? 'text-emerald-600' : 'text-amber-600')}>
                    ({student.last_grade}/5)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform',
          isExpanded && 'rotate-180')} />
      </button>

      {isExpanded && isCompliant && (
        <div className="border-t border-slate-100 px-4 pb-3 pt-2 dark:border-slate-700">

          {/* Recommended next exercise */}
          {student.next_exercise_id && (
            <div className="mb-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recommended next
              </p>
              <button
                onClick={() => onSelectExercise(
                  student.next_exercise_id!,
                  student.next_exercise_code!,
                  student.next_exercise_title!,
                  student.next_prereq_met,
                  false // Recommended exercises are usually not buffers
                )}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left',
                  'hover:border-primary-300 hover:bg-primary-50',
                  'dark:hover:border-primary-700 dark:hover:bg-primary-950',
                  student.next_prereq_met
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/50'
                    : 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50'
                )}
              >
                {student.next_prereq_met
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
                <div>
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    {student.next_exercise_code}
                  </span>
                  <span className="mx-2 text-slate-400">—</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {student.next_exercise_title}
                  </span>
                  {!student.next_prereq_met && (
                    <p className="mt-0.5 text-xs text-amber-600">
                      ⚠ Prerequisite not met — requires CFI override
                    </p>
                  )}
                </div>
                <Plus className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
              </button>
            </div>
          )}

          {/* NEW: Native React Searchable Dropdown for all other exercises */}
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search 100+ Exercises
          </p>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Type exercise name or code..."
                value={exSearch}
                onChange={e => setExSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/50">
              {filteredExercises.map(ex => (
                <button key={ex.id}
                  onClick={() => onSelectExercise(ex.id, ex.exercise_code, ex.title, computePrereqMet(ex), !!ex.is_buffer)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-slate-200 dark:hover:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300 w-14 shrink-0">
                      {ex.exercise_code}
                    </span>
                    <span className="truncate text-xs text-slate-600 dark:text-slate-400">
                      {ex.title}
                    </span>
                  </div>
                  {ex.is_buffer && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      Buffer
                    </span>
                  )}
                  {!ex.is_buffer && !computePrereqMet(ex) && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                      Override
                    </span>
                  )}
                </button>
              ))}
              {filteredExercises.length === 0 && (
                <p className="p-3 text-center text-xs text-slate-500">No exercises found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}