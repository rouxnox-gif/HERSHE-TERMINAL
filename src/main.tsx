import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initPWAUpdateOrchestrator } from './pwaUpdate.ts';
import './index.css';

// Initialize PWA Service Worker update lifecycle and cache management
initPWAUpdateOrchestrator();

// Filter out benign browser-extension and transient connection abort errors (e.g. AbortError, MetaMask, Web3 wallet injection in iframes)
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
      text.includes('metamask') ||
      text.includes('failed to connect to metamask') ||
      text.includes('ethereum') ||
      text.includes('wallet') ||
      src.includes('chrome-extension://') ||
      src.includes('moz-extension://') ||
      src.includes('safari-extension://')
    );
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

