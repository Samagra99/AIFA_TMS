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
  const parseTimeToMin = (tStr?: string) => {
    if (!tStr || !tStr.includes(':')) return 0
    const [h, m] = tStr.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  const formatMinToHHMM = (totalM: number) => {
    if (!totalM || totalM <= 0) return '00:00'
    const h = Math.floor(totalM / 60)
    const m = totalM % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const totalMinutes = entries.reduce((acc, e) => acc + parseTimeToMin(e.grand_total), 0)
  const totalFormatted = formatMinToHHMM(totalMinutes)

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

          {/* 25-Column Landscape DGCA Logbook Spread */}
          <div className="border border-black text-[10px] overflow-x-auto">
            <table className="w-full min-w-[1250px] border-collapse text-center table-fixed">
              <thead>
                <tr className="border-b border-black bg-slate-100 font-bold text-[10px]">
                  <th colSpan={2} className="border-r border-black p-1 w-[75px]">Year/वर्ष Month/माह</th>
                  <th rowSpan={2} className="border-r border-black p-1 w-[35px]">Date<br/>2</th>
                  <th colSpan={2} className="border-r border-black p-1 w-[110px]">Aircraft</th>
                  <th rowSpan={2} className="border-r border-black p-1 w-[100px]">Commander / Instructor<br/>5</th>
                  <th rowSpan={2} className="border-r border-black p-1 w-[90px]">Co-Pilot<br/>6</th>
                  <th colSpan={2} className="border-r border-black p-1 w-[120px]">Route / मार्ग</th>
                  <th colSpan={2} className="border-r border-black p-1 w-[80px]">Time / समय</th>
                  <th colSpan={4} className="border-r border-black p-1 w-[160px]">Single Engine Aircraft</th>
                  <th colSpan={6} className="border-r border-black p-1 w-[210px]">Multi Engine Aircraft</th>
                  <th colSpan={2} className="border-r border-black p-1 w-[70px]">Instrument</th>
                  <th colSpan={2} className="border-r border-black p-1 w-[70px]">Instructional</th>
                  <th rowSpan={2} className="border-r border-black p-1 w-[55px]">G. Total<br/>25</th>
                  <th rowSpan={2} className="p-1 w-[120px]">Remarks / अभियुक्तियां</th>
                </tr>
                <tr className="border-b border-black bg-slate-50 font-semibold text-[8px]">
                  <th className="border-r border-black p-0.5 w-[45px]">Year 1</th>
                  <th className="border-r border-black p-0.5 w-[30px]">Month</th>
                  <th className="border-r border-black p-0.5 w-[55px]">Type 3</th>
                  <th className="border-r border-black p-0.5 w-[55px]">Regn 4</th>
                  <th className="border-r border-black p-0.5 w-[60px]">From 7</th>
                  <th className="border-r border-black p-0.5 w-[60px]">To 8</th>
                  <th className="border-r border-black p-0.5 w-[40px]">ATD 9</th>
                  <th className="border-r border-black p-0.5 w-[40px]">ATA 10</th>
                  <th className="border-r border-black p-0.5 w-[40px]">Dual 11</th>
                  <th className="border-r border-black p-0.5 w-[40px]">Solo / PIC 12</th>
                  <th className="border-r border-black p-0.5 w-[40px]">N-Dual 13</th>
                  <th className="border-r border-black p-0.5 w-[40px]">N-Solo / PIC 14</th>
                  <th className="border-r border-black p-0.5 w-[35px]">U/T 15</th>
                  <th className="border-r border-black p-0.5 w-[35px]">2nd 16</th>
                  <th className="border-r border-black p-0.5 w-[35px]">1st 17</th>
                  <th className="border-r border-black p-0.5 w-[35px]">NU/T 18</th>
                  <th className="border-r border-black p-0.5 w-[35px]">N2nd 19</th>
                  <th className="border-r border-black p-0.5 w-[35px]">N1st 20</th>
                  <th className="border-r border-black p-0.5 w-[35px]">Sim 21</th>
                  <th className="border-r border-black p-0.5 w-[35px]">Act 22</th>
                  <th className="border-r border-black p-0.5 w-[35px]">Day 23</th>
                  <th className="border-r border-black p-0.5 w-[35px]">Ngt 24</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={27} className="py-8 text-slate-400 italic">No flight log entries recorded</td>
                  </tr>
                ) : entries.map(entry => {
                  const dateParts = (entry.date || entry.year_month || '').split('-')
                  const yearStr = dateParts[0] || ''
                  const monthStr = dateParts[1] || ''
                  const cleanFrom = (entry.from_base || '').split(' ')[0]
                  const cleanTo = (entry.to_base || '').split(' ')[0]

                  return (
                    <tr key={entry.id} className="h-8 hover:bg-slate-50">
                      <td className="border-r border-slate-300 p-0.5 font-mono truncate">{yearStr}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono truncate">{monthStr}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono truncate">{entry.day_date}</td>
                      <td className="border-r border-slate-300 p-0.5 font-bold truncate">{entry.aircraft_type}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono font-semibold truncate">{entry.aircraft_regn}</td>
                      <td className="border-r border-slate-300 p-0.5 font-medium truncate">{entry.commander}</td>
                      <td className="border-r border-slate-300 p-0.5 font-medium truncate">{entry.co_pilot || '—'}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono truncate">{cleanFrom}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono truncate">{cleanTo}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono truncate">{entry.atd}</td>
                      <td className="border-r border-slate-300 p-0.5 font-mono truncate">{entry.ata}</td>

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
                  )
                })}
                {/* Fill empty lines up to 8 if needed */}
                {Array.from({ length: Math.max(0, 8 - entries.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-8">
                    <td colSpan={27} className="border-t border-slate-200"></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-black bg-slate-100 font-bold">
                  <td colSpan={11} className="border-r border-black p-1 text-right">Page Total →</td>
                  <td colSpan={14} className="border-r border-black p-1 text-right"></td>
                  <td className="border-r border-black p-1 font-mono">{totalFormatted}</td>
                  <td className="p-1 font-mono text-left">OK</td>
                </tr>
                <tr className="border-t border-black bg-slate-200 font-extrabold">
                  <td colSpan={11} className="border-r border-black p-1 text-right">Progressive Total →</td>
                  <td colSpan={14} className="border-r border-black p-1 text-right"></td>
                  <td className="border-r border-black p-1 font-mono">{totalFormatted}</td>
                  <td className="p-1 font-mono text-left">Verified</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
