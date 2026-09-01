import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { MonthlyDistributionConfig, Product, Order, Expense, PendingOrder, InventoryItem, InventoryLog, StaffShift, PaymentTypeConfig, TabType, StoreInfoSettings } from '../types';
import { DEFAULT_PAYMENT_CONFIGS, DEFAULT_STORE_INFO, getPaymentConfigs, getHiddenTabs, getStoreInfoSettings } from '../db/repositories/appSettingsRepo';

export function usePOSData() {
  const products = useLiveQuery(
    async () => {
      const items = await db.products.toArray();
      return items.filter(p => !p.isDeleted);
    },
    [],
    [] as Product[]
  );

  const orders = useLiveQuery(
    async () => {
      const items = await db.orders.toArray();
      return items
        .filter(o => !o.isDeleted)
        .sort((a, b) => {
          const dateA = `${a.date || ''} ${a.time || ''}`;
          const dateB = `${b.date || ''} ${b.time || ''}`;
          return dateB.localeCompare(dateA);
        });
    },
    [],
    [] as Order[]
  );

  const expenses = useLiveQuery(
    async () => {
      const items = await db.expenses.toArray();
      return items
        .filter(e => !e.isDeleted)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },
    [],
    [] as Expense[]
  );

  const pendingOrders = useLiveQuery(
    async () => {
      const items = await db.pendingOrders.toArray();
      return items
        .filter(p => !p.isDeleted)
        .sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));
    },
    [],
    [] as PendingOrder[]
  );

  const inventory = useLiveQuery(
    async () => {
      return await db.inventory.toArray();
    },
    [],
    [] as InventoryItem[]
  );

  const inventoryLogs = useLiveQuery(
    async () => {
      const items = await db.inventoryLogs.toArray();
      return items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    },
    [],
    [] as InventoryLog[]
  );

  const shifts = useLiveQuery(
    async () => {
      const items = await db.shifts.toArray();
      return items.sort((a, b) => `${b.checkInDate || ''} ${b.checkInTime || ''}`.localeCompare(`${a.checkInDate || ''} ${a.checkInTime || ''}`));
    },
    [],
    [] as StaffShift[]
  );

  const distributions = useLiveQuery(
    async () => {
      const list = await db.distributions.toArray();
      const map: Record<string, MonthlyDistributionConfig> = {};
      for (const d of list) {
        map[d.month] = d;
      }
      return map;
    },
    [],
    {} as Record<string, MonthlyDistributionConfig>
  );

  const paymentConfigs = useLiveQuery(
    async () => {
      return await getPaymentConfigs();
    },
    [],
    DEFAULT_PAYMENT_CONFIGS as PaymentTypeConfig[]
  );

  const hiddenTabs = useLiveQuery(
    async () => {
      return await getHiddenTabs();
    },
    [],
    [] as TabType[]
  );

  const storeInfo = useLiveQuery(
    async () => {
      return await getStoreInfoSettings();
    },
    [],
    DEFAULT_STORE_INFO as StoreInfoSettings
  );

  return {
    products,
    orders,
    expenses,
    pendingOrders,
    inventory,
    inventoryLogs,
    shifts,
    distributions,
    paymentConfigs,
    hiddenTabs,
    storeInfo,
  };
}
