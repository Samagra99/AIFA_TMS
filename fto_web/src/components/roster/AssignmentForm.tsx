import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateAssignment } from '@/api/hooks/useRostering'
import { useInstructors } from '@/api/hooks/useInstructors'
import { useStudents } from '@/api/hooks'
import { useBases } from '@/api/hooks'
import { Button } from '@/components/ui'
import { toast } from 'sonner'
import type { Student, Instructor } from '@/api/types'

const schema = z.object({
  instructor: z.string().uuid('Select an instructor'),
  student:    z.string().uuid('Select a student'),
  base:       z.string().uuid('Select a base'),
  notes:      z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  /** Pre-select the student — used when opened from the Students page. */
  presetStudent?:    Student
  /** Pre-select the instructor — used when opened from the Instructors page. */
  presetInstructor?: Instructor
  onSuccess?: () => void
}

export function AssignmentForm({ presetStudent, presetInstructor, onSuccess }: Props) {
  const createAssignment = useCreateAssignment()
  const { data: instructorsData } = useInstructors()
  const { data: studentsData }    = useStudents()
  const { data: basesData }       = useBases()

  const instructors = instructorsData?.results ?? []
  const students     = studentsData?.results    ?? []

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      instructor: presetInstructor?.id ?? '',
      student:    presetStudent?.id ?? '',
      base:       presetStudent?.user_detail.home_base
        ?? presetInstructor?.user_detail.home_base
        ?? '',
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await createAssignment.mutateAsync(data)
      const instr = instructors.find(i => i.id === data.instructor)
      const stud  = students.find(s => s.id === data.student)
      toast.success(
        `${stud?.user_detail.first_name ?? 'Student'} assigned to ${instr?.user_detail.first_name ?? 'instructor'}`
      )
      onSuccess?.()
    } catch (err: any) {
      const detail = err?.response?.data?.errors?.non_field_errors?.[0]
        ?? err?.response?.data?.detail
        ?? 'This student may already be assigned to this instructor'
      toast.error(detail)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        This creates a permanent instructor–student pairing for the duration of the
        training course. The instructor's daily plan form will show this student's
        curriculum progress going forward.
      </p>

      {/* Student */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Student *
        </label>
        <select {...register('student')} disabled={!!presetStudent}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60
            dark:border-slate-600 dark:bg-slate-700 dark:text-white">
          <option value="">Select student…</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>
              {s.user_detail.first_name} {s.user_detail.last_name}
              {s.batch_number ? ` — ${s.batch_number}` : ''}
            </option>
          ))}
        </select>
        {errors.student && <p className="mt-1 text-xs text-red-600">{errors.student.message}</p>}
      </div>

      {/* Instructor */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Instructor *
        </label>
        <select {...register('instructor')} disabled={!!presetInstructor}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60
            dark:border-slate-600 dark:bg-slate-700 dark:text-white">
          <option value="">Select instructor…</option>
          {instructors.map(i => (
            <option key={i.id} value={i.id}>
              {i.user_detail.first_name} {i.user_detail.last_name}
              {i.cfi_licence_number ? ` — ${i.cfi_licence_number}` : ''}
            </option>
          ))}
        </select>
        {errors.instructor && <p className="mt-1 text-xs text-red-600">{errors.instructor.message}</p>}
      </div>

      {/* Base */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Base *
        </label>
        <select {...register('base')}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-primary-500
            dark:border-slate-600 dark:bg-slate-700 dark:text-white">
          <option value="">Select base…</option>
          {basesData?.results.map(b => (
            <option key={b.id} value={b.id}>{b.name} ({b.icao_code})</option>
          ))}
        </select>
        {errors.base && <p className="mt-1 text-xs text-red-600">{errors.base.message}</p>}
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Notes
        </label>
        <textarea {...register('notes')} rows={2}
          placeholder="e.g. Reassigned from previous instructor due to schedule conflict"
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-primary-500
            dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
      </div>

      <Button type="submit" loading={createAssignment.isPending} className="w-full">
        Assign Student to Instructor
      </Button>
    </form>
  )
}
