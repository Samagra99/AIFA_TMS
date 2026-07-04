import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class Aircraft extends Model {
  static table = 'aircraft';

  @field('remote_id') remoteId: string;
  @field('registration') registration: string;
  @field('type') type: string;
  @field('base') base: string;
  @field('status') status: string;
  @field('total_airframe_hours') totalAirframeHours: number;
  @field('hours_since_100h') hoursSince100h: number;
  @field('hours_since_annual') hoursSinceAnnual: number;
  @field('remaining_hours') remainingHours: number;
  @field('ferry_buffer_hours') ferryBufferHours: number;
  @field('is_ferry_blocked') isFerryBlocked: boolean;
  @field('last_crs_date') lastCrsDate: number;
  @field('open_snags_count') openSnagsCount: number;
  @field('synced_at') syncedAt: number;
}
