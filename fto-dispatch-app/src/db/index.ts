import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { Flight } from './models/Flight';
import { Aircraft } from './models/Aircraft';
import { DispatchRecord } from './models/DispatchRecord';
import { FtoAlert } from './models/FtoAlert';
import { SyncQueueItem } from './models/SyncQueueItem';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'fto_dispatch_v1',
  // jsi: true  ← Enable for EAS native builds for ~5x better performance.
  //               Requires expo prebuild. Set false for Expo Go testing.
  jsi: false,
  onSetUpError: (error) => {
    console.error('[WatermelonDB] Setup failed:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Flight, Aircraft, DispatchRecord, FtoAlert, SyncQueueItem],
});

// Convenience typed collection accessors
export const flightsCollection = database.get<Flight>('flights');
export const aircraftCollection = database.get<Aircraft>('aircraft');
export const dispatchCollection = database.get<DispatchRecord>('dispatch_records');
export const alertsCollection = database.get<FtoAlert>('fto_alerts');
export const syncQueueCollection = database.get<SyncQueueItem>('sync_queue');
