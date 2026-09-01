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
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Configure local persistence for PWA/browser session longevity
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase] Auth persistence initialization note:', err);
  });
}

const config = firebaseConfig as any;

// Always pass firestoreDatabaseId if configured
export const db = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

// Track single-flight initial auth readiness
let singleFlightAuthPromise: Promise<User | null> | null = null;

/**
 * Ensures Firebase Authentication state is resolved.
 * Returns the active Google-authenticated user, or null if no user is signed in.
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
 * Signs out the currently authenticated Google user.
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

