import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class SyncQueueItem extends Model {
  static table = 'sync_queue';

  @field('model') model: string;
  @field('operation') operation: string;
  @field('record_id') recordId: string;
  @field('payload') payload: string;     // JSON string
  @field('attempts') attempts: number;
  @field('last_error') lastError: string;
  @field('created_at') createdAt: number;
}
