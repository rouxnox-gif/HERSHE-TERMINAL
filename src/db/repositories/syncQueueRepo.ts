import { db } from '../db';
import { SyncQueueItem, SyncEntityType, SyncOperationType } from '../../types';

/**
 * Enqueue an operation for cloud synchronization.
 * Uses deterministic operationId based on entityType, entityId and operation if not explicitly passed.
 */
export async function enqueueSyncItem(params: {
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperationType;
  payload: any;
  deviceId: string;
  operationId?: string;
}): Promise<SyncQueueItem> {
  const operationId = params.operationId || `sync-${params.operation.toLowerCase()}-${params.entityType}-${params.entityId}`;
  
  const queueItem: SyncQueueItem = {
    operationId,
    entityType: params.entityType,
    entityId: params.entityId,
    operation: params.operation,
    payload: params.payload,
    deviceId: params.deviceId,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };

  await db.syncQueue.put(queueItem);
  return queueItem;
}

/**
 * Fix #7: Stale processing recovery.
 * If the browser crashes after an item becomes 'processing', reset items
 * older than staleTimeoutMs (default 5 mins) back to 'pending'.
 */
export async function recoverStaleProcessingItems(staleTimeoutMs = 5 * 60 * 1000): Promise<number> {
  const now = Date.now();
  const processingItems = await db.syncQueue
    .where('status')
    .equals('processing')
    .toArray();

  let recoveredCount = 0;
  for (const item of processingItems) {
    const lastAttemptMs = item.lastAttempt ? new Date(item.lastAttempt).getTime() : 0;
    if (now - lastAttemptMs > staleTimeoutMs || !item.lastAttempt) {
      await db.syncQueue.update(item.operationId, {
        status: 'pending',
      });
      recoveredCount++;
    }
  }
  return recoveredCount;
}

/**
 * Retrieves pending or eligible failed items with exponential backoff filter.
 * Automatically triggers stale processing recovery first.
 */
export async function getPendingSyncItems(limit = 50): Promise<SyncQueueItem[]> {
  await recoverStaleProcessingItems();

  const allCandidates = await db.syncQueue
    .where('status')
    .equals('pending')
    .or('status')
    .equals('failed')
    .sortBy('createdAt');

  const now = Date.now();

  const eligible = allCandidates.filter(item => {
    if (item.status === 'pending') return true;
    if (item.status === 'failed') {
      const retryCount = item.retryCount || 1;
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 60s
      const delayMs = Math.min(60000, 1000 * Math.pow(2, Math.min(retryCount, 6)));
      const lastAttemptMs = item.lastAttempt ? new Date(item.lastAttempt).getTime() : 0;
      return (now - lastAttemptMs) >= delayMs;
    }
    return false;
  });

  return eligible.slice(0, limit);
}

export async function getQueueItem(operationId: string): Promise<SyncQueueItem | undefined> {
  return await db.syncQueue.get(operationId);
}

export async function markItemProcessing(operationId: string): Promise<void> {
  await db.syncQueue.update(operationId, {
    status: 'processing',
    lastAttempt: new Date().toISOString(),
  });
}

export async function markItemCompleted(operationId: string): Promise<void> {
  await db.syncQueue.delete(operationId);
}

export async function markItemFailed(operationId: string, errorMsg: string): Promise<void> {
  const item = await db.syncQueue.get(operationId);
  if (item) {
    await db.syncQueue.update(operationId, {
      status: 'failed',
      retryCount: (item.retryCount || 0) + 1,
      lastAttempt: new Date().toISOString(),
      error: errorMsg,
    });
  }
}

export async function getPendingSyncCount(): Promise<number> {
  return await db.syncQueue
    .where('status')
    .anyOf(['pending', 'failed', 'processing'])
    .count();
}

export async function getAllQueueItems(): Promise<SyncQueueItem[]> {
  return await db.syncQueue.toArray();
}
