import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSubmitGrades } from '@/api/hooks/useSyllabus'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { SyllabusExercise } from '@/api/hooks/useSyllabus'

const schema = z.object({
  grade:            z.number().min(1).max(5),
  instructor_notes: z.string().max(500),
})
type FD = z.infer<typeof schema>

const LABELS: Record<number,{label:string;color:string}> = {
  1:{label:'Unsatisfactory', color:'border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'},
  2:{label:'Below Standard', color:'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300'},
  3:{label:'Satisfactory',   color:'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'},
  4:{label:'Above Standard', color:'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'},
  5:{label:'Exceptional',    color:'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'},
}

interface Props { exercise:SyllabusExercise; flightId:string; studentId:string; onSuccess?:()=>void }

export function GradeEntryPanel({ exercise, flightId, studentId, onSuccess }: Props) {
  const submit = useSubmitGrades()
  const { control, handleSubmit, watch } = useForm<FD>({
    resolver: zodResolver(schema),
    defaultValues: { grade:3, instructor_notes:'' },
  })
  const g = watch('grade')

  const onSubmit = async (data: FD) => {
    try {
      await submit.mutateAsync([{ flight:flightId, exercise:exercise.id, student:studentId, grade:data.grade, instructor_notes:data.instructor_notes }])
      toast.success(`${exercise.exercise_code} graded — ${LABELS[data.grade].label}`)
      onSuccess?.()
    } catch { toast.error('Failed to submit grade') }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4">
        <p className="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">{exercise.exercise_code}</p>
        <p className="text-base font-semibold text-slate-900 dark:text-white">{exercise.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">Pass grade: {exercise.pass_grade}/5 · <span className="capitalize">{exercise.flight_type_required.replace(/_/g,' ')}</span></p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Grade</p>
          <Controller name="grade" control={control} render={({ field }) => (
            <div className="grid grid-cols-5 gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => field.onChange(n)}
                  className={cn('flex flex-col items-center rounded-xl border-2 p-3 text-center transition-all',
                    field.value===n ? LABELS[n].color : 'border-slate-200 hover:border-slate-300 dark:border-slate-700')}>
                  <span className="text-xl font-bold">{n}</span>
                  <span className="mt-0.5 text-[9px] leading-tight opacity-70">{LABELS[n].label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )} />
          {g && (
            <p className={cn('mt-2 text-center text-xs font-semibold', g>=exercise.pass_grade?'text-emerald-600':'text-red-600')}>
              {LABELS[g].label} · {g>=exercise.pass_grade?'✓ Exercise passed':'✗ Below pass standard'}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Instructor Notes</label>
          <Controller name="instructor_notes" control={control} render={({ field }) => (
            <textarea {...field} rows={3} placeholder="Specific observations, areas for improvement…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white" />
          )} />
        </div>
        <Button type="submit" loading={submit.isPending} className="w-full">Submit Grade</Button>
      </form>
    </div>
  )
}
