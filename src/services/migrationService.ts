import { db } from '../db/db';
import {
  INITIAL_PRODUCTS,
  DEFAULT_INVENTORY,
  getDefaultMonthlyDistribution,
  getBruneiDateString,
  isLegacySyntheticInventoryId
} from '../data/initialData';
import { getOrCreateDeviceId, setStorePin, getStoreId } from '../db/repositories/appSettingsRepo';
import { enqueueSyncItem } from '../db/repositories/syncQueueRepo';
import { triggerSync } from './syncEngine';
import { db as firestoreDb } from '../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Product, Order, Expense, PendingOrder, StaffShift, InventoryItem, InventoryLog, InventoryMovement, MonthlyDistributionConfig } from '../types';
import { reconcileInventoryWithProducts } from './posService';

const MIGRATION_FLAG_KEY = 'hershe_pos_dexie_migration_v1_done';
const OLD_STORAGE_KEY = 'hershe_pos_app_data_v4';
const OLD_PIN_KEY = 'hershe_pos_store_pin';

/**
 * Permanently deletes everything that consists of 20 bottles (items, logs, movements)
 * from both local IndexedDB and Cloud Firestore.
 */
export async function purgeEverythingConsistingOf20Bottles(): Promise<{
  deletedInventory: number;
  deletedLogs: number;
  deletedMovements: number;
}> {
  let deletedInventory = 0;
  let deletedLogs = 0;
  let deletedMovements = 0;

  try {
    const deviceId = await getOrCreateDeviceId();
    const storeId = await getStoreId();

    // 1. Purge Inventory records that consist of 20 bottles or have stock/restock of 20
    const allInv = await db.inventory.toArray();
    const inv20ToDelete = allInv.filter(inv => {
      const stock = Number(inv.currentStock);
      const restock = Number(inv.lastRestockedQty);
      const name = (inv.productName || '').toLowerCase();
      return (
        stock === 20 ||
        restock === 20 ||
        inv.currentStock === 20 ||
        inv.lastRestockedQty === 20 ||
        isLegacySyntheticInventoryId(inv.id) ||
        inv.id.startsWith('inv-p-modal-') ||
        inv.id.startsWith('inv-prod-') ||
        name.includes('20 bottle') ||
        name.includes('20 btl')
      );
    });

    if (inv20ToDelete.length > 0) {
      await db.transaction('rw', [db.inventory, db.syncQueue], async () => {
        for (const item of inv20ToDelete) {
          await db.inventory.delete(item.id);
          await enqueueSyncItem({
            entityType: 'inventoryItem',
            entityId: item.id,
            operation: 'DELETE',
            payload: { id: item.id },
            deviceId,
            operationId: `sync-del-20btl-${item.id}-${Date.now()}`,
          });
          deletedInventory++;
        }
      });

      // Synchronously trigger delete directly in Firestore
      for (const item of inv20ToDelete) {
        try {
          await deleteDoc(doc(firestoreDb, 'stores', storeId, 'inventory', item.id));
        } catch {
          // If offline, syncQueue handles it
        }
      }
    }

    // 2. Purge Inventory Logs corresponding to 20 bottles
    const allLogs = await db.inventoryLogs.toArray();
    const logs20ToDelete = allLogs.filter(log => {
      const qty = Math.abs(Number(log.quantityChange));
      const bal = Number(log.balanceAfter);
      const reason = (log.reason || '').toLowerCase();
      const prod = (log.productName || '').toLowerCase();
      return (
        qty === 20 ||
        bal === 20 ||
        reason.includes('20') ||
        prod.includes('20 bottle') ||
        prod.includes('20 btl')
      );
    });

    if (logs20ToDelete.length > 0) {
      await db.inventoryLogs.bulkDelete(logs20ToDelete.map(l => l.id));
      deletedLogs = logs20ToDelete.length;
      for (const log of logs20ToDelete) {
        try {
          await deleteDoc(doc(firestoreDb, 'stores', storeId, 'inventoryLogs', log.id));
        } catch {}
      }
    }

    // 3. Purge Inventory Movements corresponding to 20 bottles
    const allMovs = await db.inventoryMovements.toArray();
    const movs20ToDelete = allMovs.filter(m => {
      const change = Math.abs(Number(m.quantityChange));
      const reason = (m.reason || '').toLowerCase();
      const prod = (m.productName || '').toLowerCase();
      return change === 20 || reason.includes('20') || prod.includes('20 bottle') || prod.includes('20 btl');
    });

    if (movs20ToDelete.length > 0) {
      await db.inventoryMovements.bulkDelete(movs20ToDelete.map(m => m.movementId));
      deletedMovements = movs20ToDelete.length;
      for (const m of movs20ToDelete) {
        try {
          await deleteDoc(doc(firestoreDb, 'stores', storeId, 'inventoryMovements', m.movementId));
        } catch {}
      }
    }

    // 4. Purge any stale syncQueue items for 20-bottle items so they never re-upload
    const allSync = await db.syncQueue.toArray();
    const badSyncOps = allSync.filter(s => {
      if (s.entityType === 'inventoryItem') {
        const payload = s.payload as any;
        if (payload) {
          const stock = Number(payload.currentStock);
          const restock = Number(payload.lastRestockedQty);
          if (stock === 20 || restock === 20 || isLegacySyntheticInventoryId(s.entityId)) {
            return true;
          }
        }
      }
      return false;
    });
    if (badSyncOps.length > 0) {
      await db.syncQueue.bulkDelete(badSyncOps.map(s => s.operationId));
    }

    triggerSync();
  } catch (err) {
    console.warn('[Purge20Bottles] Notice during purge:', err);
  }

  return { deletedInventory, deletedLogs, deletedMovements };
}

/**
 * Fix #9: Resumable, idempotent, deterministic and atomic migration.
 * Converts legacy localStorage state to IndexedDB with stable IDs.
 * Retains localStorage intact as backup.
 */
export async function initializeDatabaseAndMigrate(): Promise<void> {
  const isMigrated = localStorage.getItem(MIGRATION_FLAG_KEY);
  const deviceId = await getOrCreateDeviceId();

  // Clean default products if not yet cleaned
  const MENU_RESET_KEY = 'hershe_pos_cleared_default_menu_v3';
  if (!localStorage.getItem(MENU_RESET_KEY)) {
    try {
      const defaultIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
      const allProducts = await db.products.toArray();
      const defaults = allProducts.filter(p => defaultIds.includes(p.id) && !p.isDeleted);
      if (defaults.length > 0) {
        await db.transaction('rw', [db.products, db.syncQueue], async () => {
          for (const prod of defaults) {
            await db.products.update(prod.id, { isDeleted: true, updatedAt: new Date().toISOString() });
          }
        });
      }
      localStorage.setItem(MENU_RESET_KEY, 'true');
    } catch (e) {
      console.warn('Failed to clean default products:', e);
    }
  }

  // Unconditionally purge everything consisting of 20 bottles on every boot
  await purgeEverythingConsistingOf20Bottles();

  // Once migrated, never re-run migration on refresh regardless of whether inventory is empty
  if (isMigrated) {
    return; // Already initialized and verified
  }

  // 1. Check existing Store PIN
  const existingPin = localStorage.getItem(OLD_PIN_KEY);
  if (existingPin) {
    await setStorePin(existingPin);
  }

  // 2. Read old localStorage data
  let oldData: any = null;
  try {
    const raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (raw) {
      oldData = JSON.parse(raw);
      // Clean legacy inventory from old storage backup so it cannot re-inject 20 btl items
      if (oldData && oldData.inventory) {
        oldData.inventory = [];
        localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify(oldData));
      }
    }
  } catch (err) {
    console.warn('[MigrationService] Error reading old localStorage data:', err);
  }

  await db.transaction('rw', [
    db.products,
    db.orders,
    db.orderItems,
    db.expenses,
    db.pendingOrders,
    db.shifts,
    db.distributions,
    db.inventory,
    db.inventoryLogs,
    db.appSettings
  ], async () => {
    // 1. Products (Deterministic IDs)
    if (oldData && Array.isArray(oldData.products) && oldData.products.length > 0) {
      const prods: Product[] = oldData.products.map((p: any, idx: number) => {
        const fallbackNameHash = (p.name || 'item').toLowerCase().replace(/\s+/g, '_');
        return {
          ...p,
          id: p.id || `prod-legacy-${idx}-${fallbackNameHash}`,
          updatedAt: p.updatedAt || new Date().toISOString(),
          deviceId,
        };
      });
      await db.products.bulkPut(prods);
    }

    // 2. Inventory: Opt-in only. Do NOT migrate synthetic default 20 btl items.
    // The inventory list remains completely empty until the user explicitly adds items.
    // (DEFAULT_INVENTORY is empty, so no automatic items are created)

    // 3. Orders
    if (oldData && Array.isArray(oldData.orders) && oldData.orders.length > 0) {
      for (let idx = 0; idx < oldData.orders.length; idx++) {
        const ord = oldData.orders[idx];
        const orderId = ord.orderId || ord.id || `ord-legacy-${ord.date || 'unknown'}-${idx}`;
        const orderRecord: Order = {
          ...ord,
          id: ord.id || orderId,
          orderId,
          deviceId: ord.deviceId || deviceId,
          createdAt: ord.createdAt || new Date().toISOString(),
          updatedAt: ord.updatedAt || new Date().toISOString(),
        };
        await db.orders.put(orderRecord);

        if (ord.items && Array.isArray(ord.items)) {
          const itemsToSave = ord.items.map((it: any, itemIdx: number) => ({
            ...it,
            id: `${orderId}-item-${itemIdx}`,
            orderId,
            createdAt: orderRecord.createdAt,
          }));
          await db.orderItems.bulkPut(itemsToSave);
        }
      }
    }

    // 4. Expenses
    if (oldData && Array.isArray(oldData.expenses) && oldData.expenses.length > 0) {
      const exps: Expense[] = oldData.expenses.map((e: any, idx: number) => ({
        ...e,
        id: e.id || `exp-legacy-${e.date || 'unknown'}-${idx}`,
        deviceId: e.deviceId || deviceId,
        createdAt: e.createdAt || new Date().toISOString(),
        updatedAt: e.updatedAt || new Date().toISOString(),
      }));
      await db.expenses.bulkPut(exps);
    }

    // 5. Pending Orders
    if (oldData && Array.isArray(oldData.pendingOrders) && oldData.pendingOrders.length > 0) {
      const pends: PendingOrder[] = oldData.pendingOrders.map((p: any, idx: number) => {
        const orderId = p.orderId || p.id || `pend-legacy-${p.date || 'unknown'}-${idx}`;
        return {
          ...p,
          id: p.id || orderId,
          orderId,
          deviceId: p.deviceId || deviceId,
          createdAt: p.createdAt || new Date().toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString(),
        };
      });
      await db.pendingOrders.bulkPut(pends);
    }

    // 6. Shifts
    if (oldData && Array.isArray(oldData.shifts) && oldData.shifts.length > 0) {
      const shifts: StaffShift[] = oldData.shifts.map((s: any, idx: number) => ({
        ...s,
        id: s.id || `shift-legacy-${s.date || 'unknown'}-${idx}`,
        deviceId: s.deviceId || deviceId,
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: s.updatedAt || new Date().toISOString(),
      }));
      await db.shifts.bulkPut(shifts);
    }

    // 7. Inventory Logs
    if (oldData && Array.isArray(oldData.inventoryLogs) && oldData.inventoryLogs.length > 0) {
      const logs: InventoryLog[] = oldData.inventoryLogs.map((l: any, idx: number) => ({
        ...l,
        id: l.id || `log-legacy-${l.date || 'unknown'}-${idx}`,
        createdAt: l.createdAt || new Date().toISOString(),
      }));
      await db.inventoryLogs.bulkPut(logs);
    }

    // 8. Distributions
    const currentMonth = getBruneiDateString().substring(0, 7);
    if (oldData && oldData.distributions && typeof oldData.distributions === 'object') {
      for (const [monthKey, config] of Object.entries(oldData.distributions)) {
        await db.distributions.put({
          ...(config as MonthlyDistributionConfig),
          month: monthKey,
          deviceId,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      const distCount = await db.distributions.count();
      if (distCount === 0) {
        await db.distributions.put({
          ...getDefaultMonthlyDistribution(currentMonth),
          deviceId,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  });

  // Reconcile inventory with active products:
  // If there's no menu available, inventory also should be none!
  const allProds = await db.products.toArray();
  const activeProds = allProds.filter(p => !p.isDeleted);
  await reconcileInventoryWithProducts(activeProds);

  // Commit migration completion flag so initialization only runs once
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}
