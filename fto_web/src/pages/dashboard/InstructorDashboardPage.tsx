import { useState } from 'react'
import { useInstructorDashboard, useInstructorAvailability } from '@/api/hooks/useDashboard'
import { useInstructorLogbookEntries } from '@/api/hooks/useInstructors'
import { useDailyRoster } from '@/api/hooks/useScheduling'
import { Card, CardHeader, CardTitle, PageLoader, Badge, Button } from '@/components/ui'
import { DGCAPilotLogbookModal } from '@/components/logbook/DGCAPilotLogbookModal'
import { useAuthStore } from '@/stores'
import {
  Clock, Plane,
  Calendar, TrendingDown, Printer,
} from 'lucide-react'
import { cn, fmt } from '@/lib/utils'
import dayjs from 'dayjs'

export function InstructorDashboardPage() {
  const [showLogbook, setShowLogbook] = useState(false)
  const { user } = useAuthStore()
  const { data, isLoading } = useInstructorDashboard()
  const instructorId = user?.id || ''
  const { data: logbookData } = useInstructorLogbookEntries(instructorId)
  
  const todayStr = dayjs().format('YYYY-MM-DD')
  const { data: roster } = useDailyRoster(todayStr)
  const myFlights = roster?.filter(f => 
    (f.instructor_user_id === user?.id || f.instructor_name?.includes(user?.full_name || '')) &&
    !['cancelled', 'aborted', 'draft'].includes(f.status)
  ) || []

  if (isLoading || !data) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {greeting()}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {dayjs().format('dddd, D MMMM YYYY')}
          </p>
        </div>
        <Button onClick={() => setShowLogbook(true)} size="sm" className="gap-2">
          <Printer className="h-4 w-4" /> Print Official Logbook
        </Button>
      </div>

      {/* KPI strip — items 1 & 2 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KPI label="Flown Today" value={`${data.hours_flown_today}h`} icon={Clock} color="text-primary-600" />
        <KPI label="Flown This Month" value={`${data.hours_flown_month}h`} icon={Clock} color="text-primary-600" />
        <KPI
          label="Remaining Today"
          value={`${data.hours_remaining_today}h`}
          icon={TrendingDown}
          color={data.hours_remaining_today <= 1 ? 'text-red-600' : data.hours_remaining_today <= 2 ? 'text-amber-600' : 'text-emerald-600'}
          sub={`of ${data.fdtl_daily_cap_hours}h daily cap`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Item 3 — Assigned students */}
        <Card>
          <CardHeader>
            <CardTitle>My Students</CardTitle>
            <span className="text-xs text-slate-500">{data.students.length} assigned</span>
          </CardHeader>
          {data.students.length === 0 ? (
            <EmptyState icon="🎓" message="No students assigned yet." />
          ) : (
            <div className="space-y-2">
              {data.students.map(s => (
                <div key={s.student_id}
                  className="flex items-center justify-between rounded-xl border border-slate-200
                    bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {s.student_name}
                      </p>
                      {s.batch_number && (
                        <span className="shrink-0 text-xs text-slate-400">{s.batch_number}</span>
                      )}
                      <div className="ml-1 flex items-center gap-1">
                        <Badge variant={s.spl_expiry && dayjs(s.spl_expiry).isAfter(dayjs()) ? 'success' : 'danger'}>
                          {s.spl_expiry && dayjs(s.spl_expiry).isAfter(dayjs()) ? 'SPL ✓' : 'SPL ✗'}
                        </Badge>
                        <Badge variant={s.medical_expiry && dayjs(s.medical_expiry).isAfter(dayjs()) ? 'success' : 'danger'}>
                          {s.medical_expiry && dayjs(s.medical_expiry).isAfter(dayjs()) ? 'Med ✓' : 'Med ✗'}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      {s.last_exercise_code ? (
                        <>
                          <span className="font-mono">{s.last_exercise_code}</span>
                          {s.last_grade !== null && (
                            <span className={cn('font-semibold',
                              s.last_grade >= 3 ? 'text-emerald-600' : 'text-amber-600')}>
                              {s.last_grade}/5
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="italic text-slate-400">No sorties yet</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                      {Number(s.hours_total).toFixed(1)}h
                    </p>
                    <p className="text-xs text-slate-400">total</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Item 4 — Expiring documents */}
        <Card>
          <CardHeader>
            <CardTitle>Expiring Within 60 Days</CardTitle>
            {data.expiring_within_60_days.length > 0 && (
              <span className="text-xs font-semibold text-amber-600">
                {data.expiring_within_60_days.length} item(s)
              </span>
            )}
          </CardHeader>
          {data.expiring_within_60_days.length === 0 ? (
            <EmptyState icon="✅" message="Nothing expiring soon." />
          ) : (
            <div className="space-y-2">
              {data.expiring_within_60_days.map((e, i) => (
                <div key={i} className={cn(
                  'flex items-center justify-between rounded-xl border px-4 py-3',
                  e.days_left <= 14
                    ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
                )}>
                  <div>
                    <p className={cn('text-sm font-semibold',
                      e.days_left <= 14 ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200')}>
                      {e.is_own ? e.label : `${e.entity_name} — ${e.label}`}
                    </p>
                    <p className="text-xs text-slate-500">Expires {fmt.date(e.expiry_date)}</p>
                  </div>
                  <Badge variant={e.days_left <= 14 ? 'danger' : 'warning'}>
                    {e.days_left}d
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Item - Today's Active Flights */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Active Flights</CardTitle>
            <span className="text-xs font-semibold text-primary-600">{myFlights.length} sorties</span>
          </CardHeader>
          {myFlights.length === 0 ? (
            <EmptyState icon="✈️" message="No active flights scheduled today." />
          ) : (
            <div className="space-y-2">
              {myFlights.map(f => (
                <div key={f.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {fmt.time(f.scheduled_start)} – {fmt.time(f.scheduled_end)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {f.student_name || 'No student'} • {f.aircraft_name || f.aircraft_detail?.tail_number}
                    </p>
                  </div>
                  <Badge variant="primary" className="capitalize">{f.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Item 5 — AOG aircraft */}
      <Card>
        <CardHeader>
          <CardTitle>AOG Aircraft</CardTitle>
          {data.aog_aircraft.length > 0 && (
            <span className="text-xs font-semibold text-red-600">{data.aog_aircraft.length} grounded</span>
          )}
        </CardHeader>
        {data.aog_aircraft.length === 0 ? (
          <EmptyState icon="✅" message="No AOG aircraft. All serviceable." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.aog_aircraft.map(a => (
              <div key={a.aircraft_id} className="flex items-start gap-3 rounded-xl border
                border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                <Plane className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">{a.tail_number}</p>
                  <p className="text-xs text-slate-500">{a.base_name}</p>
                  {a.aog_reason && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{a.aog_reason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Additional feature — flying hours availability calculator */}
      <AvailabilityCalculator />

      <DGCAPilotLogbookModal
        open={showLogbook}
        onClose={() => setShowLogbook(false)}
        pilotName={logbookData?.pilot_name || user?.full_name || 'Instructor Pilot'}
        licenceNumber={logbookData?.licence_number || 'Active'}
        role={logbookData?.role || 'Instructor Pilot'}
        entries={logbookData?.entries || []}
      />
    </div>
  )
}

// ─── Flying Hours Availability Calculator ──────────────────────────────────────

function AvailabilityCalculator() {
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))
  const { data, isLoading } = useInstructorAvailability(selectedDate)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flying Hours Availability</CardTitle>
      </CardHeader>
      <p className="mb-4 -mt-2 text-xs text-slate-500 dark:text-slate-400">
        Select a date to see how many flying hours you have available against each
        DGCA CAR-FTL rolling window, based on your actual flight history.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-slate-400" />
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm
            dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      </div>

      {isLoading || !data ? (
        <PageLoader />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.windows.map(w => (
            <div key={w.window} className="rounded-xl border border-slate-200 bg-slate-50 p-4
              dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {w.window_label}
              </p>
              <p className={cn('mt-2 font-mono text-2xl font-bold',
                w.pct_used >= 90 ? 'text-red-600' : w.pct_used >= 75 ? 'text-amber-600' : 'text-emerald-600')}>
                {w.remaining_hours}h
              </p>
              <p className="text-xs text-slate-400">available of {w.cap_hours}h cap</p>

              <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={cn('h-1.5 rounded-full transition-all',
                  w.pct_used >= 90 ? 'bg-red-500' : w.pct_used >= 75 ? 'bg-amber-500' : 'bg-emerald-500')}
                  style={{ width: `${Math.min(100, w.pct_used)}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {w.flown_hours}h flown · {w.flight_count} flight{w.flight_count !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Shared small components ────────────────────────────────────────────────────

function KPI({ label, value, icon: Icon, color, sub }: {
  label: string; value: string; icon: React.ComponentType<{className?:string}>; color: string; sub?: string
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`rounded-xl bg-slate-100 p-3 dark:bg-slate-700 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
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