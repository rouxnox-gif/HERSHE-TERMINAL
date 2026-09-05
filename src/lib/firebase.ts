import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged, 
  User,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  Firestore,
} from 'firebase/firestore';
import defaultAppletConfig from '../../firebase-applet-config.json';

// Support VITE_ environment variables (for Cloudflare Pages / external hosting) with fallback to firebase-applet-config.json
const envApiKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_FIREBASE_API_KEY : undefined;
const resolvedFirebaseConfig = envApiKey
  ? {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (defaultAppletConfig as any).authDomain,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (defaultAppletConfig as any).projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (defaultAppletConfig as any).storageBucket,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (defaultAppletConfig as any).messagingSenderId,
      appId: import.meta.env.VITE_FIREBASE_APP_ID || (defaultAppletConfig as any).appId,
      firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (defaultAppletConfig as any).firestoreDatabaseId,
    }
  : defaultAppletConfig;

const app = !getApps().length ? initializeApp(resolvedFirebaseConfig) : getApp();

export const auth = getAuth(app);

// Configure local persistence for PWA/browser session longevity
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase] Auth persistence initialization note:', err);
  });
}

const config = resolvedFirebaseConfig as any;

// Initialize Firestore with auto-detect long polling for optimal connection resilience across networks & sandboxes
let firestoreInstance: Firestore;
const firestoreSettings = {
  experimentalAutoDetectLongPolling: true,
};

try {
  firestoreInstance = config.firestoreDatabaseId
    ? initializeFirestore(app, firestoreSettings, config.firestoreDatabaseId)
    : initializeFirestore(app, firestoreSettings);
} catch {
  firestoreInstance = config.firestoreDatabaseId
    ? getFirestore(app, config.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreInstance;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Track single-flight initial auth readiness
let singleFlightAuthPromise: Promise<User | null> | null = null;

/**
 * Ensures Firebase Authentication state is resolved.
 * Checks for restored Google session credentials without triggering unnecessary popup prompts.
 * Guaranteed single-flight promise.
 */
export async function ensureAuth(): Promise<User | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (singleFlightAuthPromise) {
    return singleFlightAuthPromise;
  }

  singleFlightAuthPromise = (async () => {
    try {
      if (auth.currentUser) {
        return auth.currentUser;
      }

      // Wait for Firebase Auth persistence restoration
      if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
      } else {
        await new Promise<void>((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, () => {
            unsubscribe();
            resolve();
          });
        });
      }

      return auth.currentUser || null;
    } catch (err) {
      console.warn('[Firebase] Auth state restoration note:', err);
      return auth.currentUser || null;
    } finally {
      singleFlightAuthPromise = null;
    }
  })();

  return singleFlightAuthPromise;
}

/**
 * Signs in with Google provider using popup.
 */
export async function signInWithGoogle(customPrompt: string = 'select_account'): Promise<User> {
  const provider = new GoogleAuthProvider();
  if (customPrompt) {
    provider.setCustomParameters({ prompt: customPrompt });
  }

  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/**
 * Signs out the currently authenticated user.
 */
export async function signOutGoogle(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Subscribes to Firebase Auth state changes.
 */
export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}

/**
 * Explicit application startup initialization helper.
 */
export function initAuth(): void {
  ensureAuth().catch((err) => {
    console.warn('[Firebase] Startup auth initialization notice:', err);
  });
}

