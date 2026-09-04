import { db } from '../db/db';
import {
  INITIAL_PRODUCTS,
  DEFAULT_INVENTORY,
  getDefaultMonthlyDistribution,
  getBruneiDateString
} from '../data/initialData';
import { getOrCreateDeviceId, setStorePin } from '../db/repositories/appSettingsRepo';
import { Product, Order, Expense, PendingOrder, StaffShift, InventoryItem, InventoryLog, MonthlyDistributionConfig } from '../types';
import { reconcileInventoryWithProducts } from './posService';

const MIGRATION_FLAG_KEY = 'hershe_pos_dexie_migration_v1_done';
const OLD_STORAGE_KEY = 'hershe_pos_app_data_v4';
const OLD_PIN_KEY = 'hershe_pos_store_pin';

/**
 * Fix #9: Resumable, idempotent, deterministic and atomic migration.
 * Converts legacy localStorage state to IndexedDB with stable IDs.
 * Retains localStorage intact as backup.
 */
export async function initializeDatabaseAndMigrate(): Promise<void> {
  const isMigrated = localStorage.getItem(MIGRATION_FLAG_KEY);
  const deviceId = await getOrCreateDeviceId();

  // One-time cleanup of default hardcoded menu items so owner has clean dedicated menu
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

  // Check if DB already has inventory
  const invCount = await db.inventory.count();

  if (isMigrated && invCount > 0) {
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

    // 2. Inventory (Deterministic IDs)
    if (oldData && Array.isArray(oldData.inventory) && oldData.inventory.length > 0) {
      const invs: InventoryItem[] = oldData.inventory.map((i: any, idx: number) => {
        const fallbackNameHash = (i.productName || 'item').toLowerCase().replace(/\s+/g, '_');
        return {
          ...i,
          id: i.id || `inv-legacy-${idx}-${fallbackNameHash}`,
          updatedAt: i.updatedAt || new Date().toISOString(),
          deviceId,
        };
      });
      await db.inventory.bulkPut(invs);
    } else if (invCount === 0) {
      await db.inventory.bulkPut(DEFAULT_INVENTORY.map(i => ({ ...i, deviceId, updatedAt: new Date().toISOString() })));
    }

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

  // Verify verification before committing completion flag
  const verifiedProducts = await db.products.count();
  if (verifiedProducts > 0) {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  }
}
