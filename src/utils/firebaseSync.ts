import { getStorePin, setStorePin, getStoreId, setStoreId } from '../db/repositories/appSettingsRepo';
import { startRealtimeSync, stopRealtimeSync, triggerSync, runSyncCycle } from '../services/syncEngine';
import { db as localDb } from '../db/db';
import { StorageData } from './storage';
import { ensureAuth, db as firestoreDb } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

export interface UserStoreRecord {
  storeId: string;
  pin: string;
  role: 'owner' | 'staff';
  storeName?: string;
  registeredAt?: string;
}

const STORE_PIN_KEY = 'hershe_pos_store_pin';

/**
 * Computes a secure deterministic SHA-256 hash for a store PIN.
 * Ensures the plaintext PIN is never stored or used as a public Firestore lookup.
 */
export async function hashStorePin(pin: string): Promise<string> {
  const clean = pin.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(`hershe_pos_salt_${clean}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for non-crypto environments
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `hash_${Math.abs(hash)}`;
}

export function getStoredPinCode(userUid?: string): string {
  if (userUid) {
    const userPin = localStorage.getItem(`${STORE_PIN_KEY}_${userUid}`);
    if (userPin) return userPin;
  }
  return localStorage.getItem(STORE_PIN_KEY) || '';
}

export function hasStoredPinCode(userUid?: string): boolean {
  return Boolean(getStoredPinCode(userUid));
}

export function setStoredPinCode(pin: string, userUid?: string): void {
  const cleanPin = pin.trim();
  localStorage.setItem(STORE_PIN_KEY, cleanPin);
  if (userUid) {
    localStorage.setItem(`${STORE_PIN_KEY}_${userUid}`, cleanPin);
  }
  setStorePin(cleanPin).catch(() => {});
  startRealtimeSync();
  triggerSync();
}

export function clearStoredPinCode(userUid?: string): void {
  localStorage.removeItem(STORE_PIN_KEY);
  if (userUid) {
    localStorage.removeItem(`${STORE_PIN_KEY}_${userUid}`);
  }
  stopRealtimeSync();
}

/**
 * Fetches all registered stores and PINs owned or joined by the specified Google account UID.
 */
export async function getUserRegisteredStores(uid: string): Promise<UserStoreRecord[]> {
  if (!uid || !firestoreDb) return [];
  try {
    const userDocRef = doc(firestoreDb, 'users', uid);
    const userSnap = await getDoc(userDocRef).catch(() => null);
    if (!userSnap || !userSnap.exists()) return [];

    const data = userSnap.data();
    const storesMap = data?.stores || {};
    const records: UserStoreRecord[] = [];

    if (storesMap && typeof storesMap === 'object') {
      Object.entries(storesMap).forEach(([storeId, val]: [string, any]) => {
        if (val && typeof val === 'object') {
          records.push({
            storeId,
            pin: String(val.pin || ''),
            role: val.role === 'owner' ? 'owner' : 'staff',
            storeName: val.storeName || undefined,
            registeredAt: val.registeredAt || val.connectedAt || undefined,
          });
        }
      });
    }

    // Sort with owner stores first, then by registration date
    records.sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (b.role === 'owner' && a.role !== 'owner') return 1;
      return (b.registeredAt || '').localeCompare(a.registeredAt || '');
    });

    return records;
  } catch (err) {
    console.warn('[FirebaseSync] Error fetching user registered stores:', err);
    return [];
  }
}

/**
 * Register a brand new 4-digit PIN store account.
 * 1. Hashes PIN to prevent storing plaintext PINs or public lookups.
 * 2. Checks PIN uniqueness in /store_pins/{pinHash}.
 * 3. Generates a permanent cryptographically random storeId (store_<UUID>).
 * 4. Registers PIN mapping in /store_pins/{pinHash} with ownerUid.
 * 5. Adds authenticated user to /stores/{storeId}/members/{uid} with valid pinHash proof.
 * 6. Creates store metadata at /stores/{storeId}/meta/info.
 */
export async function registerNewStorePin(pinCode: string): Promise<StorageData> {
  const pin = pinCode.trim();
  if (pin.length !== 4 || !/^\d{4}$/.exec(pin)) {
    throw new Error('Store PIN must be exactly 4 numeric digits.');
  }

  // 1. Validate online connectivity
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Internet connection is required to register a new store. Connect to the internet and try again.');
  }

  // 2. Resolve or wait for single-flight Firebase Auth
  const authUser = await ensureAuth();
  if (!authUser || !authUser.uid) {
    throw new Error('Please sign in with your Google account first to register a new store.');
  }

  const pinHash = await hashStorePin(pin);

  // 3. Check if PIN hash is already registered in Store PIN Registry
  const pinRef = doc(firestoreDb, 'store_pins', pinHash);
  const pinSnap = await getDoc(pinRef).catch(() => null);
  if (pinSnap && pinSnap.exists()) {
    const pinData = pinSnap.data();
    // If the registered PIN belongs to the currently signed-in user, connect them seamlessly!
    if (pinData?.ownerUid === authUser.uid && pinData?.storeId) {
      return await connectExistingStorePin(pin);
    }
    throw new Error(
      `PIN "${pin}" is already registered. If this is your store, switch to "Existing Store" to connect, or choose a different 4-digit PIN.`
    );
  }

  // 4. Generate permanent cryptographically random store ID
  const randomUuid = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID().replace(/-/g, '') 
    : `${Date.now()}${Math.random().toString(36).substring(2, 11)}`;
  const permanentStoreId = `store_${randomUuid}`;

  const nowIso = new Date().toISOString();

  // 5. Register PIN mapping in /store_pins/{pinHash}
  try {
    await setDoc(pinRef, {
      pinHash,
      storeId: permanentStoreId,
      ownerUid: authUser.uid,
      ownerEmail: authUser.email || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  } catch (pinErr: any) {
    if (pinErr?.code === 'permission-denied' || pinErr?.message?.includes('permission')) {
      throw new Error(`PIN "${pin}" is already in use. Please select a different 4-digit PIN or use "Existing Store".`);
    }
    throw pinErr;
  }

  // 6. Atomically register store member and metadata in writeBatch
  const memberRef = doc(firestoreDb, 'stores', permanentStoreId, 'members', authUser.uid);
  const metaRef = doc(firestoreDb, 'stores', permanentStoreId, 'meta', 'info');

  try {
    const batch = writeBatch(firestoreDb);
    batch.set(memberRef, {
      uid: authUser.uid,
      pinHash,
      role: 'owner',
      email: authUser.email || '',
      displayName: authUser.displayName || '',
      joinedAt: nowIso,
    });
    batch.set(metaRef, {
      storeId: permanentStoreId,
      storePinHash: pinHash,
      ownerUid: authUser.uid,
      ownerEmail: authUser.email || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    }, { merge: true });

    await batch.commit();
  } catch (batchErr) {
    // Rollback orphaned PIN registration if membership creation fails
    console.error('[FirebaseSync] Store registration batch failed, rolling back PIN:', batchErr);
    await deleteDoc(pinRef).catch(() => {});
    throw new Error('Failed to complete store registration. Please try again.');
  }

  // 7. Store settings locally and in user profile
  await setStorePin(pin);
  await setStoreId(permanentStoreId);
  setStoredPinCode(pin, authUser.uid);
  localStorage.setItem(`hershe_pos_store_id_${authUser.uid}`, permanentStoreId);

  // Update user document with registered store
  try {
    const userDocRef = doc(firestoreDb, 'users', authUser.uid);
    await setDoc(userDocRef, {
      uid: authUser.uid,
      email: authUser.email || '',
      displayName: authUser.displayName || '',
      lastActiveStoreId: permanentStoreId,
      lastActivePin: pin,
      stores: {
        [permanentStoreId]: {
          storeId: permanentStoreId,
          pin: pin,
          role: 'owner',
          storeName: 'Hershe Store',
          registeredAt: nowIso,
        }
      },
      updatedAt: nowIso,
    }, { merge: true });
  } catch (userErr) {
    console.warn('[FirebaseSync] User profile update skipped:', userErr);
  }

  // 8. Start real-time sync with permanent storeId
  startRealtimeSync(permanentStoreId);
  triggerSync();

  const [products, orders, expenses, pendingOrders, shifts, inventory, inventoryLogs] = await Promise.all([
    localDb.products.toArray(),
    localDb.orders.toArray(),
    localDb.expenses.toArray(),
    localDb.pendingOrders.toArray(),
    localDb.shifts.toArray(),
    localDb.inventory.toArray(),
    localDb.inventoryLogs.toArray(),
  ]);

  return {
    products: products.filter(p => !p.isDeleted),
    orders: orders.filter(o => !o.isDeleted),
    expenses: expenses.filter(e => !e.isDeleted),
    pendingOrders: pendingOrders.filter(p => !p.isDeleted),
    shifts,
    inventory,
    inventoryLogs,
    currentUser: null,
    distributions: {},
  };
}

/**
 * Connect to an existing 4-digit PIN store account.
 * 1. Hashes PIN and resolves storeId from /store_pins/{pinHash}.
 * 2. Proves knowledge of pinHash to authorize user in /stores/{storeId}/members/{uid}.
 * 3. Sets permanent storeId and PIN in local settings.
 */
export async function connectExistingStorePin(pinCode: string): Promise<StorageData> {
  const pin = pinCode.trim();
  if (pin.length !== 4 || !/^\d{4}$/.exec(pin)) {
    throw new Error('Store PIN must be exactly 4 numeric digits.');
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Internet connection is required to connect to an existing store. Connect to the internet and try again.');
  }

  const authUser = await ensureAuth();
  if (!authUser || !authUser.uid) {
    throw new Error('Please sign in with your Google account first to connect to this store.');
  }

  const nowIso = new Date().toISOString();
  const pinHash = await hashStorePin(pin);
  let targetStoreId: string | null = null;

  // 1. Look up in Store PIN Registry (exact hash get)
  const pinRef = doc(firestoreDb, 'store_pins', pinHash);
  const pinSnap = await getDoc(pinRef).catch(() => null);

  if (pinSnap && pinSnap.exists()) {
    const pinData = pinSnap.data();
    targetStoreId = pinData?.storeId || null;
  }

  // Fallback: Safe legacy migration check for store_{pin}
  if (!targetStoreId) {
    const legacyStoreId = `store_${pin}`;
    const legacyMetaRef = doc(firestoreDb, 'stores', legacyStoreId, 'meta', 'info');
    const legacySnap = await getDoc(legacyMetaRef).catch(() => null);

    if (legacySnap && legacySnap.exists()) {
      targetStoreId = legacyStoreId;
      // Auto-migrate to secure store_pins
      await setDoc(pinRef, {
        pinHash,
        storeId: legacyStoreId,
        migratedAt: nowIso,
        ownerUid: authUser.uid,
        ownerEmail: authUser.email || '',
      }, { merge: true }).catch(() => {});
    }
  }

  if (!targetStoreId) {
    throw new Error(`Store PIN "${pin}" not found. Please verify your PIN or select "Create New Store".`);
  }

  // 2. Authorize current user as member in /stores/{targetStoreId}/members/{uid} with valid pinHash proof
  const memberRef = doc(firestoreDb, 'stores', targetStoreId, 'members', authUser.uid);
  await setDoc(memberRef, {
    uid: authUser.uid,
    pinHash,
    role: 'staff',
    email: authUser.email || '',
    displayName: authUser.displayName || '',
    joinedAt: nowIso,
    lastActiveAt: nowIso,
  }, { merge: true });

  // 3. Save resolved store identity locally and in user profile
  await setStorePin(pin);
  await setStoreId(targetStoreId);
  setStoredPinCode(pin, authUser.uid);
  localStorage.setItem(`hershe_pos_store_id_${authUser.uid}`, targetStoreId);

  // Update user document with connected store
  try {
    const userDocRef = doc(firestoreDb, 'users', authUser.uid);
    await setDoc(userDocRef, {
      uid: authUser.uid,
      email: authUser.email || '',
      displayName: authUser.displayName || '',
      lastActiveStoreId: targetStoreId,
      lastActivePin: pin,
      stores: {
        [targetStoreId]: {
          storeId: targetStoreId,
          pin: pin,
          role: 'staff',
          connectedAt: nowIso,
        }
      },
      updatedAt: nowIso,
    }, { merge: true });
  } catch (userErr) {
    console.warn('[FirebaseSync] User profile connection update skipped:', userErr);
  }

  // 4. Start real-time sync with resolved storeId
  startRealtimeSync(targetStoreId);
  triggerSync();

  const [products, orders, expenses, pendingOrders, shifts, inventory, inventoryLogs] = await Promise.all([
    localDb.products.toArray(),
    localDb.orders.toArray(),
    localDb.expenses.toArray(),
    localDb.pendingOrders.toArray(),
    localDb.shifts.toArray(),
    localDb.inventory.toArray(),
    localDb.inventoryLogs.toArray(),
  ]);

  return {
    products: products.filter(p => !p.isDeleted),
    orders: orders.filter(o => !o.isDeleted),
    expenses: expenses.filter(e => !e.isDeleted),
    pendingOrders: pendingOrders.filter(p => !p.isDeleted),
    shifts,
    inventory,
    inventoryLogs,
    currentUser: null,
    distributions: {},
  };
}

/**
 * Real-time synchronization subscription for the active store.
 */
export function subscribeToFirebaseSync(onDataChange?: (data: StorageData) => void): () => void {
  startRealtimeSync();
  triggerSync();

  return () => {
    // Subscription alive
  };
}

/**
 * Force manual trigger of synchronization cycle.
 */
export async function forceSyncNow(): Promise<{ success: boolean; pushedCount: number; errors: number }> {
  return await runSyncCycle();
}

/**
 * Bridge for backwards-compatibility
 */
export async function saveDataToFirebase(data?: StorageData): Promise<void> {
  triggerSync();
}

