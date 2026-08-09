import { useState } from 'react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import {
  useAirports, useCreateAirport, useUpdateAirport,
  useCrossCountryRoutes, useCreateRoute, useUpdateRoute, useDeleteRoute,
  useRouteBriefing, useRefreshBriefing,
  useCreateRouteLeg, useDeleteRouteLeg,
  useCreateAlternate, useDeleteAlternate,
  useCreateNearby, useDeleteNearby,
  type Airport, type CrossCountryRoute,
} from '@/api/hooks'
import { Card, Button, Modal } from '@/components/ui'
import { Map, Route, RefreshCw, Plus, X, ChevronDown, ChevronRight, CloudSun, AlertCircle, Info } from 'lucide-react'

// ─── Helper ────────────────────────────────────────────────────────────────────
function MetarBadge({ metar }: { metar: string }) {
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function NavigationPage() {
  const [tab, setTab] = useState<'airports' | 'routes'>('routes')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Navigation</h1>
        <p className="text-sm text-slate-500">Cross-country routes, airport catalogue &amp; weather briefings</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(['routes', 'airports'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors rounded-t-lg ${
              tab === t
                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            {t === 'routes' ? 'Cross-Country Routes' : 'Airport Catalogue'}
          </button>
        ))}
      </div>

      {tab === 'routes' && <RoutesTab />}
      {tab === 'airports' && <AirportsTab />}
    </div>
  )
}

// ─── Routes Tab ────────────────────────────────────────────────────────────────
function RoutesTab() {
  const { data: routes = [], isLoading } = useCrossCountryRoutes()
  const deleteRoute = useDeleteRoute()
  const [selectedRoute, setSelectedRoute] = useState<CrossCountryRoute | null>(null)
  const [showBriefing, setShowBriefing] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState<CrossCountryRoute | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this route?')) return
    try {
      await deleteRoute.mutateAsync(id)
      toast.success('Route archived')
      if (selectedRoute?.id === id) setSelectedRoute(null)
    } catch { toast.error('Failed to archive route') }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Sidebar: route list */}
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved Routes</h2>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Route
          </Button>
        </div>
        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-slate-400">Loading routes…</div>
        ) : routes.length === 0 ? (
          <Card className="py-10 text-center">
            <Route className="mx-auto h-8 w-8 text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">No routes yet. Create your first CC route.</p>
          </Card>
        ) : routes.map(r => (
          <button key={r.id} onClick={() => setSelectedRoute(r)}
            className={`w-full text-left rounded-xl border p-4 transition-shadow hover:shadow-md ${
              selectedRoute?.id === r.id
                ? 'border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-950'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
            }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{r.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {r.departure_icao} → {r.destination_icao}
                  {r.is_triangular && <span className="ml-2 text-primary-600 font-medium">△ Triangular</span>}
                </p>
                {r.total_distance_nm && (
                  <p className="text-xs text-slate-400 mt-0.5">{r.total_distance_nm} NM</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Detail panel */}
      <div className="lg:col-span-3">
        {selectedRoute ? (
          <RouteDetailPanel
            route={selectedRoute}
            onEdit={() => setShowEditModal(selectedRoute)}
            onDelete={() => handleDelete(selectedRoute.id)}
            onBriefing={() => setShowBriefing(selectedRoute.id)}
          />
        ) : (
          <Card className="flex flex-col items-center justify-center py-24 text-center">
            <Map className="mb-3 h-10 w-10 text-slate-200" />
            <p className="text-slate-400 text-sm">Select a route to view details or get a briefing</p>
          </Card>
        )}
      </div>

      {showCreateModal && (
        <CreateRouteModal onClose={() => setShowCreateModal(false)} />
      )}
      {showEditModal && (
        <EditRouteModal route={showEditModal} onClose={() => setShowEditModal(null)} />
      )}
      {showBriefing && (
        <BriefingModal routeId={showBriefing} onClose={() => setShowBriefing(null)} />
      )}
    </div>
  )
}

// ─── Route Detail Panel ────────────────────────────────────────────────────────
function RouteDetailPanel({ route, onEdit, onDelete, onBriefing }: {
  route: CrossCountryRoute
  onEdit: () => void
  onDelete: () => void
  onBriefing: () => void
}) {
  const createLeg = useCreateRouteLeg()
  const deleteLeg = useDeleteRouteLeg()
  const createAlt = useCreateAlternate()
  const deleteAlt = useDeleteAlternate()
  const createNearby = useCreateNearby()
  const deleteNearby = useDeleteNearby()
  const { data: airports = [] } = useAirports()

  const [showLegs, setShowLegs] = useState(true)
  const [showAlts, setShowAlts] = useState(true)
  const [showNearby, setShowNearby] = useState(true)

  const [newLegAirport, setNewLegAirport] = useState('')
  const [newAltAirport, setNewAltAirport] = useState('')
  const [newAltType, setNewAltType] = useState<'takeoff'|'enroute'|'destination'>('destination')
  const [newNearbyAirport, setNewNearbyAirport] = useState('')
  const [newNearbyNotes, setNewNearbyNotes] = useState('')

  const airportOptions = airports.map(a => ({ value: a.id, label: `${a.icao_code} — ${a.name}` }))

  const handleAddLeg = async () => {
    if (!newLegAirport) return
    try {
      await createLeg.mutateAsync({ route: route.id, airport: newLegAirport, sequence: route.legs.length + 1 })
      setNewLegAirport('')
      toast.success('Leg added')
    } catch { toast.error('Failed to add leg') }
  }

  const handleAddAlt = async () => {
    if (!newAltAirport) return
    try {
      await createAlt.mutateAsync({ route: route.id, airport: newAltAirport, alternate_type: newAltType })
      setNewAltAirport('')
      toast.success('Alternate added')
    } catch { toast.error('Failed to add alternate') }
  }

  const handleAddNearby = async () => {
    if (!newNearbyAirport) return
    try {
      await createNearby.mutateAsync({ route: route.id, airport: newNearbyAirport, notes: newNearbyNotes })
      setNewNearbyAirport('')
      setNewNearbyNotes('')
      toast.success('Nearby airport added')
    } catch { toast.error('Failed to add nearby') }
  }

  return (
    <Card className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{route.name}</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {route.departure_icao} ({route.departure_name}) →&nbsp;
            {route.destination_icao} ({route.destination_name})
            {route.is_triangular && ' · △ Triangular'}
            {route.total_distance_nm && ` · ${route.total_distance_nm} NM`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="danger" onClick={onDelete}>Archive</Button>
          <Button size="sm" onClick={onBriefing}>
            <CloudSun className="h-3.5 w-3.5 mr-1" /> Briefing
          </Button>
        </div>
      </div>

      {/* Legs */}
      <section>
        <button onClick={() => setShowLegs(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 hover:text-slate-700">
          {showLegs ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Intermediate Legs / Waypoints ({route.legs.length})
        </button>
        {showLegs && (
          <div className="space-y-2">
            {route.legs.sort((a, b) => a.sequence - b.sequence).map(leg => (
              <div key={leg.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300 mr-2">#{leg.sequence}</span>
                <span className="flex-1">{leg.airport_icao || leg.waypoint_name} {leg.airport_name && `— ${leg.airport_name}`}</span>
                {leg.leg_distance_nm && <span className="text-xs text-slate-400 mr-3">{leg.leg_distance_nm} NM</span>}
                <button onClick={() => deleteLeg.mutateAsync(leg.id).then(() => toast.success('Leg removed'))}
                  className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <select value={newLegAirport} onChange={e => setNewLegAirport(e.target.value)}
                className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                <option value="">Add airport leg…</option>
                {airportOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Button size="sm" onClick={handleAddLeg} loading={createLeg.isPending}>Add</Button>
            </div>
          </div>
        )}
      </section>

      {/* Alternates */}
      <section>
        <button onClick={() => setShowAlts(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 hover:text-slate-700">
          {showAlts ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Alternate Airports ({route.alternates.length})
        </button>
        {showAlts && (
          <div className="space-y-2">
            {route.alternates.map(alt => (
              <div key={alt.id} className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 px-3 py-2 text-sm">
                <span className="font-medium text-amber-700 dark:text-amber-300 capitalize w-24">{alt.alternate_type}</span>
                <span className="flex-1">{alt.airport_icao} {alt.airport_name && `— ${alt.airport_name}`}</span>
                <button onClick={() => deleteAlt.mutateAsync(alt.id).then(() => toast.success('Alternate removed'))}
                  className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <select value={newAltAirport} onChange={e => setNewAltAirport(e.target.value)}
                className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                <option value="">Select airport…</option>
                {airportOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={newAltType} onChange={e => setNewAltType(e.target.value as any)}
                className="w-36 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                <option value="takeoff">Takeoff</option>
                <option value="enroute">Enroute</option>
                <option value="destination">Destination</option>
              </select>
              <Button size="sm" onClick={handleAddAlt} loading={createAlt.isPending}>Add</Button>
            </div>
          </div>
        )}
      </section>

      {/* Nearby */}
      <section>
        <button onClick={() => setShowNearby(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 hover:text-slate-700">
          {showNearby ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Nearby / Diversion Airports ({route.nearby_airports.length})
        </button>
        {showNearby && (
          <div className="space-y-2">
            {route.nearby_airports.map(nb => (
              <div key={nb.id} className="flex items-center justify-between rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 px-3 py-2 text-sm">
                <span className="flex-1">{nb.airport_icao} {nb.airport_name && `— ${nb.airport_name}`}</span>
                {nb.notes && <span className="text-xs text-slate-400 italic mr-3">{nb.notes}</span>}
                <button onClick={() => deleteNearby.mutateAsync(nb.id).then(() => toast.success('Removed'))}
                  className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <select value={newNearbyAirport} onChange={e => setNewNearbyAirport(e.target.value)}
                className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                <option value="">Select airport…</option>
                {airportOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input value={newNearbyNotes} onChange={e => setNewNearbyNotes(e.target.value)} placeholder="Notes (optional)"
                className="w-40 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <Button size="sm" onClick={handleAddNearby} loading={createNearby.isPending}>Add</Button>
            </div>
          </div>
        )}
      </section>
    </Card>
  )
}

// ─── Create Route Modal ────────────────────────────────────────────────────────
function CreateRouteModal({ onClose }: { onClose: () => void }) {
  const { data: airports = [] } = useAirports()
  const createRoute = useCreateRoute()

  const [name, setName] = useState('')
  const [departureId, setDepartureId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [isTriangular, setIsTriangular] = useState(false)
  const [totalDistance, setTotalDistance] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !departureId || !destinationId) { toast.error('Name, departure, and destination are required'); return }
    try {
      await createRoute.mutateAsync({
        name, departure_airport: departureId as any, destination_airport: destinationId as any,
        is_triangular: isTriangular,
        total_distance_nm: totalDistance ? totalDistance as any : undefined,
      })
      toast.success('Route created!')
      onClose()
    } catch { toast.error('Failed to create route') }
  }

  return (
    <Modal open={true} title="Create Cross-Country Route" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Route Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. VAOP-VAUD-VAOP Triangular"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Departure *</label>
            <select value={departureId} onChange={e => setDepartureId(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option value="">Select airport…</option>
              {airports.map(a => <option key={a.id} value={a.id}>{a.icao_code} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Destination *</label>
            <select value={destinationId} onChange={e => setDestinationId(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option value="">Select airport…</option>
              {airports.map(a => <option key={a.id} value={a.id}>{a.icao_code} — {a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isTriangular} onChange={e => setIsTriangular(e.target.checked)} className="h-4 w-4 rounded" />
            Triangular Route
          </label>
          <div className="flex-1">
            <input value={totalDistance} onChange={e => setTotalDistance(e.target.value)} type="number" step="0.1" placeholder="Total distance (NM)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={createRoute.isPending}>Create Route</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit Route Modal ──────────────────────────────────────────────────────────
function EditRouteModal({ route, onClose }: { route: CrossCountryRoute; onClose: () => void }) {
  const updateRoute = useUpdateRoute()
  const [name, setName] = useState(route.name)
  const [isTriangular, setIsTriangular] = useState(route.is_triangular)
  const [totalDistance, setTotalDistance] = useState(route.total_distance_nm || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateRoute.mutateAsync({ id: route.id, name, is_triangular: isTriangular, total_distance_nm: totalDistance as any })
      toast.success('Route updated')
      onClose()
    } catch { toast.error('Failed to update route') }
  }

  return (
    <Modal open={true} title="Edit Route" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Route Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isTriangular} onChange={e => setIsTriangular(e.target.checked)} className="h-4 w-4 rounded" />
            Triangular Route
          </label>
          <input value={totalDistance} onChange={e => setTotalDistance(e.target.value)} type="number" step="0.1" placeholder="Total distance (NM)"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
        </div>
        <div className="flex gap-3">
          <Button type="submit" loading={updateRoute.isPending}>Save</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Briefing Modal ────────────────────────────────────────────────────────────
function BriefingModal({ routeId, onClose }: { routeId: string; onClose: () => void }) {
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
          {briefing.airports.map(ap => (
            <div key={ap.icao_code} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Airport header */}
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
                    {ap.weather.metar && (
                      <div className="rounded-lg bg-slate-900 dark:bg-slate-950 p-3 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-slate-400 font-semibold">METAR</span>
                          <MetarBadge metar={ap.weather.metar} />
                        </div>
                        <code className="text-xs text-green-400 font-mono break-all whitespace-pre-wrap">{ap.weather.metar}</code>
                      </div>
                    )}
                    {ap.weather.taf && (
                      <div className="rounded-lg bg-slate-900 dark:bg-slate-950 p-3">
                        <p className="text-xs text-slate-400 font-semibold mb-1">TAF</p>
                        <code className="text-xs text-sky-300 font-mono break-all whitespace-pre-wrap">{ap.weather.taf}</code>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                    <Info className="h-4 w-4" /> No weather data. Click Refresh to fetch.
                  </div>
                )}

                {/* NOTAMs */}
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

// ─── Airports Tab ──────────────────────────────────────────────────────────────
function AirportsTab() {
  const [search, setSearch] = useState('')
  const { data: airports = [], isLoading } = useAirports(search || undefined)
  const [showCreate, setShowCreate] = useState(false)
  const [editAirport, setEditAirport] = useState<Airport | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ICAO, name, city…"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Airport
        </Button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Loading airports…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                {['ICAO', 'IATA', 'Name', 'City', 'Elevation', 'Fuel', 'Customs', 'Verified', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {airports.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{a.icao_code}</td>
                  <td className="px-4 py-3 text-slate-500">{a.iata_code || '—'}</td>
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="px-4 py-3 text-slate-500">{a.city || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{a.elevation_ft} ft</td>
                  <td className="px-4 py-3">{a.has_fuel ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3">{a.has_customs ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3">
                    {a.is_verified
                      ? <span className="text-emerald-600 text-xs font-medium">Verified</span>
                      : <span className="text-amber-600 text-xs font-medium">Pending</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditAirport(a)}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium">Edit</button>
                  </td>
                </tr>
              ))}
              {airports.length === 0 && (
                <tr><td colSpan={9} className="py-16 text-center text-slate-400">No airports found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <AirportFormModal onClose={() => setShowCreate(false)} />}
      {editAirport && <AirportFormModal airport={editAirport} onClose={() => setEditAirport(null)} />}
    </div>
  )
}

// ─── Airport Form Modal ────────────────────────────────────────────────────────
function AirportFormModal({ airport, onClose }: { airport?: Airport; onClose: () => void }) {
  const createAirport = useCreateAirport()
  const updateAirport = useUpdateAirport()
  const isEdit = !!airport

  const [form, setForm] = useState({
    icao_code: airport?.icao_code || '',
    iata_code: airport?.iata_code || '',
    name: airport?.name || '',
    city: airport?.city || '',
    latitude: airport?.latitude || '',
    longitude: airport?.longitude || '',
    elevation_ft: airport?.elevation_ft?.toString() || '0',
    has_fuel: airport?.has_fuel ?? true,
    has_customs: airport?.has_customs ?? false,
    is_verified: airport?.is_verified ?? true,
    remarks: airport?.remarks || '',
  })

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = { ...form, elevation_ft: parseInt(form.elevation_ft) || 0 }
    try {
      if (isEdit) {
        await updateAirport.mutateAsync({ id: airport!.id, ...data })
        toast.success('Airport updated')
      } else {
        await createAirport.mutateAsync(data)
        toast.success('Airport added')
      }
      onClose()
    } catch { toast.error('Failed to save airport') }
  }

  const isPending = createAirport.isPending || updateAirport.isPending

  return (
    <Modal open={true} title={isEdit ? `Edit ${airport!.icao_code}` : 'Add Airport'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ICAO Code *</label>
            <input value={form.icao_code} onChange={e => set('icao_code', e.target.value.toUpperCase())} required maxLength={4}
              placeholder="VAOP" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">IATA Code</label>
            <input value={form.iata_code} onChange={e => set('iata_code', e.target.value.toUpperCase())} maxLength={3}
              placeholder="UDR" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Airport Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
            <input value={form.city} onChange={e => set('city', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
            <input value={form.latitude} onChange={e => set('latitude', e.target.value)} type="number" step="any" required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
            <input value={form.longitude} onChange={e => set('longitude', e.target.value)} type="number" step="any" required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Elevation (ft)</label>
          <input value={form.elevation_ft} onChange={e => set('elevation_ft', e.target.value)} type="number"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
        </div>
        <div className="flex gap-6">
          {[
            { label: 'Has Fuel', key: 'has_fuel' },
            { label: 'Has Customs', key: 'has_customs' },
            { label: 'Verified', key: 'is_verified' },
          ].map(({ label, key }) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={(form as any)[key]} onChange={e => set(key, e.target.checked)} className="h-4 w-4 rounded" />
              {label}
            </label>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
          <textarea value={form.remarks} onChange={e => set('remarks', e.target.value)} rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={isPending}>{isEdit ? 'Save Changes' : 'Add Airport'}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}
