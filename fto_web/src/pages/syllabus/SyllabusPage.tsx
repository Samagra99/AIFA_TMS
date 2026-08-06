import { useState, useMemo } from 'react'
import { useSyllabusStages, useSortieGrades, useLicenceTypes, type SyllabusExercise } from '@/api/hooks/useSyllabus'
import { useStudents } from '@/api/hooks/useStudents'
import { useFlights }  from '@/api/hooks/useScheduling'
import { CurriculumTree }  from '@/components/syllabus/CurriculumTree'
import { GradeEntryPanel } from '@/components/syllabus/GradeEntryPanel'
import { PageLoader, Card } from '@/components/ui'
import { BookOpen, GraduationCap, Search } from 'lucide-react'
import { useAuthStore } from '@/stores'
import dayjs from 'dayjs'
import type { Student } from '@/api/types'

export function SyllabusPage() {
  const { data: licenceTypesData }           = useLicenceTypes()
  const licenceTypes                          = licenceTypesData?.results ?? []
  const [licenceType, setLicenceType]         = useState<string>('CPL')
  const [studentSearch, setStudentSearch]     = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedFlight,  setSelectedFlight]  = useState<string>('')
  const [selectedEx, setSelectedEx]           = useState<SyllabusExercise | null>(null)

  const { user } = useAuthStore()

  const { data: stagesData, isLoading: stagesLoading } = useSyllabusStages(licenceType)
  const { data: studentsData }                          = useStudents(studentSearch ? { search: studentSearch } : undefined)
  const { data: gradesData }                            = useSortieGrades(selectedStudent?.id)
  const { data: flightsData }                           = useFlights(
    selectedStudent ? { student: selectedStudent.id, status: 'completed' } : undefined
  )

  const stages   = stagesData?.results  ?? []
  const students = studentsData?.results ?? []
  const grades   = gradesData?.results  ?? []
  const flights  = flightsData?.results ?? []

  // Filter completed flights to ONLY show those containing the selected exercise
  const matchingFlights = useMemo(() => {
    if (!selectedEx) return []
    return flights.filter(f =>
      f.exercises?.some((fe: any) => fe.exercise === selectedEx.id || fe.exercise_id === selectedEx.id)
    )
  }, [flights, selectedEx])

  // Selected flight object & dual grading security permission check
  const activeFlight = useMemo(() => {
    return flights.find(f => f.id === selectedFlight)
  }, [flights, selectedFlight])

  const { isAllowedToGrade, unauthorizedReason } = useMemo(() => {
    if (!activeFlight || !user) return { isAllowedToGrade: true, unauthorizedReason: '' }
    const isDual = ['dual', 'cross_country_dual', 'night_dual'].includes(activeFlight.flight_type)
    const isCfiOrAdmin = ['cfi', 'superadmin'].includes(user.role)

    if (isDual && !isCfiOrAdmin) {
      const isAssignedInstructor =
        (activeFlight.instructor_user_id && activeFlight.instructor_user_id === user.id) ||
        (activeFlight.instructor && activeFlight.instructor === user.id)
      if (!isAssignedInstructor) {
        const assignedName = activeFlight.instructor_name || 'the assigned instructor'
        return {
          isAllowedToGrade: false,
          unauthorizedReason: `Security Policy: Only ${assignedName} (who conducted this dual sortie) is permitted to grade it.`,
        }
      }
    }
    return { isAllowedToGrade: true, unauthorizedReason: '' }
  }, [activeFlight, user])

  // Overall progress for the selected student
  const totalEx  = stages.flatMap(s => s.lessons.flatMap(l => l.exercises)).length
  const passedEx = grades.filter(g => g.passed).length
  const pctDone  = totalEx > 0 ? Math.round((passedEx / totalEx) * 100) : 0

  const activeLicenceCodes = licenceTypes.length > 0 ? licenceTypes.map(lt => lt.code) : ['CPL', 'PPL']

  return (
    <div className="flex h-full gap-6 overflow-hidden">

      {/* ── Left: Curriculum tree + student selector ─────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto">

        {/* Licence type tabs */}
        <div className="flex flex-wrap rounded-xl border border-slate-200 p-1 dark:border-slate-700">
          {activeLicenceCodes.map(code => (
            <button key={code} onClick={() => setLicenceType(code)}
              className={`flex-1 rounded-lg py-1.5 px-2 text-sm font-semibold transition-colors ${
                licenceType === code
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'}`}>
              {code}
            </button>
          ))}
        </div>

        {/* Student search */}
        <div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
              placeholder="Find student…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          {studentSearch && students.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {students.slice(0, 6).map(s => (
                <button key={s.id} onClick={() => { setSelectedStudent(s); setStudentSearch('') }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700">
                  <GraduationCap className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {s.user_detail.first_name} {s.user_detail.last_name}
                    </p>
                    <p className="text-xs text-slate-500">{s.batch_number ?? 'No batch'} · {s.target_licence}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected student card */}
        {selectedStudent && (
          <Card className="!p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {selectedStudent.user_detail.first_name} {selectedStudent.user_detail.last_name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedStudent.batch_number ?? 'No batch'} · {selectedStudent.target_licence}
                </p>
              </div>
              <button onClick={() => { setSelectedStudent(null); setSelectedEx(null); setSelectedFlight('') }}
                className="text-xs text-slate-400 hover:text-slate-600">✕</button>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>Curriculum progress</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{pctDone}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-2 rounded-full bg-primary-500 transition-all" style={{ width: `${pctDone}%` }} />
              </div>
              <p className="mt-1 text-right text-xs text-slate-400">{passedEx} / {totalEx} exercises passed</p>
            </div>
          </Card>
        )}

        {/* Curriculum tree */}
        {stagesLoading ? <PageLoader /> : (
          <CurriculumTree
            stages={stages}
            grades={grades}
            onSelectExercise={(ex) => { setSelectedEx(ex); setSelectedFlight('') }}
            selectedExId={selectedEx?.id}
          />
        )}
      </div>

      {/* ── Right: Grade entry / exercise detail ─────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {!selectedStudent ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <BookOpen className="mb-3 h-12 w-12 text-slate-200 dark:text-slate-700" />
            <p className="text-slate-500 dark:text-slate-400">Select a student to view their curriculum progress</p>
          </div>
        ) : !selectedEx ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <BookOpen className="mb-3 h-12 w-12 text-slate-200 dark:text-slate-700" />
            <p className="text-slate-500 dark:text-slate-400">Click an exercise in the curriculum tree to grade it</p>
          </div>
        ) : (
          <>
            {/* Flight selector — grade is always tied to a flight */}
            <Card>
              <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
                Select Completed Flight for {selectedEx.exercise_code} ({selectedEx.title})
              </p>
              <p className="mb-2 text-xs text-slate-500">
                Only completed flights containing this specific exercise are shown.
              </p>
              {matchingFlights.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  No completed flights found with exercise <strong>{selectedEx.exercise_code}</strong> for this student.
                </div>
              ) : (
                <select value={selectedFlight} onChange={e => setSelectedFlight(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white">
                  <option value="">Choose a completed flight…</option>
                  {matchingFlights.map(f => {
                    const dateStr = dayjs(f.scheduled_start).format('DD MMM YYYY')
                    const startTime = dayjs(f.scheduled_start).format('HH:mm')
                    const endTime   = dayjs(f.scheduled_end).format('HH:mm')
                    const tail      = f.aircraft_name || 'Tail'
                    const type      = f.flight_type.replace(/_/g,' ').toUpperCase()
                    const instructor= f.instructor_name || 'Instructor'
                    return (
                      <option key={f.id} value={f.id}>
                        {dateStr} ({startTime}–{endTime}) · {tail} · {type} · Instructor: {instructor}
                      </option>
                    )
                  })}
                </select>
              )}
            </Card>

            {selectedFlight && (
              <GradeEntryPanel
                exercise={selectedEx}
                flightId={selectedFlight}
                studentId={selectedStudent.id}
                isAllowedToGrade={isAllowedToGrade}
                unauthorizedReason={unauthorizedReason}
                onSuccess={() => setSelectedEx(null)}
              />
            )}

            {/* Historical grades for this exercise */}
            {grades.filter(g => g.exercise === selectedEx.id).length > 0 && (
              <Card>
                <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Grade History</p>
                <div className="space-y-2">
                  {grades.filter(g => g.exercise === selectedEx.id).map(g => (
                    <div key={g.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-700">
                      <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${
                        g.passed
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'}`}>
                        {g.grade}/5
                      </span>
                      <div className="flex-1 min-w-0">
                        {g.instructor_notes && (
                          <p className="truncate text-xs text-slate-600 dark:text-slate-400">{g.instructor_notes}</p>
                        )}
                        <p className="text-xs text-slate-400">{new Date(g.graded_at).toLocaleDateString('en-IN')}</p>
                      </div>
                      {g.is_locked && <span className="text-xs text-slate-400">🔒 Locked</span>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
