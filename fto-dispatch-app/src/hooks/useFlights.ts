import { useState, useEffect, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { flightsCollection } from '../db';
import { Flight } from '../db/models/Flight';
import { pullAll } from '../services/sync.service';
import { useNetworkStatus } from './useNetworkStatus';

export function useFlights() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const { isConnected } = useNetworkStatus();

  // React to WatermelonDB changes (reactive query)
  useEffect(() => {
    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    const subscription = flightsCollection
      .query(
        Q.where('scheduled_start', Q.gte(todayStart)),
        Q.where('scheduled_start', Q.lte(todayEnd)),
        Q.sortBy('scheduled_start', Q.asc)
      )
      .observe()
      .subscribe((results) => {
        setFlights(results);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  // Sync from server when network available
  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsSyncing(true);
    try {
      await pullAll(lastSyncedAt ?? undefined);
      setLastSyncedAt(Date.now());
    } catch (err) {
      console.warn('[useFlights] sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected, lastSyncedAt]);

  // Auto-sync on mount and every 5 minutes
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  return { flights, isLoading, isSyncing, lastSyncedAt, refresh };
}

// ─── Date helpers (avoid date-fns for minimal bundle on mobile) ───────────────

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
