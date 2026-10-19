// Card Binder service worker: makes the app installable, opens instantly, and works offline for
// anything already viewed. Bump VERSION to drop old caches after a change to this file.
const VERSION = 'v2';
const SHELL = `cb-shell-${VERSION}`, DATA = `cb-data-${VERSION}`, IMG = `cb-img-${VERSION}`;
const SHELL_FILES = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon.svg', 'op-sets.json', 'pokemon-packs.json', 'privacy.html'];
const MAX_IMAGES = 2500;   // ~20 KB each → roughly 50 MB at most
const MAX_DATA = 400;

// Hosts that send Access-Control-Allow-Origin: *, so images are fetched in CORS mode and cached
// as real (non-opaque) responses that count their true size against the storage quota
const DATA_HOSTS = ['api.tcgdex.net', 'raw.githubusercontent.com', 'optcgapi.com'];
const IMG_HOSTS = ['assets.tcgdex.net', 'tcgplayer-cdn.tcgplayer.com', 'images.scrydex.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('cb-') && ![SHELL, DATA, IMG].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName), keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);   // oldest first
}
// Save a copy. The copy must be taken before the response goes back to the page (which consumes
// its body), and waitUntil keeps the worker alive until the save has finished.
function put(event, cacheName, key, res, max) {
  if (!res || !res.ok) return;
  const copy = res.clone();
  event.waitUntil(caches.open(cacheName).then(c => c.put(key, copy)).then(() => trim(cacheName, max)).catch(() => {}));
}

// Pages and app files: network first so updates show at once; the cached copy when offline
async function networkFirst(event, cacheName, max) {
  const req = event.request;
  try {
    const res = await fetch(req);
    put(event, cacheName, req, res, max);
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    if (req.mode === 'navigate') { const shell = await caches.match('./'); if (shell) return shell; }
    throw err;
  }
}
// Images never change at the same URL: cache first, download once
async function cacheFirst(event, cors) {
  const req = event.request;
  const hit = await caches.match(req.url);
  if (hit) return hit;
  const res = await fetch(cors ? new Request(req.url, { mode: 'cors', credentials: 'omit' }) : req);
  put(event, IMG, req.url, res, MAX_IMAGES);
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // GraphQL POSTs, Drive uploads
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;

  if (same && url.pathname.startsWith('/api/psa10')) return;            // live prices, never cached here
  if (same && url.pathname.startsWith('/api/img')) return e.respondWith(cacheFirst(e, false));
  if (IMG_HOSTS.includes(url.hostname)) return e.respondWith(cacheFirst(e, true));
  if (DATA_HOSTS.includes(url.hostname)) return e.respondWith(networkFirst(e, DATA, MAX_DATA));
  if (same) return e.respondWith(networkFirst(e, SHELL, 100));
  // everything else (Google sign-in and Drive, pokemontcg.io, Ko-fi, GitHub) goes straight to the network
});
