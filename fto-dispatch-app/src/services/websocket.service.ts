import { WsMessage, WsAogPayload, AlertData } from '../types';
import { database, alertsCollection } from '../db';
import { FtoAlert } from '../db/models/FtoAlert';
import { useAlertsStore } from '../store/alerts.store';

const WS_BASE = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://192.168.1.100:8000';
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

type MessageHandler = (msg: WsMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private shouldReconnect = false;
  private handlers: Set<MessageHandler> = new Set();
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  /** Call with valid JWT before connecting */
  setToken(token: string) {
    this.token = token;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.shouldReconnect = true;
    this.openConnection();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.clearPing();
    this.ws?.close(1000, 'Client disconnecting');
    this.ws = null;
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private openConnection() {
    const url = `${WS_BASE}/ws/dispatch/?token=${this.token ?? ''}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] Connected to dispatch channel');
      this.reconnectDelay = RECONNECT_BASE_MS;
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        this.route(msg);
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onerror = (e) => {
      console.warn('[WS] Error:', e);
    };

    this.ws.onclose = (e) => {
      console.log('[WS] Closed:', e.code, e.reason);
      this.clearPing();
      if (this.shouldReconnect) {
        setTimeout(() => this.openConnection(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
      }
    };
  }

  // ─── Route inbound messages to local DB + Zustand ───────────────────────────

  private async route(msg: WsMessage) {
    switch (msg.type) {
      case 'aog_alert':
        await this.handleAogAlert(msg.payload as unknown as WsAogPayload);
        break;
      case 'flight_status_update':
        // Handled via the next pull-sync; no local action needed.
        break;
      default:
        break;
    }
  }

  private async handleAogAlert(payload: WsAogPayload) {
    try {
      // Persist to local WatermelonDB
      let newAlert: FtoAlert | null = null;
      await database.write(async () => {
        newAlert = await alertsCollection.create((a: FtoAlert) => {
          a.remoteId = '';          // Will be reconciled on next pull
          a.type = 'AOG';
          a.severity = 'CRITICAL';
          a.title = `AOG — ${payload.aircraft_registration ?? payload.registration}`;
          a.message = payload.snag_description ?? 'No-Go snag logged. Aircraft grounded.';
          a.aircraftRegistration = payload.aircraft_registration ?? payload.registration ?? '';
          a.affectedFlightsCount = payload.affected_flight_ids?.length ?? 0;
          a.isRead = false;
          a.isResolved = false;
          a.createdAt = payload.created_at
            ? new Date(payload.created_at).getTime()
            : Date.now();
        });
      });

      // Push to Zustand so any mounted screen shows the banner immediately
      if (newAlert) {
        const alertData: AlertData = {
          id: (newAlert as FtoAlert).id,
          remoteId: null,
          type: 'AOG',
          severity: 'CRITICAL',
          title: (newAlert as FtoAlert).title,
          message: (newAlert as FtoAlert).message,
          aircraftRegistration: (newAlert as FtoAlert).aircraftRegistration || null,
          affectedFlightsCount: (newAlert as FtoAlert).affectedFlightsCount,
          isRead: false,
          isResolved: false,
          createdAt: (newAlert as FtoAlert).createdAt,
        };
        useAlertsStore.getState().addAlert(alertData);
      }
    } catch (err) {
      console.error('[WS] Failed to persist AOG alert:', err);
    }
  }

  private startPing() {
    this.clearPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);
  }

  private clearPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const wsService = new WebSocketService();
