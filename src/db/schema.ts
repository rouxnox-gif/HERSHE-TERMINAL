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

export interface AppSettingRecord {
  key: string;
  value: any;
  updatedAt?: string;
}

export type {
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
};
