/* ============================================================
   Service Worker — Cass la Ria (v10 — cache reset)

   TEMPORARY: This version clears ALL cached data and forces
   every open tab to reload with fresh content from the network.

   Why: Previous service worker versions cached stale JS files
   (notably rain.js without the door feature) on users' devices.
   Even though the SW was updated to network-first (v9), users
   who had the old cache-first SW (v8) were still being served
   stale sub-resources on their first visit after the update.
   The updatefound → activated → reload cycle in index.html
   was not reliably firing on all browsers (especially iOS Safari)
   because the installing worker's statechange to 'activated'
   can be missed if the page navigates or the event fires before
   the listener is attached.

   This "nuke" SW solves the chicken-and-egg problem by:
   1. Installing immediately (skipWaiting)
   2. On activate: deleting ALL caches, claiming all clients,
      and navigating every open tab to reload
   3. On fetch: passing everything straight to the network
      (no caching at all) so users always get fresh content

   After all users have picked up this version (24h max per
   the browser spec), a future deploy can restore caching.

   Reference: https://medium.com/@nekrtemplar/self-destroying-serviceworker-73d62921d717
   Reference: https://github.com/NekR/self-destroying-sw
   Reference: https://web.dev/articles/service-worker-lifecycle
   Reference: https://stackoverflow.com/questions/59725245
   ============================================================ */

// Install — skip waiting immediately so this SW activates ASAP
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Activate — nuke all caches, claim all clients, force reload
self.addEventListener('activate', function(event) {
  event.waitUntil(
    // Step 1: Delete every cache
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(name) {
            return caches.delete(name);
          })
        );
      })
      // Step 2: Take control of all open tabs
      .then(function() {
        return self.clients.claim();
      })
      // Step 3: Force every open tab to reload with fresh content
      .then(function() {
        return self.clients.matchAll({ type: 'window' });
      })
      .then(function(clients) {
        clients.forEach(function(client) {
          client.navigate(client.url);
        });
      })
  );
});

// Fetch — pure network pass-through, no caching whatsoever.
// Every request goes straight to the server. If offline,
// the browser's native error page will show (acceptable
// trade-off for guaranteed freshness during the reset period).
self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});
