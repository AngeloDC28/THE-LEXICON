/**
 * THE LEXICON — Service Worker
 *
 * Strategy:
 *   App shell (HTML/CSS/JS/manifest): cache-first, updated in background
 *   Entry images (/public/THE-LEXICON-ASSETS/**): stale-while-revalidate
 *   External (Google APIs, Firebase, fonts): network-first, no cache
 *   database.js: network-first, stale-while-revalidate fallback
 */

const CACHE_NAME   = 'lexicon-v1';
const IMAGES_CACHE = 'lexicon-images-v1';

const SHELL = [
  '/',
  '/index.html',
  '/index.css',
  '/database.js',
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

// ── Activate: prune old caches ───────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== IMAGES_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin and the assets origin
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

  // App shell routes (navigation + static files): cache-first
  if (request.mode === 'navigate' || SHELL.some(p => url.pathname === p)) {
    e.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // JS modules: cache-first
  if (url.pathname.startsWith('/js/')) {
    e.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }
});

// ── Strategies ───────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Background refresh
    fetch(request).then(r => { if (r.ok) cache.put(request, r); }).catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
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
