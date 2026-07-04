import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { SchedulingCheckResult, RuleCheckResult } from '@/api/types'
import { cn } from '@/lib/utils'

const RULE_LABELS: Record<string, string> = {
  student_medical_valid:       'Student Medical',
  student_spl_valid:           'Student SPL',
  student_frtol_valid:         'Student FRTOL',
  instructor_fdtl_daily:       'Instructor FDTL (Daily)',
  instructor_fdtl_weekly:      'Instructor FDTL (Weekly)',
  instructor_fdtl_monthly:     'Instructor FDTL (Monthly)',
  aircraft_not_aog:            'Aircraft Airworthy',
  aircraft_50hr_ferry_buffer:  '50-hr + Ferry Buffer',
  aircraft_100hr_ferry_buffer: '100-hr + Ferry Buffer',
  aircraft_annual_due:         'Annual Inspection',
  crosswind_within_student_limit: 'Crosswind Limit',
  density_altitude_warning:    'Density Altitude',
}

interface Props { result: SchedulingCheckResult; className?: string }

export function ConstraintBadge({ result, className }: Props) {
  return (
    <div className={cn('rounded-xl border p-4 space-y-2', result.all_passed
      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
      : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950', className)}>
      <div className="flex items-center gap-2">
        {result.all_passed
          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          : <XCircle className="h-4 w-4 text-red-600" />}
        <p className={cn('text-sm font-semibold', result.all_passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
          {result.all_passed ? 'All constraints cleared' : `${result.blocking_failures.length} constraint(s) failed`}
        </p>
      </div>
      {result.blocking_failures.map((f, i) => <RuleRow key={i} rule={f} type="fail" />)}
      {result.warnings.map((w, i)            => <RuleRow key={i} rule={w} type="warn" />)}
    </div>
  )
}

function RuleRow({ rule, type }: { rule: RuleCheckResult; type: 'fail' | 'warn' }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {type === 'fail'
        ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
        : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
      <div>
        <span className={cn('font-medium', type === 'fail' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300')}>
          {RULE_LABELS[rule.rule] ?? rule.rule}
        </span>
        <span className="ml-1 text-slate-500 dark:text-slate-400">— {rule.detail}</span>
      </div>
    </div>
  )
}
