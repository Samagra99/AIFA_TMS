import { useState } from 'react'
import { useSnagEntries, useSetSnagTimeline, useReclassifySnagNoGo } from '@/api/hooks/useInfrastructure'
import { Modal, Button } from '@/components/ui'
import { useAuthStore } from '@/stores'
import { AlertTriangle, Clock, Calendar, OctagonAlert } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { SnagEntry } from '@/api/types'

dayjs.extend(relativeTime)

export function DeferredDefectsSection() {
  const { user } = useAuthStore()
  const isCAMO = user?.role === 'camo'

  const { data: snagsData, isLoading, refetch } = useSnagEntries()
  const setTimeline = useSetSnagTimeline()
  const reclassifyNoGo = useReclassifySnagNoGo()

  const [selectedSnag, setSelectedSnag] = useState<SnagEntry | null>(null)
  const [dueDateInput, setDueDateInput] = useState('')
  const [camoNotesInput, setCamoNotesInput] = useState('')

  const activeDeferredSnags = (snagsData ?? []).filter(s => {
    if (s.resolved_at) return false
    if (s.category === 'no_go') return false
    const isOverdue = s.resolution_due_date && dayjs().isAfter(dayjs(s.resolution_due_date))
    if (isOverdue) return false // Once transitioned to AOG via expired timeline, keep only in AOG section
    return s.category === 'go' || s.is_deferred
  })

  const handleOpenTimelineModal = (snag: SnagEntry) => {
    setSelectedSnag(snag)
    setDueDateInput(
      snag.resolution_due_date
        ? dayjs(snag.resolution_due_date).format('YYYY-MM-DDTHH:mm')
        : dayjs().add(3, 'day').format('YYYY-MM-DDTHH:mm')
    )
    setCamoNotesInput(snag.camo_notes || '')
  }

  const handleSaveTimeline = async () => {
    if (!selectedSnag || !dueDateInput) return
    try {
      await setTimeline.mutateAsync({
        snagId: selectedSnag.id,
        resolution_due_date: new Date(dueDateInput).toISOString(),
        camo_notes: camoNotesInput,
      })
      toast.success('CAMO resolution timeline saved')
      setSelectedSnag(null)
      refetch()
    } catch (err: any) {
      toast.error('Failed to set resolution timeline')
    }
  }

  const handleReclassifyNoGo = async (snag: SnagEntry) => {
    if (!confirm(`Ground aircraft for snag: "${snag.description}"? This will change status to AOG.`)) return
    try {
      await reclassifyNoGo.mutateAsync({
        snagId: snag.id,
        camo_notes: 'Reclassified as NO-GO (AOG) by CAMO inspection',
      })
      toast.error(`Aircraft grounded for snag: ${snag.description}`)
      refetch()
    } catch (err: any) {
      toast.error('Failed to reclassify snag')
    }
  }

  if (isLoading) return null
  if (activeDeferredSnags.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-center justify-between mb-3 border-b border-amber-200/60 dark:border-amber-900/40 pb-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
            Active Deferred Defects (Operating Under MEL / Deferral)
          </h3>
          <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white">
            {activeDeferredSnags.length}
          </span>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Must be resolved within CAMO timeline or aircraft grounds automatically
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        {activeDeferredSnags.map(snag => {
          const isOverdue = snag.resolution_due_date && dayjs().isAfter(dayjs(snag.resolution_due_date))
          const dueFormatted = snag.resolution_due_date
            ? dayjs(snag.resolution_due_date).format('DD MMM YYYY, hh:mm A')
            : 'Timeline Pending'
          const timeFromNow = snag.resolution_due_date ? dayjs(snag.resolution_due_date).fromNow() : ''

          return (
            <div
              key={snag.id}
              className={`rounded-xl border p-3.5 transition-all bg-white dark:bg-slate-800 ${
                isOverdue
                  ? 'border-red-400 ring-1 ring-red-400 dark:border-red-600'
                  : 'border-amber-300 dark:border-amber-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">
                      {snag.aircraft_tail_number || 'Aircraft'}
                    </span>
                    {snag.aircraft_type_name && (
                      <span className="text-xs text-slate-500 font-medium">
                        {snag.aircraft_type_name}
                      </span>
                    )}
                    {snag.ata_chapter && (
                      <span className="text-[11px] font-semibold text-slate-500">
                        ATA {snag.ata_chapter}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {snag.description}
                  </p>
                </div>

                {isOverdue ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                    <OctagonAlert className="h-3.5 w-3.5" /> OVERDUE (AOG)
                  </span>
                ) : snag.resolution_due_date ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <Clock className="h-3.5 w-3.5" /> {timeFromNow}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    Pending CAMO
                  </span>
                )}
              </div>

              {/* Timeline & Notes */}
              <div className="mt-2.5 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-900/60 space-y-1">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" /> CAMO Due: <strong className="text-slate-800 dark:text-slate-200">{dueFormatted}</strong>
                  </span>
                </div>
                {snag.camo_notes && (
                  <p className="text-slate-600 dark:text-slate-300 italic">
                    CAMO Notes: {snag.camo_notes}
                  </p>
                )}
              </div>

              {/* Action Buttons (Restricted strictly to CAMO Role) */}
              {isCAMO && (
                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleOpenTimelineModal(snag)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {snag.resolution_due_date ? 'Edit CAMO Timeline' : 'Set CAMO Timeline'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReclassifyNoGo(snag)}
                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                  >
                    Ground Aircraft (No-Go)
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Set CAMO Timeline Modal */}
      <Modal
        open={!!selectedSnag}
        onClose={() => setSelectedSnag(null)}
        title="CAMO Resolution Timeline & MEL Notes"
        size="md"
      >
        {selectedSnag && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-bold">Defect: {selectedSnag.description}</p>
              <p className="mt-0.5">Aircraft: {selectedSnag.aircraft_tail_number || 'Fleet Aircraft'}</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                CAMO Resolution Due Date & Time *
              </label>
              <input
                type="datetime-local"
                value={dueDateInput}
                onChange={e => setDueDateInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                If the defect is not resolved by this date/time, the aircraft will automatically be grounded (AOG).
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                CAMO / MEL Instructions & Engineering Notes
              </label>
              <textarea
                rows={3}
                value={camoNotesInput}
                onChange={e => setCamoNotesInput(e.target.value)}
                placeholder="e.g. Deferral approved per MEL 28-10. Rectification required at 100hr inspection."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <Button variant="secondary" size="sm" onClick={() => setSelectedSnag(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveTimeline} loading={setTimeline.isPending}>
                Save CAMO Timeline
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
