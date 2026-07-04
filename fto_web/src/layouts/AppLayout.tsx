import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Sidebar } from './Sidebar'
import { TopBar }  from './TopBar'
import { useThemeInit } from '@/hooks/useTheme'
import { useAOGSocket }  from '@/hooks/useAOGSocket'
import { useUIStore }    from '@/stores'

export function AppLayout() {
  useThemeInit()
  useAOGSocket()        // subscribe to WebSocket fleet alerts globally
  const aogAlerts = useUIStore(s => s.aogAlerts)
  const dismiss   = useUIStore(s => s.dismissAlert)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />

        {/* AOG banner — shown when there are active alerts */}
        {aogAlerts.length > 0 && (
          <div className="shrink-0 bg-red-600 text-white">
            <div className="flex items-center justify-between px-6 py-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse-dot" />
                <strong>AOG ALERT:</strong>
                <span>{aogAlerts[0].tail_number} — {aogAlerts[0].reason}</span>
                {aogAlerts[0].flights_cancelled > 0 && (
                  <span className="opacity-80">
                    ({aogAlerts[0].flights_cancelled} flight{aogAlerts[0].flights_cancelled > 1 ? 's' : ''} cancelled)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {aogAlerts.length > 1 && (
                  <span className="text-xs opacity-80">+{aogAlerts.length - 1} more</span>
                )}
                <button
                  onClick={() => dismiss(aogAlerts[0].id)}
                  className="rounded px-2 py-0.5 text-xs hover:bg-red-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  )
}
