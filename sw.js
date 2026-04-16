/* ============================================================
   Service Worker — Cass la Ria
   Cache-first strategy for the app shell with offline fallback.
   Caches core HTML, CSS, JS, fonts, and icons on install so
   the site loads instantly on repeat visits and works offline.

   v2: Added offline.html fallback, 404.html, and time-theme.js
   to the cached assets. Navigation requests that fail now serve
   the offline page instead of a browser error.

   v3: Celestial body system (sun + moon) added to rain.js.
   Cache bump forces all clients to pick up the new weather engine.

   v4: Added cicero story page, editable translation system,
   and door interaction. Cache bump forces all clients to pick
   up the new content. Switched sub-resources to stale-while-
   revalidate with version-aware cache busting.

   Reference: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   Reference: https://web.dev/articles/service-workers-cache-storage
   Reference: https://web.dev/articles/offline-fallback-page
   ============================================================ */

const CACHE_NAME = 'casslaria-v9';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/cicero.html',
  '/404.html',
  '/offline.html',
  '/css/variables.css',
  '/css/reset.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/animations.css',
  '/css/rain.css',
  '/css/fonts.css',
  '/css/fonts-cjk.css',
  '/css/editable.css',
  '/css/cicero.css',
  '/js/i18n.js',
  '/js/main.js',
  '/js/time-theme.js',
  '/js/rain.js',
  '/js/wet-text.js',
  '/js/editable.js',
  '/js/cicero.js',
  '/assets/fonts/cormorant-garamond-v21-latin-regular.woff2',
  '/assets/fonts/cormorant-garamond-v21-latin-300.woff2',
  '/assets/fonts/cormorant-garamond-v21-latin-600.woff2',
  '/assets/icons/favicon-32x32.png',
  '/assets/icons/favicon-192x192.png',
  '/assets/icons/favicon-512x512.png'
];

// Install — pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches and immediately claim all clients
// so that the new service worker takes over without requiring a
// second page load. This is critical for iOS Safari which can be
// slow to activate updated service workers.
// Reference: https://web.dev/articles/service-worker-lifecycle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch — network-first for HTML, stale-while-revalidate for sub-resources.
//
// Previous strategy was cache-first for sub-resources, which caused
// stale content on devices with persistent service worker caches
// (notably iOS Safari on older iPhones like iPhone XR). The cache-
// first approach returns old files immediately and only updates the
// cache in the background — meaning users see stale content until
// their NEXT visit.
//
// New strategy: network-first for ALL requests. This ensures users
// always get the latest content. If the network fails, fall back to
// cache. This trades a small latency increase for guaranteed freshness.
//
// Reference: https://web.dev/articles/offline-cookbook#network-falling-back-to-cache
// Reference: https://stackoverflow.com/questions/51435349
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (e.g., Google Fonts — those have their own caching)
  if (!request.url.startsWith(self.location.origin)) return;

  // Navigation requests (HTML pages) — network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: try cache first, then fall back to offline.html
          return caches.match(request)
            .then((cached) => cached || caches.match('/offline.html'));
        })
    );
    return;
  }

  // Sub-resources (CSS, JS, fonts, images) — network-first with cache fallback.
  // Always try the network first to ensure freshness. If the network
  // request succeeds, update the cache and return the fresh response.
  // If it fails (offline), return the cached version.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
