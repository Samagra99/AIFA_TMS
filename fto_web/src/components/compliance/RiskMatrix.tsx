import { cn } from '@/lib/utils'

interface RiskEntry { id:string; title:string; likelihood:number; severity:number; risk_score:number; status:string }
interface Props { entries: RiskEntry[] }

const LIKELIHOOD_LABELS = ['','Rare','Unlikely','Possible','Likely','Almost Certain']
const SEVERITY_LABELS   = ['','Negligible','Minor','Major','Severe','Catastrophic']

function riskColor(score: number) {
  if (score >= 20) return 'bg-red-500 text-white'
  if (score >= 12) return 'bg-orange-400 text-white'
  if (score >= 6)  return 'bg-amber-400 text-slate-900'
  if (score >= 3)  return 'bg-yellow-300 text-slate-900'
  return 'bg-emerald-400 text-white'
}

function riskLabel(score: number) {
  if (score >= 20) return 'Critical'
  if (score >= 12) return 'High'
  if (score >= 6)  return 'Medium'
  if (score >= 3)  return 'Low'
  return 'Negligible'
}

export function RiskMatrix({ entries }: Props) {
  return (
    <div className="space-y-6">
      {/* 5×5 Matrix grid */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Matrix</p>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="w-24 p-2 text-right text-slate-500">Likelihood ↓ / Severity →</th>
                {SEVERITY_LABELS.slice(1).map((s,i) => (
                  <th key={s} className="w-24 p-2 text-center font-medium text-slate-600 dark:text-slate-400">
                    {i+1} {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[5,4,3,2,1].map(l => (
                <tr key={l}>
                  <td className="p-2 text-right text-xs text-slate-500 dark:text-slate-400">
                    {l} {LIKELIHOOD_LABELS[l]}
                  </td>
                  {[1,2,3,4,5].map(s => {
                    const score  = l * s
                    const count  = entries.filter(e => e.likelihood===l && e.severity===s).length
                    return (
                      <td key={s} className={cn('h-12 w-24 border border-white/20 text-center font-bold rounded', riskColor(score))}>
                        {score}
                        {count > 0 && (
                          <div className="mx-auto mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/30 text-[9px] font-bold">
                            {count}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {[['Negligible',1],['Low',3],['Medium',6],['High',12],['Critical',20]].map(([l,s]) => (
          <div key={String(l)} className="flex items-center gap-1.5">
            <div className={cn('h-4 w-4 rounded text-[10px]', riskColor(Number(s)))} />
            <span className="text-xs text-slate-600 dark:text-slate-400">{l}</span>
          </div>
        ))}
      </div>

      {/* Open hazards list */}
      {entries.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Open Hazards ({entries.length})</p>
          <div className="space-y-2">
            {entries.filter(e=>e.status==='open').map(e => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold', riskColor(e.risk_score))}>
                  {e.risk_score}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{e.title}</p>
                  <p className="text-xs text-slate-500">{riskLabel(e.risk_score)} risk · L{e.likelihood} × S{e.severity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
