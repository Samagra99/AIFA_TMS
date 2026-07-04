import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class Flight extends Model {
  static table = 'flights';

  @field('remote_id') remoteId: string;
  @field('aircraft_registration') aircraftRegistration: string;
  @field('aircraft_type') aircraftType: string;
  @field('instructor_name') instructorName: string;
  @field('student_name') studentName: string;
  @field('scheduled_start') scheduledStart: number;
  @field('scheduled_end') scheduledEnd: number;
  @field('flight_type') flightType: string;
  @field('exercise_number') exerciseNumber: string;
  @field('exercise_name') exerciseName: string;
  @field('base') base: string;
  @field('status') status: string;
  @field('synced_at') syncedAt: number;
}
