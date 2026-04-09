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

   Reference: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   Reference: https://web.dev/articles/service-workers-cache-storage
   Reference: https://web.dev/articles/offline-fallback-page
   ============================================================ */

const CACHE_NAME = 'casslaria-v5';

const CORE_ASSETS = [
  '/',
  '/index.html',
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
  '/js/i18n.js',
  '/js/main.js',
  '/js/time-theme.js',
  '/js/rain.js',
  '/js/wet-text.js',
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

// Activate — clean up old caches
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

// Fetch — cache-first for core assets, network-first for everything else.
// Navigation requests that fail (offline) fall back to /offline.html.
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

  // Sub-resources (CSS, JS, fonts, images) — cache-first with background update
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          // Return cached version immediately, but also update cache in background
          fetch(request)
            .then((response) => {
              if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
              }
            })
            .catch(() => { /* offline — cached version is fine */ });

          return cached;
        }

        // Not in cache — fetch from network
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          });
      })
  );
});
