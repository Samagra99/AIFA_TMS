import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSubmitOccurrence } from '@/api/hooks/useCompliance'
import { useBases } from '@/api/hooks'
import { Button } from '@/components/ui'
import { toast } from 'sonner'

const TYPES = ['incident','accident','near_miss','hazard_report','airspace_infringement','bird_strike','technical_defect']
const SEVERITIES = ['low','medium','high','critical']

const schema = z.object({
  base:             z.string().uuid('Select a base'),
  occurrence_type:  z.string().min(1),
  severity:         z.enum(['low','medium','high','critical']),
  event_datetime:   z.string().min(1, 'Required'),
  event_location:   z.string().optional(),
  description:      z.string().min(20, 'Minimum 20 characters required'),
  immediate_actions:z.string().optional(),
})
type FD = z.infer<typeof schema>

interface Props { onSuccess?: () => void }

const SEVERITY_COLOR: Record<string,string> = {
  low:      'border-emerald-400 bg-emerald-50 text-emerald-700',
  medium:   'border-amber-400 bg-amber-50 text-amber-700',
  high:     'border-orange-400 bg-orange-50 text-orange-700',
  critical: 'border-red-500 bg-red-50 text-red-700',
}

export function OccurrenceForm({ onSuccess }: Props) {
  const submit = useSubmitOccurrence()
  const { data: bases } = useBases()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FD>({
    resolver: zodResolver(schema),
    defaultValues: {
      occurrence_type: 'incident',
      severity: 'low',
      event_datetime: new Date().toISOString().slice(0,16),
    },
  })
  const sev = watch('severity')

  const onSubmit = async (data: FD) => {
    try {
      await submit.mutateAsync(data as any)
      toast.success('Occurrence report submitted')
      onSuccess?.()
    } catch { toast.error('Failed to submit occurrence') }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Base *</label>
          <select {...register('base')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white">
            <option value="">Select…</option>
            {bases?.results.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {errors.base && <p className="mt-0.5 text-xs text-red-600">{errors.base.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Event Date & Time *</label>
          <input type="datetime-local" {...register('event_datetime')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
          {errors.event_datetime && <p className="mt-0.5 text-xs text-red-600">{errors.event_datetime.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Occurrence Type *</label>
          <select {...register('occurrence_type')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm capitalize dark:border-slate-700 dark:bg-slate-700 dark:text-white">
            {TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Event Location</label>
          <input {...register('event_location')} placeholder="e.g. Final approach RWY 09"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
        </div>
      </div>

      {/* Severity picker */}
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Severity *</p>
        <div className="grid grid-cols-4 gap-2">
          {SEVERITIES.map(s => (
            <label key={s} className={`flex cursor-pointer flex-col items-center rounded-xl border-2 p-3 text-center capitalize transition-all ${watch('severity')===s ? SEVERITY_COLOR[s] : 'border-slate-200 dark:border-slate-700'}`}>
              <input type="radio" value={s} {...register('severity')} className="sr-only" />
              <span className="text-sm font-semibold">{s}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Description *</label>
        <textarea {...register('description')} rows={4}
          placeholder="Describe the occurrence in detail — what happened, sequence of events, conditions…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
        {errors.description && <p className="mt-0.5 text-xs text-red-600">{errors.description.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Immediate Actions Taken</label>
        <textarea {...register('immediate_actions')} rows={2}
          placeholder="What actions were taken immediately after the event…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
      </div>

      {sev === 'critical' && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          ⚠ <strong>Critical severity</strong> — this report will trigger an immediate SMS alert to the CFI and Safety Officer.
        </div>
      )}

      <Button type="submit" loading={submit.isPending}
        variant={sev==='critical'?'danger':'primary'} className="w-full">
        Submit Occurrence Report
      </Button>
    </form>
  )
}
