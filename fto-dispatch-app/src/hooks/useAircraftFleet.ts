import { useState, useEffect, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { aircraftCollection } from '../db';
import { Aircraft } from '../db/models/Aircraft';
import { pullAll } from '../services/sync.service';
import { useNetworkStatus } from './useNetworkStatus';

interface FleetByBase {
  AMRAVATI: Aircraft[];
  SAT1: Aircraft[];
  SAT2: Aircraft[];
  [key: string]: Aircraft[];
}

export function useAircraftFleet() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [byBase, setByBase] = useState<FleetByBase>({
    AMRAVATI: [],
    SAT1: [],
    SAT2: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    const subscription = aircraftCollection
      .query(Q.sortBy('registration', Q.asc))
      .observe()
      .subscribe((results) => {
        setAircraft(results);
        setByBase(groupByBase(results));
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsSyncing(true);
    try {
      await pullAll();
    } catch (err) {
      console.warn('[useAircraftFleet] sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Quick stats
  const stats = {
    total: aircraft.length,
    serviceable: aircraft.filter((a) => a.status === 'SERVICEABLE').length,
    aog: aircraft.filter((a) => a.status === 'AOG').length,
    maintenance: aircraft.filter((a) => a.status === 'MAINTENANCE').length,
    ferryBlocked: aircraft.filter((a) => a.isFerryBlocked).length,
  };

  return { aircraft, byBase, stats, isLoading, isSyncing, refresh };
}

function groupByBase(fleet: Aircraft[]): FleetByBase {
  const result: FleetByBase = { AMRAVATI: [], SAT1: [], SAT2: [] };
  for (const ac of fleet) {
    const base = ac.base ?? 'AMRAVATI';
    if (!result[base]) result[base] = [];
    result[base].push(ac);
  }
  return result;
}
