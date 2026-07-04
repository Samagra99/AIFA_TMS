import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    // ─── Flights ─────────────────────────────────────────────────────────────
    tableSchema({
      name: 'flights',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'aircraft_registration', type: 'string' },
        { name: 'aircraft_type', type: 'string' },
        { name: 'instructor_name', type: 'string' },
        { name: 'student_name', type: 'string' },
        { name: 'scheduled_start', type: 'number' },  // Unix ms
        { name: 'scheduled_end', type: 'number' },    // Unix ms
        { name: 'flight_type', type: 'string' },      // DUAL|SOLO|CHECK|IFOX
        { name: 'exercise_number', type: 'string', isOptional: true },
        { name: 'exercise_name', type: 'string', isOptional: true },
        { name: 'base', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    // ─── Aircraft ────────────────────────────────────────────────────────────
    tableSchema({
      name: 'aircraft',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'registration', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'base', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'total_airframe_hours', type: 'number' },
        { name: 'hours_since_100h', type: 'number' },
        { name: 'hours_since_annual', type: 'number' },
        { name: 'remaining_hours', type: 'number' },
        { name: 'ferry_buffer_hours', type: 'number' },
        { name: 'is_ferry_blocked', type: 'boolean' },
        { name: 'last_crs_date', type: 'number', isOptional: true },
        { name: 'open_snags_count', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    // ─── Dispatch records ─────────────────────────────────────────────────────
    tableSchema({
      name: 'dispatch_records',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'flight_id', type: 'string' },             // local WDB id
        { name: 'remote_flight_id', type: 'string', isOptional: true },

        // Step 1: Pre-flight
        { name: 'preflight_checks', type: 'string' },      // JSON
        { name: 'preflight_notes', type: 'string', isOptional: true },
        { name: 'preflight_completed_at', type: 'number', isOptional: true },
        { name: 'preflight_by', type: 'string', isOptional: true },

        // Step 2: Weather
        { name: 'weather_data', type: 'string', isOptional: true }, // JSON
        { name: 'notam_acknowledged', type: 'boolean' },
        { name: 'weather_decision', type: 'string', isOptional: true }, // GO|NO_GO
        { name: 'weather_completed_at', type: 'number', isOptional: true },

        // Step 3: Release
        { name: 'released_by', type: 'string', isOptional: true },
        { name: 'released_at', type: 'number', isOptional: true },
        { name: 'release_signature', type: 'string', isOptional: true }, // SVG paths
        { name: 'eta_minutes', type: 'number', isOptional: true },

        // Meta
        { name: 'status', type: 'string' },                // PENDING|PRE_FLIGHT|BRIEFING|RELEASED
        { name: 'is_synced', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ─── Alerts (AOG, snag, weather, FDTL) ───────────────────────────────────
    tableSchema({
      name: 'fto_alerts',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'type', type: 'string' },          // AOG|SNAG|WEATHER|FDTL|MEDICAL
        { name: 'severity', type: 'string' },      // CRITICAL|HIGH|MEDIUM|LOW
        { name: 'title', type: 'string' },
        { name: 'message', type: 'string' },
        { name: 'aircraft_registration', type: 'string', isOptional: true },
        { name: 'affected_flights_count', type: 'number' },
        { name: 'is_read', type: 'boolean' },
        { name: 'is_resolved', type: 'boolean' },
        { name: 'created_at', type: 'number' },    // Unix ms
      ],
    }),

    // ─── Sync queue ───────────────────────────────────────────────────────────
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'model', type: 'string' },         // 'dispatch_records'
        { name: 'operation', type: 'string' },     // 'create'|'update'
        { name: 'record_id', type: 'string' },     // local WDB id
        { name: 'payload', type: 'string' },       // JSON
        { name: 'attempts', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
