/**
 * THE LEXICON — Service Worker v2
 *
 * Strategy:
 *   Navigation requests: network-first (always fresh HTML shell after deploy)
 *   App shell static (CSS/manifest/favicon): stale-while-revalidate
 *   Entry images (/public/THE-LEXICON-ASSETS/**): stale-while-revalidate
 *   database.js: network-first, stale-while-revalidate fallback
 *   JS modules (/js/**): stale-while-revalidate
 *   External (Google APIs, Firebase, fonts): passthrough (no cache)
 */

const CACHE_VERSION = 2;
const CACHE_NAME   = `lexicon-v${CACHE_VERSION}`;
const IMAGES_CACHE = `lexicon-images-v${CACHE_VERSION}`;

const SHELL = [
  '/',
  '/index.html',
  '/index.css',
  '/favicon.svg',
  '/site.webmanifest',
];

// ── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: prune old caches + notify clients ─────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== IMAGES_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
     .then(() => {
       // Notify all open tabs that a new version is active
       self.clients.matchAll({ type: 'window' }).then(clients => {
         clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
       });
     })
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Entry images: stale-while-revalidate
  if (url.pathname.startsWith('/public/THE-LEXICON-ASSETS/')) {
    e.respondWith(staleWhileRevalidate(request, IMAGES_CACHE));
    return;
  }

  // database.js: network-first, fall back to cache
  if (url.pathname === '/database.js') {
    e.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  // Navigation requests: network-first with SPA fallback
  // This ensures users always get the latest HTML shell after deploy,
  // and deep links (/entry/slug) work offline by falling back to cached /index.html
  if (request.mode === 'navigate') {
    e.respondWith(navigationHandler(request));
    return;
  }

  // Static shell files: stale-while-revalidate
  if (SHELL.some(p => url.pathname === p)) {
    e.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }

  // JS modules: stale-while-revalidate (not cache-first)
  if (url.pathname.startsWith('/js/')) {
    e.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }
});

// ── Strategies ───────────────────────────────────────────────────────────────

/**
 * Navigation handler: network-first with SPA fallback.
 * - Try network first (always get latest HTML after deploy)
 * - If network fails, fall back to cached version of the exact URL
 * - If that misses too, fall back to cached /index.html (SPA shell)
 */
async function navigationHandler(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Offline: try exact URL first, then fall back to app shell
    const cached = await cache.match(request);
    if (cached) return cached;
    return cache.match('/index.html');
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cache.match(request);
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(r => {
    if (r.ok) cache.put(request, r.clone());
    return r;
  }).catch(() => {});
  return cached || fetchPromise;
}
