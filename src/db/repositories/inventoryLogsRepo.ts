import { db } from '../db';
import { InventoryLog } from '../../types';

export async function getAllInventoryLogs(): Promise<InventoryLog[]> {
  const logs = await db.inventoryLogs.toArray();
  return logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
}

export async function saveInventoryLog(log: InventoryLog): Promise<void> {
  await db.inventoryLogs.put(log);
}

export async function saveInventoryLogsBulk(logs: InventoryLog[]): Promise<void> {
  await db.inventoryLogs.bulkPut(logs);
}

export async function deleteInventoryLog(id: string): Promise<void> {
  await db.inventoryLogs.delete(id);
}

export async function deleteInventoryLogsBulk(ids: string[]): Promise<void> {
  await db.inventoryLogs.bulkDelete(ids);
}

export async function clearAllInventoryLogs(): Promise<void> {
  await db.inventoryLogs.clear();
}

