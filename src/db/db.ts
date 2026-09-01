import Dexie, { type Table } from 'dexie';
import {
  Product,
  Order,
  OrderItem,
  Expense,
  PendingOrder,
  InventoryItem,
  InventoryLog,
  InventoryMovement,
  StaffShift,
  MonthlyDistributionConfig,
  SyncQueueItem,
  SyncMeta
} from '../types';
import { AppSettingRecord } from './schema';

export class HershePOSDatabase extends Dexie {
  products!: Table<Product, string>;
  orders!: Table<Order, string>;
  orderItems!: Table<OrderItem, string>;
  expenses!: Table<Expense, string>;
  pendingOrders!: Table<PendingOrder, string>;
  inventory!: Table<InventoryItem, string>;
  inventoryLogs!: Table<InventoryLog, string>;
  inventoryMovements!: Table<InventoryMovement, string>;
  shifts!: Table<StaffShift, string>;
  distributions!: Table<MonthlyDistributionConfig, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncMeta!: Table<SyncMeta, string>;
  appSettings!: Table<AppSettingRecord, string>;

  constructor() {
    super('HershePOS_IndexedDB_v1');

    this.version(1).stores({
      products: 'id, name, price, updatedAt, isDeleted',
      orders: 'orderId, id, date, paymentType, staffName, createdAt, updatedAt, deviceId, isDeleted',
      orderItems: 'id, orderId, name, createdAt',
      expenses: 'id, date, paymentType, createdAt, updatedAt, deviceId, isDeleted',
      pendingOrders: 'orderId, id, date, paymentType, staffName, createdAt, updatedAt, deviceId, isDeleted',
      inventory: 'id, productName, currentStock, updatedAt',
      inventoryLogs: 'id, timestamp, date, productName, type, createdAt',
      inventoryMovements: 'movementId, productName, type, orderId, deviceId, createdAt, appliedLocally, syncedToFirestore',
      shifts: 'id, staffName, status, checkInDate, createdAt, updatedAt',
      distributions: 'month, updatedAt',
      syncQueue: 'operationId, entityType, entityId, status, createdAt, retryCount',
      syncMeta: 'key, updatedAt',
      appSettings: 'key',
    });
  }
}

export const db = new HershePOSDatabase();
