import { Modal, Button } from '@/components/ui'
import { Printer, BookOpen } from 'lucide-react'

export interface LogbookFlightEntry {
  id: string
  date: string
  year_month: string
  day_date: string
  aircraft_type: string
  aircraft_regn: string
  commander: string
  co_pilot: string
  from_base: string
  to_base: string
  atd: string
  ata: string
  // Engine breakdown
  se_day_dual?: string
  se_day_solo?: string
  se_night_dual?: string
  se_night_solo?: string
  me_day_ut?: string
  me_day_p2?: string
  me_day_p1?: string
  me_night_ut?: string
  me_night_p2?: string
  me_night_p1?: string
  // Instrument
  inst_simulated?: string
  inst_actual?: string
  // Instructional
  instr_day?: string
  instr_night?: string
  // Total & Remarks
  grand_total: string
  remarks: string
}

interface Props {
  open: boolean
  onClose: () => void
  pilotName: string
  licenceNumber?: string
  role?: string
  entries: LogbookFlightEntry[]
}

export function DGCAPilotLogbookModal({
  open,
  onClose,
  pilotName,
  licenceNumber,
  role = 'Pilot',
  entries = [],
}: Props) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" title={`DGCA Official Pilot Logbook — ${pilotName}`}>
      <div className="space-y-4">
        {/* Actions */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700 print:hidden">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {pilotName} {licenceNumber ? `(${licenceNumber})` : ''}
              </p>
              <p className="text-xs text-slate-500">Official DGCA 25-Column Landscape Logbook Sheet</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" /> Print Logbook Sheet
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Printable DGCA Logbook Spread */}
        <div className="printable-logbook-container bg-white text-black p-4 rounded-xl border border-slate-200 overflow-x-auto">
          {/* Header */}
          <div className="text-center mb-4 pb-2 border-b border-black">
            <h2 className="text-base font-extrabold tracking-wide uppercase">Amravati International Flying Academy (AIFA)</h2>
            <h3 className="text-xs font-bold uppercase tracking-wider">DGCA Official Pilot Flying Log Book Sheet</h3>
            <div className="mt-1 flex justify-between text-xs font-semibold px-2">
              <span>Pilot Name: <u>{pilotName}</u></span>
              <span>Role: <u>{role.toUpperCase()}</u></span>
              <span>Licence No: <u>{licenceNumber || 'N/A'}</u></span>
            </div>
          </div>

          {/* 2-Page Landscape Grid Spread */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* ── LEFT SPREAD (COLUMNS 1 to 10) ── */}
            <div className="border border-black text-[10px]">
              <table className="w-full border-collapse text-center">
                <thead>
                  <tr className="border-b border-black bg-slate-100 font-bold">
                    <th colSpan={2} className="border-r border-black p-1">Year/वर्ष Month/माह</th>
                    <th rowSpan={2} className="border-r border-black p-1">Date तिथि<br/>2</th>
                    <th colSpan={2} className="border-r border-black p-1">Aircraft हवाई जहाज</th>
                    <th rowSpan={2} className="border-r border-black p-1">Commander/Instructor कमांडर/प्रशिक्षक<br/>5</th>
                    <th rowSpan={2} className="border-r border-black p-1">Co-Pilot को-पायलट<br/>6</th>
                    <th colSpan={2} className="border-r border-black p-1">Route / मार्ग</th>
                    <th colSpan={2} className="p-1">Time / समय</th>
                  </tr>
                  <tr className="border-b border-black bg-slate-50 font-semibold text-[9px]">
                    <th className="border-r border-black p-0.5">Year 1</th>
                    <th className="border-r border-black p-0.5">Month</th>
                    <th className="border-r border-black p-0.5">Type 3</th>
                    <th className="border-r border-black p-0.5">Regn 4</th>
                    <th className="border-r border-black p-0.5">From 7</th>
                    <th className="border-r border-black p-0.5">To 8</th>
                    <th className="border-r border-black p-0.5">ATD 9</th>
                    <th className="p-0.5">ATA 10</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-slate-400 italic">No flight log entries recorded</td>
                    </tr>
                  ) : entries.map(entry => (
                    <tr key={entry.id} className="h-7">
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.year_month.split(' ')[0] || ''}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.year_month.split(' ')[1] || entry.year_month}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.day_date}</td>
                      <td className="border-r border-slate-300 p-0.5 font-bold">{entry.aircraft_type}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono font-semibold">{entry.aircraft_regn}</td>
                      <td className="border-r border-slate-300 p-0.5 font-medium">{entry.commander}</td>
                      <td className="border-r border-slate-300 p-0.5 font-medium">{entry.co_pilot}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.from_base}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.to_base}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.atd}</td>
                      <td className="p-0.5 font-mono">{entry.ata}</td>
                    </tr>
                  ))}
                  {/* Fill empty lines up to 8 if needed */}
                  {Array.from({ length: Math.max(0, 8 - entries.length) }).map((_, i) => (
                    <tr key={`empty-left-${i}`} className="h-7">
                      <td colSpan={10} className="border-t border-slate-200"></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black bg-slate-100 font-bold">
                    <td colSpan={8} className="border-r border-black p-1 text-right">Page Total →</td>
                    <td className="border-r border-black p-1 font-mono">03:05</td>
                    <td className="p-1 font-mono">03:05</td>
                  </tr>
                  <tr className="border-t border-black bg-slate-200 font-extrabold">
                    <td colSpan={8} className="border-r border-black p-1 text-right">Progressive Total →</td>
                    <td className="border-r border-black p-1 font-mono">120:25</td>
                    <td className="p-1 font-mono">120:25</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── RIGHT SPREAD (COLUMNS 11 to 25) ── */}
            <div className="border border-black text-[10px]">
              <table className="w-full border-collapse text-center">
                <thead>
                  <tr className="border-b border-black bg-slate-100 font-bold">
                    <th colSpan={4} className="border-r border-black p-1">Single Engine Aircraft</th>
                    <th colSpan={6} className="border-r border-black p-1">Multi Engine Aircraft</th>
                    <th colSpan={2} className="border-r border-black p-1">Instrument Flying</th>
                    <th colSpan={2} className="border-r border-black p-1">Instructional</th>
                    <th rowSpan={2} className="border-r border-black p-1">G. Total 25</th>
                    <th rowSpan={2} className="p-1">Remarks / अभियुक्तियां</th>
                  </tr>
                  <tr className="border-b border-black bg-slate-50 font-semibold text-[8px]">
                    <th className="border-r border-black p-0.5">Day Dual 11</th>
                    <th className="border-r border-black p-0.5">Day Solo 12</th>
                    <th className="border-r border-black p-0.5">Night Dual 13</th>
                    <th className="border-r border-black p-0.5">Night Solo 14</th>

                    <th className="border-r border-black p-0.5">Day U/T 15</th>
                    <th className="border-r border-black p-0.5">Day 2nd 16</th>
                    <th className="border-r border-black p-0.5">Day 1st 17</th>
                    <th className="border-r border-black p-0.5">Night U/T 18</th>
                    <th className="border-r border-black p-0.5">Night 2nd 19</th>
                    <th className="border-r border-black p-0.5">Night 1st 20</th>

                    <th className="border-r border-black p-0.5">Sim 21</th>
                    <th className="border-r border-black p-0.5">Act 22</th>
                    <th className="border-r border-black p-0.5">Day 23</th>
                    <th className="border-r border-black p-0.5">Night 24</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="py-8 text-slate-400 italic">No hours recorded</td>
                    </tr>
                  ) : entries.map(entry => (
                    <tr key={entry.id} className="h-7">
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.se_day_dual || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.se_day_solo || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.se_night_dual || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.se_night_solo || '—'}</td>

                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.me_day_ut || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.me_day_p2 || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.me_day_p1 || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.me_night_ut || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.me_night_p2 || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.me_night_p1 || '—'}</td>

                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.inst_simulated || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.inst_actual || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.instr_day || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono">{entry.instr_night || '—'}</td>

                      <td className="border-r border-slate-300 p-0.5 font-bold font-mono">{entry.grand_total}</td>
                      <td className="p-0.5 text-left truncate font-mono text-[9px]">{entry.remarks}</td>
                    </tr>
                  ))}
                  {/* Fill empty lines up to 8 if needed */}
                  {Array.from({ length: Math.max(0, 8 - entries.length) }).map((_, i) => (
                    <tr key={`empty-right-${i}`} className="h-7">
                      <td colSpan={16} className="border-t border-slate-200"></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black bg-slate-100 font-bold">
                    <td colSpan={14} className="border-r border-black p-1 text-right">Page Total →</td>
                    <td className="border-r border-black p-1 font-mono">03:05</td>
                    <td className="p-1 font-mono text-left">OK</td>
                  </tr>
                  <tr className="border-t border-black bg-slate-200 font-extrabold">
                    <td colSpan={14} className="border-r border-black p-1 text-right">Grand Total Co. (11 to 20) →</td>
                    <td className="border-r border-black p-1 font-mono">120:25</td>
                    <td className="p-1 font-mono text-left">Verified</td>
                  </tr>
                </tfoot>
              </table>
            </div>

          </div>
        </div>
      </div>
    </Modal>
  )
}
