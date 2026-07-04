import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'

/** Syncs the <html> class with the persisted theme on first load. */
export function useThemeInit() {
  const theme = useUIStore(s => s.theme)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
}
