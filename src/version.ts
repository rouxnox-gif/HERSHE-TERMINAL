/**
 * Application Version & Build Metadata
 * Used for cache busting verification, PWA update tracking, and runtime diagnostics.
 */
export const APP_VERSION = '2.4.2';
export const BUILD_TIMESTAMP = new Date().toISOString();
export const BUILD_ID = '2026.09.09-STOCK-RESOLVED';

if (typeof window !== 'undefined') {
  (window as any).__HERSHE_VERSION__ = {
    version: APP_VERSION,
    buildId: BUILD_ID,
    buildTimestamp: BUILD_TIMESTAMP,
  };
}
