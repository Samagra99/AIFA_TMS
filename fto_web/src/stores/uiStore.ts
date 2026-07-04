/**
 * UI store — persisted preferences (theme, active base, sidebar state).
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UUID, WSAOGEvent } from '@/api/types'

interface AOGAlert {
  id:               string
  aircraft_id:      UUID
  tail_number:      string
  reason:           string
  timestamp:        string
  flights_cancelled: number
}

interface UIState {
  // Theme
  theme:         'light' | 'dark'
  toggleTheme:   () => void
  // Active base (null = all bases / fleet view)
  activeBaseId:  UUID | null
  setActiveBase: (id: UUID | null) => void
  // Sidebar
  sidebarOpen:   boolean
  setSidebar:    (open: boolean) => void
  toggleSidebar: () => void
  // Live AOG alerts (cleared on dismiss)
  aogAlerts:     AOGAlert[]
  addAOGAlert:   (event: WSAOGEvent) => void
  dismissAlert:  (id: string) => void
  clearAlerts:   () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme:       'light',
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'light' ? 'dark' : 'light'
          document.documentElement.classList.toggle('dark', next === 'dark')
          return { theme: next }
        }),

      activeBaseId:  null,
      setActiveBase: (id) => set({ activeBaseId: id }),

      sidebarOpen:   true,
      setSidebar:    (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      aogAlerts:    [],
      addAOGAlert:  (event) =>
        set((s) => ({
          aogAlerts: [
            { ...event, id: `${event.aircraft_id}-${Date.now()}` },
            ...s.aogAlerts,
          ].slice(0, 20), // keep last 20
        })),
      dismissAlert: (id) =>
        set((s) => ({ aogAlerts: s.aogAlerts.filter((a) => a.id !== id) })),
      clearAlerts:  () => set({ aogAlerts: [] }),
    }),
    {
      name:       'fto-ui',
      storage:    createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, activeBaseId: s.activeBaseId, sidebarOpen: s.sidebarOpen }),
    }
  )
)
