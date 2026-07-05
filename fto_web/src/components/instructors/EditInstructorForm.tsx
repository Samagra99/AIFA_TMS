import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEditInstructor } from '@/api/hooks/useProfileEdits'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Instructor } from '@/api/types'

const schema = z.object({
  cfi_licence_number:         z.string().optional().nullable(),
  cfi_expiry:                 z.string().optional().nullable(),
  instrument_rating:          z.boolean(),
  multi_engine_rating:        z.boolean(),
  fdtl_daily_hours:           z.string().min(1, 'Required'),
  fdtl_weekly_hours:          z.string().min(1, 'Required'),
  fdtl_monthly_hours:         z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

interface Props {
  instructor: Instructor
  onSuccess?: () => void
}

const asInput = (v: string | null | undefined) => v ?? ''
const asPayload = (v: string) => (v === '' ? null : v)

/** Backend stores FDTL as minutes; the form works in hours for readability. */
const minToHours = (min: number) => (min / 60).toFixed(1)
const hoursToMin  = (hrs: string)  => Math.round(parseFloat(hrs) * 60)

export function EditInstructorForm({ instructor, onSuccess }: Props) {
  const editInstructor = useEditInstructor()

  const { register, handleSubmit, control, reset, formState: { errors, isDirty } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        cfi_licence_number:  asInput(instructor.cfi_licence_number),
        cfi_expiry:          asInput(instructor.cfi_expiry),
        instrument_rating:   instructor.instrument_rating,
        multi_engine_rating: instructor.multi_engine_rating,
        fdtl_daily_hours:    minToHours(instructor.fdtl_daily_remaining_min),
        fdtl_weekly_hours:   minToHours(instructor.fdtl_weekly_remaining_min),
        fdtl_monthly_hours:  minToHours(instructor.fdtl_monthly_remaining_min),
      },
    })

  useEffect(() => {
    reset({
      cfi_licence_number:  asInput(instructor.cfi_licence_number),
      cfi_expiry:          asInput(instructor.cfi_expiry),
      instrument_rating:   instructor.instrument_rating,
      multi_engine_rating: instructor.multi_engine_rating,
      fdtl_daily_hours:    minToHours(instructor.fdtl_daily_remaining_min),
      fdtl_weekly_hours:   minToHours(instructor.fdtl_weekly_remaining_min),
      fdtl_monthly_hours:  minToHours(instructor.fdtl_monthly_remaining_min),
    })
  }, [instructor.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: FormData) => {
    try {
      await editInstructor.mutateAsync({
        id: instructor.id,
        cfi_licence_number:        data.cfi_licence_number || null,
        cfi_expiry:                asPayload(data.cfi_expiry ?? ''),
        instrument_rating:         data.instrument_rating,
        multi_engine_rating:       data.multi_engine_rating,
        fdtl_daily_remaining_min:   hoursToMin(data.fdtl_daily_hours),
        fdtl_weekly_remaining_min:  hoursToMin(data.fdtl_weekly_hours),
        fdtl_monthly_remaining_min: hoursToMin(data.fdtl_monthly_hours),
      })
      toast.success(`${instructor.user_detail.first_name}'s profile updated`)
      onSuccess?.()
    } catch (err: any) {
      const detail = err?.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(' ')
        : 'Failed to update instructor'
      toast.error(detail)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* CFI licence */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          CFI / Instructor Licence
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="CFI Licence Number">
            <input {...register('cfi_licence_number')} placeholder="e.g. CFI-IN-00214"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
          <Field label="Licence Expiry">
            <input type="date" {...register('cfi_expiry')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
        </div>
      </section>

      {/* Ratings */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ratings
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Controller name="instrument_rating" control={control} render={({ field }) => (
            <RatingToggle label="Instrument Rating" checked={field.value} onChange={field.onChange} />
          )} />
          <Controller name="multi_engine_rating" control={control} render={({ field }) => (
            <RatingToggle label="Multi-Engine Rating" checked={field.value} onChange={field.onChange} />
          )} />
        </div>
      </section>

      {/* FDTL */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          FDTL Remaining Hours
        </h3>
        <p className="mb-3 -mt-1 text-xs text-slate-400">
          Manually adjust remaining Flight Duty Time Limitation hours — for example,
          after correcting a roster error. These reset automatically to full limits
          (8h / 30h / 100h) by the nightly Celery task under normal operation.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Daily (hrs)">
            <input type="number" step="0.1" {...register('fdtl_daily_hours')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            {errors.fdtl_daily_hours && <p className="mt-1 text-xs text-red-600">{errors.fdtl_daily_hours.message}</p>}
          </Field>
          <Field label="Weekly (hrs)">
            <input type="number" step="0.1" {...register('fdtl_weekly_hours')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            {errors.fdtl_weekly_hours && <p className="mt-1 text-xs text-red-600">{errors.fdtl_weekly_hours.message}</p>}
          </Field>
          <Field label="Monthly (hrs)">
            <input type="number" step="0.1" {...register('fdtl_monthly_hours')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            {errors.fdtl_monthly_hours && <p className="mt-1 text-xs text-red-600">{errors.fdtl_monthly_hours.message}</p>}
          </Field>
        </div>
      </section>

      <div className="flex gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button type="submit" loading={editInstructor.isPending} disabled={!isDirty} className="flex-1">
          Save Changes
        </Button>
      </div>
    </form>
  )
}

function RatingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn(
      'flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-colors',
      checked
        ? 'border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-950'
        : 'border-slate-200 dark:border-slate-700'
    )}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded accent-primary-600" />
      <span className={cn('text-sm font-medium',
        checked ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300')}>
        {label}
      </span>
    </label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
    </div>
  )
}
