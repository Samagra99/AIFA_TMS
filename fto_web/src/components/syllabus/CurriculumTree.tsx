import { useState } from 'react'
import { ChevronRight, ChevronDown, CheckCircle2, Circle, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SyllabusStage, SyllabusExercise, SortieGrade } from '@/api/hooks/useSyllabus'

interface Props {
  stages:            SyllabusStage[]
  grades:            SortieGrade[]
  onSelectExercise?: (ex: SyllabusExercise) => void
  selectedExId?:     string
}

export function CurriculumTree({ stages, grades, onSelectExercise, selectedExId }: Props) {
  const [openStages,  setOpenStages]  = useState<Set<string>>(new Set([stages[0]?.id]))
  const [openLessons, setOpenLessons] = useState<Set<string>>(new Set())
  const gradeMap = new Map(grades.map(g => [g.exercise, g]))

  function toggle<T>(set: Set<T>, v: T): Set<T> {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n
  }

  function exStatus(ex: SyllabusExercise): 'passed'|'attempted'|'locked'|'pending' {
    const g = gradeMap.get(ex.id)
    if (!g) {
      const ok = ex.prerequisite_ids.every(pid => gradeMap.get(pid)?.passed)
      return ok ? 'pending' : 'locked'
    }
    return g.passed ? 'passed' : 'attempted'
  }

  return (
    <div className="space-y-1.5">
      {stages.map(stage => {
        const isOpen   = openStages.has(stage.id)
        const allEx    = stage.lessons.flatMap(l => l.exercises)
        const passedEx = allEx.filter(ex => gradeMap.get(ex.id)?.passed).length
        const pct      = allEx.length ? Math.round((passedEx / allEx.length) * 100) : 0

        return (
          <div key={stage.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <button onClick={() => setOpenStages(toggle(openStages, stage.id))}
              className="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700">
              {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400">Stage {stage.stage_number}</span>
                  <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{stage.title}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-600">
                    <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{passedEx}/{allEx.length}</span>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {stage.lessons.map(lesson => {
                  const lOpen = openLessons.has(lesson.id)
                  return (
                    <div key={lesson.id}>
                      <button onClick={() => setOpenLessons(toggle(openLessons, lesson.id))}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {lOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                               : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                        <span className="w-14 shrink-0 text-xs text-slate-500">Lesson {lesson.lesson_number}</span>
                        <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-300">{lesson.title}</span>
                      </button>

                      {lOpen && (
                        <div className="bg-white dark:bg-slate-900/30">
                          {lesson.exercises.map(ex => {
                            const status = exStatus(ex)
                            const grade  = gradeMap.get(ex.id)
                            return (
                              <button key={ex.id} onClick={() => onSelectExercise?.(ex)}
                                disabled={status === 'locked'}
                                className={cn('flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors',
                                  selectedExId === ex.id && 'bg-primary-50 dark:bg-primary-950',
                                  status === 'locked' ? 'cursor-not-allowed opacity-40'
                                    : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40')}>
                                {status === 'passed'   && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                                {status === 'attempted'&& <Circle       className="h-4 w-4 shrink-0 text-amber-500" />}
                                {status === 'locked'   && <Lock         className="h-4 w-4 shrink-0 text-slate-300" />}
                                {status === 'pending'  && <Circle       className="h-4 w-4 shrink-0 text-slate-300" />}
                                <span className="w-14 shrink-0 font-mono text-xs text-slate-400">{ex.exercise_code}</span>
                                <span className="flex-1 truncate text-xs text-slate-700 dark:text-slate-300">{ex.title}</span>
                                {grade && (
                                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-bold',
                                    grade.passed
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300')}>
                                    {grade.grade}/5
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
