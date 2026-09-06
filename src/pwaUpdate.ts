import { APP_VERSION, BUILD_ID } from './version';

/**
 * Service Worker Update Orchestrator
 *
 * Ensures existing devices, installed PWAs, and open browser tabs immediately
 * receive newly deployed application versions without stale cache entrapment,
 * while strictly preserving all IndexedDB, Dexie tables, and localStorage state.
 */
export function initPWAUpdateOrchestrator(): void {
  if (typeof window === 'undefined') return;

  console.log(
    `%c[HERSHE-POS] Runtime Version: ${APP_VERSION} (${BUILD_ID})`,
    'background: #0f172a; color: #10b981; font-weight: bold; padding: 4px 8px; border-radius: 4px;'
  );

  // 1. Clean up legacy manual cache containers if present from older prototypes
  if ('caches' in window) {
    window.caches.keys().then((cacheNames) => {
      for (const name of cacheNames) {
        if (name === 'hershe-pos-cache-v1' || name.startsWith('hershe-pos-legacy-')) {
          console.log('[PWA] Purging outdated legacy cache store:', name);
          window.caches.delete(name).catch(() => {});
        }
      }
    }).catch(() => {});
  }

  // 2. Service Worker registration and lifecycle management
  if ('serviceWorker' in navigator) {
    // In local/container development mode, do not register production sw.js
    // Unregister any leftover workers to prevent dev server asset conflicts and abort errors
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister().catch(() => {});
        }
      }).catch(() => {});
      return;
    }

    let hasRefreshed = false;

    // Reload the page once the new Service Worker takes control of the page
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasRefreshed) return;
      hasRefreshed = true;
      console.log('[PWA] New Service Worker active! Reloading page to activate latest build...');
      window.location.reload();
    });

    const registerAndWatch = async () => {
      try {
        // updateViaCache: 'none' forces the browser to always query the server
        // for sw.js byte diffs, bypassing any HTTP caching tiers
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        console.log('[PWA] Service Worker registered. Scope:', registration.scope);

        // A. If a new worker is already waiting, trigger immediate skipWaiting
        if (registration.waiting) {
          console.log('[PWA] New worker already waiting. Signaling SKIP_WAITING...');
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // B. Proactively check for updates immediately upon registration
        if (navigator.onLine) {
          registration.update().catch((err) => {
            console.debug('[PWA] Immediate update check status:', err?.message || err);
          });
        }

        // C. Track newly found updates during this session
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          console.log('[PWA] New application update downloading in background...');

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // An old worker was controlling this client; the new one is installed and will activate
                console.log('[PWA] Update installed. Activating new version...');
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              } else {
                console.log('[PWA] Application cached for offline execution.');
              }
            }
          });
        });

        // D. Check for updates on visibility change (e.g. tablet unlocked, tab brought to foreground)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine) {
            registration.update().catch(() => {});
          }
        });

        // E. Check for updates when window regains focus
        window.addEventListener('focus', () => {
          if (navigator.onLine) {
            registration.update().catch(() => {});
          }
        });

        // F. Periodically check for updates while running online (every 3 minutes)
        setInterval(() => {
          if (navigator.onLine) {
            registration.update().catch(() => {});
          }
        }, 3 * 60 * 1000);

      } catch (err) {
        console.warn('[PWA] Service Worker registration / update failed:', err);
      }
    };

    if (document.readyState === 'complete') {
      registerAndWatch();
    } else {
      window.addEventListener('load', registerAndWatch);
    }
  }
}
