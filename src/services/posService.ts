import { db } from '../db/db';
import {
  Order,
  OrderItem,
  PendingOrder,
  Expense,
  Product,
  StaffShift,
  MonthlyDistributionConfig,
  PaymentMethod,
  InventoryLog,
  InventoryMovement,
  InventoryItem
} from '../types';
import { getOrCreateDeviceId, getStoreId } from '../db/repositories/appSettingsRepo';
import { enqueueSyncItem } from '../db/repositories/syncQueueRepo';
import { getBruneiDateString, getBruneiTimeString, INITIAL_PRODUCTS, DEFAULT_INVENTORY, getDefaultMonthlyDistribution, isLegacySyntheticInventoryId } from '../data/initialData';
import { triggerSync } from './syncEngine';
import { db as firestoreDb } from '../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

/**
 * Fix #5: Checkout Idempotency.
 * 1. Checks if orderId was already processed locally inside atomic transaction.
 * 2. Deducts inventory with deterministic movement IDs in the same transaction.
 * 3. Enqueues with deterministic operationId.
 * Guarantees: ONE checkout ID = ONE order.
 */
export async function createCompletedSale(params: {
  order: Order;
  staffName?: string;
}): Promise<Order> {
  const deviceId = await getOrCreateDeviceId();
  
  const orderId = params.order.orderId || params.order.id;
  if (!orderId) {
    throw new Error('Order must contain an orderId / checkout identifier');
  }

  const id = params.order.id || orderId;
  const nowIso = new Date().toISOString();
  const approveDate = params.order.paymentReceivedDate || params.order.date || getBruneiDateString();
  const approveTime = params.order.paymentReceivedTime || params.order.time || getBruneiTimeString();

  const finalPaymentType: PaymentMethod = params.order.paymentType === 'Binti Gym Transfer' 
    ? 'Cash' 
    : params.order.paymentType;

  const resolvedStaffName = params.staffName || params.order.staffName || 'Admin';

  const orderRecord: Order = {
    ...params.order,
    id,
    orderId,
    paymentType: finalPaymentType,
    staffName: resolvedStaffName,
    paymentReceivedDate: approveDate,
    paymentReceivedTime: approveTime,
    paymentReceivedAt: params.order.paymentReceivedAt || `${approveDate} ${approveTime}`,
    createdAt: params.order.createdAt || nowIso,
    updatedAt: nowIso,
    deviceId,
    isDeleted: false,
  };

  let alreadyProcessed = false;
  let existingOrder: Order | undefined;

  // Perform check, inventory deduction, order insertion, and queueing atomically
  await db.transaction('rw', [
    db.orders,
    db.orderItems,
    db.inventory,
    db.inventoryLogs,
    db.inventoryMovements,
    db.syncQueue
  ], async () => {
    existingOrder = await db.orders.get(orderId);
    if (existingOrder && !existingOrder.isDeleted) {
      alreadyProcessed = true;
      return;
    }

    // 1. Deduct Inventory Movements atomically
    if (orderRecord.items && orderRecord.items.length > 0) {
      const allInventory = await db.inventory.toArray();
      for (const item of orderRecord.items) {
        if (!item.name) continue;
        const cleanName = item.name.toLowerCase().trim();
        const matchingInv = allInventory.find(it => it.productName.toLowerCase().trim() === cleanName);

        if (matchingInv) {
          const qtyToDeduct = Number(item.qty) || 1;
          const movementId = `sale-${orderId}-${matchingInv.id}`;

          // Check if this movement was already applied
          const existingMovement = await db.inventoryMovements.get(movementId);
          if (!existingMovement || !existingMovement.appliedLocally) {
            const newStock = Math.max(0, matchingInv.currentStock - qtyToDeduct);
            await db.inventory.update(matchingInv.id, {
              currentStock: newStock,
              updatedAt: nowIso,
            });
            matchingInv.currentStock = newStock; // update in-memory snapshot for sequential lines

            const logId = `log-${movementId}`;
            const log: InventoryLog = {
              id: logId,
              timestamp: nowIso,
              date: approveDate,
              time: approveTime,
              productName: matchingInv.productName,
              type: 'sale',
              quantityChange: -qtyToDeduct,
              balanceAfter: newStock,
              reason: `Order #${orderId}`,
              staffName: resolvedStaffName,
              createdAt: nowIso,
            };
            await db.inventoryLogs.put(log);

            const movementRecord: InventoryMovement = {
              movementId,
              productId: matchingInv.id,
              productName: matchingInv.productName,
              quantityChange: -qtyToDeduct,
              type: 'sale',
              orderId,
              deviceId,
              createdAt: nowIso,
              staffName: resolvedStaffName,
              reason: `Order #${orderId}`,
              appliedLocally: true,
              syncedToFirestore: false,
            };
            await db.inventoryMovements.put(movementRecord);

            await enqueueSyncItem({
              entityType: 'inventoryMovement',
              entityId: movementId,
              operation: 'INVENTORY_MOVEMENT',
              payload: movementRecord,
              deviceId,
              operationId: `sync-mv-${movementId}`,
            });
          }
        }
      }
    }

    // 2. Put order
    await db.orders.put(orderRecord);

    // 3. Put order items
    if (orderRecord.items && orderRecord.items.length > 0) {
      const orderItemsToSave: OrderItem[] = orderRecord.items.map((it, idx) => ({
        ...it,
        id: `${orderId}-item-${idx}`,
        orderId,
        createdAt: nowIso,
      }));
      await db.orderItems.bulkPut(orderItemsToSave);
    }

    // 4. Enqueue Order with deterministic operationId
    await enqueueSyncItem({
      entityType: 'order',
      entityId: orderId,
      operation: 'CREATE',
      payload: orderRecord,
      deviceId,
      operationId: `sync-order-${orderId}`,
    });
  });

  if (alreadyProcessed && existingOrder) {
    return existingOrder;
  }

  // Trigger non-blocking cloud sync
  triggerSync();

  return orderRecord;
}

/**
 * Creates a Pending Order (for staff checkout or online pre-orders).
 * Atomic, deterministic, and idempotent.
 */
export async function createPendingOrder(params: {
  pendingOrder: PendingOrder;
  staffName?: string;
}): Promise<PendingOrder> {
  const deviceId = await getOrCreateDeviceId();
  const orderId = params.pendingOrder.orderId || params.pendingOrder.id || `pend-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const resolvedStaffName = params.staffName || params.pendingOrder.staffName || 'Staff';

  const isCustomerOrder = params.pendingOrder.orderSource === 'customer_preorder' ||
    params.pendingOrder.source === 'Customer Pre-Order' ||
    (params.staffName && params.staffName.toLowerCase().startsWith('customer')) ||
    (params.pendingOrder.staffName && params.pendingOrder.staffName.toLowerCase().startsWith('customer'));

  const pendingRecord: PendingOrder = {
    ...params.pendingOrder,
    id: params.pendingOrder.id || orderId,
    orderId,
    staffName: resolvedStaffName,
    inventoryDeducted: isCustomerOrder ? false : true,
    createdAt: params.pendingOrder.createdAt || nowIso,
    updatedAt: nowIso,
    deviceId,
    isDeleted: false,
  };

  await db.transaction('rw', [
    db.pendingOrders,
    db.inventory,
    db.inventoryLogs,
    db.inventoryMovements,
    db.syncQueue
  ], async () => {
    const existing = await db.pendingOrders.get(orderId);
    if (existing && !existing.isDeleted) {
      return;
    }

    // Deduct inventory immediately ONLY for in-store staff checkout (not unapproved customer pre-orders)
    if (!isCustomerOrder && pendingRecord.items && pendingRecord.items.length > 0) {
      const allInventory = await db.inventory.toArray();
      for (const item of pendingRecord.items) {
        if (!item.name) continue;
        const cleanName = item.name.toLowerCase().trim();
        const matchingInv = allInventory.find(it => it.productName.toLowerCase().trim() === cleanName);

        if (matchingInv) {
          const qtyToDeduct = Number(item.qty) || 1;
          const movementId = `sale-${orderId}-${matchingInv.id}`;

          const existingMovement = await db.inventoryMovements.get(movementId);
          if (!existingMovement || !existingMovement.appliedLocally) {
            const newStock = Math.max(0, matchingInv.currentStock - qtyToDeduct);
            await db.inventory.update(matchingInv.id, {
              currentStock: newStock,
              updatedAt: nowIso,
            });
            matchingInv.currentStock = newStock;

            const logId = `log-${movementId}`;
            const log: InventoryLog = {
              id: logId,
              timestamp: nowIso,
              date: pendingRecord.date,
              time: pendingRecord.time,
              productName: matchingInv.productName,
              type: 'sale',
              quantityChange: -qtyToDeduct,
              balanceAfter: newStock,
              reason: `Pending Order #${orderId}`,
              staffName: resolvedStaffName,
              createdAt: nowIso,
            };
            await db.inventoryLogs.put(log);

            const movementRecord: InventoryMovement = {
              movementId,
              productId: matchingInv.id,
              productName: matchingInv.productName,
              quantityChange: -qtyToDeduct,
              type: 'sale',
              orderId,
              deviceId,
              createdAt: nowIso,
              staffName: resolvedStaffName,
              reason: `Pending Order #${orderId}`,
              appliedLocally: true,
              syncedToFirestore: false,
            };
            await db.inventoryMovements.put(movementRecord);

            await enqueueSyncItem({
              entityType: 'inventoryMovement',
              entityId: movementId,
              operation: 'INVENTORY_MOVEMENT',
              payload: movementRecord,
              deviceId,
              operationId: `sync-mv-${movementId}`,
            });

            await enqueueSyncItem({
              entityType: 'inventoryItem',
              entityId: matchingInv.id,
              operation: 'UPDATE',
              payload: {
                ...matchingInv,
                currentStock: newStock,
                updatedAt: nowIso,
              },
              deviceId,
              operationId: `sync-inv-snap-${matchingInv.id}`,
            });
          }
        }
      }
    }

    await db.pendingOrders.put(pendingRecord);

    await enqueueSyncItem({
      entityType: 'pendingOrder',
      entityId: orderId,
      operation: 'CREATE',
      payload: pendingRecord,
      deviceId,
      operationId: `sync-pending-${orderId}`,
    });
  });

  triggerSync();
  return pendingRecord;
}

/**
 * Fix #6: Approve Pending Order Idempotency.
 * Approving the same pending order twice results in ONE completed order,
 * ONE inventory deduction, ONE order synchronization.
 */
export async function approvePendingOrder(pending: PendingOrder): Promise<Order> {
  const deviceId = await getOrCreateDeviceId();
  const nowIso = new Date().toISOString();
  const approveDate = getBruneiDateString();
  const approveTime = getBruneiTimeString();

  let completedOrder: Order | null = null;

  await db.transaction('rw', [
    db.orders,
    db.orderItems,
    db.pendingOrders,
    db.inventory,
    db.inventoryLogs,
    db.inventoryMovements,
    db.syncQueue
  ], async () => {
    // 1. Check if already approved/existing in orders or status is already approved
    if (pending.status === 'approved') {
      const existing = await db.orders.get(pending.orderId);
      if (existing) {
        completedOrder = existing;
        return;
      }
    }

    const existingOrder = await db.orders.get(pending.orderId);
    if (existingOrder && !existingOrder.isDeleted) {
      await db.pendingOrders.delete(pending.orderId);
      completedOrder = existingOrder;
      return;
    }

    const extractedStaff = pending.staffName || (pending.source ? pending.source.replace(/^Staff\s*\((.*)\)$/i, '$1').replace(/[()]/g, '').trim() : 'Staff');
    const approvedPaymentType: PaymentMethod = pending.paymentType === 'Binti Gym Transfer' ? 'Cash' : pending.paymentType;

    // Deduct inventory only if not already deducted at checkout
    if (!pending.inventoryDeducted && pending.items && pending.items.length > 0) {
      const allInventory = await db.inventory.toArray();
      for (const it of pending.items) {
        if (!it.name) continue;
        const cleanName = it.name.toLowerCase().trim();
        const matchingInv = allInventory.find(inv => inv.productName.toLowerCase().trim() === cleanName);

        if (matchingInv) {
          const qtyToDeduct = Number(it.qty) || 1;
          const movementId = `sale-${pending.orderId}-${matchingInv.id}`;

          const existingMovement = await db.inventoryMovements.get(movementId);
          if (!existingMovement || !existingMovement.appliedLocally) {
            const newStock = Math.max(0, matchingInv.currentStock - qtyToDeduct);
            await db.inventory.update(matchingInv.id, { currentStock: newStock, updatedAt: nowIso });
            matchingInv.currentStock = newStock;

            const logId = `log-${movementId}`;
            await db.inventoryLogs.put({
              id: logId,
              timestamp: nowIso,
              date: approveDate,
              time: approveTime,
              productName: matchingInv.productName,
              type: 'sale',
              quantityChange: -qtyToDeduct,
              balanceAfter: newStock,
              reason: `Pending Order #${pending.orderId} Approved`,
              staffName: extractedStaff,
              createdAt: nowIso,
            });

            const movementRecord: InventoryMovement = {
              movementId,
              productId: matchingInv.id,
              productName: matchingInv.productName,
              quantityChange: -qtyToDeduct,
              type: 'sale',
              orderId: pending.orderId,
              deviceId,
              createdAt: nowIso,
              staffName: extractedStaff,
              reason: `Pending Order #${pending.orderId} Approved`,
              appliedLocally: true,
              syncedToFirestore: false,
            };
            await db.inventoryMovements.put(movementRecord);

            await enqueueSyncItem({
              entityType: 'inventoryMovement',
              entityId: movementId,
              operation: 'INVENTORY_MOVEMENT',
              payload: movementRecord,
              deviceId,
              operationId: `sync-mv-${movementId}`,
            });
          }
        }
      }
    }

    let subtotal = 0;
    const items: OrderItem[] = pending.items.map(it => {
      const addons: string[] = [];
      if (it.protein) addons.push('With Protein');
      if (it.oat) addons.push('With Oat');

      const addonStr = it.addonString || (addons.length > 0 ? addons.join(', ') : 'None');
      const lineTotal = it.lineTotal !== undefined 
        ? it.lineTotal 
        : ((it.price || 0) + (it.protein ? 2.0 : 0) + (it.oat ? 0.5 : 0)) * (it.qty || 1);
      subtotal += lineTotal;

      return {
        name: it.name,
        addonString: addonStr,
        qty: it.qty || 1,
        lineTotal,
        finalPrice: lineTotal,
      };
    });

    const finalSubtotal = subtotal > 0 ? subtotal : pending.totalAmount;

    completedOrder = {
      id: pending.id || pending.orderId,
      orderId: pending.orderId,
      date: approveDate,
      time: approveTime,
      originalSubmissionDate: pending.date,
      originalSubmissionTime: pending.time,
      paymentType: approvedPaymentType,
      subtotal: finalSubtotal,
      discountValue: Math.max(0, finalSubtotal - pending.totalAmount),
      totalAmount: pending.totalAmount || finalSubtotal,
      items,
      itemsSummary: pending.itemsSummary,
      staffName: extractedStaff,
      paymentReceivedDate: approveDate,
      paymentReceivedTime: approveTime,
      paymentReceivedAt: `${approveDate} ${approveTime}`,
      createdAt: nowIso,
      updatedAt: nowIso,
      deviceId,
      isDeleted: false,
    };

    await db.orders.put(completedOrder);
    await db.pendingOrders.delete(pending.orderId);

    // Save order items
    const orderItemsToSave: OrderItem[] = items.map((it, idx) => ({
      ...it,
      id: `${pending.orderId}-item-${idx}`,
      orderId: pending.orderId,
      createdAt: nowIso,
    }));
    await db.orderItems.bulkPut(orderItemsToSave);

    // Enqueue order creation & pending order deletion
    await enqueueSyncItem({
      entityType: 'order',
      entityId: pending.orderId,
      operation: 'CREATE',
      payload: completedOrder,
      deviceId,
      operationId: `sync-order-${pending.orderId}`,
    });

    await enqueueSyncItem({
      entityType: 'pendingOrder',
      entityId: pending.orderId,
      operation: 'DELETE',
      payload: { orderId: pending.orderId },
      deviceId,
      operationId: `sync-del-pending-${pending.orderId}`,
    });
  });

  triggerSync();
  return completedOrder!;
}

/**
 * Fix #6: Rejects a pending order and restores stock if previously deducted.
 * Atomic, deterministic, and idempotent.
 */
export async function rejectPendingOrder(orderId: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const nowIso = new Date().toISOString();

  await db.transaction('rw', [
    db.pendingOrders,
    db.inventory,
    db.inventoryLogs,
    db.inventoryMovements,
    db.syncQueue
  ], async () => {
    const pending = await db.pendingOrders.get(orderId);
    if (!pending || pending.status === 'rejected') return;

    const extractedStaff = pending.staffName || (pending.source ? pending.source.replace(/^Staff\s*\((.*)\)$/i, '$1').replace(/[()]/g, '').trim() : 'Staff');

    // Restore inventory if it was deducted
    if (pending.inventoryDeducted && pending.items && pending.items.length > 0) {
      const allInventory = await db.inventory.toArray();
      for (const it of pending.items) {
        if (!it.name) continue;
        const cleanName = it.name.toLowerCase().trim();
        const matchingInv = allInventory.find(inv => inv.productName.toLowerCase().trim() === cleanName);

        if (matchingInv) {
          const qtyToRestore = Number(it.qty) || 1;
          const movementId = `restore-${pending.orderId}-${matchingInv.id}`;

          const existingMovement = await db.inventoryMovements.get(movementId);
          if (!existingMovement || !existingMovement.appliedLocally) {
            const newStock = matchingInv.currentStock + qtyToRestore;
            await db.inventory.update(matchingInv.id, { currentStock: newStock, updatedAt: nowIso });
            matchingInv.currentStock = newStock;

            const logId = `log-${movementId}`;
            await db.inventoryLogs.put({
              id: logId,
              timestamp: nowIso,
              date: getBruneiDateString(),
              time: getBruneiTimeString(),
              productName: matchingInv.productName,
              type: 'restore',
              quantityChange: qtyToRestore,
              balanceAfter: newStock,
              reason: `Pending Order #${pending.orderId} Rejected - Stock Restored`,
              staffName: extractedStaff,
              createdAt: nowIso,
            });

            const movementRecord: InventoryMovement = {
              movementId,
              productId: matchingInv.id,
              productName: matchingInv.productName,
              quantityChange: qtyToRestore,
              type: 'restore',
              orderId: pending.orderId,
              deviceId,
              createdAt: nowIso,
              staffName: extractedStaff,
              reason: `Pending Order #${pending.orderId} Rejected`,
              appliedLocally: true,
              syncedToFirestore: false,
            };
            await db.inventoryMovements.put(movementRecord);

            await enqueueSyncItem({
              entityType: 'inventoryMovement',
              entityId: movementId,
              operation: 'INVENTORY_MOVEMENT',
              payload: movementRecord,
              deviceId,
              operationId: `sync-mv-${movementId}`,
            });
          }
        }
      }
    }

    await db.pendingOrders.delete(orderId);

    await enqueueSyncItem({
      entityType: 'pendingOrder',
      entityId: orderId,
      operation: 'DELETE',
      payload: { orderId },
      deviceId,
      operationId: `sync-del-pending-${orderId}`,
    });
  });

  triggerSync();
}

/**
 * Approves all pending orders in batch.
 */
export async function approveAllPendingOrders(): Promise<Order[]> {
  const allPending = await db.pendingOrders.toArray();
  const pendingToApprove = allPending.filter(p => !p.isDeleted);
  const approvedOrders: Order[] = [];

  for (const pending of pendingToApprove) {
    const approved = await approvePendingOrder(pending);
    approvedOrders.push(approved);
  }

  return approvedOrders;
}

/**
 * Records an Expense offline-first.
 */
export async function createExpense(expense: Expense): Promise<Expense> {
  const deviceId = await getOrCreateDeviceId();
  const id = expense.id || `exp-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const expenseRecord: Expense = {
    ...expense,
    id,
    createdAt: expense.createdAt || nowIso,
    updatedAt: nowIso,
    deviceId,
    isDeleted: false,
  };

  await db.transaction('rw', [db.expenses, db.syncQueue], async () => {
    await db.expenses.put(expenseRecord);

    await enqueueSyncItem({
      entityType: 'expense',
      entityId: id,
      operation: 'CREATE',
      payload: expenseRecord,
      deviceId,
      operationId: `sync-exp-${id}`,
    });
  });

  triggerSync();
  return expenseRecord;
}

/**
 * Deletes an Expense.
 */
export async function deleteExpense(id: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const existing = await db.expenses.get(id);

  await db.transaction('rw', [db.expenses, db.syncQueue], async () => {
    if (existing) {
      await db.expenses.update(id, { isDeleted: true, updatedAt: new Date().toISOString() });
    } else {
      await db.expenses.delete(id);
    }

    await enqueueSyncItem({
      entityType: 'expense',
      entityId: id,
      operation: 'DELETE',
      payload: { id },
      deviceId,
      operationId: `sync-del-exp-${id}`,
    });
  });

  triggerSync();
}

/**
 * Saves or updates a Product and keeps inventory reflecting the drink menu.
 */
export async function saveProduct(product: Product): Promise<Product> {
  const deviceId = await getOrCreateDeviceId();
  const id = product.id || `prod-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const todayStr = getBruneiDateString();

  const productRecord: Product = {
    ...product,
    id,
    updatedAt: nowIso,
    deviceId,
    isDeleted: false,
  };

  await db.transaction('rw', [db.products, db.inventory, db.syncQueue], async () => {
    await db.products.put(productRecord);

    await enqueueSyncItem({
      entityType: 'product',
      entityId: id,
      operation: 'UPDATE',
      payload: productRecord,
      deviceId,
      operationId: `sync-prod-${id}`,
    });

    // Ensure inventory item reflects this product
    const allInv = await db.inventory.toArray();
    const existingInv = allInv.find(inv =>
      inv.id === `inv-${id}` ||
      (product.id && inv.id === `inv-${product.id}`) ||
      inv.productName.toLowerCase().trim() === product.name.toLowerCase().trim()
    );

    // If an inventory item is already tracked for this product, keep its name in sync
    if (existingInv) {
      if (existingInv.productName !== product.name) {
        const updatedInvItem: InventoryItem = {
          ...existingInv,
          productName: product.name,
          updatedAt: nowIso,
        };
        await db.inventory.put(updatedInvItem);
        await enqueueSyncItem({
          entityType: 'inventoryItem',
          entityId: existingInv.id,
          operation: 'UPDATE',
          payload: updatedInvItem,
          deviceId,
          operationId: `sync-inv-name-${existingInv.id}-${Date.now()}`,
        });
      }
    }
    // Note: Do NOT auto-create inventory items when adding or editing drinks.
    // The inventory list remains clean and empty until the user explicitly adds items.
  });

  triggerSync();
  return productRecord;
}

/**
 * Deletes a Product and its corresponding inventory item.
 * If no products remain, inventory is also set to none.
 */
export async function deleteProduct(productId: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const existing = await db.products.get(productId);
  const nowIso = new Date().toISOString();

  await db.transaction('rw', [db.products, db.inventory, db.syncQueue], async () => {
    if (existing) {
      await db.products.update(productId, { isDeleted: true, updatedAt: nowIso });
    } else {
      await db.products.delete(productId);
    }

    await enqueueSyncItem({
      entityType: 'product',
      entityId: productId,
      operation: 'DELETE',
      payload: { id: productId },
      deviceId,
      operationId: `sync-del-prod-${productId}-${Date.now()}`,
    });

    // Remove matching inventory item
    const allInv = await db.inventory.toArray();
    const matchingInv = allInv.find(inv =>
      inv.id === `inv-${productId}` ||
      (existing && inv.productName.toLowerCase().trim() === existing.name.toLowerCase().trim())
    );

    if (matchingInv) {
      await db.inventory.delete(matchingInv.id);
      await enqueueSyncItem({
        entityType: 'inventoryItem',
        entityId: matchingInv.id,
        operation: 'DELETE',
        payload: { id: matchingInv.id },
        deviceId,
        operationId: `sync-del-inv-${matchingInv.id}-${Date.now()}`,
      });
    }

    // If there's no active menu items left, inventory must also be none!
    const allRemainingProducts = (await db.products.toArray()).filter(p => !p.isDeleted && p.id !== productId);
    if (allRemainingProducts.length === 0) {
      const remainingInv = await db.inventory.toArray();
      for (const item of remainingInv) {
        await db.inventory.delete(item.id);
        await enqueueSyncItem({
          entityType: 'inventoryItem',
          entityId: item.id,
          operation: 'DELETE',
          payload: { id: item.id },
          deviceId,
          operationId: `sync-del-inv-${item.id}-${Date.now()}`,
        });
      }
    }
  });

  triggerSync();
}

/**
 * Clears/deletes all products from menu so owner can start with a fresh slate.
 * Per user requirement: If there's no menu available, then inventory also should be none!
 */
export async function clearAllProducts(): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const allProducts = await db.products.toArray();
  const activeProducts = allProducts.filter(p => !p.isDeleted);
  const allInv = await db.inventory.toArray();
  const nowIso = new Date().toISOString();

  await db.transaction('rw', [db.products, db.inventory, db.syncQueue], async () => {
    for (const prod of activeProducts) {
      await db.products.update(prod.id, { isDeleted: true, updatedAt: nowIso });
      await enqueueSyncItem({
        entityType: 'product',
        entityId: prod.id,
        operation: 'DELETE',
        payload: { id: prod.id },
        deviceId,
        operationId: `sync-del-prod-${prod.id}-${Date.now()}`,
      });
    }

    // If there's no menu available, inventory also should be none!
    for (const item of allInv) {
      await db.inventory.delete(item.id);
      await enqueueSyncItem({
        entityType: 'inventoryItem',
        entityId: item.id,
        operation: 'DELETE',
        payload: { id: item.id },
        deviceId,
        operationId: `sync-del-inv-${item.id}-${Date.now()}`,
      });
    }
  });

  triggerSync();
}

/**
 * Reconciles inventory items with the active terminal drink menu.
 * Rules:
 * 1. If there's no menu available (0 products), inventory MUST be none!
 * 2. If menu exists, DO NOT auto-generate synthetic inventory items with default stock!
 *    The inventory list remains empty until the user explicitly adds an item.
 * 3. Purges any legacy auto-generated synthetic inventory items (identified by isLegacySyntheticInventoryId)
 *    and removes orphan items whose menu drink was deleted.
 */
export async function reconcileInventoryWithProducts(activeProducts: Product[]): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const productsList = (activeProducts || []).filter(p => !p.isDeleted);
  const allInventory = await db.inventory.toArray();

  // Rule 1: If there's no menu available (0 products), inventory MUST be none!
  if (productsList.length === 0) {
    if (allInventory.length > 0) {
      await db.transaction('rw', [db.inventory, db.syncQueue], async () => {
        for (const item of allInventory) {
          await db.inventory.delete(item.id);
          await enqueueSyncItem({
            entityType: 'inventoryItem',
            entityId: item.id,
            operation: 'DELETE',
            payload: { id: item.id },
            deviceId,
            operationId: `sync-del-inv-${item.id}-${Date.now()}`,
          });
        }
      });
      triggerSync();
    }
    return;
  }

  // Rule 2: Clean up confirmed legacy synthetic inventory items,
  // and remove orphans whose drinks were deleted from the Drink Menu.
  const menuNames = new Set(productsList.map(p => p.name.toLowerCase().trim()));
  const syntheticItems = allInventory.filter(inv => isLegacySyntheticInventoryId(inv.id));
  const orphanItems = allInventory.filter(inv =>
    !isLegacySyntheticInventoryId(inv.id) &&
    !menuNames.has(inv.productName.toLowerCase().trim())
  );

  const itemsToDeleteMap = new Map<string, InventoryItem>();
  syntheticItems.forEach(i => itemsToDeleteMap.set(i.id, i));
  orphanItems.forEach(i => itemsToDeleteMap.set(i.id, i));
  const itemsToDelete = Array.from(itemsToDeleteMap.values());

  if (itemsToDelete.length === 0) {
    return;
  }

  const storeId = await getStoreId();
  await db.transaction('rw', [db.inventory, db.syncQueue], async () => {
    for (const item of itemsToDelete) {
      await db.inventory.delete(item.id);
      await enqueueSyncItem({
        entityType: 'inventoryItem',
        entityId: item.id,
        operation: 'DELETE',
        payload: { id: item.id },
        deviceId,
        operationId: `sync-del-inv-${item.id}-${Date.now()}`,
      });
    }
  });

  // Physically delete from Firestore directly
  for (const item of itemsToDelete) {
    try {
      await deleteDoc(doc(firestoreDb, 'stores', storeId, 'inventory', item.id));
    } catch {}
  }

  triggerSync();
}

/**
 * Deletes an order from sales history.
 */
export async function deleteOrder(orderId: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const existing = await db.orders.get(orderId);

  await db.transaction('rw', [db.orders, db.syncQueue], async () => {
    if (existing) {
      await db.orders.update(orderId, { isDeleted: true, updatedAt: new Date().toISOString() });
    } else {
      await db.orders.delete(orderId);
    }

    await enqueueSyncItem({
      entityType: 'order',
      entityId: orderId,
      operation: 'DELETE',
      payload: { orderId },
      deviceId,
      operationId: `sync-del-order-${orderId}`,
    });
  });

  triggerSync();
}

/**
 * Clears all sales history.
 */
export async function clearAllOrders(): Promise<void> {
  const orders = await db.orders.toArray();
  for (const o of orders) {
    await deleteOrder(o.orderId);
  }
}

/**
 * Saves or updates a Staff Shift.
 */
export async function saveShift(shift: StaffShift): Promise<StaffShift> {
  const deviceId = await getOrCreateDeviceId();
  const id = shift.id || `shift-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const shiftRecord: StaffShift = {
    ...shift,
    id,
    createdAt: shift.createdAt || nowIso,
    updatedAt: nowIso,
    deviceId,
  };

  await db.transaction('rw', [db.shifts, db.syncQueue], async () => {
    await db.shifts.put(shiftRecord);

    await enqueueSyncItem({
      entityType: 'shift',
      entityId: id,
      operation: 'UPDATE',
      payload: shiftRecord,
      deviceId,
      operationId: `sync-shift-${id}`,
    });
  });

  triggerSync();
  return shiftRecord;
}

/**
 * Deletes a single shift record by ID (Admin).
 */
export async function deleteShift(id: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  await db.transaction('rw', [db.shifts, db.syncQueue], async () => {
    await db.shifts.delete(id);
    await enqueueSyncItem({
      entityType: 'shift',
      entityId: id,
      operation: 'DELETE',
      payload: { id },
      deviceId,
      operationId: `sync-del-shift-${id}-${Date.now()}`,
    });
  });
  triggerSync();
}

/**
 * Clears all staff shifts (Admin).
 */
export async function clearAllShifts(): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const all = await db.shifts.toArray();
  await db.transaction('rw', [db.shifts, db.syncQueue], async () => {
    await db.shifts.clear();
    for (const s of all) {
      await enqueueSyncItem({
        entityType: 'shift',
        entityId: s.id,
        operation: 'DELETE',
        payload: { id: s.id },
        deviceId,
        operationId: `sync-del-shift-${s.id}`,
      });
    }
  });
  triggerSync();
}

/**
 * Saves Monthly Distribution configuration.
 */
export async function saveDistribution(config: MonthlyDistributionConfig): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const nowIso = new Date().toISOString();

  const distRecord: MonthlyDistributionConfig = {
    ...config,
    updatedAt: nowIso,
    deviceId,
  };

  await db.transaction('rw', [db.distributions, db.syncQueue], async () => {
    await db.distributions.put(distRecord);

    await enqueueSyncItem({
      entityType: 'distribution',
      entityId: config.month,
      operation: 'UPDATE',
      payload: distRecord,
      deviceId,
      operationId: `sync-dist-${config.month}`,
    });
  });

  triggerSync();
}

/**
 * Deletes an individual inventory log entry.
 */
export async function deleteInventoryLog(logId: string): Promise<void> {
  await db.inventoryLogs.delete(logId);
}

/**
 * Deletes multiple inventory log entries by their IDs.
 */
export async function deleteInventoryLogsBulk(logIds: string[]): Promise<void> {
  await db.inventoryLogs.bulkDelete(logIds);
}

/**
 * Clears all inventory logs and movement history.
 */
export async function clearAllInventoryLogsAndMovements(): Promise<void> {
  await db.transaction('rw', [db.inventoryLogs, db.inventoryMovements], async () => {
    await db.inventoryLogs.clear();
    await db.inventoryMovements.clear();
  });
}

/**
 * Resets local database to default initial data.
 */
export async function resetDatabaseToDefaults(): Promise<void> {
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
    db.inventoryMovements,
    db.syncQueue
  ], async () => {
    await db.orders.clear();
    await db.orderItems.clear();
    await db.expenses.clear();
    await db.pendingOrders.clear();
    await db.shifts.clear();
    await db.inventoryLogs.clear();
    await db.inventoryMovements.clear();
    await db.syncQueue.clear();

    await db.products.clear();
    await db.products.bulkPut(INITIAL_PRODUCTS);

    await db.inventory.clear();
    await db.inventory.bulkPut(DEFAULT_INVENTORY);

    const currentMonth = getBruneiDateString().substring(0, 7);
    await db.distributions.clear();
    await db.distributions.put(getDefaultMonthlyDistribution(currentMonth));
  });
}
