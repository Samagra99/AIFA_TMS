import { useEffect } from 'react'
import { Sun, Moon, Bell, LogOut, ChevronDown } from 'lucide-react'
import { useAuthStore, useUIStore } from '@/stores'
import { useBases } from '@/api/hooks'
import { useLogout } from '@/api/hooks/useAuth'
import { cn } from '@/lib/utils'

export function TopBar() {
  const { theme, toggleTheme, activeBaseId, setActiveBase, aogAlerts } = useUIStore()
  const { user } = useAuthStore()
  const logout   = useLogout()
  const { data: basesData } = useBases()
  const bases = basesData?.results ?? []

  useEffect(() => {
    if (activeBaseId) return
    const autoRoles = ['instructor', 'student', 'camo', 'safety_officer', 'finance']
    if(user?.home_base_id && autoRoles.includes(user.role)) {
      setActiveBase(user.home_base_id)
    }
  }, [user?.home_base_id, user?.role, activeBaseId, setActiveBase])
  
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6 dark:border-slate-700 dark:bg-slate-900">

      {/* Base selector */}
      <div className="relative">
        <select
          value={activeBaseId ?? ''}
          onChange={e => setActiveBase(e.target.value || null)}
          className={cn(
            'appearance-none rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-sm',
            'font-medium text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200',
            'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
          )}
        >
          {['superadmin', 'cfi', 'dispatcher'].includes(user?.role ?? '') && (
            <option value="all">All Bases</option>
          )}
          {bases.length === 0 && (
            <option value="" disabled>Loading bases...</option>
          )}
          {bases.map(b => (
            <option key={b.id} value={b.id}>{b.name} ({b.icao_code})</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>

      <div className="flex-1" />

      {/* AOG alert count */}
      {aogAlerts.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          {aogAlerts.length} AOG {aogAlerts.length === 1 ? 'alert' : 'alerts'}
        </div>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>

      {/* Notifications placeholder */}
      <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
        <Bell className="h-4 w-4" />
        {aogAlerts.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        )}
      </button>

      {/* Logout */}
      <button
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </header>
  )
}
