import { db } from '../db';
import { InventoryMovement } from '../../types';

export async function getAllInventoryMovements(): Promise<InventoryMovement[]> {
  return await db.inventoryMovements.orderBy('createdAt').reverse().toArray();
}

export async function getInventoryMovementById(movementId: string): Promise<InventoryMovement | undefined> {
  return await db.inventoryMovements.get(movementId);
}

export async function hasInventoryMovement(movementId: string): Promise<boolean> {
  const count = await db.inventoryMovements.where('movementId').equals(movementId).count();
  return count > 0;
}

export async function recordInventoryMovement(movement: InventoryMovement): Promise<void> {
  await db.inventoryMovements.put(movement);
}

export async function getUnsyncedMovements(): Promise<InventoryMovement[]> {
  return await db.inventoryMovements
    .where('syncedToFirestore')
    .equals(0) // or false
    .toArray();
}

export async function markMovementSynced(movementId: string): Promise<void> {
  await db.inventoryMovements.update(movementId, { syncedToFirestore: true });
}

export async function deleteInventoryMovement(movementId: string): Promise<void> {
  await db.inventoryMovements.delete(movementId);
}

export async function clearAllInventoryMovements(): Promise<void> {
  await db.inventoryMovements.clear();
}

