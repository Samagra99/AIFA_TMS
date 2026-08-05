/**
 * Sync Engine — background synchronization orchestrator.
 * 
 * Responsibilities:
 * 1. Listen for network state changes via NetInfo
 * 2. On reconnect: flush offline mutation queue, then refresh caches
 * 3. Periodic background sync while online (configurable interval)
 * 4. Expose connectivity state to the rest of the app
 */
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { apiClient } from '../api/client';
import { flushQueue, getPendingCount, cleanupResolvedMutations } from './offlineQueue';
import { logger } from '../lib/logger';
import {
  cacheFlights,
  cacheAircraft,
  cacheWeather,
  cacheResponse,
} from './cacheManager';
import { useAuthStore } from '../stores/authStore';
import dayjs from 'dayjs';

// ── Singleton State ─────────────────────────────────────────────────────────

let isOnline = true;
let isSyncing = false;
let syncListenersRegistered = false;
let backgroundSyncTimer: ReturnType<typeof setInterval> | null = null;

// ── Callbacks for UI reactivity ─────────────────────────────────────────────

type SyncCallback = (event: SyncEvent) => void;
const listeners = new Set<SyncCallback>();

export interface SyncEvent {
  type: 'connectivity_change' | 'sync_start' | 'sync_complete' | 'queue_flushed' | 'sync_error';
  isOnline: boolean;
  pendingCount: number;
  detail?: string;
}

export function addSyncListener(callback: SyncCallback): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emit(event: SyncEvent) {
  listeners.forEach((cb) => {
    try { cb(event); } catch (e) { logger.warn('[SyncEngine] Listener error:', e); }
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get current online status.
 */
export function getIsOnline(): boolean {
  return isOnline;
}

/**
 * Get whether a sync is in progress.
 */
export function getIsSyncing(): boolean {
  return isSyncing;
}

/**
 * Initialize the sync engine. Call once on app startup after auth is ready.
 * Sets up NetInfo listener and background sync interval.
 */
export function initSyncEngine(backgroundIntervalMs: number = 5 * 60 * 1000): void {
  if (syncListenersRegistered) return;
  syncListenersRegistered = true;

  logger.log('[SyncEngine] Initializing...');

  // Listen for network state changes
  NetInfo.addEventListener((state: NetInfoState) => {
    const wasOffline = !isOnline;
    isOnline = !!state.isConnected && !!state.isInternetReachable;

    const pendingCountPromise = getPendingCount();
    pendingCountPromise.then((pendingCount) => {
      emit({
        type: 'connectivity_change',
        isOnline,
        pendingCount,
        detail: isOnline ? 'Online' : 'Offline',
      });
    });

    // If we just came back online, trigger a full sync
    if (wasOffline && isOnline) {
      logger.log('[SyncEngine] 📶 Network restored — triggering sync');
      performFullSync();
    }
  });

  // Listen for app foreground events
  AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'active' && isOnline) {
      logger.log('[SyncEngine] App foregrounded — checking for pending sync');
      performFullSync();
    }
  });

  // Background sync interval (only while online)
  backgroundSyncTimer = setInterval(() => {
    if (isOnline && !isSyncing) {
      logger.log('[SyncEngine] ⏰ Background sync tick');
      performFullSync();
    }
  }, backgroundIntervalMs);

  // Initial sync
  setTimeout(() => {
    if (isOnline) performFullSync();
  }, 2000);
}

/**
 * Stop the sync engine (call on logout).
 */
export function stopSyncEngine(): void {
  if (backgroundSyncTimer) {
    clearInterval(backgroundSyncTimer);
    backgroundSyncTimer = null;
  }
  syncListenersRegistered = false;
  listeners.clear();
  logger.log('[SyncEngine] Stopped');
}

/**
 * Perform a full sync cycle:
 * 1. Flush offline mutation queue
 * 2. Refresh flight cache (today + tomorrow)
 * 3. Refresh fleet cache
 * 4. Refresh weather cache
 * 5. Clean up old resolved mutations
 */
export async function performFullSync(): Promise<void> {
  if (isSyncing || !isOnline) return;

  const authState = useAuthStore.getState();
  if (!authState.accessToken) return; // Not logged in

  isSyncing = true;
  const pendingBefore = await getPendingCount();

  emit({
    type: 'sync_start',
    isOnline: true,
    pendingCount: pendingBefore,
  });

  try {
    // ── Step 1: Flush mutation queue ──────────────────────────────────
    if (pendingBefore > 0) {
      logger.log(`[SyncEngine] Flushing ${pendingBefore} pending mutations...`);
      const result = await flushQueue();

      emit({
        type: 'queue_flushed',
        isOnline: true,
        pendingCount: result.remaining,
        detail: `Replayed ${result.replayed}, failed ${result.failed}, remaining ${result.remaining}`,
      });
    }

    // ── Step 2: Refresh today's flights ──────────────────────────────
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const params = new URLSearchParams({ date: today });
      const userBase = authState.user?.home_base_id;
      if (userBase) params.set('base_id', userBase);

      const { data: flights } = await apiClient.get(
        `/scheduling/flights/daily-roster/?${params}`
      );
      if (Array.isArray(flights)) {
        await cacheFlights(flights);
        await cacheResponse(`roster:${today}`, '/scheduling/flights/daily-roster/', { date: today }, flights, 30);
      }
    } catch (e) {
      logger.warn('[SyncEngine] Flight cache refresh failed:', e);
    }

    // ── Step 3: Refresh fleet status ─────────────────────────────────
    try {
      const { data: aircraftResp } = await apiClient.get('/infrastructure/aircraft/');
      const aircraft = aircraftResp?.results || aircraftResp;
      if (Array.isArray(aircraft)) {
        await cacheAircraft(aircraft);
        await cacheResponse('aircraft:all', '/infrastructure/aircraft/', null, aircraft, 60);
      }
    } catch (e) {
      logger.warn('[SyncEngine] Fleet cache refresh failed:', e);
    }

    // ── Step 4: Refresh weather ──────────────────────────────────────
    try {
      const { data: weatherList } = await apiClient.get('/weather/metar/');
      if (Array.isArray(weatherList)) {
        for (const w of weatherList) {
          await cacheWeather(w);
        }
      }
    } catch (e) {
      logger.warn('[SyncEngine] Weather cache refresh failed:', e);
    }

    // ── Step 5: Cleanup old mutations ────────────────────────────────
    await cleanupResolvedMutations();

    const pendingAfter = await getPendingCount();
    emit({
      type: 'sync_complete',
      isOnline: true,
      pendingCount: pendingAfter,
      detail: 'Full sync complete',
    });

    logger.log('[SyncEngine] ✅ Full sync complete');
  } catch (error) {
    logger.error('[SyncEngine] Sync error:', error);
    const pendingAfter = await getPendingCount();
    emit({
      type: 'sync_error',
      isOnline,
      pendingCount: pendingAfter,
      detail: String(error),
    });
  } finally {
    isSyncing = false;
  }
}

/**
 * Force a manual sync (user-triggered pull-to-refresh).
 */
export async function manualSync(): Promise<void> {
  if (!isOnline) {
    logger.log('[SyncEngine] Cannot sync — offline');
    return;
  }
  return performFullSync();
}
