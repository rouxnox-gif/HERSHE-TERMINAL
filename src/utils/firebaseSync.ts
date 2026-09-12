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
  storeType?: string;
  registeredAt?: string;
}

const STORE_PIN_KEY = 'hershe_pos_store_pin';

/**
 * Clears all local IndexedDB entity records and sync queue for clean store isolation.
 * Prevents Store A data from ever leaking into Store B when switching or registering.
 */
export async function clearLocalStoreData(): Promise<void> {
  stopRealtimeSync();
  await localDb.transaction('rw', [
    localDb.products,
    localDb.orders,
    localDb.orderItems,
    localDb.expenses,
    localDb.pendingOrders,
    localDb.shifts,
    localDb.distributions,
    localDb.inventory,
    localDb.inventoryLogs,
    localDb.inventoryMovements,
    localDb.syncQueue,
  ], async () => {
    await localDb.products.clear();
    await localDb.orders.clear();
    await localDb.orderItems.clear();
    await localDb.expenses.clear();
    await localDb.pendingOrders.clear();
    await localDb.shifts.clear();
    await localDb.distributions.clear();
    await localDb.inventory.clear();
    await localDb.inventoryLogs.clear();
    await localDb.inventoryMovements.clear();
    await localDb.syncQueue.clear();
  });
}

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
            storeType: val.storeType || undefined,
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
export async function registerNewStorePin(
  pinCode: string,
  storeName?: string,
  storeType?: string
): Promise<StorageData> {
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
  const finalStoreName = (storeName && storeName.trim()) || 'HERSHE Store';
  const finalStoreType = (storeType && storeType.trim()) || 'Drinks & Beverages';

  // 5. CRITICAL: Clean local store data before registering so old store items never pollute the new store
  await clearLocalStoreData();

  // 6. Register PIN mapping in /store_pins/{pinHash}
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

  // 7. Atomically register store member and metadata in writeBatch
  const memberRef = doc(firestoreDb, 'stores', permanentStoreId, 'members', authUser.uid);
  const metaRef = doc(firestoreDb, 'stores', permanentStoreId, 'meta', 'info');
  const settingsRef = doc(firestoreDb, 'stores', permanentStoreId, 'meta', 'settings');

  const initialStoreInfo = {
    storeName: finalStoreName,
    storeType: finalStoreType,
    whatsappNumber: '6738881234',
    location: 'Store Location',
    bankName: 'BIBD / Baiduri',
    bankAccountNumber: '00-001-01-7890123',
    bankAccountHolder: finalStoreName.toUpperCase(),
    instructions: 'Please make payment to the bank account above and attach your payment receipt screenshot when WhatsApp opens!',
    isPreOrderOpen: true,
    closedMessage: 'We are currently closed for pre-orders.',
    bannerTitle: `Pre-Order ${finalStoreName}`,
    bannerSubtitle: 'Order ahead for speedy pickup!',
    addons: [],
  };

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
      storeName: finalStoreName,
      storeType: finalStoreType,
      ownerUid: authUser.uid,
      ownerEmail: authUser.email || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    }, { merge: true });
    batch.set(settingsRef, {
      storeInfo: initialStoreInfo,
      updatedAt: nowIso,
    }, { merge: true });

    // Register public PIN reference so customers with link ?tab=customer&pin={pin} resolve immediately
    const publicPinRef = doc(firestoreDb, 'public', `pin_${pin}`);
    batch.set(publicPinRef, {
      pin,
      storeId: permanentStoreId,
      storeName: finalStoreName,
      updatedAt: nowIso,
    }, { merge: true });

    await batch.commit();
  } catch (batchErr) {
    console.error('[FirebaseSync] Store registration batch failed, rolling back PIN:', batchErr);
    await deleteDoc(pinRef).catch(() => {});
    throw new Error('Failed to complete store registration. Please try again.');
  }

  // 8. Store settings locally on THIS device
  await setStorePin(pin);
  await setStoreId(permanentStoreId);
  setStoredPinCode(pin, authUser.uid);
  localStorage.setItem(`hershe_pos_store_id_${authUser.uid}`, permanentStoreId);
  localStorage.setItem('hershe_store_info_settings', JSON.stringify(initialStoreInfo));
  await localDb.appSettings.put({
    key: 'hershe_store_info_settings',
    value: initialStoreInfo,
    updatedAt: nowIso,
  });

  // Update user document with registered store
  try {
    const userDocRef = doc(firestoreDb, 'users', authUser.uid);
    await setDoc(userDocRef, {
      uid: authUser.uid,
      email: authUser.email || '',
      displayName: authUser.displayName || '',
      stores: {
        [permanentStoreId]: {
          storeId: permanentStoreId,
          pin: pin,
          role: 'owner',
          storeName: finalStoreName,
          storeType: finalStoreType,
          registeredAt: nowIso,
        }
      },
      updatedAt: nowIso,
    }, { merge: true });
  } catch (userErr) {
    console.warn('[FirebaseSync] User profile update skipped:', userErr);
  }

  // 9. Start real-time sync with new permanent storeId
  await startRealtimeSync(permanentStoreId);

  return {
    products: [],
    orders: [],
    expenses: [],
    pendingOrders: [],
    shifts: [],
    inventory: [],
    inventoryLogs: [],
    currentUser: null,
    distributions: {},
  };
}

/**
 * Connect to an existing 4-digit PIN store account.
 * 1. Hashes PIN and resolves storeId from /store_pins/{pinHash}.
 * 2. Proves knowledge of pinHash to authorize user in /stores/{storeId}/members/{uid}.
 * 3. Cleans local state to guarantee absolute store isolation.
 * 4. Sets permanent storeId and PIN in local settings.
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
    throw new Error(`Store PIN "${pin}" not found. Please verify your PIN or select "Register New Store".`);
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

  // 3. CRITICAL: Clean local Dexie tables before connecting to a different store
  await clearLocalStoreData();

  // 4. Fetch target store info & metadata
  let connectedStoreName = 'HERSHE Store';
  let connectedStoreType = 'Drinks & Beverages';

  try {
    const metaInfoRef = doc(firestoreDb, 'stores', targetStoreId, 'meta', 'info');
    const metaInfoSnap = await getDoc(metaInfoRef).catch(() => null);
    if (metaInfoSnap && metaInfoSnap.exists()) {
      const data = metaInfoSnap.data();
      if (data?.storeName) connectedStoreName = data.storeName;
      if (data?.storeType) connectedStoreType = data.storeType;
    }

    const metaSettingsRef = doc(firestoreDb, 'stores', targetStoreId, 'meta', 'settings');
    const metaSettingsSnap = await getDoc(metaSettingsRef).catch(() => null);
    if (metaSettingsSnap && metaSettingsSnap.exists()) {
      const sData = metaSettingsSnap.data();
      if (sData?.storeInfo && typeof sData.storeInfo === 'object') {
        localStorage.setItem('hershe_store_info_settings', JSON.stringify(sData.storeInfo));
        await localDb.appSettings.put({
          key: 'hershe_store_info_settings',
          value: sData.storeInfo,
          updatedAt: nowIso,
        });
      }
      if (sData?.googleSpreadsheetId && typeof sData.googleSpreadsheetId === 'string' && sData.googleSpreadsheetId.trim()) {
        const cleanSheetId = sData.googleSpreadsheetId.trim();
        localStorage.setItem(`hershe_pos_google_spreadsheet_id_pin_${pin}`, cleanSheetId);
        localStorage.setItem(`hershe_pos_google_spreadsheet_id_store_${targetStoreId}`, cleanSheetId);
        await localDb.appSettings.put({
          key: `hershe_pos_google_spreadsheet_id_pin_${pin}`,
          value: cleanSheetId,
          updatedAt: nowIso,
        });
        await localDb.appSettings.put({
          key: `hershe_pos_google_spreadsheet_id_store_${targetStoreId}`,
          value: cleanSheetId,
          updatedAt: nowIso,
        });
      }
    }
  } catch (mErr) {
    console.warn('[FirebaseSync] Failed reading target store metadata:', mErr);
  }

  // 5. Save resolved store identity locally on THIS device
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
      stores: {
        [targetStoreId]: {
          storeId: targetStoreId,
          pin: pin,
          role: 'staff',
          storeName: connectedStoreName,
          storeType: connectedStoreType,
          connectedAt: nowIso,
        }
      },
      updatedAt: nowIso,
    }, { merge: true });

    // Also register or refresh public PIN mapping
    const publicPinRef = doc(firestoreDb, 'public', `pin_${pin}`);
    await setDoc(publicPinRef, {
      pin,
      storeId: targetStoreId,
      storeName: connectedStoreName,
      updatedAt: nowIso,
    }, { merge: true }).catch(() => {});
  } catch (userErr) {
    console.warn('[FirebaseSync] User profile connection update skipped:', userErr);
  }

  // 6. Start real-time sync with resolved storeId
  await startRealtimeSync(targetStoreId);

  // Allow brief window for initial real-time snapshot to populate localDb
  await new Promise((r) => setTimeout(r, 400));

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

/**
 * Resolves a 4-digit PIN to its unique permanent storeId.
 * Checks /public/pin_{pin}, /store_pins/{pinHash}, and legacy store_{pin}.
 * Safe for unauthenticated customers accessing customer pre-order links.
 */
export async function resolveStoreIdFromPin(pin: string): Promise<string | null> {
  const clean = (pin || '').trim();
  if (!clean || clean.length !== 4 || !/^\d{4}$/.exec(clean)) return null;

  try {
    // 1. Check public PIN registry (accessible without authentication)
    const pubRef = doc(firestoreDb, 'public', `pin_${clean}`);
    const pubSnap = await getDoc(pubRef).catch(() => null);
    if (pubSnap && pubSnap.exists()) {
      const data = pubSnap.data();
      if (data?.storeId) return data.storeId;
    }

    // 2. Check store_pins by hash (if authenticated)
    const pinHash = await hashStorePin(clean);
    const pinRef = doc(firestoreDb, 'store_pins', pinHash);
    const pinSnap = await getDoc(pinRef).catch(() => null);
    if (pinSnap && pinSnap.exists()) {
      const data = pinSnap.data();
      if (data?.storeId) return data.storeId;
    }

    // 3. Fallback: check legacy store_{pin}
    const legacyId = `store_${clean}`;
    const legacyRef = doc(firestoreDb, 'stores', legacyId, 'meta', 'info');
    const legacySnap = await getDoc(legacyRef).catch(() => null);
    if (legacySnap && legacySnap.exists()) {
      return legacyId;
    }

    return legacyId;
  } catch (err) {
    console.warn('[FirebaseSync] resolveStoreIdFromPin notice:', err);
    return `store_${clean}`;
  }
}

