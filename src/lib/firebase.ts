import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously,
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
  Firestore 
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

// Initialize Firestore with auto-detect long polling for robust iframe / network proxy connectivity
let firestoreInstance: Firestore;
try {
  firestoreInstance = config.firestoreDatabaseId
    ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, config.firestoreDatabaseId)
    : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch {
  firestoreInstance = config.firestoreDatabaseId
    ? getFirestore(app, config.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreInstance;

// Track single-flight initial auth readiness
let singleFlightAuthPromise: Promise<User | null> | null = null;

/**
 * Ensures Firebase Authentication state is resolved.
 * If no user is logged in, automatically signs in anonymously so that cloud syncing
 * and store security rules function seamlessly without requiring human popup interaction.
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

      if (auth.currentUser) {
        return auth.currentUser;
      }

      // Automatically sign in anonymously for friction-free POS terminal operations
      try {
        const cred = await signInAnonymously(auth);
        return cred.user;
      } catch (anonErr) {
        console.warn('[Firebase] Anonymous authentication notice:', anonErr);
        return auth.currentUser || null;
      }
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

