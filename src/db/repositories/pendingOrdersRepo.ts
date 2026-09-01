import { db } from '../db';
import { PendingOrder } from '../../types';

export async function getAllPendingOrders(): Promise<PendingOrder[]> {
  const list = await db.pendingOrders.toArray();
  return list
    .filter(p => !p.isDeleted)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

export async function getPendingOrderById(orderId: string): Promise<PendingOrder | undefined> {
  return await db.pendingOrders.get(orderId);
}

export async function savePendingOrder(order: PendingOrder): Promise<void> {
  const toSave: PendingOrder = {
    ...order,
    id: order.id || order.orderId,
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: order.updatedAt || new Date().toISOString(),
  };
  await db.pendingOrders.put(toSave);
}

export async function savePendingOrdersBulk(orders: PendingOrder[]): Promise<void> {
  await db.pendingOrders.bulkPut(orders);
}

export async function deletePendingOrderById(orderId: string): Promise<void> {
  const existing = await db.pendingOrders.get(orderId);
  if (existing) {
    await db.pendingOrders.update(orderId, { isDeleted: true, updatedAt: new Date().toISOString() });
  } else {
    await db.pendingOrders.delete(orderId);
  }
}

export async function removePendingOrderPermanently(orderId: string): Promise<void> {
  await db.pendingOrders.delete(orderId);
}
