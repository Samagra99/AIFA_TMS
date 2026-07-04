/**
 * Subscribes to the fleet WebSocket and pipes AOG events
 * into the global UI store so every layout can show alerts.
 */
import { useCallback } from 'react'
import { useWebSocket } from './useWebSocket'
import { useUIStore } from '@/stores/uiStore'
import { useQueryClient } from '@tanstack/react-query'
import type { WSEvent, WSAOGEvent } from '@/api/types'
import { toast } from 'sonner'

export function useAOGSocket() {
  const addAlert = useUIStore(s => s.addAOGAlert)
  const qc       = useQueryClient()

  const onMessage = useCallback((event: WSEvent) => {
    if (event.event !== 'aog') return
    const aog = event as WSAOGEvent
    addAlert(aog)
    toast.error(`AOG — ${aog.tail_number}`, {
      description: aog.reason,
      duration: 0, // persist until dismissed
      id: aog.aircraft_id,
    })
    // Invalidate fleet + roster so they refetch immediately
    qc.invalidateQueries({ queryKey: ['fleet'] })
    qc.invalidateQueries({ queryKey: ['roster'] })
  }, [addAlert, qc])

  useWebSocket('/ws/fleet/', onMessage)
}
