/* Explicit selected-trip packages only. No automatic runtime, map, API or GPS caching. */
const DATABASE = 'spotlog.offline-trips.v1';
const STORE = 'trips';
const CACHE_PREFIX = 'spotlog-offline-trip-v1-';
const base = new URL(self.registration.scope);
function assetUrl(source, expression) {
  try { const url = new URL(source); return typeof source === 'string' && url.href === source && url.origin === base.origin && !url.search && !url.hash && !url.username && !url.password && !/%2f|%5c|%2e/i.test(url.pathname) && url.pathname.startsWith(`${base.pathname}assets/`) && expression.test(url.pathname); } catch { return false; }
}
function reviewPhotoUrl(source) {
  try {
    const url = new URL(source);
    return typeof source === 'string' && url.href === source && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
      && url.origin === base.origin && !url.search && !url.hash && !url.username && !url.password && !/%2f|%5c|%2e/i.test(url.pathname)
      && /^\/@fs\/[a-z]:\/(?:[^/]+\/)*Spotlog\/assets\/spotlog\/(?:busan-business\/|public-tourism\/)?[^/]+\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(url.pathname);
  } catch { return false; }
}
function validRecord(record) {
  return record && record.schemaVersion === 1 && typeof record.id === 'string' && typeof record.cacheName === 'string'
    && /^spotlog-offline-trip-v1-[a-f0-9-]{36}$/.test(record.cacheName) && typeof record.savedAt === 'string' && Number.isFinite(Date.parse(record.savedAt))
    && Array.isArray(record.shellUrls) && record.shellUrls.includes(new URL('index.html', base).href)
    && record.shellUrls.every(url => url === new URL('index.html', base).href || assetUrl(url, /\.(?:m?js|css|woff2?|ttf|otf)$/))
    && Array.isArray(record.imageUrls) && record.imageUrls.every(url => assetUrl(url, /\.(?:png|jpe?g|webp|gif|avif|svg)$/i) || reviewPhotoUrl(url));
}
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function records() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly'); const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((Array.isArray(request.result) ? request.result : []).filter(validRecord).sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    request.onerror = () => reject(request.error); tx.oncomplete = tx.onabort = () => db.close();
  });
}
function eligible(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== base.origin) return null;
  if (reviewPhotoUrl(url.href)) return { navigation: false, key: url.href };
  if (!url.pathname.startsWith(base.pathname)) return null;
  const navigation = request.mode === 'navigate' && (url.pathname === base.pathname || url.pathname === `${base.pathname}index.html`);
  if (navigation) return { navigation: true, key: new URL('index.html', base).href };
  if (url.search || url.username || url.password || /%2f|%5c|%2e/i.test(url.pathname) || !url.pathname.startsWith(`${base.pathname}assets/`)) return null;
  if (!/\.(?:m?js|css|woff2?|ttf|otf|png|jpe?g|webp|gif|avif|svg)$/i.test(url.pathname)) return null;
  return { navigation: false, key: url.href };
}
self.addEventListener('fetch', event => {
  const target = eligible(event.request); if (!target) return;
  event.respondWith((async () => {
    try { const response = await fetch(event.request); if (response.ok) return response; throw new Error('Network response unavailable'); } catch {
      try {
        for (const record of await records()) {
          if (!target.navigation && ![...(record.shellUrls || []), ...(record.imageUrls || [])].includes(target.key)) continue;
          if (!(await caches.keys()).includes(record.cacheName)) continue;
          const response = await (await caches.open(record.cacheName)).match(target.key);
          if (response) return response;
        }
      } catch { /* An inaccessible/evicted cache must not become a fake success. */ }
      return Response.error();
    }
  })());
});
