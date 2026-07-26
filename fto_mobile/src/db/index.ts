/**
 * Offline Database — barrel export.
 */
export { getDatabase, clearAllCaches, getDatabaseStats } from './database';
export {
  enqueueMutation,
  getPendingMutations,
  getPendingCount,
  getFailedMutations,
  flushQueue,
  retryMutation,
  discardMutation,
  cleanupResolvedMutations,
  type PendingMutation,
} from './offlineQueue';
export {
  cacheResponse,
  getCachedResponse,
  invalidateCache,
  invalidateCachePrefix,
  cacheFlights,
  getCachedFlights,
  cacheAircraft,
  getCachedAircraft,
  cacheWeather,
  getCachedWeather,
} from './cacheManager';
export {
  initSyncEngine,
  stopSyncEngine,
  performFullSync,
  manualSync,
  getIsOnline,
  getIsSyncing,
  addSyncListener,
  type SyncEvent,
} from './syncEngine';
export {
  useIsOnline,
  usePendingMutationCount,
  useSyncStatus,
  useOfflineQuery,
  useOfflineMutation,
} from './useOffline';
