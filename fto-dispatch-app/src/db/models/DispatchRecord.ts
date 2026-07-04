import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class DispatchRecord extends Model {
  static table = 'dispatch_records';

  @field('remote_id') remoteId: string;
  @field('flight_id') flightId: string;
  @field('remote_flight_id') remoteFlightId: string;

  // Step 1
  @field('preflight_checks') preflightChecks: string;    // JSON string
  @field('preflight_notes') preflightNotes: string;
  @field('preflight_completed_at') preflightCompletedAt: number;
  @field('preflight_by') preflightBy: string;

  // Step 2
  @field('weather_data') weatherData: string;            // JSON string
  @field('notam_acknowledged') notamAcknowledged: boolean;
  @field('weather_decision') weatherDecision: string;
  @field('weather_completed_at') weatherCompletedAt: number;

  // Step 3
  @field('released_by') releasedBy: string;
  @field('released_at') releasedAt: number;
  @field('release_signature') releaseSignature: string;
  @field('eta_minutes') etaMinutes: number;

  // Meta
  @field('status') status: string;
  @field('is_synced') isSynced: boolean;
  @field('created_at') createdAt: number;
  @field('updated_at') updatedAt: number;
}
