import { useState, useEffect } from 'react'
import { Card, Button, PageLoader, Badge } from '@/components/ui'
import { Cloud, Wind, Thermometer, Edit2 } from 'lucide-react'
import { useWeatherLatest, useWeatherHistory, useManualWeatherEntry, useSetActiveRunway, useRunways, useSolarSchedule, useUpdateSolarSchedule } from '@/api/hooks/useWeather'
import { useBases } from '@/api/hooks/useInfrastructure'
import { useUIStore } from '@/stores'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import type { WeatherEntry } from '@/api/types'

export function WeatherPage() {
  const { activeBaseId } = useUIStore()
  // Assuming the base object is available or just rely on API response
  // We'll just fetch by baseId
  
  const { data: latest, isLoading: latestLoading } = useWeatherLatest(undefined, activeBaseId || undefined)
  const { data: history, isLoading: historyLoading } = useWeatherHistory(latest?.icao_code)
  
  const [showManualForm, setShowManualForm] = useState(false)

  if (!activeBaseId || activeBaseId === 'all') {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <Cloud className="mb-4 h-12 w-12 text-slate-300" />
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Select a Specific Base</h2>
        <p className="text-sm text-slate-500">Weather data requires a specific base to be selected from the top menu.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Aviation Weather</h1>
            <p className="text-sm text-slate-500">Latest meteorological observations and forecasts</p>
          </div>
        </div>
        <Button onClick={() => setShowManualForm(!showManualForm)} variant={showManualForm ? 'secondary' : 'primary'} size="sm">
          {showManualForm ? 'Cancel Manual Entry' : <><Edit2 className="h-4 w-4 mr-1" /> Manual Entry</>}
        </Button>
      </div>

      {showManualForm && <ManualEntryForm icao={latest?.icao_code || ''} onClose={() => setShowManualForm(false)} />}

      {latestLoading ? <PageLoader /> : (
        <>
          {latest && <WeatherDashboard latest={latest} baseId={activeBaseId} />}
          <SolarScheduleCard baseId={activeBaseId} />

          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Observations</h2>
            </div>
            {historyLoading ? <div className="p-8"><PageLoader /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Wind</th>
                      <th className="px-4 py-3 font-medium">Visibility</th>
                      <th className="px-4 py-3 font-medium">Temp/Dew</th>
                      <th className="px-4 py-3 font-medium">QNH</th>
                      <th className="px-4 py-3 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                    {history?.results?.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {w.observation_time ? dayjs(w.observation_time).format('DD MMM, HH:mm') : (w.fetched_at ? dayjs(w.fetched_at).format('DD MMM, HH:mm') : '-')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="default" className="text-xs font-mono">{w.icao_code}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {w.wind_direction_deg !== null && w.wind_speed_kt !== null ? (
                            <span>{String(w.wind_direction_deg).padStart(3, '0')}° / {w.wind_speed_kt}kt {w.wind_gust_kt ? `G${w.wind_gust_kt}kt` : ''}</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">{w.visibility_m ? `${w.visibility_m}m` : '-'}</td>
                        <td className="px-4 py-3">{w.temp_celsius && w.dewpoint_celsius ? `${w.temp_celsius}°C / ${w.dewpoint_celsius}°C` : '-'}</td>
                        <td className="px-4 py-3">{w.qnh_hpa ? `${w.qnh_hpa} hPa` : '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={w.source === 'manual' ? 'warning' : 'default'} className="text-[10px] uppercase">
                            {w.source.replace('_', ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function WeatherDashboard({ latest, baseId }: { latest: WeatherEntry, baseId: string }) {
  const { data: basesData } = useBases()
  const { data: runwaysData } = useRunways(baseId)
  
  const currentBase = basesData?.results?.find(b => b.id === baseId)
  const runways = runwaysData?.results || []

  const [activeRunway, setActiveRunwayInput] = useState('')
  const setActiveRunway = useSetActiveRunway()

  // Initialize input with current active runway
  useEffect(() => {
    if (currentBase?.active_runway) {
      const savedDirection = localStorage.getItem(`base_${baseId}_rwy_${currentBase.active_runway}_dir`) || 'primary'
      setActiveRunwayInput(`${currentBase.active_runway}|${savedDirection}`)
    }
  }, [currentBase?.active_runway, baseId])

  const handleSetRunway = async () => {
    if (!activeRunway) return
    const [runwayId] = activeRunway.split('|')
    try {
      await setActiveRunway.mutateAsync({ base_id: baseId, runway_id: runwayId })
      toast.success('Active runway updated')
    } catch {
      toast.error('Failed to set active runway')
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPIBox icon={<Thermometer className="h-4 w-4 text-orange-500" />} label="Temperature" value={latest.temp_celsius ? `${latest.temp_celsius}°C` : 'N/A'} sub={latest.dewpoint_celsius ? `Dew: ${latest.dewpoint_celsius}°C` : ''} />
        <KPIBox icon={<Wind className="h-4 w-4 text-sky-500" />} label="Wind" value={latest.wind_speed_kt !== null ? `${latest.wind_speed_kt} kt` : 'N/A'} sub={latest.wind_direction_deg !== null ? `Dir: ${String(latest.wind_direction_deg).padStart(3, '0')}°` : ''} />
        <KPIBox icon={<Cloud className="h-4 w-4 text-slate-500" />} label="Visibility" value={latest.visibility_m ? `${latest.visibility_m} m` : 'N/A'} sub={latest.visibility_m && latest.visibility_m < 5000 ? 'Low Vis' : 'VFR'} />
        <KPIBox icon={<span className="text-slate-400 font-bold text-xs">QNH</span>} label="Pressure" value={latest.qnh_hpa ? `${latest.qnh_hpa} hPa` : 'N/A'} />
        <KPIBox icon={<span className="text-slate-400 font-bold text-xs">DA</span>} label="Density Alt" value={latest.density_altitude_ft ? `${Math.round(latest.density_altitude_ft)} ft` : 'N/A'} />
      </div>

      <Card className="p-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Latest METAR ({latest.icao_code})</h3>
          <p className="font-mono text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
            {latest.metar_raw || 'No METAR available.'}
          </p>
        </div>
        {latest.taf_raw && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Latest TAF</h3>
            <p className="font-mono text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
              {latest.taf_raw}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Observed: {latest.observation_time ? dayjs(latest.observation_time).format('DD MMM YYYY, HH:mm') : (latest.fetched_at ? dayjs(latest.fetched_at).format('DD MMM YYYY, HH:mm') : '-')} 
              {latest.is_stale && <span className="ml-2 text-red-500 font-medium">⚠️ STALE DATA</span>}
            </div>
            
            <div className="flex items-center gap-2">
               <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Source:</span>
               <Badge variant="default" className="text-[10px] uppercase">{latest.source?.replace('_', ' ') || 'UNKNOWN'}</Badge>
            </div>
          </div>
        </div>
      </Card>
      
      <Card className="p-4 border-t-4 border-t-sky-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            Active Runway
          </h3>
          <p className="text-xs text-slate-500">Select the active runway for crosswind calculations.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
            className="flex-1 md:w-48 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-lg p-2"
            value={activeRunway}
            onChange={(e) => {
              const val = e.target.value
              setActiveRunwayInput(val)
              if (val) {
                const [rwyId, dir] = val.split('|')
                localStorage.setItem(`base_${baseId}_rwy_${rwyId}_dir`, dir)
              }
            }}
          >
            <option value="">-- Select Runway --</option>
            {runways.flatMap(r => {
              const parts = r.runway_identifier.split('-')
              if (parts.length === 2) {
                return [
                  <option key={`${r.id}-primary`} value={`${r.id}|primary`}>RWY {parts[0]} ({r.heading_deg}°)</option>,
                  <option key={`${r.id}-reciprocal`} value={`${r.id}|reciprocal`}>RWY {parts[1]} ({r.reciprocal_heading_deg}°)</option>
                ]
              }
              return <option key={r.id} value={`${r.id}|primary`}>RWY {r.runway_identifier} ({r.heading_deg}°)</option>
            })}
          </select>
          <Button 
            size="sm" 
            onClick={handleSetRunway} 
            disabled={!activeRunway || setActiveRunway.isPending}
          >
            {setActiveRunway.isPending ? 'Saving...' : 'Set Active'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function KPIBox({ icon, label, value, sub }: { icon: React.ReactNode, label: string, value: string, sub?: string }) {
  return (
    <Card className="p-4 flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </Card>
  )
}

function ManualEntryForm({ icao, onClose }: { icao: string, onClose: () => void }) {
  const manualEntry = useManualWeatherEntry()
  const [form, setForm] = useState({
    icao_code: icao,
    metar_raw: '',
    taf_raw: '',
    observation_time: '',
    wind_direction_deg: '',
    wind_speed_kt: '',
    wind_gust_kt: '',
    visibility_m: '',
    temp_celsius: '',
    dewpoint_celsius: '',
    qnh_hpa: '',
    source_remarks: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: Record<string, any> = { ...form }
      // Convert number strings
      const numericFields = ['wind_direction_deg', 'wind_speed_kt', 'wind_gust_kt', 'visibility_m', 'temp_celsius', 'dewpoint_celsius', 'qnh_hpa']
      numericFields.forEach(f => {
        if (payload[f] === '') payload[f] = null
        else payload[f] = Number(payload[f])
      })
      if (payload.observation_time) {
        payload.observation_time = payload.observation_time + 'Z'
      }
      
      await manualEntry.mutateAsync(payload)
      toast.success('Weather recorded manually')
      onClose()
    } catch {
      toast.error('Failed to submit manual weather')
    }
  }

  return (
    <Card className="border-primary-200 bg-primary-50/50 dark:border-primary-900/50 dark:bg-primary-950/20">
      <div className="mb-4 pb-3 border-b border-primary-100 dark:border-primary-900">
        <h2 className="text-sm font-semibold text-primary-900 dark:text-primary-100 flex items-center gap-2">
          <Edit2 className="h-4 w-4" /> Manual Weather Entry
        </h2>
        <p className="text-xs text-primary-700 dark:text-primary-300 mt-1">Use this when automatic fetches fail or are inaccurate.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">ICAO Code *</label>
              <input type="text" required value={form.icao_code} onChange={e => setForm({...form, icao_code: e.target.value.toUpperCase()})}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase dark:border-slate-600 dark:bg-slate-800" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Raw METAR</label>
              <textarea value={form.metar_raw} onChange={e => {
                const val = e.target.value.toUpperCase()
                const updates: any = { metar_raw: val }
                
                // Very basic METAR auto-parse
                const timeMatch = val.match(/\b(\d{2})(\d{2})(\d{2})Z\b/)
                if (timeMatch) {
                  const day = parseInt(timeMatch[1])
                  const hour = parseInt(timeMatch[2])
                  const minute = parseInt(timeMatch[3])
                  
                  const now = new Date()
                  let obs = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, minute, 0))
                  
                  // If parsed time is > 1 day in future, it's likely from previous month
                  if (obs.getTime() > now.getTime() + 86400000) {
                    obs.setUTCMonth(obs.getUTCMonth() - 1)
                  }
                  
                  // Keep it in Zulu/UTC for the datetime-local input
                  updates.observation_time = obs.toISOString().slice(0, 16)
                }

                const windMatch = val.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/)
                if (windMatch) {
                  if (windMatch[1] !== 'VRB') updates.wind_direction_deg = windMatch[1]
                  updates.wind_speed_kt = windMatch[2]
                  if (windMatch[3]) updates.wind_gust_kt = windMatch[3]
                }
                
                const visMatch = val.match(/\b(\d{4})\b/)
                if (visMatch && parseInt(visMatch[1]) <= 9999) updates.visibility_m = visMatch[1]
                
                const tempMatch = val.match(/\b(M?\d{2})\/(M?\d{2})\b/)
                if (tempMatch) {
                  updates.temp_celsius = tempMatch[1].replace('M', '-')
                  updates.dewpoint_celsius = tempMatch[2].replace('M', '-')
                }
                
                const qnhMatch = val.match(/\bQ(\d{4})\b/)
                if (qnhMatch) updates.qnh_hpa = qnhMatch[1]

                setForm({ ...form, ...updates })
              }} rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 uppercase" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Raw TAF</label>
              <textarea value={form.taf_raw} onChange={e => setForm({...form, taf_raw: e.target.value.toUpperCase()})} rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-800 uppercase" />
            </div>
          </div>

          <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-semibold text-slate-500 uppercase">Decoded Values</h3>
              <div className="w-1/2">
                <label className="mb-1 block text-xs text-slate-500">Observation Time (Zulu/UTC)</label>
                <input type="datetime-local" value={form.observation_time} onChange={e => setForm({...form, observation_time: e.target.value})}
                  className="w-full rounded-md border border-slate-300 p-1.5 text-xs dark:border-slate-600 dark:bg-slate-800" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Wind Dir (°)</label>
                <input type="number" value={form.wind_direction_deg} onChange={e => setForm({...form, wind_direction_deg: e.target.value})}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Wind Spd (kt)</label>
                <input type="number" value={form.wind_speed_kt} onChange={e => setForm({...form, wind_speed_kt: e.target.value})}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Gust (kt)</label>
                <input type="number" value={form.wind_gust_kt} onChange={e => setForm({...form, wind_gust_kt: e.target.value})}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Visibility (m)</label>
                <input type="number" value={form.visibility_m} onChange={e => setForm({...form, visibility_m: e.target.value})}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">QNH (hPa)</label>
                <input type="number" value={form.qnh_hpa} onChange={e => setForm({...form, qnh_hpa: e.target.value})}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Temp (°C)</label>
                <input type="number" value={form.temp_celsius} onChange={e => setForm({...form, temp_celsius: e.target.value})}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Dewpoint (°C)</label>
                <input type="number" value={form.dewpoint_celsius} onChange={e => setForm({...form, dewpoint_celsius: e.target.value})}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
              </div>
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Source Remarks (Reason for manual entry)</label>
          <input type="text" value={form.source_remarks} onChange={e => setForm({...form, source_remarks: e.target.value})} placeholder="e.g. Received via radio from tower"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={manualEntry.isPending}>Save Manual Entry</Button>
        </div>
      </form>
    </Card>
  )
}

function SolarScheduleCard({ baseId }: { baseId: string }) {
  const today = dayjs().format('YYYY-MM-DD')
  const { data: schedule, isLoading } = useSolarSchedule(baseId, today)
  const updateSchedule = useUpdateSolarSchedule()
  
  const [isEditing, setIsEditing] = useState(false)
  const [sunriseInput, setSunriseInput] = useState('')
  const [sunsetInput, setSunsetInput] = useState('')

  useEffect(() => {
    if (schedule) {
      setSunriseInput(dayjs(schedule.sunrise_time).format('HH:mm'))
      setSunsetInput(dayjs(schedule.sunset_time).format('HH:mm'))
    }
  }, [schedule])

  if (isLoading || !schedule) return null

  const handleSave = async () => {
    try {
      const datePrefix = dayjs(schedule.date).format('YYYY-MM-DD')
      await updateSchedule.mutateAsync({
        id: schedule.id,
        sunrise_time: `${datePrefix}T${sunriseInput}:00Z`,
        sunset_time: `${datePrefix}T${sunsetInput}:00Z`
      })
      toast.success('Solar schedule updated')
      setIsEditing(false)
    } catch {
      toast.error('Failed to update solar schedule')
    }
  }

  return (
    <Card className="p-4 border-t-4 border-t-orange-400">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            Solar Schedule <span className="text-xs font-normal text-slate-500">({schedule.date})</span>
          </h3>
          <p className="text-xs text-slate-500">Automatically calculated times for this base.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setIsEditing(!isEditing)}>
          <Edit2 className="w-3 h-3 mr-1" /> {isEditing ? 'Cancel' : 'Edit'}
        </Button>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase">🌅 Sunrise</span>
          {isEditing ? (
            <input type="time" value={sunriseInput} onChange={e => setSunriseInput(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded p-1 text-sm" />
          ) : (
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {dayjs(schedule.sunrise_time).format('HH:mm')}
            </span>
          )}
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase">🌇 Sunset</span>
          {isEditing ? (
            <input type="time" value={sunsetInput} onChange={e => setSunsetInput(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded p-1 text-sm" />
          ) : (
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {dayjs(schedule.sunset_time).format('HH:mm')}
            </span>
          )}
        </div>
        
        {isEditing && (
          <div className="ml-auto">
            <Button size="sm" onClick={handleSave} loading={updateSchedule.isPending}>Save</Button>
          </div>
        )}
      </div>
    </Card>
  )
}
