import { useState } from 'react'
import { useStudentDashboard } from '@/api/hooks/useDashboard'
import { Card, CardHeader, CardTitle, PageLoader, Badge, Button } from '@/components/ui'
import { DGCAPilotLogbookModal } from '@/components/logbook/DGCAPilotLogbookModal'
import { useAuthStore } from '@/stores'
import { BookOpen, Mail, TrendingUp, Award, Printer } from 'lucide-react'
import { cn, fmt } from '@/lib/utils'
import dayjs from 'dayjs'

export function StudentDashboardPage() {
  const [showLogbook, setShowLogbook] = useState(false)
  const { user } = useAuthStore()
  const { data, isLoading } = useStudentDashboard()

  if (isLoading || !data) return <PageLoader />

  const { curriculum_progress: progress } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {greeting()}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {dayjs().format('dddd, D MMMM YYYY')} · Training for {data.target_licence}
          </p>
        </div>
        <Button onClick={() => setShowLogbook(true)} size="sm" className="gap-2">
          <Printer className="h-4 w-4" /> Print Official Logbook
        </Button>
      </div>

      {/* Item 1 — Total hours */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPI label="Total Hours" value={`${Number(data.hours_total).toFixed(1)}h`} icon={TrendingUp} color="text-primary-600" />
        <KPI label="PIC" value={`${Number(data.hours_pic).toFixed(1)}h`} icon={Award} color="text-emerald-600" />
        <KPI label="Dual" value={`${Number(data.hours_dual).toFixed(1)}h`} icon={Award} color="text-slate-600" />
        <KPI label="Solo" value={`${Number(data.hours_solo).toFixed(1)}h`} icon={Award} color="text-amber-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Item 2 — Last exercise & grade */}
        <Card>
          <CardHeader>
            <CardTitle>Last Sortie</CardTitle>
          </CardHeader>
          {!data.last_exercise ? (
            <EmptyState icon="✈️" message="No sorties graded yet." />
          ) : (
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">
                    {data.last_exercise.code}
                  </p>
                  <p className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
                    {data.last_exercise.title}
                  </p>
                  {data.last_exercise.graded_at && (
                    <p className="mt-1 text-xs text-slate-400">
                      {fmt.date(data.last_exercise.graded_at)}
                    </p>
                  )}
                </div>
                {data.last_exercise.grade !== null && (
                  <div className={cn(
                    'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold',
                    data.last_exercise.passed
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                  )}>
                    {data.last_exercise.grade}
                  </div>
                )}
              </div>
              <div className="mt-3">
                {data.last_exercise.passed ? (
                  <Badge variant="success">Passed</Badge>
                ) : (
                  <Badge variant="warning">Below Pass Standard</Badge>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Item 4 — Assigned instructor */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned Instructor</CardTitle>
          </CardHeader>
          {!data.assigned_instructor ? (
            <EmptyState icon="👨‍✈️" message="No instructor assigned yet." />
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full
                bg-primary-600 text-lg font-bold text-white">
                {data.assigned_instructor.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900 dark:text-white">
                  {data.assigned_instructor.name}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Mail className="h-3 w-3" /> {data.assigned_instructor.email}
                </p>
                {data.assigned_instructor.cfi_licence_number && (
                  <p className="mt-0.5 font-mono text-xs text-slate-400">
                    AFI/ FI Number: {data.assigned_instructor.cfi_licence_number}
                  </p>
                )}
                {/* {data.assigned_instructor.base_name && (
                  <p className="mt-0.5 text-xs text-slate-400">{data.assigned_instructor.base_name}</p>
                )} */}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Item 3 — Curriculum progress */}
      <Card>
        <CardHeader>
          <CardTitle>Curriculum Progress</CardTitle>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {progress.passed_exercises}/{progress.total_exercises} exercises
          </span>
        </CardHeader>

        {/* Overall progress bar */}
        <div className="mb-5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Overall</span>
            <span className="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">
              {progress.progress_pct}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-2.5 rounded-full bg-primary-500 transition-all"
              style={{ width: `${progress.progress_pct}%` }} />
          </div>
        </div>

        {/* Per-stage breakdown */}
        {progress.stages.length === 0 ? (
          <EmptyState icon="📘" message="No syllabus stages configured yet." />
        ) : (
          <div className="space-y-3">
            {progress.stages.map(stage => (
              <div key={stage.stage_number}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <BookOpen className="h-3.5 w-3.5" />
                    Stage {stage.stage_number} — {stage.stage_title}
                  </span>
                  <span className="text-slate-400">{stage.passed}/{stage.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
                  <div className={cn('h-1.5 rounded-full transition-all',
                    stage.pct === 100 ? 'bg-emerald-500' : 'bg-primary-400')}
                    style={{ width: `${stage.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <DGCAPilotLogbookModal
        open={showLogbook}
        onClose={() => setShowLogbook(false)}
        pilotName={user?.full_name || 'Student Pilot'}
        licenceNumber="SPL-Active"
        role="Student Pilot"
        entries={[]}
      />
    </div>
  )
}

function KPI({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: React.ComponentType<{className?:string}>; color: string
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`rounded-xl bg-slate-100 p-3 dark:bg-slate-700 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </Card>
  )
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="mb-2 text-3xl">{icon}</span>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `Good ${period}`
}