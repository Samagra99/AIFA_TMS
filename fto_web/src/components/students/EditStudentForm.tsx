import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEditStudent } from '@/api/hooks/useProfileEdits'
import { useLicenceTypes } from '@/api/hooks/useSyllabus'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Student } from '@/api/types'

const schema = z.object({
  batch_number:          z.string().optional().nullable(),
  target_licence:        z.string().min(1, 'Target licence required'),
  spl_number:             z.string().optional().nullable(),
  spl_issue_date:         z.string().optional().nullable(),
  spl_expiry:             z.string().optional().nullable(),
  medical_class:          z.union([z.literal(1), z.literal(2), z.null()]),
  medical_expiry:         z.string().optional().nullable(),
  frtol_number:           z.string().optional().nullable(),
  frtol_expiry:           z.string().optional().nullable(),
  solo_approved:          z.boolean(),
  solo_max_crosswind_kt:  z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

interface Props {
  student:    Student
  onSuccess?: () => void
}

/** Converts null/undefined to '' for controlled date/text inputs. */
const asInput = (v: string | null | undefined) => v ?? ''
/** Converts '' back to null before sending to the API — empty date fields
 *  must clear the field server-side rather than being sent as "". */
const asPayload = (v: string) => (v === '' ? null : v)

export function EditStudentForm({ student, onSuccess }: Props) {
  const editStudent = useEditStudent()
  const { data: licenceTypesData } = useLicenceTypes()
  const licenceTypes = licenceTypesData?.results ?? []

  const { register, handleSubmit, control, watch, reset, formState: { errors, isDirty } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        batch_number:          asInput(student.batch_number),
        target_licence:        student.target_licence || 'CPL',
        spl_number:             asInput(student.spl_number),
        spl_issue_date:         asInput(student.spl_issue_date),
        spl_expiry:             asInput(student.spl_expiry),
        medical_class:          student.medical_class,
        medical_expiry:         asInput(student.medical_expiry),
        frtol_number:           asInput(student.frtol_number),
        frtol_expiry:           asInput(student.frtol_expiry),
        solo_approved:          student.solo_approved,
        solo_max_crosswind_kt:  student.solo_max_crosswind_kt,
      },
    })

  // Re-sync form if a different student is passed in without remounting
  useEffect(() => {
    reset({
      batch_number:          asInput(student.batch_number),
      target_licence:        student.target_licence || 'CPL',
      spl_number:             asInput(student.spl_number),
      spl_issue_date:         asInput(student.spl_issue_date),
      spl_expiry:             asInput(student.spl_expiry),
      medical_class:          student.medical_class,
      medical_expiry:         asInput(student.medical_expiry),
      frtol_number:           asInput(student.frtol_number),
      frtol_expiry:           asInput(student.frtol_expiry),
      solo_approved:          student.solo_approved,
      solo_max_crosswind_kt:  student.solo_max_crosswind_kt,
    })
  }, [student.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const soloApproved = watch('solo_approved')

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        batch_number:          data.batch_number || null,
        target_licence:        data.target_licence as 'PPL' | 'CPL',
        spl_number:             data.spl_number || null,
        spl_issue_date:         asPayload(data.spl_issue_date ?? ''),
        spl_expiry:             asPayload(data.spl_expiry ?? ''),
        medical_class:          data.medical_class,
        medical_expiry:         asPayload(data.medical_expiry ?? ''),
        frtol_number:           data.frtol_number || null,
        frtol_expiry:           asPayload(data.frtol_expiry ?? ''),
        solo_approved:          data.solo_approved,
        solo_max_crosswind_kt:  data.solo_max_crosswind_kt,
      }

      await editStudent.mutateAsync({ id: student.id, ...payload })
      toast.success(`${student.user_detail.first_name}'s profile updated`)
      onSuccess?.()
    } catch (err: any) {
      const detail = err?.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(' ')
        : 'Failed to update student'
      toast.error(detail)
    }
  }

  const licenceOptions = licenceTypes.length > 0
    ? licenceTypes.map(lt => ({ value: lt.code, label: `${lt.code} - ${lt.name}` }))
    : [
        { value: 'CPL', label: 'CPL - Commercial Pilot Licence' },
        { value: 'PPL', label: 'PPL - Private Pilot Licence' },
      ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Enrolment */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Enrolment
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Batch Number">
            <input {...register('batch_number')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
          <Field label="Target Licence *">
            <select {...register('target_licence')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white">
              {licenceOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* SPL */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Student Pilot Licence (SPL)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="SPL Number">
            <input {...register('spl_number')} placeholder="e.g. SPL-2026-0142"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
          <Field label="SPL Expiry">
            <input type="date" {...register('spl_expiry')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
          <Field label="SPL Issue Date">
            <input type="date" {...register('spl_issue_date')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
        </div>
      </section>

      {/* Medical */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Medical Certificate
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Medical Class">
            <Controller name="medical_class" control={control} render={({ field }) => (
              <select
                value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary-500
                  dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                <option value="">Not set</option>
                <option value="1">Class 1</option>
                <option value="2">Class 2</option>
              </select>
            )} />
          </Field>
          <Field label="Medical Expiry">
            <input type="date" {...register('medical_expiry')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
        </div>
      </section>

      {/* FRTOL */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Flight Radio Telephony Operator Licence (R) (FRTOL)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="FRTOL Number">
            <input {...register('frtol_number')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
          <Field label="FRTOL Expiry">
            <input type="date" {...register('frtol_expiry')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
        </div>
      </section>

      {/* Solo authorisation */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Solo Authorisation
        </h3>
        <div className="grid grid-cols-2 gap-4 items-start">
          <Controller name="solo_approved" control={control} render={({ field }) => (
            <label className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors',
              field.value
                ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950'
                : 'border-slate-200 dark:border-slate-700'
            )}>
              <input type="checkbox" checked={field.value}
                onChange={e => field.onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-emerald-600" />
              <div>
                <p className={cn('text-sm font-semibold',
                  field.value ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300')}>
                  Solo Approved
                </p>
                <p className="text-xs text-slate-500">
                  Student is authorised to fly solo sorties
                </p>
              </div>
            </label>
          )} />
          <Field label="Solo Max Crosswind (kt) *" hint={!soloApproved ? 'Only applies once solo is approved' : undefined}>
            <input type="number" step="0.1" {...register('solo_max_crosswind_kt')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            {errors.solo_max_crosswind_kt &&
              <p className="mt-1 text-xs text-red-600">{errors.solo_max_crosswind_kt.message}</p>}
          </Field>
        </div>
      </section>

      <div className="flex gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button type="submit" loading={editStudent.isPending} disabled={!isDirty} className="flex-1">
          Save Changes
        </Button>
      </div>
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
