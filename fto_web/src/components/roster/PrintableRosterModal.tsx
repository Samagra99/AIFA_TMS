import { Modal, Button } from '@/components/ui'
import { Printer } from 'lucide-react'
import { fmt, flightTypeBadge } from '@/lib/utils'
import dayjs from 'dayjs'
import type { Flight } from '@/api/types'
import type { DailyPlanRequest } from '@/api/hooks/useRostering'

interface Props {
  open: boolean
  onClose: () => void
  planRequest: DailyPlanRequest | null
  flights: Flight[]
}

export function PrintableRosterModal({ open, onClose, planRequest, flights }: Props) {
  if (!planRequest) return null

  const activeFlights = flights.filter(f => f.status !== 'cancelled')

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Printable Daily Flight Roster"
      size="xl"
    >
      <div className="space-y-4">
        {/* Action Toolbar (Hidden during print) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700 no-print">
          <p className="text-xs text-slate-500">
            Official DGCA Daily Flight Roster document for <strong>{fmt.date(planRequest.plan_date)}</strong>
          </p>
          <div className="flex gap-2">
            <Button onClick={handlePrint} size="sm" className="gap-2">
              <Printer className="h-4 w-4" /> Print Roster / Save PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* ── PRINTABLE DOCUMENT CONTAINER ───────────────────────────────────── */}
        <div className="printable-roster-content bg-white p-6 text-slate-900 shadow-sm rounded-lg border border-slate-200 dark:bg-slate-900 dark:text-white dark:border-slate-700">
          
          {/* FTO Official Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 dark:border-white">
            <div>
              <h1 className="text-lg font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Amravati Flight Training Organization (FTO)
              </h1>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                DGCA Approved Flying Training Organization | Base: {planRequest.base_name} ({planRequest.base_icao})
              </p>
              <p className="text-[11px] text-slate-500">
                Document Ref: FTO-ROSTER-{dayjs(planRequest.plan_date).format('YYYYMMDD')}
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block rounded border border-slate-900 px-3 py-1 text-center font-mono text-xs font-bold dark:border-white">
                OFFICIAL DAILY ROSTER
              </div>
              <p className="mt-1 text-xs font-semibold">Date: {fmt.date(planRequest.plan_date)}</p>
            </div>
          </div>

          {/* Roster Metadata Summary */}
          <div className="my-4 grid grid-cols-4 gap-4 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="block font-medium text-slate-500">Operating Base:</span>
              <span className="font-bold text-slate-900 dark:text-white">{planRequest.base_name} ({planRequest.base_icao})</span>
            </div>
            <div>
              <span className="block font-medium text-slate-500">Total Sorties Scheduled:</span>
              <span className="font-bold text-slate-900 dark:text-white">{activeFlights.length} Flights</span>
            </div>
            <div>
              <span className="block font-medium text-slate-500">CFI Approval Status:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 capitalize">{planRequest.status}</span>
            </div>
            <div>
              <span className="block font-medium text-slate-500">Reviewed Date/Time:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {planRequest.deadline ? fmt.datetime(planRequest.deadline) : 'N/A'}
              </span>
            </div>
          </div>

          {/* Sortie Schedule Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-800 bg-slate-100 dark:border-slate-200 dark:bg-slate-800">
                  <th className="p-2 font-bold uppercase text-slate-700 dark:text-slate-200 w-8">#</th>
                  <th className="p-2 font-bold uppercase text-slate-700 dark:text-slate-200">Time Window</th>
                  <th className="p-2 font-bold uppercase text-slate-700 dark:text-slate-200">Aircraft Tail</th>
                  <th className="p-2 font-bold uppercase text-slate-700 dark:text-slate-200">Instructor (PIC)</th>
                  <th className="p-2 font-bold uppercase text-slate-700 dark:text-slate-200">Student Pilot</th>
                  <th className="p-2 font-bold uppercase text-slate-700 dark:text-slate-200">Flight Type</th>
                  <th className="p-2 font-bold uppercase text-slate-700 dark:text-slate-200">Exercise Code / Title</th>
                  <th className="p-2 font-bold uppercase text-slate-700 dark:text-slate-200">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {activeFlights.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No flights confirmed for this roster date.
                    </td>
                  </tr>
                ) : (
                  activeFlights.map((flight, idx) => (
                    <tr key={flight.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-2 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-2 font-mono whitespace-nowrap font-bold text-slate-900 dark:text-white">
                        {fmt.time(flight.scheduled_start)} – {fmt.time(flight.scheduled_end)}
                      </td>
                      <td className="p-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {flight.aircraft_name}
                      </td>
                      <td className="p-2 font-medium text-slate-900 dark:text-white">
                        {flight.instructor_name}
                      </td>
                      <td className="p-2 text-slate-700 dark:text-slate-300">
                        {flight.student_name ?? '—'}
                      </td>
                      <td className="p-2 capitalize">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {flightTypeBadge(flight.flight_type)}
                        </span>
                      </td>
                      <td className="p-2 text-slate-700 dark:text-slate-300">
                        {flight.exercises && flight.exercises.length > 0 ? (
                          flight.exercises.map(e => `${e.exercise_code || ''} ${e.exercise_title || ''}`).join(', ')
                        ) : (
                          'Routine Flight'
                        )}
                      </td>
                      <td className="p-2 text-slate-500 italic">
                        {flight.notes || (flight.override_requested ? 'CFI Override Approved' : '—')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* CFI Comments if applicable */}
          {planRequest.cfi_comments && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs dark:bg-amber-950/30 dark:border-amber-800">
              <span className="font-bold text-amber-900 dark:text-amber-200">CFI Instructions / Remarks:</span>
              <p className="mt-0.5 italic text-amber-800 dark:text-amber-300">"{planRequest.cfi_comments}"</p>
            </div>
          )}

          {/* DGCA Formal Sign-off Block */}
          <div className="mt-8 grid grid-cols-2 gap-12 pt-6 border-t-2 border-slate-900 dark:border-white">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Prepared By (Dispatcher)</p>
              <div className="mt-6 h-12 border-b border-dashed border-slate-400"></div>
              <div className="mt-1 flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span>Signature & Seal</span>
                <span>Date & Time</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Authorized & Approved By (Chief Flight Instructor)</p>
              <div className="mt-6 h-12 border-b border-dashed border-slate-400"></div>
              <div className="mt-1 flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span>Signature & Seal</span>
                <span>Date & Time</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Modal>
  )
}
