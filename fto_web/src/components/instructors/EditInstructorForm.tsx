import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEditInstructor } from '@/api/hooks/useProfileEdits'
import { useAircraftTypes } from '@/api/hooks/useInfrastructure'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Instructor } from '@/api/types'

const schema = z.object({
  cpl_atpl_number:            z.string().optional().nullable(),
  cpl_atpl_expiry:            z.string().optional().nullable(),
  frtol_number:               z.string().optional().nullable(),
  frtol_expiry:               z.string().optional().nullable(),
  medical_class1_expiry:      z.string().optional().nullable(),
  ir_expiry:                  z.string().optional().nullable(),
  fir_rating_type:            z.enum(['AFIR', 'FIR']).optional().nullable(),
  fir_licence_number:         z.string().optional().nullable(),
  fir_expiry:                 z.string().optional().nullable(),
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
const asPayload = (v: string | null | undefined) => (!v || v === '' ? null : v)

/** Backend stores FDTL as minutes; the form works in hours for readability. */
const minToHours = (min: number) => (min / 60).toFixed(1)
const hoursToMin  = (hrs: string)  => Math.round(parseFloat(hrs) * 60)

// Common fallback aircraft type ratings if DB empty
const COMMON_TYPE_RATINGS = [
  'PA 28', 'C172', 'C152', 'DA 42', 'DA 40', 'P2008JC', 'PA 34'
]

export function EditInstructorForm({ instructor, onSuccess }: Props) {
  const editInstructor = useEditInstructor()
  const { data: aircraftTypesData } = useAircraftTypes()

  // Type rating selection state
  const [selectedTypeRatings, setSelectedTypeRatings] = useState<string[]>(
    instructor.type_rating_ids || []
  )
  const [customRatingInput, setCustomRatingInput] = useState('')

  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        cpl_atpl_number:       asInput(instructor.cpl_atpl_number),
        cpl_atpl_expiry:       asInput(instructor.cpl_atpl_expiry),
        frtol_number:          asInput(instructor.frtol_number),
        frtol_expiry:          asInput(instructor.frtol_expiry),
        medical_class1_expiry: asInput(instructor.medical_class1_expiry),
        ir_expiry:             asInput(instructor.ir_expiry),
        fir_rating_type:       instructor.fir_rating_type || 'FIR',
        fir_licence_number:    asInput(instructor.fir_licence_number || instructor.cfi_licence_number),
        fir_expiry:            asInput(instructor.fir_expiry || instructor.cfi_expiry),
        instrument_rating:     instructor.instrument_rating,
        multi_engine_rating:   instructor.multi_engine_rating,
        fdtl_daily_hours:      minToHours(instructor.fdtl_daily_remaining_min),
        fdtl_weekly_hours:     minToHours(instructor.fdtl_weekly_remaining_min),
        fdtl_monthly_hours:    minToHours(instructor.fdtl_monthly_remaining_min),
      },
    })

  const currentFirRating = watch('fir_rating_type')

  useEffect(() => {
    reset({
      cpl_atpl_number:       asInput(instructor.cpl_atpl_number),
      cpl_atpl_expiry:       asInput(instructor.cpl_atpl_expiry),
      frtol_number:          asInput(instructor.frtol_number),
      frtol_expiry:          asInput(instructor.frtol_expiry),
      medical_class1_expiry: asInput(instructor.medical_class1_expiry),
      ir_expiry:             asInput(instructor.ir_expiry),
      fir_rating_type:       instructor.fir_rating_type || 'FIR',
      fir_licence_number:    asInput(instructor.fir_licence_number || instructor.cfi_licence_number),
      fir_expiry:            asInput(instructor.fir_expiry || instructor.cfi_expiry),
      instrument_rating:     instructor.instrument_rating,
      multi_engine_rating:   instructor.multi_engine_rating,
      fdtl_daily_hours:      minToHours(instructor.fdtl_daily_remaining_min),
      fdtl_weekly_hours:     minToHours(instructor.fdtl_weekly_remaining_min),
      fdtl_monthly_hours:    minToHours(instructor.fdtl_monthly_remaining_min),
    })
    setSelectedTypeRatings(instructor.type_rating_ids || [])
  }, [instructor.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTypeRating = (idOrLabel: string) => {
    setSelectedTypeRatings(prev =>
      prev.includes(idOrLabel)
        ? prev.filter(x => x !== idOrLabel)
        : [...prev, idOrLabel]
    )
  }

  const handleAddCustomRating = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = customRatingInput.trim()
    if (!trimmed) return
    if (!selectedTypeRatings.includes(trimmed)) {
      setSelectedTypeRatings(prev => [...prev, trimmed])
    }
    setCustomRatingInput('')
  }

  const onSubmit = async (data: FormData) => {
    try {
      await editInstructor.mutateAsync({
        id: instructor.id,
        cpl_atpl_number:           asPayload(data.cpl_atpl_number),
        cpl_atpl_expiry:           asPayload(data.cpl_atpl_expiry),
        frtol_number:              asPayload(data.frtol_number),
        frtol_expiry:              asPayload(data.frtol_expiry),
        medical_class1_expiry:     asPayload(data.medical_class1_expiry),
        ir_expiry:                 asPayload(data.ir_expiry),
        fir_rating_type:           data.fir_rating_type || 'FIR',
        fir_licence_number:        asPayload(data.fir_licence_number),
        fir_expiry:                asPayload(data.fir_expiry),
        cfi_licence_number:        asPayload(data.fir_licence_number),
        cfi_expiry:                asPayload(data.fir_expiry),
        type_rating_ids:           selectedTypeRatings,
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

  // Combine DB aircraft types with common fallbacks
  const dbTypes = aircraftTypesData?.results || []
  const allAvailableRatings = [
    ...dbTypes.map(t => ({ id: t.id, label: `${t.make_model} (${t.icao_designator || 'Type'})` })),
    ...COMMON_TYPE_RATINGS.filter(label => !dbTypes.some(t => t.make_model.includes(label) || t.icao_designator === label)).map(label => ({ id: label, label }))
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">

      {/* SECTION 1: CPL / ATPL Licence */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Section 1 · Commercial / Airline Transport Pilot Licence (CPL / ATPL)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="CPL / ATPL Number">
            <input {...register('cpl_atpl_number')} placeholder="e.g. CPL-19284"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
          <Field label="Licence Expiry">
            <input type="date" {...register('cpl_atpl_expiry')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
        </div>
      </section>

      {/* SECTION 2: Radio Telephony Licence (FRTOL(R)) */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Section 2 · Radio Telephony Licence (FRTOL(R))
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="FRTOL(R) Number">
            <input {...register('frtol_number')} placeholder="e.g. FRTOL-8821"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
          <Field label="FRTOL Expiry">
            <input type="date" {...register('frtol_expiry')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
        </div>
      </section>

      {/* SECTION 3: Class 1 Medical & Instrument Expiries */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Section 3 · Class 1 Medical & Instrument Rating Expiries
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Medical Class 1 Expiry">
            <input type="date" {...register('medical_class1_expiry')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
          <Field label="Instrument Rating (IR) Expiry">
            <input type="date" {...register('ir_expiry')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
          </Field>
        </div>
      </section>

      {/* SECTION 4: Flight Instructor Rating (DGCA AFIR / FIR) */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Section 4 · Flight Instructor Rating (DGCA AFIR / FIR)
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Instructor Rating Type
            </label>
            <div className="flex gap-2">
              {(['AFIR', 'FIR'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue('fir_rating_type', type, { shouldDirty: true })}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-colors',
                    currentFirRating === type
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {type === 'AFIR' ? 'AFIR (Assistant Flight Instructor)' : 'FIR (Flight Instructor)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Rating / Licence Number">
              <input {...register('fir_licence_number')} placeholder="e.g. FIR-1234 or AFIR-7891"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary-500
                  dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </Field>
            <Field label="Rating Expiry">
              <input type="date" {...register('fir_expiry')}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary-500
                  dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            </Field>
          </div>
        </div>
      </section>

      {/* SECTION 5: Aircraft Type Ratings & AUW Endorsements */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Section 5 · Endorsed Aircraft Type Ratings & AUW Endorsements
        </h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Select endorsed fleet types, DGCA open AUW endorsements, or add any custom aircraft type rating.
        </p>

        {/* Open AUW Endorsement Toggles */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { id: 'All Single Engine < 1500kg AUW', label: 'All Single Engine Land < 1500kg AUW', desc: 'Standard DGCA Open Rating for light aircraft' },
            { id: 'All Multi Engine < 5700kg AUW', label: 'All Multi Engine Land < 5700kg AUW', desc: 'Standard DGCA Multi-Engine Rating' },
          ].map(auw => {
            const isSelected = selectedTypeRatings.includes(auw.id)
            return (
              <button
                key={auw.id}
                type="button"
                onClick={() => toggleTypeRating(auw.id)}
                className={cn(
                  'flex flex-col text-left rounded-xl border-2 p-3 transition-colors',
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-950'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                )}
              >
                <span className={cn('text-xs font-bold flex items-center justify-between', isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-200')}>
                  <span>{auw.label}</span>
                  <span>{isSelected ? '✓ Active' : '+ Enable'}</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{auw.desc}</span>
              </button>
            )
          })}
        </div>

        {/* Preset & Custom Badges */}
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Endorsed Types / Ratings
          </label>
          <div className="flex flex-wrap gap-2">
            {allAvailableRatings.map(item => {
              const isSelected = selectedTypeRatings.includes(item.id) || selectedTypeRatings.includes(item.label)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleTypeRating(item.id)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                    isSelected
                      ? 'border-primary-500 bg-primary-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {item.label}
                </button>
              )
            })}

            {/* Custom ratings added by user */}
            {selectedTypeRatings.filter(r =>
              !['All Single Engine < 1500kg AUW', 'All Multi Engine < 5700kg AUW'].includes(r) &&
              !allAvailableRatings.some(item => item.id === r || item.label === r)
            ).map(customRating => (
              <button
                key={customRating}
                type="button"
                onClick={() => toggleTypeRating(customRating)}
                className="rounded-lg border border-primary-500 bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
              >
                ✓ {customRating}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Aircraft Type Input */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={customRatingInput}
            onChange={e => setCustomRatingInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCustomRating(e) }}
            placeholder="Add custom aircraft type (e.g. Beechcraft Baron 58, Cirrus SR22)..."
            className="flex-1 rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
          <button
            type="button"
            onClick={handleAddCustomRating}
            disabled={!customRatingInput.trim()}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            + Add Rating
          </button>
        </div>
      </section>

      {/* SECTION 6: Operational Ratings & FDTL Limits */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Section 6 · Operational Ratings & FDTL Remaining Hours
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Controller name="instrument_rating" control={control} render={({ field }) => (
            <RatingToggle label="Instrument Rating (IR)" checked={field.value} onChange={field.onChange} />
          )} />
          <Controller name="multi_engine_rating" control={control} render={({ field }) => (
            <RatingToggle label="Multi-Engine Rating (ME)" checked={field.value} onChange={field.onChange} />
          )} />
        </div>

        <p className="mb-2 text-xs text-slate-400">
          Manually adjust remaining Flight Duty Time Limitation hours (resets to 8h / 30h / 100h nightly).
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Daily (hrs)">
            <input type="number" step="0.1" {...register('fdtl_daily_hours')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            {errors.fdtl_daily_hours && <p className="mt-1 text-xs text-red-600">{errors.fdtl_daily_hours.message}</p>}
          </Field>
          <Field label="Weekly (hrs)">
            <input type="number" step="0.1" {...register('fdtl_weekly_hours')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            {errors.fdtl_weekly_hours && <p className="mt-1 text-xs text-red-600">{errors.fdtl_weekly_hours.message}</p>}
          </Field>
          <Field label="Monthly (hrs)">
            <input type="number" step="0.1" {...register('fdtl_monthly_hours')}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-primary-500
                dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            {errors.fdtl_monthly_hours && <p className="mt-1 text-xs text-red-600">{errors.fdtl_monthly_hours.message}</p>}
          </Field>
        </div>
      </section>

      <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white pt-4 dark:border-slate-700 dark:bg-slate-900">
        <Button type="submit" loading={editInstructor.isPending} className="flex-1">
          Save Changes
        </Button>
      </div>
    </form>
  )
}

function RatingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn(
      'flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors',
      checked
        ? 'border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-950'
        : 'border-slate-200 dark:border-slate-700'
    )}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded accent-primary-600" />
      <span className={cn('text-xs font-semibold',
        checked ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300')}>
        {label}
      </span>
    </label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </label>
      {children}
    </div>
  )
}
