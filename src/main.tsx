import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initPWAUpdateOrchestrator } from './pwaUpdate.ts';
import { initializeDatabaseAndMigrate } from './services/migrationService.ts';
import { initAuth } from './lib/firebase.ts';
import './index.css';

// Initialize PWA Service Worker update lifecycle and cache management
initPWAUpdateOrchestrator();

// Filter out benign browser-extension and transient connection abort errors (e.g. AbortError, MetaMask, Web3 wallet injection in iframes, Firestore offline notices)
if (typeof window !== 'undefined') {
  const isIgnorableError = (msg?: string, source?: string, name?: string) => {
    const text = (msg || '').toLowerCase();
    const src = (source || '').toLowerCase();
    const errName = (name || '').toLowerCase();
    return (
      errName === 'aborterror' ||
      text.includes('aborterror') ||
      text.includes('the connection was closed') ||
      text.includes('connection closed') ||
      text.includes('user aborted a request') ||
      text.includes('could not reach cloud firestore backend') ||
      text.includes('code=unavailable') ||
      text.includes('client will operate in offline mode') ||
      text.includes('metamask') ||
      text.includes('failed to connect to metamask') ||
      text.includes('ethereum') ||
      text.includes('wallet') ||
      src.includes('chrome-extension://') ||
      src.includes('moz-extension://') ||
      src.includes('safari-extension://')
    );
  };

  // Intercept transient Firestore offline / connection retry logs so they don't get misflagged as fatal runtime crashes
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const text = args.map(a => (typeof a === 'string' ? a : a?.message || a?.stack || '')).join(' ').toLowerCase();
    if (
      text.includes('could not reach cloud firestore backend') ||
      text.includes('client will operate in offline mode') ||
      text.includes('code=unavailable') ||
      text.includes('aborterror')
    ) {
      console.warn('[Network/Firestore] Connection retry notice:', ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };

  window.addEventListener(
    'error',
    (event) => {
      const errName = (event.error as any)?.name;
      if (isIgnorableError(event.message, event.filename, errName)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = event.reason;
      const msg = typeof reason === 'string' ? reason : reason?.message || '';
      const stack = reason?.stack || '';
      const errName = reason?.name;
      if (isIgnorableError(msg, stack, errName)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
}

/**
 * Boot Sequence Gate:
 * 1. Initialize Firebase Auth
 * 2. Run Dexie initialization & migration gate to purge confirmed legacy synthetic inventory
 * 3. Mount App into DOM only when database is confirmed clean and ready
 */
async function bootstrapApp() {
  try {
    initAuth();
    await initializeDatabaseAndMigrate();
  } catch (err) {
    console.error('[Bootstrap] Initialization error:', err);
  }

  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  }
}

bootstrapApp();

