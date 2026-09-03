import { db } from '../db';
import { PaymentTypeConfig, TabConfig, TabType, StoreInfoSettings, CustomAddon } from '../../types';
import { db as firestoreDb } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const DEVICE_ID_KEY = 'hershe_pos_device_id';
const STORE_PIN_KEY = 'hershe_pos_store_pin';
const STORE_ID_KEY = 'hershe_pos_store_id';
const PAYMENT_CONFIGS_KEY = 'hershe_payment_configs';
const HIDDEN_TABS_KEY = 'hershe_hidden_tabs';
const STORE_INFO_KEY = 'hershe_store_info_settings';

export const DEFAULT_ADDONS: CustomAddon[] = [];

export const DEFAULT_STORE_INFO: StoreInfoSettings = {
  storeName: 'HERSHE Drinks & Juices',
  whatsappNumber: '6738881234',
  location: 'Binti Gym, Brunei',
  bankName: 'BIBD / Baiduri',
  bankAccountNumber: '00-001-01-7890123',
  bankAccountHolder: 'HERSHE BEVERAGES',
  instructions: 'Please make payment to the bank account above and attach your payment receipt screenshot when WhatsApp opens!',
  isPreOrderOpen: true,
  closedMessage: 'We are currently closed for pre-orders. Please visit us in-store at Binti Gym or check back during our opening hours!',
  bannerTitle: 'Pre-Order Drinks & Smoothies',
  bannerSubtitle: 'Order ahead, choose your custom add-ons, and send your order with proof of payment directly to our WhatsApp for speedy pickup!',
  addons: DEFAULT_ADDONS,
};

export const DEFAULT_PAYMENT_CONFIGS: PaymentTypeConfig[] = [
  { id: 'Cash', name: 'Cash', enabled: true },
  { id: 'Card Lulu', name: 'Card Lulu', enabled: true },
  { id: 'Card Mizah', name: 'Card Mizah', enabled: true },
  { id: 'Binti Gym Transfer', name: 'Binti Gym Transfer', enabled: true },
];

export const ALL_APP_TABS: TabConfig[] = [
  { id: 'sales', label: 'Terminal', description: 'Take beverage orders and process checkouts', defaultVisible: true },
  { id: 'customer', label: 'Customer Menu', description: 'Customer pre-order portal with WhatsApp payment proof checkout', defaultVisible: true },
  { id: 'dashboard', label: 'Dashboard', description: 'Real-time sales, live profits & performance metrics', defaultVisible: true },
  { id: 'inventory', label: 'Inventory', description: 'Stock levels, restocks, and audit movement logs', defaultVisible: true },
  { id: 'expenses', label: 'Expenses', description: 'Log operational costs, supplier payouts, and utility bills', defaultVisible: true },
  { id: 'monthly', label: 'Reports', description: 'Monthly performance & account financial breakdown', defaultVisible: true },
  { id: 'distribution', label: 'Partnership distribution', description: 'Calculate profit splits and partner payouts', defaultVisible: true },
  { id: 'history', label: 'History', description: 'Review past completed transactions', defaultVisible: true },
  { id: 'pending', label: 'Pending', description: 'Review and approve customer pre-orders and staff orders', defaultVisible: true },
  { id: 'receipts', label: 'Receipts', description: 'Search and reprint thermal customer receipts', defaultVisible: true },
];

/**
 * Gets or creates a permanent globally unique device ID using crypto.randomUUID().
 * Never regenerates on page loads once created.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  // Check IndexedDB
  const stored = await db.appSettings.get(DEVICE_ID_KEY);
  if (stored && typeof stored.value === 'string' && stored.value.length > 0) {
    return stored.value;
  }

  // Check localStorage as fallback
  const localFallback = localStorage.getItem(DEVICE_ID_KEY);
  if (localFallback) {
    await db.appSettings.put({ key: DEVICE_ID_KEY, value: localFallback, updatedAt: new Date().toISOString() });
    return localFallback;
  }

  // Generate new UUID
  const newDeviceId = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem(DEVICE_ID_KEY, newDeviceId);
  await db.appSettings.put({ key: DEVICE_ID_KEY, value: newDeviceId, updatedAt: new Date().toISOString() });
  return newDeviceId;
}

export async function getStorePin(): Promise<string> {
  const stored = await db.appSettings.get(STORE_PIN_KEY);
  if (stored && typeof stored.value === 'string' && stored.value.length > 0) {
    return stored.value;
  }
  const local = localStorage.getItem(STORE_PIN_KEY);
  if (local) {
    await db.appSettings.put({ key: STORE_PIN_KEY, value: local, updatedAt: new Date().toISOString() });
    return local;
  }
  return '';
}

export async function setStorePin(pin: string): Promise<void> {
  const cleanPin = pin.trim();
  localStorage.setItem(STORE_PIN_KEY, cleanPin);
  await db.appSettings.put({ key: STORE_PIN_KEY, value: cleanPin, updatedAt: new Date().toISOString() });
}

/**
 * Gets or generates a permanent random store ID independent from human-facing PIN.
 * Supports URL search parameter (?store=xxx or ?s=xxx) for direct customer links.
 */
export async function getStoreId(): Promise<string> {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlStore = params.get('store') || params.get('storeId') || params.get('s');
    if (urlStore && urlStore.trim()) {
      const cleanUrlStore = urlStore.trim();
      localStorage.setItem(STORE_ID_KEY, cleanUrlStore);
      await db.appSettings.put({ key: STORE_ID_KEY, value: cleanUrlStore, updatedAt: new Date().toISOString() });
      return cleanUrlStore;
    }
  }

  const stored = await db.appSettings.get(STORE_ID_KEY);
  if (stored && typeof stored.value === 'string' && stored.value.length > 0) {
    return stored.value;
  }
  const local = localStorage.getItem(STORE_ID_KEY);
  if (local) {
    await db.appSettings.put({ key: STORE_ID_KEY, value: local, updatedAt: new Date().toISOString() });
    return local;
  }

  // Generate a dedicated permanent cryptographically random store ID (store_<UUID>)
  const randomUuid = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID().replace(/-/g, '') 
    : `${Date.now()}${Math.random().toString(36).substring(2, 11)}`;
  const permanentStoreId = `store_${randomUuid}`;

  localStorage.setItem(STORE_ID_KEY, permanentStoreId);
  await db.appSettings.put({ key: STORE_ID_KEY, value: permanentStoreId, updatedAt: new Date().toISOString() });
  return permanentStoreId;
}

export async function setStoreId(storeId: string): Promise<void> {
  const cleanId = storeId.trim();
  localStorage.setItem(STORE_ID_KEY, cleanId);
  await db.appSettings.put({ key: STORE_ID_KEY, value: cleanId, updatedAt: new Date().toISOString() });
}

export async function getSetting<T = any>(key: string, defaultValue: T): Promise<T> {
  const item = await db.appSettings.get(key);
  if (item && item.value !== undefined) {
    return item.value as T;
  }
  return defaultValue;
}

export async function setSetting<T = any>(key: string, value: T): Promise<void> {
  await db.appSettings.put({ key, value, updatedAt: new Date().toISOString() });
}

export async function getPaymentConfigs(): Promise<PaymentTypeConfig[]> {
  try {
    const stored = await db.appSettings.get(PAYMENT_CONFIGS_KEY);
    if (stored && Array.isArray(stored.value) && stored.value.length > 0) {
      return stored.value;
    }
    const local = localStorage.getItem(PAYMENT_CONFIGS_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load payment configs:', err);
  }
  return DEFAULT_PAYMENT_CONFIGS;
}

export async function savePaymentConfigs(configs: PaymentTypeConfig[]): Promise<void> {
  try {
    localStorage.setItem(PAYMENT_CONFIGS_KEY, JSON.stringify(configs));
    await db.appSettings.put({
      key: PAYMENT_CONFIGS_KEY,
      value: configs,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to save payment configs:', err);
  }
}

export async function getHiddenTabs(): Promise<TabType[]> {
  try {
    const stored = await db.appSettings.get(HIDDEN_TABS_KEY);
    if (stored && Array.isArray(stored.value)) {
      return stored.value as TabType[];
    }
    const local = localStorage.getItem(HIDDEN_TABS_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        return parsed as TabType[];
      }
    }
  } catch (err) {
    console.warn('Failed to load hidden tabs:', err);
  }
  return [];
}

export async function saveHiddenTabs(hiddenTabs: TabType[]): Promise<void> {
  try {
    localStorage.setItem(HIDDEN_TABS_KEY, JSON.stringify(hiddenTabs));
    await db.appSettings.put({
      key: HIDDEN_TABS_KEY,
      value: hiddenTabs,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to save hidden tabs:', err);
  }
}

export async function getStoreInfoSettings(): Promise<StoreInfoSettings> {
  try {
    let resolvedInfo: StoreInfoSettings = DEFAULT_STORE_INFO;
    const stored = await db.appSettings.get(STORE_INFO_KEY);
    if (stored && stored.value && typeof stored.value === 'object') {
      resolvedInfo = { ...DEFAULT_STORE_INFO, ...stored.value };
    } else {
      const local = localStorage.getItem(STORE_INFO_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && typeof parsed === 'object') {
          resolvedInfo = { ...DEFAULT_STORE_INFO, ...parsed };
        }
      }
    }

    // Ensure addons array is valid array
    if (!resolvedInfo.addons || !Array.isArray(resolvedInfo.addons)) {
      resolvedInfo.addons = DEFAULT_ADDONS;
    }
    if (resolvedInfo.isPreOrderOpen === undefined) {
      resolvedInfo.isPreOrderOpen = true;
    }
    return resolvedInfo;
  } catch (err) {
    console.warn('Failed to load store info settings:', err);
  }
  return DEFAULT_STORE_INFO;
}

export async function saveStoreInfoSettings(info: StoreInfoSettings): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    localStorage.setItem(STORE_INFO_KEY, JSON.stringify(info));
    await db.appSettings.put({
      key: STORE_INFO_KEY,
      value: info,
      updatedAt: nowIso,
    });

    // Cloud synchronization for real-time customer and device access
    try {
      const storeId = await getStoreId();
      if (storeId && firestoreDb) {
        const settingsRef = doc(firestoreDb, 'stores', storeId, 'meta', 'settings');
        await setDoc(settingsRef, {
          storeInfo: info,
          updatedAt: nowIso,
        }, { merge: true });

        const infoRef = doc(firestoreDb, 'stores', storeId, 'meta', 'info');
        await setDoc(infoRef, {
          isPreOrderOpen: info.isPreOrderOpen !== false,
          storeName: info.storeName || '',
          whatsappNumber: info.whatsappNumber || '',
          updatedAt: nowIso,
        }, { merge: true });
      }
    } catch (cloudErr) {
      console.warn('[AppSettingsRepo] Cloud sync for store info skipped:', cloudErr);
    }
  } catch (err) {
    console.error('Failed to save store info settings:', err);
  }
}

