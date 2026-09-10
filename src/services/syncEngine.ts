import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db as firestoreDb, ensureAuth, auth, subscribeToAuth } from '../lib/firebase';
import { db as localDb } from '../db/db';
import {
  getPendingSyncItems,
  markItemProcessing,
  markItemCompleted,
  markItemFailed,
  getPendingSyncCount,
  recoverStaleProcessingItems
} from '../db/repositories/syncQueueRepo';
import { getStoreId, getStorePin } from '../db/repositories/appSettingsRepo';
import { applyRemoteInventoryMovement } from './inventoryService';
import { connectivityService } from './connectivityService';
import { isLegacySyntheticInventoryId } from '../data/initialData';
import {
  Product,
  Order,
  OrderItem,
  Expense,
  PendingOrder,
  InventoryItem,
  InventoryMovement,
  StaffShift,
  MonthlyDistributionConfig,
  SyncQueueItem
} from '../types';

let isSyncing = false;
let syncTimeout: any = null;
let activeListeners: Unsubscribe[] = [];
let currentSubscribedStoreId: string | null = null;

/**
 * Triggers an immediate sync cycle in the background with debouncing.
 */
export function triggerSync(): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
  syncTimeout = setTimeout(() => {
    runSyncCycle().catch(err => {
      console.warn('[SyncEngine] Sync cycle error:', err);
    });
  }, 100);
}

/**
 * Executes a full sync push cycle with single-flight locking (Web Locks API + in-memory mutex).
 */
export async function runSyncCycle(): Promise<{ success: boolean; pushedCount: number; errors: number }> {
  // If Web Locks API is available, acquire non-blocking lock to prevent cross-tab / race conditions
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks?.request) {
    return new Promise((resolve) => {
      navigator.locks.request('hershe_pos_sync_worker_lock', { ifAvailable: true }, async (lock) => {
        if (!lock) {
          // Another sync process holds the lock
          resolve({ success: false, pushedCount: 0, errors: 0 });
          return;
        }
        const result = await executeSyncInternal();
        resolve(result);
      }).catch(() => {
        executeSyncInternal().then(resolve);
      });
    });
  }

  return await executeSyncInternal();
}

async function executeSyncInternal(): Promise<{ success: boolean; pushedCount: number; errors: number }> {
  if (isSyncing) {
    return { success: false, pushedCount: 0, errors: 0 };
  }

  // Fix #7: Recover any stale processing operations before beginning
  await recoverStaleProcessingItems();

  const pendingCount = await getPendingSyncCount();
  connectivityService.updatePendingCount(pendingCount);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    connectivityService.updateState('OFFLINE', pendingCount);
    return { success: false, pushedCount: 0, errors: 0 };
  }

  isSyncing = true;
  connectivityService.updateState(pendingCount > 0 ? 'SYNCING' : 'ONLINE', pendingCount);

  let pushedCount = 0;
  let errors = 0;

  try {
    const authUser = await ensureAuth();
    if (!authUser) {
      console.warn('[SyncEngine] Awaiting authentication credentials...');
    }

    const storeId = await getStoreId();
    const items = await getPendingSyncItems(50);

    for (const item of items) {
      try {
        await markItemProcessing(item.operationId);
        await syncSingleItemToFirestore(storeId, item);
        await markItemCompleted(item.operationId);
        pushedCount++;
      } catch (err: any) {
        errors++;
        console.warn(`[SyncEngine] Failed syncing item ${item.operationId}:`, err);
        const errMsg = err?.message || String(err);
        await markItemFailed(item.operationId, errMsg);
      }
    }

    const remaining = await getPendingSyncCount();
    connectivityService.updatePendingCount(remaining);

    if (errors > 0 && remaining > 0) {
      connectivityService.updateState('ERROR', remaining);
    } else if (remaining === 0) {
      connectivityService.updateState('SYNCED', 0);
    } else {
      connectivityService.updateState('ONLINE', remaining);
    }

    return { success: errors === 0, pushedCount, errors };
  } catch (globalErr: any) {
    console.warn('[SyncEngine] Global sync error:', globalErr);
    const count = await getPendingSyncCount();
    connectivityService.updateState('ERROR', count);
    return { success: false, pushedCount, errors: errors + 1 };
  } finally {
    isSyncing = false;
  }
}

/**
 * Pushes a single item from the sync queue to Firestore.
 * Completely idempotent: ONE entityId = ONE Firestore document at /stores/{storeId}/{collection}/{entityId}.
 */
async function syncSingleItemToFirestore(storeId: string, item: SyncQueueItem): Promise<void> {
  const collectionName = getCollectionNameForEntity(item.entityType);
  if (!collectionName) {
    throw new Error(`Unknown entity type: ${item.entityType}`);
  }

  const docRef = doc(firestoreDb, 'stores', storeId, collectionName, item.entityId);

  if (item.operation === 'DELETE') {
    await setDoc(docRef, { isDeleted: true, updatedAt: new Date().toISOString() }, { merge: true });
    if (item.entityType === 'inventoryItem' || item.entityType === 'inventoryMovement') {
      try {
        await deleteDoc(docRef);
      } catch {}
    }
    return;
  }

  // Sanitize payload for Firestore
  const cleanPayload = JSON.parse(JSON.stringify(item.payload));
  cleanPayload.updatedAt = cleanPayload.updatedAt || new Date().toISOString();
  cleanPayload.lastSyncedAt = new Date().toISOString();

  await setDoc(docRef, cleanPayload, { merge: true });

  // Update store meta info timestamp only for authenticated staff/admin sessions
  if (auth.currentUser) {
    try {
      const storePin = await getStorePin();
      const metaRef = doc(firestoreDb, 'stores', storeId, 'meta', 'info');
      await setDoc(metaRef, { storeId, storePin, lastActivityAt: new Date().toISOString() }, { merge: true });
    } catch {
      // Non-blocking
    }
  }
}

function getCollectionNameForEntity(entityType: string): string | null {
  switch (entityType) {
    case 'order': return 'orders';
    case 'product': return 'products';
    case 'expense': return 'expenses';
    case 'pendingOrder': return 'pendingOrders';
    case 'inventoryMovement': return 'inventoryMovements';
    case 'inventoryItem': return 'inventory';
    case 'shift': return 'shifts';
    case 'distribution': return 'distributions';
    default: return null;
  }
}

/**
 * Initializes real-time listener streams from Firestore subcollections.
 * Inbound remote changes are merged into IndexedDB without wiping local state.
 */
export async function startRealtimeSync(storeIdentifier?: string): Promise<void> {
  const storeId = storeIdentifier 
    ? (storeIdentifier.startsWith('store_') ? storeIdentifier : `store_${storeIdentifier}`)
    : await getStoreId();

  if (currentSubscribedStoreId === storeId && activeListeners.length > 0) {
    return;
  }

  stopRealtimeSync();
  currentSubscribedStoreId = storeId;

  try {
    await ensureAuth();

    // 1. Products listener
    const prodCol = collection(firestoreDb, 'stores', storeId, 'products');
    const unsubProd = onSnapshot(prodCol, async (snapshot) => {
      // Process deletions from snapshot docChanges
      for (const change of snapshot.docChanges()) {
        const changeData = change.doc.data() as any;
        if (change.type === 'removed' || changeData?.isDeleted) {
          await localDb.products.update(change.doc.id, { isDeleted: true, updatedAt: new Date().toISOString() });
        }
      }

      const remoteProducts: Product[] = [];
      snapshot.forEach(d => {
        const data = d.data() as Product;
        if (!data.id) data.id = d.id;
        remoteProducts.push(data);
      });
      if (remoteProducts.length > 0) {
        await localDb.transaction('rw', localDb.products, async () => {
          for (const rp of remoteProducts) {
            const local = await localDb.products.get(rp.id);
            if (!local || !local.updatedAt || (rp.updatedAt && rp.updatedAt >= local.updatedAt)) {
              await localDb.products.put(rp);
            }
          }
        });
      }
    }, (err) => console.warn('[SyncEngine] Products listener error:', err));
    activeListeners.push(unsubProd);

    const isAuthUser = Boolean(auth.currentUser);

    // 2. Orders listener (Private store subcollection - requires authenticated member session)
    if (isAuthUser) {
      const ordersCol = collection(firestoreDb, 'stores', storeId, 'orders');
      const unsubOrders = onSnapshot(ordersCol, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const changeData = change.doc.data() as any;
          if (change.type === 'removed' || changeData?.isDeleted) {
            await localDb.orders.delete(change.doc.id);
          }
        }

        const remoteOrders: Order[] = [];
        snapshot.forEach(d => {
          const data = d.data() as any;
          if (!data.orderId) data.orderId = d.id;
          if (!data.id) data.id = d.id;
          if (!data.isDeleted) {
            remoteOrders.push(data as Order);
          }
        });
        if (remoteOrders.length > 0) {
          await localDb.transaction('rw', [localDb.orders, localDb.orderItems], async () => {
            for (const ro of remoteOrders) {
              const local = await localDb.orders.get(ro.orderId);
              if (!local || !local.updatedAt || (ro.updatedAt && ro.updatedAt >= local.updatedAt)) {
                await localDb.orders.put(ro);
                if (ro.items && ro.items.length > 0) {
                  const itemsToSave: OrderItem[] = ro.items.map((it, idx) => ({
                    ...it,
                    id: `${ro.orderId}-item-${idx}`,
                    orderId: ro.orderId,
                    createdAt: ro.createdAt || new Date().toISOString(),
                  }));
                  await localDb.orderItems.bulkPut(itemsToSave);
                }
              }
            }
          });
        }
      }, (err) => console.warn('[SyncEngine] Orders listener error:', err));
      activeListeners.push(unsubOrders);

      // 3. Expenses listener (Private store subcollection)
      const expensesCol = collection(firestoreDb, 'stores', storeId, 'expenses');
      const unsubExpenses = onSnapshot(expensesCol, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const changeData = change.doc.data() as any;
          if (change.type === 'removed' || changeData?.isDeleted) {
            await localDb.expenses.delete(change.doc.id);
          }
        }

        const remoteExpenses: Expense[] = [];
        snapshot.forEach(d => {
          const data = d.data() as any;
          if (!data.id) data.id = d.id;
          if (!data.isDeleted) {
            remoteExpenses.push(data as Expense);
          }
        });
        if (remoteExpenses.length > 0) {
          await localDb.transaction('rw', localDb.expenses, async () => {
            for (const re of remoteExpenses) {
              const local = await localDb.expenses.get(re.id);
              if (!local || !local.updatedAt || (re.updatedAt && re.updatedAt >= local.updatedAt)) {
                await localDb.expenses.put(re);
              }
            }
          });
        }
      }, (err) => console.warn('[SyncEngine] Expenses listener error:', err));
      activeListeners.push(unsubExpenses);
    }

    // 4. Pending Orders listener
    const pendingCol = collection(firestoreDb, 'stores', storeId, 'pendingOrders');
    const unsubPending = onSnapshot(pendingCol, async (snapshot) => {
      const remotePending: PendingOrder[] = [];
      snapshot.forEach(d => {
        const data = d.data() as PendingOrder;
        if (!data.orderId) data.orderId = d.id;
        if (!data.id) data.id = d.id;
        remotePending.push(data);
      });
      if (remotePending.length > 0) {
        await localDb.transaction('rw', localDb.pendingOrders, async () => {
          for (const rp of remotePending) {
            if (rp.isDeleted) {
              await localDb.pendingOrders.delete(rp.orderId);
            } else {
              const local = await localDb.pendingOrders.get(rp.orderId);
              if (!local || !local.updatedAt || (rp.updatedAt && rp.updatedAt >= local.updatedAt)) {
                await localDb.pendingOrders.put(rp);
              }
            }
          }
        });
      }
    }, (err) => console.warn('[SyncEngine] PendingOrders listener error:', err));
    activeListeners.push(unsubPending);

    // 5. Inventory Movements listener (Movement-based conflict resolution)
    const movementsCol = collection(firestoreDb, 'stores', storeId, 'inventoryMovements');
    const unsubMovements = onSnapshot(movementsCol, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const movement = change.doc.data() as InventoryMovement;
          if (!movement.movementId) movement.movementId = change.doc.id;
          await applyRemoteInventoryMovement(movement);
        }
      });
    }, (err) => console.warn('[SyncEngine] Movements listener error:', err));
    activeListeners.push(unsubMovements);

    // 6. Inventory Items listener: Merges items and live stock levels from Firestore
    const invCol = collection(firestoreDb, 'stores', storeId, 'inventory');
    const unsubInv = onSnapshot(invCol, async (snapshot) => {
      // Process deletions from snapshot docChanges
      for (const change of snapshot.docChanges()) {
        const changeData = change.doc.data() as any;
        if (change.type === 'removed' || changeData?.isDeleted) {
          await localDb.inventory.delete(change.doc.id);
        }
      }

      const remoteInv: InventoryItem[] = [];
      snapshot.forEach(d => {
        const data = d.data() as any;
        if (!data.id) data.id = d.id;

        const isLegacy = isLegacySyntheticInventoryId(data.id) ||
          (data.currentStock === 20 && data.lastRestockedQty === 20 && data.unit === 'bottles' && !data.id.startsWith('inv-manual-'));

        if (data.isDeleted || isLegacy) {
          localDb.inventory.delete(data.id).catch(() => {});
          if (isLegacy) {
            deleteDoc(doc(firestoreDb, 'stores', storeId, 'inventory', data.id)).catch(() => {});
          }
          return;
        }

        remoteInv.push(data as InventoryItem);
      });
      if (remoteInv.length > 0) {
        await localDb.transaction('rw', localDb.inventory, async () => {
          for (const ri of remoteInv) {
            const local = await localDb.inventory.get(ri.id);
            if (!local) {
              // Check if a local item exists with the exact same product name
              const allLocal = await localDb.inventory.toArray();
              const matchedByName = allLocal.find(
                it => it.productName.toLowerCase().trim() === ri.productName.toLowerCase().trim()
              );
              if (matchedByName && matchedByName.id !== ri.id) {
                await localDb.inventory.delete(matchedByName.id);
              }
              await localDb.inventory.put(ri);
            } else if (!local.updatedAt || (ri.updatedAt && ri.updatedAt >= local.updatedAt)) {
              // Update metadata AND authoritative currentStock from Firestore
              await localDb.inventory.put({
                ...local,
                productName: ri.productName || local.productName,
                currentStock: ri.currentStock !== undefined ? Number(ri.currentStock) : local.currentStock,
                unit: ri.unit || local.unit,
                lowStockThreshold: ri.lowStockThreshold ?? local.lowStockThreshold,
                costPerUnit: ri.costPerUnit ?? local.costPerUnit,
                lastRestockedDate: ri.lastRestockedDate || local.lastRestockedDate,
                lastRestockedQty: ri.lastRestockedQty ?? local.lastRestockedQty,
                updatedAt: ri.updatedAt || new Date().toISOString(),
              });
            }
          }
        });
      }
    }, (err) => console.warn('[SyncEngine] Inventory listener error:', err));
    activeListeners.push(unsubInv);

    // 7. Shifts listener (Private store subcollection)
    if (isAuthUser) {
      const shiftsCol = collection(firestoreDb, 'stores', storeId, 'shifts');
      const unsubShifts = onSnapshot(shiftsCol, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const changeData = change.doc.data() as any;
          if (change.type === 'removed' || changeData?.isDeleted) {
            await localDb.shifts.delete(change.doc.id);
          }
        }

        const remoteShifts: StaffShift[] = [];
        snapshot.forEach(d => {
          const data = d.data() as any;
          if (!data.id) data.id = d.id;
          if (!data.isDeleted) {
            remoteShifts.push(data as StaffShift);
          }
        });
        if (remoteShifts.length > 0) {
          await localDb.transaction('rw', localDb.shifts, async () => {
            for (const rs of remoteShifts) {
              const local = await localDb.shifts.get(rs.id);
              if (!local || !local.updatedAt || (rs.updatedAt && rs.updatedAt >= local.updatedAt)) {
                await localDb.shifts.put(rs);
              }
            }
          });
        }
      }, (err) => console.warn('[SyncEngine] Shifts listener error:', err));
      activeListeners.push(unsubShifts);

      // 8. Distributions listener (Private store subcollection)
      const distCol = collection(firestoreDb, 'stores', storeId, 'distributions');
      const unsubDist = onSnapshot(distCol, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const changeData = change.doc.data() as any;
          if (change.type === 'removed' || changeData?.isDeleted) {
            await localDb.distributions.delete(change.doc.id);
          }
        }

        const remoteDist: MonthlyDistributionConfig[] = [];
        snapshot.forEach(d => {
          const data = d.data() as any;
          if (!data.month) data.month = d.id;
          if (!data.isDeleted) {
            remoteDist.push(data as MonthlyDistributionConfig);
          }
        });
        if (remoteDist.length > 0) {
          await localDb.transaction('rw', localDb.distributions, async () => {
            for (const rd of remoteDist) {
              const local = await localDb.distributions.get(rd.month);
              if (!local || !local.updatedAt || (rd.updatedAt && rd.updatedAt >= local.updatedAt)) {
                await localDb.distributions.put(rd);
              }
            }
          });
        }
      }, (err) => console.warn('[SyncEngine] Distributions listener error:', err));
      activeListeners.push(unsubDist);
    }

    // 9. Real-time Store Settings (Store Info, Addons, Pre-order Open/Close)
    const settingsDocRef = doc(firestoreDb, 'stores', storeId, 'meta', 'settings');
    const unsubSettings = onSnapshot(settingsDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data?.storeInfo && typeof data.storeInfo === 'object') {
          const key = 'hershe_store_info_settings';
          const updateIso = data.updatedAt || new Date().toISOString();
          await localDb.appSettings.put({
            key,
            value: data.storeInfo,
            updatedAt: updateIso,
          });
          localStorage.setItem(key, JSON.stringify(data.storeInfo));
        }
      }
    }, (err) => console.warn('[SyncEngine] Store settings listener error:', err));
    activeListeners.push(unsubSettings);

    // 10. Fallback listener for meta/info
    const infoDocRef = doc(firestoreDb, 'stores', storeId, 'meta', 'info');
    const unsubInfo = onSnapshot(infoDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data && data.isPreOrderOpen !== undefined) {
          const key = 'hershe_store_info_settings';
          const existing = (await localDb.appSettings.get(key))?.value || {};
          if (existing.isPreOrderOpen !== data.isPreOrderOpen) {
            const merged = { ...existing, isPreOrderOpen: data.isPreOrderOpen };
            await localDb.appSettings.put({
              key,
              value: merged,
              updatedAt: new Date().toISOString(),
            });
            localStorage.setItem(key, JSON.stringify(merged));
          }
        }
      }
    }, (err) => console.warn('[SyncEngine] Store info listener error:', err));
    activeListeners.push(unsubInfo);

  } catch (initErr) {
    console.warn('[SyncEngine] Failed setting up realtime listeners:', initErr);
  }
}

/**
 * Stops all active Firestore listeners.
 */
export function stopRealtimeSync(): void {
  activeListeners.forEach(unsub => {
    try { unsub(); } catch {}
  });
  activeListeners = [];
  currentSubscribedStoreId = null;
}

// Automatically start continuous sync periodic timer and lifecycle event listeners
if (typeof window !== 'undefined') {
  // Re-sync on auth state changes (e.g. Google Login/Logout)
  subscribeToAuth((user) => {
    if (user && currentSubscribedStoreId) {
      startRealtimeSync(currentSubscribedStoreId);
    }
  });

  // Re-sync on network connection restored
  window.addEventListener('online', () => {
    triggerSync();
    if (currentSubscribedStoreId) {
      startRealtimeSync(currentSubscribedStoreId);
    }
  });

  // Re-sync on tab/window focus
  window.addEventListener('focus', () => {
    triggerSync();
  });

  // Re-sync when tab becomes visible after backgrounding
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerSync();
      if (currentSubscribedStoreId && activeListeners.length === 0) {
        startRealtimeSync(currentSubscribedStoreId);
      }
    }
  });

  // Continuous background heartbeat: sync every 10 seconds if online
  setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      getPendingSyncCount().then(count => {
        if (count > 0) {
          triggerSync();
        }
      });
    }
  }, 10000);
}
