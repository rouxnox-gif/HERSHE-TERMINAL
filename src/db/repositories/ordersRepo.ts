import { db } from '../db';
import { Order, OrderItem } from '../../types';

export async function getAllOrders(): Promise<Order[]> {
  const orders = await db.orders.toArray();
  // Filter out deleted and sort by date/time descending
  return orders
    .filter(o => !o.isDeleted)
    .sort((a, b) => {
      const dateA = `${a.date || ''} ${a.time || ''}`;
      const dateB = `${b.date || ''} ${b.time || ''}`;
      return dateB.localeCompare(dateA);
    });
}

export async function getOrderById(orderId: string): Promise<Order | undefined> {
  return await db.orders.get(orderId);
}

export async function saveOrder(order: Order): Promise<void> {
  const nowIso = new Date().toISOString();
  const toSave: Order = {
    ...order,
    id: order.id || order.orderId,
    createdAt: order.createdAt || nowIso,
    updatedAt: order.updatedAt || nowIso,
  };

  await db.transaction('rw', db.orders, db.orderItems, async () => {
    await db.orders.put(toSave);

    if (order.items && order.items.length > 0) {
      const orderItemsToSave: OrderItem[] = order.items.map((item, idx) => ({
        ...item,
        id: item.id || `${toSave.orderId}-item-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        orderId: toSave.orderId,
        createdAt: item.createdAt || nowIso,
      }));
      await db.orderItems.bulkPut(orderItemsToSave);
    }
  });
}

export async function saveOrdersBulk(orders: Order[]): Promise<void> {
  await db.transaction('rw', db.orders, db.orderItems, async () => {
    for (const order of orders) {
      await saveOrder(order);
    }
  });
}

export async function deleteOrderById(orderId: string): Promise<void> {
  const existing = await db.orders.get(orderId);
  if (existing) {
    await db.orders.update(orderId, { isDeleted: true, updatedAt: new Date().toISOString() });
  }
}

export async function clearAllOrders(): Promise<void> {
  await db.transaction('rw', db.orders, db.orderItems, async () => {
    await db.orders.clear();
    await db.orderItems.clear();
  });
}
