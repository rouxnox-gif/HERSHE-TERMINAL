import { db } from '../db/db';
import { InventoryItem, InventoryLog, InventoryMovement } from '../types';
import { getOrCreateDeviceId } from '../db/repositories/appSettingsRepo';
import { enqueueSyncItem } from '../db/repositories/syncQueueRepo';
import { getBruneiDateString, getBruneiTimeString } from '../data/initialData';

/**
 * Apply an inventory movement locally.
 * Fix #2, #3, #4:
 * 1. Check movement exists INSIDE the Dexie transaction.
 * 2. Update local stock projection.
 * 3. Create inventory log.
 * 4. Insert movement with unique primary key.
 * 5. Enqueue ONLY the inventoryMovement event for cloud sync (NEVER authoritative currentStock snapshot).
 */
export async function applyInventoryMovement(
  movement: InventoryMovement,
  options: { enqueueSync?: boolean } = { enqueueSync: true }
): Promise<{ success: boolean; updatedStock?: number }> {
  let applied = false;
  let newStock = 0;

  await db.transaction('rw', [db.inventory, db.inventoryLogs, db.inventoryMovements, db.syncQueue], async () => {
    // 1. Check if movement was already applied inside the atomic transaction
    const existingMovement = await db.inventoryMovements.get(movement.movementId);
    if (existingMovement && existingMovement.appliedLocally) {
      applied = false;
      return;
    }

    const cleanName = movement.productName.toLowerCase().trim();
    const allItems = await db.inventory.toArray();
    const targetItem = allItems.find(it => it.productName.toLowerCase().trim() === cleanName);

    const dateStr = movement.createdAt ? movement.createdAt.substring(0, 10) : getBruneiDateString();
    const timeStr = getBruneiTimeString();

    if (targetItem) {
      newStock = Math.max(0, targetItem.currentStock + movement.quantityChange);
      await db.inventory.update(targetItem.id, {
        currentStock: newStock,
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Record inventory log
    const logId = `log-${movement.movementId}`;
    const log: InventoryLog = {
      id: logId,
      timestamp: movement.createdAt || new Date().toISOString(),
      date: dateStr,
      time: timeStr,
      productName: movement.productName,
      type: movement.type,
      quantityChange: movement.quantityChange,
      balanceAfter: targetItem ? newStock : 0,
      reason: movement.reason || `Movement: ${movement.type}`,
      staffName: movement.staffName || 'System',
      createdAt: movement.createdAt || new Date().toISOString(),
    };
    await db.inventoryLogs.put(log);

    // 3. Save movement record as applied locally
    const movementRecord: InventoryMovement = {
      ...movement,
      appliedLocally: true,
    };
    await db.inventoryMovements.put(movementRecord);

    // 4. Enqueue ONLY the inventoryMovement event for cloud synchronization
    // Authoritative event sourcing: No currentStock snapshot is pushed to cloud
    if (options.enqueueSync) {
      await enqueueSyncItem({
        entityType: 'inventoryMovement',
        entityId: movement.movementId,
        operation: 'INVENTORY_MOVEMENT',
        payload: movementRecord,
        deviceId: movement.deviceId,
        operationId: `sync-mv-${movement.movementId}`,
      });
    }

    applied = true;
  });

  return { success: applied, updatedStock: newStock };
}

/**
 * Deducts inventory stock for an order's items by generating deterministic inventory movements.
 * Fix #3: Deterministic IDs -> sale-{orderId}-{productId}
 */
export async function deductInventoryForOrder(
  items: { name: string; qty: number }[],
  orderId: string,
  staffName: string,
  orderDate?: string,
  orderTime?: string
): Promise<InventoryMovement[]> {
  if (!items || items.length === 0) return [];

  const deviceId = await getOrCreateDeviceId();
  const allInventory = await db.inventory.toArray();
  const movementsCreated: InventoryMovement[] = [];

  for (const item of items) {
    if (!item.name) continue;
    const cleanName = item.name.toLowerCase().trim();
    const matchingInv = allInventory.find(it => it.productName.toLowerCase().trim() === cleanName);

    if (matchingInv) {
      const qtyToDeduct = Number(item.qty) || 1;
      const movementId = `sale-${orderId}-${matchingInv.id}`;

      const movement: InventoryMovement = {
        movementId,
        productId: matchingInv.id,
        productName: matchingInv.productName,
        quantityChange: -qtyToDeduct,
        type: 'sale',
        orderId,
        deviceId,
        createdAt: new Date().toISOString(),
        staffName: staffName || 'Staff',
        reason: `Order #${orderId}`,
        appliedLocally: false,
        syncedToFirestore: false,
      };

      await applyInventoryMovement(movement, { enqueueSync: true });
      movementsCreated.push(movement);
    }
  }

  return movementsCreated;
}

/**
 * Restores inventory stock when an order is cancelled or rejected.
 * Fix #3: Deterministic IDs -> restore-{orderId}-{productId}
 */
export async function restoreInventoryForOrder(
  items: { name: string; qty: number }[],
  orderId: string,
  staffName: string,
  reasonStr?: string
): Promise<InventoryMovement[]> {
  if (!items || items.length === 0) return [];

  const deviceId = await getOrCreateDeviceId();
  const allInventory = await db.inventory.toArray();
  const movementsCreated: InventoryMovement[] = [];

  for (const item of items) {
    if (!item.name) continue;
    const cleanName = item.name.toLowerCase().trim();
    const matchingInv = allInventory.find(it => it.productName.toLowerCase().trim() === cleanName);

    if (matchingInv) {
      const qtyToRestore = Number(item.qty) || 1;
      const movementId = `restore-${orderId}-${matchingInv.id}`;

      const movement: InventoryMovement = {
        movementId,
        productId: matchingInv.id,
        productName: matchingInv.productName,
        quantityChange: qtyToRestore,
        type: 'restore',
        orderId,
        deviceId,
        createdAt: new Date().toISOString(),
        staffName: staffName || 'Admin',
        reason: reasonStr || `Order #${orderId} cancelled/rejected - stock restored`,
        appliedLocally: false,
        syncedToFirestore: false,
      };

      await applyInventoryMovement(movement, { enqueueSync: true });
      movementsCreated.push(movement);
    }
  }

  return movementsCreated;
}

/**
 * Apply remote inventory movement received from Firestore.
 * Idempotently applies stock change only if movementId has not been processed.
 */
export async function applyRemoteInventoryMovement(movement: InventoryMovement): Promise<void> {
  const isAlreadyApplied = await db.inventoryMovements.get(movement.movementId);
  if (isAlreadyApplied && isAlreadyApplied.appliedLocally) {
    return; // Already accounted for
  }

  await applyInventoryMovement(movement, { enqueueSync: false });
}
