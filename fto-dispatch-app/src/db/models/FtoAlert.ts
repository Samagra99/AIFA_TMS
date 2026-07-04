import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class FtoAlert extends Model {
  static table = 'fto_alerts';

  @field('remote_id') remoteId: string;
  @field('type') type: string;
  @field('severity') severity: string;
  @field('title') title: string;
  @field('message') message: string;
  @field('aircraft_registration') aircraftRegistration: string;
  @field('affected_flights_count') affectedFlightsCount: number;
  @field('is_read') isRead: boolean;
  @field('is_resolved') isResolved: boolean;
  @field('created_at') createdAt: number;
}
