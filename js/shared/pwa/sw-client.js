/**
 * PWA Service Worker Client
 * Handles registration, update checks, and force-reload logic.
 */

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Determine the correct path to sw.js based on current location
      // If we are in /pages/xyz/index.html, sw.js is at ../../sw.js
      // If we are in /index.html, sw.js is at ./sw.js
      const isSubPage = window.location.pathname.includes('/pages/');
      const swPath = isSubPage ? '../../sw.js' : './sw.js';

      navigator.serviceWorker.register(swPath, { updateViaCache: 'none', type: 'module' })
        .then(registration => {
          // Trigger update checks while the page is open.
          const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
          const tryUpdate = async () => {
            try { await registration.update(); } catch (e) { console.warn('SW update check failed:', e); }
          };

          tryUpdate();
          setInterval(tryUpdate, UPDATE_CHECK_INTERVAL_MS);

          // Also re-check when the tab becomes visible again.
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              tryUpdate();
            }
          });
        })
        .catch(err => console.warn('SW registration failed:', err));
    });
  }
}

/**
 * Hard refresh: update SW, clear all caches, reload with cache-buster.
 */
export async function forceAppReload() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      try { await reg.update(); } catch (e) { console.warn('SW update failed:', e); }

      if (reg.waiting) {
        // New SW version is ready — activate it before reloading
        await new Promise(resolve => {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
          setTimeout(resolve, 5000); // safety: don't block forever
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        });
      } else if (reg.installing) {
        // SW still installing — wait for it to activate
        await new Promise(resolve => {
          const sw = reg.installing;
          const timeout = setTimeout(resolve, 5000);
          sw.addEventListener('statechange', function handler() {
            if (this.state === 'activated') {
              clearTimeout(timeout);
              sw.removeEventListener('statechange', handler);
              resolve();
            }
          });
        });
      }
    }
  } catch { /* SW not supported */ }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  } catch (e) { console.warn('Cache clearing failed:', e); }

  // Reload with a cache-busting parameter
  const url = new URL(window.location.href);
  url.searchParams.set('refresh', Date.now());
  window.location.replace(url.toString());
}
