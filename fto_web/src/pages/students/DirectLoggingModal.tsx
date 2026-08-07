import { useState, useMemo } from 'react'
import { Modal, Button } from '@/components/ui'
import { useSyllabusExercises } from '@/api/hooks/useSyllabus'
import { apiClient } from '@/api/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Student } from '@/api/types'

export function DirectLoggingModal({
  open,
  student,
  onClose
}: {
  open: boolean
  student: Student | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: exercisesData, isLoading: exLoading } = useSyllabusExercises({ per_page: 500 })
  const exercises = exercisesData?.results ?? []

  const groundExercises = useMemo(() => {
    return exercises.filter((ex: any) => ex.is_ground_event || ex.is_knowledge_test)
  }, [exercises])

  const [exerciseId, setExerciseId] = useState('')
  const [grade, setGrade] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/maintenance/grades/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', student?.id] })
      toast.success('Grade logged successfully')
      onClose()
      setExerciseId('')
      setGrade('')
      setNotes('')
    },
    onError: (err: any) => {
      toast.error('Failed to log grade', { description: err?.response?.data?.detail || err.message })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!student || !exerciseId || grade === '') return
    submitMutation.mutate({
      student: student.id,
      exercise: exerciseId,
      grade: Number(grade),
      instructor_notes: notes
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={`Log Ground Event / Knowledge Test`} size="sm">
      {student && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-600 mb-4 dark:text-slate-400">
            Logging grade for <strong>{student.user_detail.first_name} {student.user_detail.last_name}</strong>
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Event / Test
            </label>
            <select
              required
              value={exerciseId}
              onChange={e => setExerciseId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select event...</option>
              {groundExercises.map((ex: any) => (
                <option key={ex.id} value={ex.id}>
                  {ex.exercise_code} - {ex.title}
                </option>
              ))}
            </select>
            {exLoading && <p className="text-xs text-slate-500 mt-1">Loading exercises...</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Grade (1-5)
            </label>
            <input
              type="number"
              min="1"
              max="5"
              required
              value={grade}
              onChange={e => setGrade(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Instructor Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
            <Button variant="primary" type="submit" loading={submitMutation.isPending} disabled={!exerciseId || grade === ''}>
              Save Grade
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
