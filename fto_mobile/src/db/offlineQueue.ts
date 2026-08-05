/**
 * Offline Mutation Queue — stores API mutations made while offline
 * and replays them against the SAME standard REST endpoints when
 * connectivity returns.
 *
 * This replaces legacy sync endpoints. Every mutation hits the same
 * endpoint the web app uses (e.g., POST /api/v1/dispatch/tech-logs/{id}/closeout/).
import { getDatabase } from './database';
import { apiClient } from '../api/client';
import { logger } from '../lib/logger';
import type { AxiosRequestConfig } from 'axios';

export interface PendingMutation {
  id: number;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  endpoint: string;
  payload: string | null;
  headers: string | null;
  created_at: string;
  retry_count: number;
  max_retries: number;
  status: 'pending' | 'in_flight' | 'failed' | 'succeeded';
  error_message: string | null;
  resolved_at: string | null;
}

/**
 * Enqueue a mutation for later replay.
 * Called when the app is offline and the user triggers a write action.
 */
export async function enqueueMutation(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  endpoint: string,
  payload?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO pending_mutations (method, endpoint, payload, headers)
     VALUES (?, ?, ?, ?)`,
    method,
    endpoint,
    payload ? JSON.stringify(payload) : null,
    extraHeaders ? JSON.stringify(extraHeaders) : null,
  );
  logger.log(`[OfflineQueue] Enqueued: ${method} ${endpoint} (id=${result.lastInsertRowId})`);
  return result.lastInsertRowId;
}

/**
 * Get all pending mutations ordered by creation time (FIFO).
 */
export async function getPendingMutations(): Promise<PendingMutation[]> {
  const db = await getDatabase();
  return db.getAllAsync<PendingMutation>(
    `SELECT * FROM pending_mutations
     WHERE status = 'pending'
     ORDER BY created_at ASC`
  );
}

/**
 * Get count of pending mutations.
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM pending_mutations WHERE status = 'pending'"
  );
  return row?.count ?? 0;
}

/**
 * Get failed mutations that may need manual review.
 */
export async function getFailedMutations(): Promise<PendingMutation[]> {
  const db = await getDatabase();
  return db.getAllAsync<PendingMutation>(
    `SELECT * FROM pending_mutations
     WHERE status = 'failed'
     ORDER BY created_at ASC`
  );
}

/**
 * Replay a single mutation against the server.
 * Returns true if successful, false if failed.
 */
async function replayMutation(mutation: PendingMutation): Promise<boolean> {
  const db = await getDatabase();

  // Mark as in-flight
  await db.runAsync(
    "UPDATE pending_mutations SET status = 'in_flight' WHERE id = ?",
    mutation.id
  );

  try {
    const config: AxiosRequestConfig = {
      method: mutation.method.toLowerCase() as any,
      url: mutation.endpoint,
      data: mutation.payload ? JSON.parse(mutation.payload) : undefined,
      headers: mutation.headers ? JSON.parse(mutation.headers) : undefined,
    };

    await apiClient.request(config);

    // Success — mark as resolved
    await db.runAsync(
      `UPDATE pending_mutations
       SET status = 'succeeded', resolved_at = datetime('now')
       WHERE id = ?`,
      mutation.id
    );
    logger.log(`[OfflineQueue] ✅ Replayed: ${mutation.method} ${mutation.endpoint}`);
    return true;
  } catch (error: any) {
    const statusCode = error?.response?.status;
    const errorMsg = error?.response?.data?.detail || error.message || 'Unknown error';

    // 4xx errors (except 401/408/429) are permanent failures — don't retry
    const isPermanentFailure =
      statusCode && statusCode >= 400 && statusCode < 500 &&
      statusCode !== 401 && statusCode !== 408 && statusCode !== 429;

    if (isPermanentFailure || mutation.retry_count >= mutation.max_retries - 1) {
      // Mark as permanently failed — needs manual review
      await db.runAsync(
        `UPDATE pending_mutations
         SET status = 'failed', error_message = ?, retry_count = retry_count + 1
         WHERE id = ?`,
        `${statusCode || 'network'}: ${errorMsg}`,
        mutation.id
      );
      logger.warn(`[OfflineQueue] ❌ Failed permanently: ${mutation.method} ${mutation.endpoint} — ${errorMsg}`);
    } else {
      // Transient failure — back to pending with incremented retry count
      await db.runAsync(
        `UPDATE pending_mutations
         SET status = 'pending', retry_count = retry_count + 1, error_message = ?
         WHERE id = ?`,
        errorMsg,
        mutation.id
      );
      logger.warn(`[OfflineQueue] ⚠ Retry ${mutation.retry_count + 1}: ${mutation.method} ${mutation.endpoint}`);
    }
    return false;
  }
}

/**
 * Flush the entire queue — replays all pending mutations in FIFO order.
 * Stops on first transient failure to maintain ordering guarantees.
 * 
 * Returns { replayed: number, failed: number, remaining: number }
 */
export async function flushQueue(): Promise<{
  replayed: number;
  failed: number;
  remaining: number;
}> {
  const pending = await getPendingMutations();
  let replayed = 0;
  let failed = 0;

  logger.log(`[OfflineQueue] Flushing ${pending.length} pending mutations...`);

  const permanentlyFailedRelatedIds = new Set<string>();

  for (const mutation of pending) {
    // Extract related ID (techLog.id or flight.id) to track dependencies
    let relatedId = null;
    if (mutation.payload) {
      try {
        const parsed = JSON.parse(mutation.payload);
        relatedId = parsed.id || parsed.flight; 
      } catch (e) {}
    }

    if (relatedId && permanentlyFailedRelatedIds.has(relatedId)) {
      const db = await getDatabase();
      await db.runAsync(
        `UPDATE pending_mutations
         SET status = 'failed', error_message = 'Prerequisite mutation failed permanently'
         WHERE id = ?`,
        mutation.id
      );
      failed++;
      logger.warn(`[OfflineQueue] ❌ Skipped (prerequisite failed): ${mutation.method} ${mutation.endpoint}`);
      continue;
    }

    const success = await replayMutation(mutation);
    if (success) {
      replayed++;
    } else {
      failed++;
      // Check if it was a permanent failure (status is 'failed')
      // If transient, stop processing to maintain order
      const db = await getDatabase();
      const updated = await db.getFirstAsync<{ status: string }>(
        'SELECT status FROM pending_mutations WHERE id = ?',
        mutation.id
      );
      if (updated?.status === 'pending') {
        // Transient failure — stop to maintain FIFO ordering
        logger.log('[OfflineQueue] Stopping flush due to transient failure (FIFO ordering)');
        break;
      }
      // Permanent failure — add to failed related IDs to block dependents
      if (relatedId) {
        permanentlyFailedRelatedIds.add(relatedId);
      }
    }
  }

  const remaining = await getPendingCount();
  logger.log(`[OfflineQueue] Flush complete: ${replayed} replayed, ${failed} failed, ${remaining} remaining`);

  return { replayed, failed, remaining };
}

/**
 * Retry a specific failed mutation (user-triggered).
 */
export async function retryMutation(id: number): Promise<boolean> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE pending_mutations SET status = 'pending', retry_count = 0, error_message = NULL WHERE id = ?",
    id
  );
  const mutation = await db.getFirstAsync<PendingMutation>(
    'SELECT * FROM pending_mutations WHERE id = ?',
    id
  );
  if (!mutation) return false;
  return replayMutation(mutation);
}

/**
 * Discard a failed mutation (user chose to abandon it).
 */
export async function discardMutation(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE pending_mutations SET status = 'failed', error_message = 'Discarded by user', resolved_at = datetime('now') WHERE id = ?",
    id
  );
}

/**
 * Clean up old resolved mutations (keep last 7 days).
 */
export async function cleanupResolvedMutations(): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `DELETE FROM pending_mutations
     WHERE status IN ('succeeded', 'failed')
     AND resolved_at < datetime('now', '-7 days')`
  );
  return result.changes;
}
