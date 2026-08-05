import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateMaintenanceRecord } from '@/api/hooks/useMaintenance'
import { useFleetStatus, useBases, useSnagEntries } from '@/api/hooks'
import { Button } from '@/components/ui'
import { toast } from 'sonner'

const MAINT_TYPES = [
  'line','50hr','100hr','200hr','600hr','annual','biennial','unscheduled','ad_compliance','sb_compliance'
]

const STATUS_TYPES = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

const schema = z.object({
  aircraft:          z.string().uuid('Select an aircraft'),
  base:              z.string().uuid('Select a base'),
  maintenance_type:  z.string().min(1),
  performed_at_date: z.string().optional(),
  performed_at_hours:z.string().optional(),
  next_due_hours:    z.string().optional(),
  next_due_date:     z.string().optional(),
  work_order_number: z.string().optional(),
  description:       z.string().min(10, 'Minimum 10 characters'),
  ame_licence_number:z.string().optional(),
  labour_hours:      z.string().optional(),
  status:            z.string().default('planned'),
  snag_ids:          z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  if (data.status === 'in_progress' || data.status === 'completed') {
    if (!data.performed_at_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['performed_at_date'], message: 'Required for in-progress or completed' })
    }
    if (!data.performed_at_hours) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['performed_at_hours'], message: 'Required for in-progress or completed' })
    }
  }
})
type FD = z.infer<typeof schema>

interface Props { onSuccess?: () => void }

export function NewRecordForm({ onSuccess }: Props) {
  const createRecord = useCreateMaintenanceRecord()
  const { data: fleet }  = useFleetStatus()
  const { data: bases }  = useBases()
  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<FD>({
    resolver: zodResolver(schema),
    defaultValues: { maintenance_type: '100hr', performed_at_date: new Date().toISOString().slice(0,10), status: 'planned', snag_ids: [] },
  })

  const selectedAircraft = watch('aircraft')
  const selectedStatus = watch('status')
  const { data: allSnags } = useSnagEntries(selectedAircraft)
  const openSnags = (allSnags ?? []).filter(s => !s.resolved_at)

  const selectedSnagIds = watch('snag_ids') || []
  const toggleSnag = (id: string) => {
    if (selectedSnagIds.includes(id)) {
      setValue('snag_ids', selectedSnagIds.filter(x => x !== id))
    } else {
      setValue('snag_ids', [...selectedSnagIds, id])
    }
  }

  const onSubmit = async (data: FD) => {
    try {
      await createRecord.mutateAsync(data as any)
      toast.success('Maintenance record created')
      onSuccess?.()
    } catch { toast.error('Failed to create record') }
  }

  const Input = ({ name, label, type='text', required=false }: any) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{label}{required&&' *'}</label>
      <input type={type} {...register(name)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
      {errors[name as keyof FD] && (
        <p className="mt-0.5 text-xs text-red-600">{(errors[name as keyof FD] as any)?.message}</p>
      )}
    </div>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Aircraft *</label>
          <select {...register('aircraft')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white">
            <option value="">Select…</option>
            {fleet?.map(a => <option key={a.id} value={a.id}>{a.tail_number} — {a.aircraft_type_name}</option>)}
          </select>
          {errors.aircraft && <p className="mt-0.5 text-xs text-red-600">{errors.aircraft.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Base *</label>
          <select {...register('base')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white">
            <option value="">Select…</option>
            {bases?.results.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {errors.base && <p className="mt-0.5 text-xs text-red-600">{errors.base.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Maintenance Type *</label>
          <select {...register('maintenance_type')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white">
            {MAINT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Status *</label>
          <select {...register('status')} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white">
            {STATUS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {selectedStatus !== 'planned' && (
          <>
            <Input name="performed_at_date"  label="Date Performed"    type="date" required />
            <Input name="performed_at_hours" label="Hobbs at Perform."  required />
            <Input name="next_due_hours"     label="Next Due (hours)" />
            <Input name="next_due_date"      label="Next Due (date)"   type="date" />
            <Input name="work_order_number"  label="Work Order #" />
            <Input name="ame_licence_number" label="AME Licence #" />
            <Input name="labour_hours"       label="Labour Hours" />
          </>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Description *</label>
        <textarea {...register('description')} rows={3} placeholder="Describe work performed…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
        {errors.description && <p className="mt-0.5 text-xs text-red-600">{errors.description.message}</p>}
      </div>
      
      {selectedAircraft && openSnags.length > 0 && (
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">Link Open Snags (Defects)</label>
          <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            {openSnags.map(snag => (
              <label key={snag.id} className="flex items-start space-x-3 rounded p-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                <input 
                  type="checkbox" 
                  checked={selectedSnagIds.includes(snag.id)}
                  onChange={() => toggleSnag(snag.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {snag.category === 'no_go' ? '🔴' : '🟡'} {snag.description}
                  </span>
                  <span className="text-xs text-slate-500">
                    Reported {new Date(snag.reported_at).toLocaleDateString()}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
      <Button type="submit" loading={createRecord.isPending} className="w-full">Create Maintenance Record</Button>
    </form>
  )
}
