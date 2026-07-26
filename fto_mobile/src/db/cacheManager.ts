/**
 * Cache Manager — reads/writes API response cache in SQLite.
 * Provides offline read fallback for React Query hooks.
 *
 * When online: API response is served normally AND cached locally.
 * When offline: Cached response is served from SQLite.
 */
import { getDatabase } from './database';
import type { Flight, Aircraft, WeatherCache, TechLog } from '../types';

// ── Generic API Response Cache ──────────────────────────────────────────────

/**
 * Store an API response in the generic cache.
 * @param cacheKey Unique key (e.g. 'flights:2026-07-25:base-abc')
 * @param endpoint The API endpoint path
 * @param params Query params object
 * @param data The response data to cache
 * @param ttlMinutes Optional TTL in minutes (default: 60)
 */
export async function cacheResponse(
  cacheKey: string,
  endpoint: string,
  params: Record<string, string> | null,
  data: unknown,
  ttlMinutes: number = 60,
): Promise<void> {
  const db = await getDatabase();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO api_cache (cache_key, endpoint, params, response_data, fetched_at, expires_at)
     VALUES (?, ?, ?, ?, datetime('now'), ?)`,
    cacheKey,
    endpoint,
    params ? JSON.stringify(params) : null,
    JSON.stringify(data),
    expiresAt,
  );
}

/**
 * Retrieve a cached API response.
 * Returns null if not cached or expired.
 */
export async function getCachedResponse<T>(
  cacheKey: string,
  ignoreExpiry: boolean = false,
): Promise<T | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ response_data: string; expires_at: string | null }>(
    'SELECT response_data, expires_at FROM api_cache WHERE cache_key = ?',
    cacheKey,
  );

  if (!row) return null;

  // Check expiry unless explicitly ignored (offline mode ignores expiry)
  if (!ignoreExpiry && row.expires_at) {
    if (new Date(row.expires_at) < new Date()) {
      return null; // Expired
    }
  }

  try {
    return JSON.parse(row.response_data) as T;
  } catch {
    return null;
  }
}

/**
 * Invalidate a specific cache entry.
 */
export async function invalidateCache(cacheKey: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM api_cache WHERE cache_key = ?', cacheKey);
}

/**
 * Invalidate all cache entries matching a prefix.
 * e.g. invalidateCachePrefix('flights:') clears all flight caches.
 */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM api_cache WHERE cache_key LIKE ?', `${prefix}%`);
}

// ── Typed Entity Caches (denormalized for fast offline access) ───────────────

/**
 * Cache today's flight roster for offline access.
 */
export async function cacheFlights(flights: Flight[]): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    // Clear existing cached flights (we always cache the full day)
    await db.runAsync('DELETE FROM cached_flights');

    for (const f of flights) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_flights
         (id, base_id, instructor_id, instructor_name, student_id, student_name,
          aircraft_id, aircraft_name, flight_type, status, scheduled_start,
          scheduled_end, is_ferry, is_solo, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        f.id,
        f.base,
        f.instructor,
        f.instructor_name || null,
        f.student || null,
        f.student_name || null,
        f.aircraft,
        f.aircraft_name || null,
        f.flight_type,
        f.status,
        f.scheduled_start,
        f.scheduled_end,
        f.is_ferry ? 1 : 0,
        f.is_solo ? 1 : 0,
        JSON.stringify(f),
      );
    }
  });
}

/**
 * Get cached flights, optionally filtered.
 */
export async function getCachedFlights(filters?: {
  date?: string;
  baseId?: string;
  instructorId?: string;
  status?: string[];
}): Promise<Flight[]> {
  const db = await getDatabase();
  let query = 'SELECT data_json FROM cached_flights WHERE 1=1';
  const params: any[] = [];

  if (filters?.date) {
    query += ' AND scheduled_start LIKE ?';
    params.push(`${filters.date}%`);
  }
  if (filters?.baseId) {
    query += ' AND base_id = ?';
    params.push(filters.baseId);
  }
  if (filters?.instructorId) {
    query += ' AND instructor_id = ?';
    params.push(filters.instructorId);
  }
  if (filters?.status?.length) {
    const placeholders = filters.status.map(() => '?').join(',');
    query += ` AND status IN (${placeholders})`;
    params.push(...filters.status);
  }

  query += ' ORDER BY scheduled_start ASC';

  const rows = await db.getAllAsync<{ data_json: string }>(query, ...params);
  return rows.map((r) => JSON.parse(r.data_json) as Flight);
}

/**
 * Cache fleet aircraft for offline access.
 */
export async function cacheAircraft(aircraft: Aircraft[]): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM cached_aircraft');

    for (const a of aircraft) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_aircraft
         (id, tail_number, status, current_base_id, hobbs_total, aog_reason, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        a.id,
        a.tail_number,
        a.status,
        a.current_base,
        parseFloat(a.hobbs_total),
        a.aog_reason || null,
        JSON.stringify(a),
      );
    }
  });
}

/**
 * Get cached aircraft.
 */
export async function getCachedAircraft(filters?: {
  status?: string;
  baseId?: string;
}): Promise<Aircraft[]> {
  const db = await getDatabase();
  let query = 'SELECT data_json FROM cached_aircraft WHERE 1=1';
  const params: any[] = [];

  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.baseId) {
    query += ' AND current_base_id = ?';
    params.push(filters.baseId);
  }

  const rows = await db.getAllAsync<{ data_json: string }>(query, ...params);
  return rows.map((r) => JSON.parse(r.data_json) as Aircraft);
}

/**
 * Cache weather data for a base.
 */
export async function cacheWeather(weather: WeatherCache): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO cached_weather
     (icao_code, metar_raw, wind_speed_kt, wind_direction_deg, visibility_m,
      density_altitude_ft, data_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    weather.icao_code,
    weather.metar_raw,
    weather.wind_speed_kt,
    weather.wind_direction_deg,
    weather.visibility_m,
    weather.density_altitude_ft,
    JSON.stringify(weather),
  );
}

/**
 * Get cached weather for a base.
 */
export async function getCachedWeather(icao: string): Promise<WeatherCache | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ data_json: string }>(
    'SELECT data_json FROM cached_weather WHERE icao_code = ?',
    icao,
  );
  return row ? (JSON.parse(row.data_json) as WeatherCache) : null;
}
