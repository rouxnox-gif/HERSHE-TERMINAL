import { db } from '../db';
import { InventoryItem } from '../../types';
import { getOrCreateDeviceId } from './appSettingsRepo';
import { enqueueSyncItem } from './syncQueueRepo';

export async function getAllInventory(): Promise<InventoryItem[]> {
  return await db.inventory.toArray();
}

export async function getInventoryItemById(id: string): Promise<InventoryItem | undefined> {
  return await db.inventory.get(id);
}

export async function getInventoryItemByName(name: string): Promise<InventoryItem | undefined> {
  const cleanName = name.toLowerCase().trim();
  const all = await db.inventory.toArray();
  return all.find(i => i.productName.toLowerCase().trim() === cleanName);
}

export async function saveInventoryItem(item: InventoryItem, options: { enqueueSync?: boolean } = { enqueueSync: true }): Promise<void> {
  const toSave: InventoryItem = {
    ...item,
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
  await db.inventory.put(toSave);

  if (options.enqueueSync) {
    try {
      const deviceId = await getOrCreateDeviceId();
      await enqueueSyncItem({
        entityType: 'inventoryItem',
        entityId: toSave.id,
        operation: 'UPDATE',
        payload: toSave,
        deviceId,
      });
    } catch (e) {
      console.warn('[InventoryRepo] Enqueue sync notice for item update:', e);
    }
  }
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await db.inventory.delete(id);

  try {
    const deviceId = await getOrCreateDeviceId();
    await enqueueSyncItem({
      entityType: 'inventoryItem',
      entityId: id,
      operation: 'DELETE',
      payload: { id, isDeleted: true },
      deviceId,
    });
  } catch (e) {
    console.warn('[InventoryRepo] Enqueue sync notice for item delete:', e);
  }
}

export async function saveInventoryBulk(items: InventoryItem[]): Promise<void> {
  await db.inventory.bulkPut(items);
}

