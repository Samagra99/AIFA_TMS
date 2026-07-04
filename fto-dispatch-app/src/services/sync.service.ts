import { Q } from '@nozbe/watermelondb';
import {
  database,
  flightsCollection,
  aircraftCollection,
  alertsCollection,
  dispatchCollection,
  syncQueueCollection,
} from '../db';
import { Flight } from '../db/models/Flight';
import { Aircraft } from '../db/models/Aircraft';
import { FtoAlert } from '../db/models/FtoAlert';
import { SyncQueueItem } from '../db/models/SyncQueueItem';
import { api } from './api';
import {
  ServerFlight,
  ServerAircraft,
  ServerAlert,
  WeatherData,
} from '../types';

const MAX_SYNC_ATTEMPTS = 3;

// ─── Cached weather per station ───────────────────────────────────────────────
let weatherCache: Record<string, WeatherData> = {};

export function getCachedWeather(station: string): WeatherData | null {
  return weatherCache[station] ?? null;
}

// ─── Main sync entry point ────────────────────────────────────────────────────

export async function pullAll(since?: number): Promise<void> {
  try {
    const data = await api.pullAll(since);

    await database.write(async () => {
      // Flights
      if (data.flights?.length) {
        await upsertFlights(data.flights);
      }
      // Aircraft
      if (data.aircraft?.length) {
        await upsertAircraft(data.aircraft);
      }
      // Alerts
      if (data.alerts?.length) {
        await upsertAlerts(data.alerts);
      }
    });

    // Weather (not stored in WDB – held in memory, fast enough for today's op)
    if (data.weather) {
      weatherCache = { ...weatherCache, ...data.weather };
    }
  } catch (err) {
    console.warn('[Sync] pullAll failed:', err);
    throw err;
  }
}

// ─── Push queued offline mutations ───────────────────────────────────────────

export async function pushPending(): Promise<{ pushed: number; failed: number }> {
  const pending = await syncQueueCollection
    .query(Q.sortBy('created_at', Q.asc))
    .fetch();

  let pushed = 0;
  let failed = 0;

  for (const item of pending) {
    if (item.attempts >= MAX_SYNC_ATTEMPTS) {
      failed++;
      continue;
    }

    try {
      const payload = JSON.parse(item.payload);

      if (item.model === 'dispatch_records') {
        await api.pushDispatchRecord(payload);
      }

      // Mark the dispatch record as synced and remove from queue
      await database.write(async () => {
        const records = await dispatchCollection
          .query(Q.where('id', item.recordId))
          .fetch();
        if (records.length > 0) {
          await records[0].update((r) => {
            r.isSynced = true;
          });
        }
        await item.destroyPermanently();
      });

      pushed++;
    } catch (err) {
      await database.write(async () => {
        await item.update((i) => {
          i.attempts = i.attempts + 1;
          i.lastError = String(err);
        });
      });
      failed++;
    }
  }

  return { pushed, failed };
}

// ─── Enqueue a local mutation for later sync ─────────────────────────────────

export async function enqueueSync(
  model: string,
  operation: 'create' | 'update',
  recordId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await database.write(async () => {
    await syncQueueCollection.create((item: SyncQueueItem) => {
      item.model = model;
      item.operation = operation;
      item.recordId = recordId;
      item.payload = JSON.stringify(payload);
      item.attempts = 0;
      item.lastError = '';
      item.createdAt = Date.now();
    });
  });
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────

async function upsertFlights(serverFlights: ServerFlight[]): Promise<void> {
  const remoteIds = serverFlights.map((f) => String(f.id));
  const existing = await flightsCollection
    .query(Q.where('remote_id', Q.oneOf(remoteIds)))
    .fetch();
  const existingMap = new Map(existing.map((f) => [f.remoteId, f]));

  const preparedUpdates: Flight[] = [];
  const preparedCreates: ReturnType<typeof flightsCollection.prepareCreate>[] = [];

  for (const sf of serverFlights) {
    const existing = existingMap.get(String(sf.id));
    const start = new Date(sf.scheduled_start).getTime();
    const end = new Date(sf.scheduled_end).getTime();

    if (existing) {
      preparedUpdates.push(
        existing.prepareUpdate((f) => {
          f.status = sf.status;
          f.syncedAt = Date.now();
        }) as unknown as Flight
      );
    } else {
      preparedCreates.push(
        flightsCollection.prepareCreate((f: Flight) => {
          f.remoteId = String(sf.id);
          f.aircraftRegistration = sf.aircraft_registration;
          f.aircraftType = sf.aircraft_type;
          f.instructorName = sf.instructor_name;
          f.studentName = sf.student_name;
          f.scheduledStart = start;
          f.scheduledEnd = end;
          f.flightType = sf.flight_type;
          f.exerciseNumber = sf.exercise_number ?? '';
          f.exerciseName = sf.exercise_name ?? '';
          f.base = sf.base;
          f.status = sf.status;
          f.syncedAt = Date.now();
        })
      );
    }
  }

  await database.batch(...preparedUpdates, ...preparedCreates);
}

async function upsertAircraft(serverAircraft: ServerAircraft[]): Promise<void> {
  const remoteIds = serverAircraft.map((a) => String(a.id));
  const existing = await aircraftCollection
    .query(Q.where('remote_id', Q.oneOf(remoteIds)))
    .fetch();
  const existingMap = new Map(existing.map((a) => [a.remoteId, a]));

  const preparedUpdates: Aircraft[] = [];
  const preparedCreates: ReturnType<typeof aircraftCollection.prepareCreate>[] = [];

  for (const sa of serverAircraft) {
    const existing = existingMap.get(String(sa.id));

    if (existing) {
      preparedUpdates.push(
        existing.prepareUpdate((a) => {
          a.status = sa.status;
          a.totalAirframeHours = sa.total_airframe_hours;
          a.hoursSince100h = sa.hours_since_100h;
          a.hoursSinceAnnual = sa.hours_since_annual;
          a.remainingHours = sa.remaining_hours;
          a.isFerryBlocked = sa.is_ferry_blocked;
          a.openSnagsCount = sa.open_snags_count;
          a.syncedAt = Date.now();
        }) as unknown as Aircraft
      );
    } else {
      preparedCreates.push(
        aircraftCollection.prepareCreate((a: Aircraft) => {
          a.remoteId = String(sa.id);
          a.registration = sa.registration;
          a.type = sa.type;
          a.base = sa.base;
          a.status = sa.status;
          a.totalAirframeHours = sa.total_airframe_hours;
          a.hoursSince100h = sa.hours_since_100h;
          a.hoursSinceAnnual = sa.hours_since_annual;
          a.remainingHours = sa.remaining_hours;
          a.ferryBufferHours = sa.ferry_buffer_hours;
          a.isFerryBlocked = sa.is_ferry_blocked;
          a.lastCrsDate = sa.last_crs_date
            ? new Date(sa.last_crs_date).getTime()
            : 0;
          a.openSnagsCount = sa.open_snags_count;
          a.syncedAt = Date.now();
        })
      );
    }
  }

  await database.batch(...preparedUpdates, ...preparedCreates);
}

async function upsertAlerts(serverAlerts: ServerAlert[]): Promise<void> {
  const remoteIds = serverAlerts.map((a) => String(a.id));
  const existing = await alertsCollection
    .query(Q.where('remote_id', Q.oneOf(remoteIds)))
    .fetch();
  const existingMap = new Map(existing.map((a) => [a.remoteId, a]));

  const preparedUpdates: FtoAlert[] = [];
  const preparedCreates: ReturnType<typeof alertsCollection.prepareCreate>[] = [];

  for (const sa of serverAlerts) {
    const existing = existingMap.get(String(sa.id));

    if (existing) {
      preparedUpdates.push(
        existing.prepareUpdate((a) => {
          a.isResolved = sa.is_resolved;
        }) as unknown as FtoAlert
      );
    } else {
      preparedCreates.push(
        alertsCollection.prepareCreate((a: FtoAlert) => {
          a.remoteId = String(sa.id);
          a.type = sa.type;
          a.severity = sa.severity;
          a.title = sa.title;
          a.message = sa.message;
          a.aircraftRegistration = sa.aircraft_registration ?? '';
          a.affectedFlightsCount = sa.affected_flights_count;
          a.isRead = false;
          a.isResolved = sa.is_resolved;
          a.createdAt = new Date(sa.created_at).getTime();
        })
      );
    }
  }

  await database.batch(...preparedUpdates, ...preparedCreates);
}
