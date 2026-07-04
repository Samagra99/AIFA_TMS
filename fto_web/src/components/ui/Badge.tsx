import { cn } from '@/lib/utils'

const variants = {
  default:  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  primary:  'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200',
  success:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  warning:  'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  danger:   'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  aog:      'bg-red-600 text-white animate-pulse-dot',
}

interface Props {
  variant?: keyof typeof variants
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
      variants[variant], className
    )}>
      {children}
    </span>
  )
}
