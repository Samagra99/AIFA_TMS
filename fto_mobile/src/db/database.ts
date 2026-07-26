/**
 * Database setup using expo-sqlite.
 * Provides offline caching and mutation queue for the mobile app.
 * 
 * expo-sqlite is used instead of WatermelonDB because:
 * 1. Native Expo support — no custom dev client needed
 * 2. Synchronous reads for fast cache lookups
 * 3. Lighter weight for our use case (cache + queue, not full ORM)
 */
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('aifa_fto.db');
  await initializeSchema(db);
  return db;
}

async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- ── Offline Mutation Queue ──────────────────────────────────────────
    -- Stores API mutations made while offline, replayed on reconnect.
    CREATE TABLE IF NOT EXISTS pending_mutations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      method        TEXT NOT NULL,            -- 'POST' | 'PATCH' | 'PUT' | 'DELETE'
      endpoint      TEXT NOT NULL,            -- e.g. '/dispatch/tech-logs/abc/closeout/'
      payload       TEXT,                     -- JSON stringified request body
      headers       TEXT,                     -- JSON stringified extra headers
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      retry_count   INTEGER NOT NULL DEFAULT 0,
      max_retries   INTEGER NOT NULL DEFAULT 5,
      status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_flight' | 'failed' | 'succeeded'
      error_message TEXT,
      resolved_at   TEXT
    );

    -- ── API Response Cache ──────────────────────────────────────────────
    -- Caches GET responses for offline reads.
    CREATE TABLE IF NOT EXISTS api_cache (
      cache_key     TEXT PRIMARY KEY,         -- e.g. 'flights:2026-07-25:base-abc'
      endpoint      TEXT NOT NULL,            -- e.g. '/scheduling/flights/daily-roster/'
      params        TEXT,                     -- JSON stringified query params
      response_data TEXT NOT NULL,            -- JSON stringified response
      fetched_at    TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at    TEXT,                     -- optional TTL
      etag          TEXT                      -- for conditional requests
    );

    -- ── Flight Cache (denormalized for fast offline access) ─────────────
    CREATE TABLE IF NOT EXISTS cached_flights (
      id                TEXT PRIMARY KEY,
      base_id           TEXT,
      instructor_id     TEXT,
      instructor_name   TEXT,
      student_id        TEXT,
      student_name      TEXT,
      aircraft_id       TEXT,
      aircraft_name     TEXT,
      flight_type       TEXT,
      status            TEXT,
      scheduled_start   TEXT,
      scheduled_end     TEXT,
      is_ferry          INTEGER DEFAULT 0,
      is_solo           INTEGER DEFAULT 0,
      data_json         TEXT NOT NULL,        -- full Flight JSON
      synced_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Aircraft Cache ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS cached_aircraft (
      id                TEXT PRIMARY KEY,
      tail_number       TEXT,
      status            TEXT,
      current_base_id   TEXT,
      hobbs_total       REAL,
      aog_reason        TEXT,
      data_json         TEXT NOT NULL,
      synced_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Weather Cache ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS cached_weather (
      icao_code         TEXT PRIMARY KEY,
      metar_raw         TEXT,
      wind_speed_kt     INTEGER,
      wind_direction_deg INTEGER,
      visibility_m      INTEGER,
      density_altitude_ft INTEGER,
      data_json         TEXT NOT NULL,
      fetched_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Tech Log Cache ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS cached_tech_logs (
      id                TEXT PRIMARY KEY,
      flight_id         TEXT,
      aircraft_id       TEXT,
      status            TEXT,
      data_json         TEXT NOT NULL,
      synced_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Indexes for fast lookups ────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_mutations_status ON pending_mutations(status);
    CREATE INDEX IF NOT EXISTS idx_flights_date ON cached_flights(scheduled_start);
    CREATE INDEX IF NOT EXISTS idx_flights_status ON cached_flights(status);
    CREATE INDEX IF NOT EXISTS idx_flights_instructor ON cached_flights(instructor_id);
    CREATE INDEX IF NOT EXISTS idx_aircraft_status ON cached_aircraft(status);
    CREATE INDEX IF NOT EXISTS idx_cache_key ON api_cache(cache_key);
  `);
}

export async function clearAllCaches(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM api_cache;
    DELETE FROM cached_flights;
    DELETE FROM cached_aircraft;
    DELETE FROM cached_weather;
    DELETE FROM cached_tech_logs;
  `);
}

export async function getDatabaseStats(): Promise<{
  pendingMutations: number;
  cachedFlights: number;
  cachedAircraft: number;
  cacheEntries: number;
}> {
  const database = await getDatabase();
  const mutations = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM pending_mutations WHERE status = 'pending'"
  );
  const flights = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM cached_flights'
  );
  const aircraft = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM cached_aircraft'
  );
  const cache = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM api_cache'
  );

  return {
    pendingMutations: mutations?.count ?? 0,
    cachedFlights: flights?.count ?? 0,
    cachedAircraft: aircraft?.count ?? 0,
    cacheEntries: cache?.count ?? 0,
  };
}
