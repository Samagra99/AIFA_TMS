import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  usePlanRequests, useCreatePlanRequest, usePlanRequestProgress,
  useAllPlansForRequest, useApproveOverride,
  type DailyPlanRequest, type InstructorDailyPlan,
} from '@/api/hooks/useRostering'
import { useBases } from '@/api/hooks'
import { Button, Card, Badge, PageLoader, Modal } from '@/components/ui'
import { Plus, Users, Clock, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { fmt } from '@/lib/utils'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { useAuthStore } from '@/stores'

interface Props {
  onSelectRequest: (req: DailyPlanRequest) => void
  selectedRequestId?: string
}

const schema = z.object({
  plan_date: z.string().min(1, 'Required'),
  base: z.string().uuid('Select a base'),
  deadline: z.string().min(1, 'Required'),
  notes: z.string().optional(),
})
type FD = z.infer<typeof schema>

export function PlanRequestPanel({ onSelectRequest, selectedRequestId }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)

  const { data: reqData, isLoading } = usePlanRequests()
  const { data: basesData } = useBases()
  const createReq = useCreatePlanRequest()

  const { user } = useAuthStore()
  const isCFI = user?.role && ['cfi', 'superadmin'].includes(user.role.toLowerCase())

  const { register, handleSubmit, formState: { errors } } = useForm<FD>({
    resolver: zodResolver(schema),
    defaultValues: {
      plan_date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      deadline: dayjs().format('YYYY-MM-DDT20:00'),
    },
  })

  const onSubmit = async (data: FD) => {
    try {
      const req = await createReq.mutateAsync({
        ...data,
        deadline: new Date(data.deadline).toISOString(),
      })
      toast.success(`Plan request created for ${fmt.date(req.plan_date)}`)
      setShowCreate(false)
      onSelectRequest(req)
    } catch { toast.error('Failed to create plan request') }
  }

  const requests = reqData?.results ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Plan Requests</p>
          <p className="text-xs text-slate-500">
            Create a request to collect instructor plans for a given date
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-3.5 w-3.5" /> New Request
        </Button>
      </div>

      {/* List */}
      {isLoading ? <PageLoader /> : requests.length === 0 ? (
        <Card className="py-10 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-slate-200" />
          <p className="text-sm text-slate-400">No plan requests yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <RequestCard
              key={req.id}
              request={req}
              isSelected={selectedRequestId === req.id}
              isCFI={!!isCFI}
              onSelect={() => onSelectRequest(req)}
              onReview={() => setReviewId(req.id)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)}
        title="New Plan Request" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Flying Date *
              </label>
              <input type="date" {...register('plan_date')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                  dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
              {errors.plan_date &&
                <p className="mt-0.5 text-xs text-red-600">{errors.plan_date.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Base *
              </label>
              <select {...register('base')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                  dark:border-slate-700 dark:bg-slate-700 dark:text-white">
                <option value="">Select base…</option>
                {basesData?.results.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.icao_code})</option>
                ))}
              </select>
              {errors.base && <p className="mt-0.5 text-xs text-red-600">{errors.base.message}</p>}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Submission Deadline *
            </label>
            <input type="datetime-local" {...register('deadline')}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
            {errors.deadline &&
              <p className="mt-0.5 text-xs text-red-600">{errors.deadline.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Instructions to Instructors
            </label>
            <textarea {...register('notes')} rows={3}
              placeholder="e.g. Preference for cross-country students tomorrow. Avoid morning solo slots due to forecast DA…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm
                dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
          </div>
          <Button type="submit" loading={createReq.isPending} className="w-full">
            Send Plan Request to All Instructors
          </Button>
        </form>
      </Modal>

      {/* Override review modal */}
      {reviewId && (
        <OverrideReviewModal
          planRequestId={reviewId}
          onClose={() => setReviewId(null)}
        />
      )}
    </div>
  )
}

// ── Individual request card ────────────────────────────────────────────────────
function RequestCard({
  request: r, isSelected, isCFI, onSelect, onReview,
}: {
  request: DailyPlanRequest
  isSelected: boolean
  isCFI: boolean
  onSelect: () => void
  onReview: () => void
}) {
  const { data: progress } = usePlanRequestProgress(r.id)
  const pct = progress
    ? Math.round((progress.submitted / Math.max(progress.total, 1)) * 100)
    : 0

  const statusVariant =
    r.status === 'rostered' ? 'success' :
      r.status === 'closed' ? 'default' : 'primary'

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border p-4 transition-shadow hover:shadow-md ${isSelected
        ? 'border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-950'
        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
        }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">
            {fmt.date(r.plan_date)}
          </p>
          <p className="text-xs text-slate-500">{r.base_name} ({r.base_icao})</p>
        </div>
        <Badge variant={statusVariant} className="capitalize">{r.status}</Badge>
      </div>

      {/* Submission progress */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>Plans submitted</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {progress?.submitted ?? r.submitted_count}/{progress?.total ?? r.total_instructors}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-primary-500' : 'bg-amber-500'
              }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Deadline: {fmt.datetime(r.deadline)}
        </span>
        {isCFI && (
          <button
            onClick={e => { e.stopPropagation(); onReview() }}
            className="flex items-center gap-1 font-medium text-amber-600 hover:underline"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Review overrides
          </button>
        )}
      </div>

      {r.notes && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600
          dark:bg-slate-700 dark:text-slate-400 italic">
          "{r.notes}"
        </p>
      )}
    </div>
  )
}

// ── CFI override review modal ─────────────────────────────────────────────────
function OverrideReviewModal({
  planRequestId, onClose,
}: { planRequestId: string; onClose: () => void }) {
  const { data: plans } = useAllPlansForRequest(planRequestId)
  const approve = useApproveOverride()

  const overrideEntries = ((plans as InstructorDailyPlan[] | undefined) ?? [])
    .flatMap(p =>
      (p.entries ?? [])
        .filter(e => e.cfi_override_requested && !e.cfi_override_approved)
        .map(e => ({ ...e, instructor_name: p.instructor_name }))
    )

  return (
    <Modal open onClose={onClose} title="CFI Override Requests" size="lg">
      {overrideEntries.length === 0 ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          <p className="text-slate-500">No pending override requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The following instructors want to fly students on exercises before prerequisites
            are met. Review each request and approve or deny.
          </p>
          {overrideEntries.map(entry => (
            <div key={entry.id}
              className="rounded-xl border border-amber-200 bg-amber-50 p-4
                dark:border-amber-800 dark:bg-amber-950">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      {entry.student_name}
                    </span>
                    <span className="font-mono text-sm text-amber-700 dark:text-amber-300">
                      {entry.exercise_code}
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">
                    Requested by: {(entry as any).instructor_name}
                  </p>
                  {entry.cfi_override_reason && (
                    <p className="text-sm text-amber-800 dark:text-amber-200 italic">
                      "{entry.cfi_override_reason}"
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  loading={approve.isPending}
                  onClick={async () => {
                    try {
                      await approve.mutateAsync(entry.id)
                      toast.success(`Override approved for ${entry.student_name}`)
                    } catch { toast.error('Approval failed') }
                  }}
                  className="shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
