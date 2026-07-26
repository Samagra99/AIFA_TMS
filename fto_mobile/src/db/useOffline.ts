/**
 * Offline-Aware Hooks — wraps React Query with offline cache fallback
 * and offline mutation queueing.
 * 
 * Usage:
 *   // Instead of: const { data } = useDailyRoster(date)
 *   // Use:        const { data } = useOfflineQuery(['roster', date], () => fetchRoster(date), { cacheKey: `roster:${date}` })
 * 
 *   // Instead of: closeout.mutateAsync(data)
 *   // Use:        const closeout = useOfflineMutation(...)
 */
import { useEffect, useState, useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { getCachedResponse, cacheResponse } from '../db/cacheManager';
import { enqueueMutation, getPendingCount } from '../db/offlineQueue';
import { getIsOnline, addSyncListener, type SyncEvent } from '../db/syncEngine';

/**
 * Hook to track online/offline status reactively.
 */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(getIsOnline());

  useEffect(() => {
    return addSyncListener((event: SyncEvent) => {
      if (event.type === 'connectivity_change') {
        setOnline(event.isOnline);
      }
    });
  }, []);

  return online;
}

/**
 * Hook to track pending mutation count reactively.
 */
export function usePendingMutationCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initial count
    getPendingCount().then(setCount);

    return addSyncListener((event: SyncEvent) => {
      setCount(event.pendingCount);
    });
  }, []);

  return count;
}

/**
 * Hook to track sync status reactively.
 */
export function useSyncStatus(): {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastEvent: SyncEvent | null;
} {
  const [state, setState] = useState({
    isOnline: getIsOnline(),
    isSyncing: false,
    pendingCount: 0,
    lastEvent: null as SyncEvent | null,
  });

  useEffect(() => {
    getPendingCount().then((c) =>
      setState((s) => ({ ...s, pendingCount: c }))
    );

    return addSyncListener((event: SyncEvent) => {
      setState({
        isOnline: event.isOnline,
        isSyncing: event.type === 'sync_start',
        pendingCount: event.pendingCount,
        lastEvent: event,
      });
    });
  }, []);

  return state;
}

/**
 * Enhanced query hook that falls back to SQLite cache when offline.
 * 
 * When online: fetches from API (normal React Query behavior) + caches response.
 * When offline: returns cached data from SQLite if available.
 */
export function useOfflineQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: UseQueryOptions<T> & {
    cacheKey?: string;
    cacheTtlMinutes?: number;
    offlineFallback?: boolean;
  },
) {
  const isOnline = useIsOnline();
  const cacheKey = options?.cacheKey || (queryKey as string[]).join(':');
  const ttl = options?.cacheTtlMinutes ?? 60;
  const enableOfflineFallback = options?.offlineFallback !== false;

  // Wrapped query function that caches on success
  const wrappedQueryFn = useCallback(async () => {
    if (!isOnline && enableOfflineFallback) {
      // Offline — try cache (ignore expiry when offline)
      const cached = await getCachedResponse<T>(cacheKey, true);
      if (cached !== null) {
        return cached;
      }
      throw new Error('No cached data available offline');
    }

    // Online — fetch and cache
    const data = await queryFn();
    if (data !== undefined && data !== null) {
      await cacheResponse(
        cacheKey,
        '', // endpoint not needed for generic cache
        null,
        data,
        ttl,
      );
    }
    return data;
  }, [isOnline, cacheKey, ttl, enableOfflineFallback, queryFn]);

  return useQuery({
    ...options,
    queryKey,
    queryFn: wrappedQueryFn,
    // When offline, don't retry and don't refetch
    retry: isOnline ? (options?.retry ?? 2) : 0,
    refetchOnWindowFocus: isOnline,
    refetchInterval: isOnline ? (options?.refetchInterval as number) : undefined,
  });
}

/**
 * Enhanced mutation hook that queues mutations when offline.
 * 
 * When online: executes mutation immediately (normal behavior).
 * When offline: enqueues mutation in SQLite for later replay.
 */
export function useOfflineMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables> & {
    offlineEndpoint?: string;
    offlineMethod?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    getOfflinePayload?: (variables: TVariables) => Record<string, unknown>;
    enableOfflineQueue?: boolean;
  },
) {
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const enableQueue = options?.enableOfflineQueue !== false;

  return useMutation<TData, Error, TVariables>({
    ...options,
    mutationFn: async (variables: TVariables) => {
      if (isOnline) {
        // Online — execute normally
        return mutationFn(variables);
      }

      if (!enableQueue || !options?.offlineEndpoint || !options?.offlineMethod) {
        throw new Error('Cannot perform this action while offline');
      }

      // Offline — queue the mutation
      const payload = options.getOfflinePayload
        ? options.getOfflinePayload(variables)
        : (variables as unknown as Record<string, unknown>);

      await enqueueMutation(
        options.offlineMethod,
        options.offlineEndpoint,
        payload,
      );

      // Return optimistic response
      return { detail: 'Queued for sync when online' } as unknown as TData;
    },
  });
}
