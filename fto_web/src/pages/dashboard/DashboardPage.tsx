import React, { useState, useEffect } from 'react'
import { Plane, Users, AlertTriangle, CalendarDays, Wrench, Eye } from 'lucide-react'
import { Card, CardHeader, CardTitle, PageLoader, AircraftStatusPill } from '@/components/ui'
import { useFleetStatus, useAOGAircraft, useDailyRoster, useMaintenanceAircraft, useWeather } from '@/api/hooks'
import { useUIStore, useAuthStore } from '@/stores'
import { fmt } from '@/lib/utils'
import dayjs from 'dayjs'

export function DashboardPage() {
  const { activeBaseId } = useUIStore()
  const { user }         = useAuthStore()
  const { data: weather } = useWeather(activeBaseId)
  const today            = dayjs().format('YYYY-MM-DD')

  const isWeatherOutdated = weather?.observation_time 
    ? dayjs().diff(dayjs(weather.observation_time), 'hour') >= 12 
    : false;

  // --- Clock State ---
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    // Tick the clock every 1 minute to keep times accurate
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Format times securely enforcing timezones
  const utcTime = now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })
  const istTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
  // -------------------

  const { data: fleet, isLoading: fleetLoading } = useFleetStatus(activeBaseId)
  const { data: aog }                             = useAOGAircraft()
  const { data: maintenance }                     = useMaintenanceAircraft()
  const { data: roster }                          = useDailyRoster(today, activeBaseId)

  const airworthy      = fleet?.filter(a => a.status === 'airworthy').length ?? 0
  const aogCount       = fleet?.filter(a => a.status === 'aog').length ?? 0
  const ferryTriggered = fleet?.filter(a => a.ferry_buffer_triggered).length ?? 0
  const underMaintenance = fleet?.filter(a => a.status === 'scheduled_maintenance').length ?? 0
  const todayFlights   = roster?.length ?? 0

  return (
    <div className="space-y-6">
      {/* Header with Time/Weather Widget */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Good {greeting()}, {user?.full_name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {dayjs().format('dddd, D MMMM YYYY')} · {activeBaseId ? 'Base view' : 'All bases'}
          </p>
        </div>

        {/* Ops Clock & Weather Panel */}
        <div className="flex items-center gap-5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          {/* UTC Time */}
          <div className="flex flex-col items-center">
            <span className="font-mono text-base font-bold text-slate-800 dark:text-slate-100">{utcTime}Z</span>
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">UTC</span>
          </div>
          
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
          
          {/* IST Time */}
          <div className="flex flex-col items-center">
            <span className="font-mono text-base font-bold text-slate-800 dark:text-slate-100">{istTime}</span>
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">IST</span>
          </div>

          {/* Conditional Visibility (Only shows if a specific base is selected) */}
          {activeBaseId && activeBaseId !== 'all' && (
            <>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
              
              {/* Visibility */}
              <div className="flex flex-col items-center text-primary-600 dark:text-primary-400">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="font-mono text-sm font-bold">
                    {/* If outdated, show Not Available. Otherwise, show visibility or N/A */}
                    {isWeatherOutdated 
                      ? 'Not Available' 
                      : (weather?.visibility_m ? `${weather.visibility_m}m` : 'N/A')}
                  </span>
                </div>
                <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">Visibility</span>
              </div>

              {/* Report Time (HIDDEN if weather is outdated) */}
              {!isWeatherOutdated && weather?.observation_time && (
                <div className="flex flex-col justify-center pl-2 text-left">
                  <span className="text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    Reported
                  </span>
                  <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {fmt.time(weather.observation_time)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPI label="Airworthy" value={airworthy} icon={Plane} color="text-emerald-600" loading={fleetLoading} />
        <KPI label="AOG" value={aogCount} icon={AlertTriangle} color={aogCount > 0 ? 'text-red-600' : 'text-slate-400'} loading={fleetLoading} />
        <KPI label="Ferry Due" value={ferryTriggered} icon={Plane} color={ferryTriggered > 0 ? 'text-amber-600' : 'text-slate-400'} loading={fleetLoading} />
        <KPI label="Under Maintenance" value={underMaintenance} icon={Wrench} color={underMaintenance > 0 ? 'text-blue-600' : 'text-slate-400'} loading={fleetLoading} />
        <KPI label="Flights Today" value={todayFlights} icon={CalendarDays} color="text-primary-600" loading={fleetLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Grounded & In Maintenance</CardTitle>
            <div className="flex gap-3">
              {aogCount > 0 && (
                <span className="text-xs font-semibold text-red-600">{aogCount} AOG</span>
              )}
              {/* Assume maintenanceCount is the length of your scheduled maintenance array */}
              {underMaintenance > 0 && (
                <span className="text-xs font-semibold text-amber-600">{underMaintenance} In Maintenance</span>
              )}
            </div>
          </CardHeader>
          
          {fleetLoading ? (
            <PageLoader />
          ) : (aogCount > 0 || underMaintenance > 0) ? (
            <div className="space-y-3">
              
              {/* 1. AOG Aircraft (Red Styling) */}
              {aog?.map(a => (
                <div key={a.id} className="flex items-start justify-between rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-950/20">
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">{a.tail_number}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{a.aircraft_type_name} · {a.current_base_name}</p>
                    {a.aog_reason && (
                      <p className="mt-1.5 text-xs text-red-700 dark:text-red-300">{a.aog_reason}</p>
                    )}
                    {a.aog_since && (
                      <p className="mt-0.5 text-xs text-slate-400">Grounded {fmt.fromNow(a.aog_since)}</p>
                    )}
                  </div>
                  <AircraftStatusPill status="aog" />
                </div>
              ))}

              {/* 2. Scheduled Maintenance Aircraft (Amber Styling) */}
              {/* Make sure to replace `maintenance` with your actual array variable name */}
              {maintenance?.map(a => (
                <div key={a.id} className="flex items-start justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">{a.tail_number}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{a.aircraft_type_name} · {a.current_base_name}</p>
                    {/* If your model uses a different field for maintenance reasons, swap a.aog_reason here */}
                    {a.aog_reason && (
                      <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">{a.aog_reason}</p>
                    )}
                  </div>
                  <AircraftStatusPill status="scheduled_maintenance" />
                </div>
              ))}
              
            </div>
          ) : (
            <EmptyState icon="✅" message="All aircraft are currently serviceable." />
          )}
        </Card>
      
      {/* <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AOG Aircraft</CardTitle>
            {aogCount > 0 && (
              <span className="text-xs font-semibold text-red-600">{aogCount} grounded</span>
            )}
          </CardHeader>
          {fleetLoading ? <PageLoader /> : aog && aog.length > 0 ? (
            <div className="space-y-3">
              {aog.map(a => (
                <div key={a.id} className="flex items-start justify-between rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">{a.tail_number}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{a.aircraft_type_name} · {a.current_base_name}</p>
                    {a.aog_reason && (
                      <p className="mt-1.5 text-xs text-red-700 dark:text-red-300">{a.aog_reason}</p>
                    )}
                    {a.aog_since && (
                      <p className="mt-0.5 text-xs text-slate-400">Grounded {fmt.fromNow(a.aog_since)}</p>
                    )}
                  </div>
                  <AircraftStatusPill status="aog" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="✅" message="No AOG aircraft. All serviceable." />
          )}
        </Card> */}

        {/* Today's roster summary */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Flights</CardTitle>
            <span className="text-xs text-slate-500">{dayjs().format('D MMM')}</span>
          </CardHeader>
          {!roster ? <PageLoader /> : roster.length > 0 ? (
            <div className="space-y-2">
              {roster.slice(0, 8).map(f => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <span className="w-12 text-right font-mono text-xs text-slate-400">{fmt.time(f.scheduled_start)}</span>
                  <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {fleet?.find(a => a.id === f.aircraft)?.tail_number ?? '—'}
                  </span>
                  <span className="flex-1 truncate text-xs text-slate-500 capitalize">
                    {f.flight_type.replace(/_/g, ' ')}
                  </span>
                  <StatusDot status={f.status} />
                </div>
              ))}
              {roster.length > 8 && (
                <p className="pt-1 text-center text-xs text-slate-400">+{roster.length - 8} more flights</p>
              )}
            </div>
          ) : (
            <EmptyState icon="📅" message="No flights scheduled today." />
          )}
        </Card>
      </div>

      {/* Ferry buffer warnings */}
      {(fleet?.filter(a => a.ferry_buffer_triggered && a.status !== 'aog') ?? []).length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="text-amber-800 dark:text-amber-200">⚠ Ferry Buffer Alerts</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {fleet!.filter(a => a.ferry_buffer_triggered && a.status !== 'aog').map(a => (
              <div key={a.id} className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-mono font-bold">{a.tail_number}</span>
                {' '}at {a.current_base_name} — {Number(a.hours_to_next_inspection).toFixed(1)} hr to next inspection.
                Return to hub required.
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function KPI({ label, value, icon: Icon, color, loading }: { label: string; value: number; icon: React.ComponentType<{className?:string}>; color: string; loading?: boolean }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`rounded-xl bg-slate-100 p-3 dark:bg-slate-700 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        {loading
          ? <div className="h-7 w-8 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
          : <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>}
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </Card>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: 'bg-slate-400', confirmed: 'bg-sky-500',
    dispatched: 'bg-violet-500', airborne: 'bg-emerald-500',
    completed: 'bg-green-400', cancelled: 'bg-red-500',
  }
  return <span className={`h-2 w-2 rounded-full ${colors[status] ?? 'bg-slate-300'}`} />
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
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
