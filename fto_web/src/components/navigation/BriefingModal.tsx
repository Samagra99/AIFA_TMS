import { useRouteBriefing, useRefreshBriefing } from '@/api/hooks'
import { Modal, Button } from '@/components/ui'
import { RefreshCw, AlertCircle, CloudSun, Info } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'

export function MetarBadge({ metar }: { metar: string }) {
  const cat = metar.toLowerCase().includes('lifr') ? 'LIFR'
    : metar.toLowerCase().includes('ifr') ? 'IFR'
    : metar.toLowerCase().includes('mvfr') ? 'MVFR'
    : 'VFR'
  const color = cat === 'LIFR' ? 'bg-red-900 text-red-100'
    : cat === 'IFR' ? 'bg-red-500 text-white'
    : cat === 'MVFR' ? 'bg-blue-500 text-white'
    : 'bg-emerald-500 text-white'
  return <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${color}`}>{cat}</span>
}

export function BriefingModal({ routeId, onClose }: { routeId: string; onClose: () => void }) {
  const { data: briefing, isLoading } = useRouteBriefing(routeId)
  const refresh = useRefreshBriefing()

  const handleRefresh = async () => {
    try {
      await refresh.mutateAsync(routeId)
      toast.success('Weather & NOTAM refresh queued — data will update in ~30 seconds')
    } catch { toast.error('Refresh failed') }
  }

  return (
    <Modal open={true} title={`Briefing Packet — ${briefing?.route_name || ''}`} onClose={onClose} size="xl">
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-slate-500">Weather (METAR/TAF) and active NOTAMs for all route airports</p>
        <Button size="sm" variant="secondary" onClick={handleRefresh} loading={refresh.isPending}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Loading briefing data…</div>
      ) : !briefing ? (
        <div className="py-16 text-center text-slate-400">No briefing data available. Try refreshing.</div>
      ) : (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {briefing.airports.map((ap: any) => (
            <div key={ap.icao_code} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">{ap.icao_code}</span>
                  {ap.weather_stale && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-3 w-3" /> Weather stale
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{ap.notams.length} NOTAM{ap.notams.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="p-4 space-y-4">
                {/* Weather */}
                {ap.weather ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <CloudSun className="h-3.5 w-3.5" /> Weather
                      <span className="text-slate-400 font-normal normal-case">
                        Fetched {dayjs(ap.weather.fetched_at).format('HH:mm')}Z
                      </span>
                    </p>
                    {ap.weather.metar_raw && (
                      <div className="rounded-lg bg-slate-900 dark:bg-slate-950 p-3 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-slate-400 font-semibold">METAR</span>
                          <MetarBadge metar={ap.weather.metar_raw} />
                        </div>
                        <code className="text-xs text-green-400 font-mono break-all whitespace-pre-wrap">{ap.weather.metar_raw}</code>
                      </div>
                    )}
                    {ap.weather.taf_raw && (
                      <div className="rounded-lg bg-slate-900 dark:bg-slate-950 p-3">
                        <p className="text-xs text-slate-400 font-semibold mb-1">TAF</p>
                        <code className="text-xs text-sky-300 font-mono break-all whitespace-pre-wrap">{ap.weather.taf_raw}</code>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                    <Info className="h-4 w-4" /> No weather data. Click Refresh to fetch.
                  </div>
                )}

                {ap.notams.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" /> Active NOTAMs
                    </p>
                    <div className="space-y-2">
                      {ap.notams.map((n: any) => (
                        <div key={n.id || n.notam_id} className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <code className="text-xs font-bold text-amber-800 dark:text-amber-200">{n.notam_id}</code>
                            <div className="text-xs text-slate-500 text-right shrink-0">
                              {n.effective_from && <span>{dayjs(n.effective_from).format('DD MMM HH:mm')}Z</span>}
                              {n.effective_to && <span> → {dayjs(n.effective_to).format('DD MMM HH:mm')}Z</span>}
                              {n.is_permanent && <span className="ml-1 text-red-600 font-medium">PERM</span>}
                            </div>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap break-all">{n.notam_text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
