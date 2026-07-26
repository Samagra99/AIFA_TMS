import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores'
import { OpsDashboardPage } from './OpsDashboardPage'
import { InstructorDashboardPage } from './InstructorDashboardPage'
import { StudentDashboardPage } from './StudentDashboardPage'
import { Building2, UserCheck, ShieldCheck } from 'lucide-react'

export function DashboardPage() {
  const { user } = useAuthStore()

  // Persistent view preference for CFI / Superadmin accounts
  const [viewMode, setViewMode] = useState<'ops' | 'instructor'>(() => {
    return (localStorage.getItem('cfi_dashboard_view') as 'ops' | 'instructor') || 'ops'
  })

  useEffect(() => {
    localStorage.setItem('cfi_dashboard_view', viewMode)
  }, [viewMode])

  if (user?.role === 'instructor') return <InstructorDashboardPage />
  if (user?.role === 'student') return <StudentDashboardPage />

  const isCFI = ['cfi'].includes(user?.role || '')

  return (
    <div className="space-y-4">
      {/* CFI Multi-Role Dashboard Toggle */}
      {isCFI && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-900">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                CFI Multi-Role View
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Switch between Base Operations and Personal Instructor Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 border border-slate-200/80 dark:border-slate-700/80">
            <button
              onClick={() => setViewMode('ops')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'ops'
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Building2 className="h-3.5 w-3.5" /> Operations View
            </button>
            <button
              onClick={() => setViewMode('instructor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'instructor'
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <UserCheck className="h-3.5 w-3.5" /> Instructor View
            </button>
          </div>
        </div>
      )}

      {isCFI && viewMode === 'instructor' ? (
        <InstructorDashboardPage />
      ) : (
        <OpsDashboardPage />
      )}
    </div>
  )
}