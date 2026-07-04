/**
 * Reconnecting WebSocket hook.
 * Automatically retries on close with exponential backoff.
 * Passes received JSON messages to the `onMessage` callback.
 */
import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import type { WSEvent } from '@/api/types'

const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000'

export function useWebSocket(
  path: string,
  onMessage: (event: WSEvent) => void,
  enabled = true
) {
  const wsRef      = useRef<WebSocket | null>(null)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryDelay = useRef(1_000)

  const connect = useCallback(() => {
    if (!enabled) return
    const token = useAuthStore.getState().accessToken
    if (!token) return

    const url = `${WS_BASE}${path}?token=${token}`
    const ws  = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => { retryDelay.current = 1_000 }

    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data) as WSEvent) }
      catch { /* ignore malformed frames */ }
    }

    ws.onclose = () => {
      // Exponential backoff: 1s → 2s → 4s → … max 30s
      timerRef.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 30_000)
        connect()
      }, retryDelay.current)
    }
  }, [path, onMessage, enabled])

  useEffect(() => {
    connect()
    return () => {
      timerRef.current && clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return wsRef
}