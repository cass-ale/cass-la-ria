/* ============================================================
   Service Worker — Cass la Ria (v11 — permanent no-op)

   This is a permanent no-op service worker. It has NO fetch
   handler, so all requests pass straight through to the browser's
   normal HTTP stack (Netlify CDN → browser cache → network).

   Why a no-op instead of removing sw.js entirely:
   - If sw.js is removed, users who have an old SW installed
     will never get an update (the browser checks the same URL)
   - A no-op at the same URL replaces any old SW and then
     gets out of the way — Chrome's recommended approach
   - Reference: https://developer.chrome.com/docs/workbox/remove-buggy-service-workers

   Cache strategy is now handled entirely by HTTP headers:
   - HTML: max-age=0, must-revalidate (always fresh)
   - CSS/JS: max-age=31536000, immutable (content-hashed filenames)
   - Assets: max-age=31536000, immutable (stable filenames)
   - Reference: https://jakearchibald.com/2016/caching-best-practices/

   History:
   - v1–v8: Cache-first PWA (caused stale content issues)
   - v9: Network-first (transition)
   - v10: Nuke (cleared all caches, forced reload)
   - v11: Permanent no-op (this version — final)
   ============================================================ */

// Install — skip waiting so this replaces any old SW immediately
self.addEventListener('install', function() {
  self.skipWaiting();
});

// Activate — claim all clients and clear any leftover caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    // Clean up any caches left by previous SW versions
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(name) {
            return caches.delete(name);
          })
        );
      })
      .then(function() {
        // Take control of all open tabs
        return self.clients.claim();
      })
  );
});

// NO fetch handler — all requests use the browser's normal
// HTTP stack. This is intentional. The browser will use its
// HTTP cache (controlled by Cache-Control headers) and fall
// through to the network as needed.
