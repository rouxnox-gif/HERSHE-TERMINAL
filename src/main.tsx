import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Filter out benign browser-extension errors (e.g. MetaMask, Web3 wallet injection in iframes)
if (typeof window !== 'undefined') {
  const isExtensionError = (msg?: string, source?: string) => {
    const text = (msg || '').toLowerCase();
    const src = (source || '').toLowerCase();
    return (
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
      if (isExtensionError(event.message, event.filename)) {
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
      if (isExtensionError(msg, stack)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
}

// Register Service Worker for offline PWA functionality
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

