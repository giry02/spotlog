import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { getOfflineTripStatus, listOfflineTripStatuses, offlineTripFingerprint, offlineTripSnapshot, permittedOfflineImage, readOfflineTripSnapshot, removeOfflineTrip, saveOfflineTrip } from '../src/offlineTrips.ts';

const origin = 'https://offline.spotlog.test', base = `${origin}/spotlog/`;
const image = '/spotlog/assets/beach.webp';
const place = () => ({ id: 'p', visitId: 'v', kind: 'LANDMARK', name: '해변', area: '부산', address: '부산 중구', lat: 35.1, lng: 129.1, image, description: '해변 소개', note: '내 방문 메모', duration: '1시간', time: '10:00' });
const trip = () => ({ id: 'offline-trip', title: '부산 여행', region: '부산', dateRange: '날짜 미정', duration: '당일', status: 'PLANNING', purpose: 'PLAN', visibility: 'PRIVATE', isMine: true, planStage: 'READY', cover: image, summary: '', story: '', tags: [], saves: 0, author: '나', days: [{ dayId: 'd', day: 1, date: '', title: '', story: '', places: [place()], blocks: [{ id: 'b', type: 'PLACE', placeId: 'p', visitId: 'v' }] }] });
const fixtures = new Map([
  [`${base}index.html`, '<html><script type="module" src="/spotlog/assets/customer.js"></script></html>'],
  [`${base}assets/customer.js`, 'export const consumer = true;'],
]);
const manifest = () => ({ schemaVersion: 1, base: '/spotlog/', version: '0123456789abcdef01234567', files: [...fixtures].map(([url, text]) => ({ url: url.replace(origin, ''), bytes: Buffer.byteLength(text), digest: createHash('sha256').update(text).digest('hex') })) });

function database(rows) {
  const api = { open() {
    const request = {};
    setTimeout(() => {
      request.result = { objectStoreNames: { contains: () => true }, close() {}, transaction() {
        const tx = { aborted: false, abort() { tx.aborted = true; setTimeout(() => tx.onabort?.(), 0); }, objectStore() {
          const query = operation => { const req = {}; setTimeout(() => { if (tx.aborted) return; req.result = operation(); req.onsuccess?.(); setTimeout(() => { if (!tx.aborted) tx.oncomplete?.(); }, 0); }, 0); return req; };
          return { get: id => query(() => structuredClone(rows.get(id))), getAll: () => query(() => structuredClone([...rows.values()])), put: value => rows.set(value.id, structuredClone(value)), delete: id => rows.delete(id) };
        } }; return tx;
      } };
      request.onsuccess?.();
    }, 0);
    return request;
  } }; return api;
}
function storage() {
  const names = new Map(), state = { putCount: 0, failPutAt: 0 };
  return { names, state, api: {
    keys: async () => [...names.keys()],
    delete: async name => names.delete(name),
    open: async name => {
      if (!names.has(name)) names.set(name, new Map()); const entries = names.get(name);
      return {
        put: async (url, response) => { state.putCount++; if (state.failPutAt === state.putCount) throw new DOMException('full', 'QuotaExceededError'); entries.set(String(url), response.clone()); },
        match: async url => entries.get(String(url))?.clone(),
      };
    },
  } };
}
async function withBrowser(run) {
  const originals = new Map(), rows = new Map(), cache = storage(), requests = [];
  const set = (key, value) => { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value, writable: true }); };
  const eventWindow = new EventTarget();
  set('window', eventWindow); set('location', { origin }); set('isSecureContext', true); set('indexedDB', database(rows)); set('caches', cache.api); set('BroadcastChannel', undefined);
  set('document', { querySelector: () => ({ src: `${base}assets/customer.js` }) });
  set('navigator', { onLine: true, serviceWorker: { register: async url => { requests.push(url); return { scope: base, active: {} }; }, ready: Promise.resolve({}) } });
  const control = { rows, cache, requests, failNetwork: false, wrongHash: false, badManifest: false, abortImage: null };
  set('fetch', async (input, options = {}) => {
    const url = String(input); requests.push(url);
    if (control.failNetwork) throw new TypeError('offline');
    if (options.signal?.aborted) throw new DOMException('cancelled', 'AbortError');
    if (url === `${base}spotlog-offline-shell.json`) {
      const value = manifest(); if (control.badManifest) value.files[1].url = '/spotlog/assets/../admin.html';
      return Response.json(value);
    }
    if (fixtures.has(url)) return new Response(control.wrongHash ? 'changed' : fixtures.get(url), { headers: { 'content-type': url.endsWith('.html') ? 'text/html' : 'application/javascript', 'content-encoding': 'gzip', 'content-length': '3' } });
    if (url === new URL(image, origin).href) { control.abortImage?.abort(); return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'image/webp' } }); }
    return new Response('', { status: 404 });
  });
  try { await run(control); } finally { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
}

test('offline copy retains itinerary identity, bookings and private notes but excludes request/editor/unknown fields', () => {
  const source = trip(); source.planningPreferences = { prompt: '내 AI 요청' }; source.editorDraft = { value: { password: 'secret' } }; source.customerRequest = 'private'; source.days[0].places[0].accessToken = 'secret'; source.days[0].places[0].bookingFixed = true;
  const copy = offlineTripSnapshot(source);
  assert.equal(copy.days[0].places[0].visitId, 'v'); assert.equal(copy.days[0].places[0].note, '내 방문 메모'); assert.equal(copy.days[0].places[0].bookingFixed, true);
  assert.ok(!JSON.stringify(copy).includes('secret')); assert.ok(!JSON.stringify(copy).includes('내 AI 요청')); assert.ok(!JSON.stringify(copy).includes('customerRequest'));
});
test('DAY focus/progress and AI prompt do not invalidate files; order, times, notes and photos do', () => {
  const source = trip(), initial = offlineTripFingerprint(source), next = structuredClone(source);
  next.travelProgress = { dayId: 'd', visitId: 'v', visits: { v: { status: 'done', recordedAt: new Date().toISOString() } } }; next.planningPreferences = { prompt: 'change' };
  assert.equal(offlineTripFingerprint(next), initial);
  for (const [key, value] of [['time', '11:00'], ['note', '수정 메모'], ['image', '/spotlog/assets/new.webp']]) { const changed = structuredClone(source); changed.days[0].places[0][key] = value; assert.notEqual(offlineTripFingerprint(changed), initial); }
});
test('selected-image whitelist excludes remote maps, uploads, API, query credentials and withdrawn photos', () => {
  const scope = new URL(base); assert.equal(permittedOfflineImage(image, scope), `${origin}${image}`);
  for (const input of ['https://tile.openstreetmap.org/1/2/3.png', '/api/media/a.png', '/spotlog/uploads/private.jpg', '/spotlog/assets/a.jpg?token=secret', '/spotlog/assets/a.jpg#foo', '/spotlog/assets/sub%2fa.jpg', 'https://a:b@offline.spotlog.test/spotlog/assets/a.jpg', '/spotlog/assets/../admin.html']) assert.equal(permittedOfflineImage(input, scope), null);
  const source = trip(); source.days[0].places[0].photos = [{ image, alt: '', caption: '', availability: 'withdrawn' }];
  assert.equal(offlineTripSnapshot(source).days[0].places[0].image, '');
});
test('loopback review allows selected licensed project photos only; deployed hosts never allow filesystem URLs', () => {
  const loopback = new URL('http://127.0.0.1:5210/spotlog/'), photo = 'http://127.0.0.1:5210/@fs/C:/Users/Giry/Documents/Spotlog/assets/spotlog/jeju-beach.webp';
  assert.equal(permittedOfflineImage(photo, loopback), photo);
  for (const folder of ['busan-business', 'public-tourism']) {
    const nested = photo.replace('/jeju-beach.webp', `/${folder}/busan.webp`); assert.equal(permittedOfflineImage(nested, loopback), nested);
  }
  for (const folder of ['private', 'uploads', 'busan-business/private', 'public-tourism/nested']) assert.equal(permittedOfflineImage(photo.replace('/jeju-beach.webp', `/${folder}/secret.webp`), loopback), null);
  for (const input of [photo.replace('assets/spotlog', 'uploads'), photo.replace('Spotlog/assets/spotlog', 'Spotlog/web/src'), `${photo}?token=secret`, `${photo}#a`, photo.replace('jeju-beach', 'folder%2fprivate'), photo.replace('jeju-beach.webp', 'admin.html'), photo.replace('127.0.0.1', '192.168.0.10')]) assert.equal(permittedOfflineImage(input, loopback), null);
  assert.equal(permittedOfflineImage(`${origin}/@fs/C:/Users/Giry/Documents/Spotlog/assets/spotlog/jeju-beach.webp`, new URL(base)), null);
});
test('explicit save verifies shell, optional selected photos, decompression headers and metadata, then removes only own package', async () => withBrowser(async env => {
  const source = trip(), before = await getOfflineTripStatus(source); assert.equal(before.state, 'none'); assert.equal(env.requests.length, 0);
  const foreign = await caches.open('another-app'); await foreign.put(`${origin}/private`, new Response('untouched'));
  const saved = await saveOfflineTrip(source); assert.equal(saved.state, 'saved'); assert.equal(saved.imageCount, 1); assert.equal(saved.missingImages, 0);
  assert.equal((await getOfflineTripStatus(source)).state, 'saved'); assert.equal((await readOfflineTripSnapshot(source.id)).days[0].places[0].name, '해변');
  const record = env.rows.get(source.id), shell = await (await caches.open(record.cacheName)).match(`${base}index.html`); assert.equal(shell.headers.get('content-encoding'), null); assert.equal(shell.headers.get('content-length'), null);
  source.days[0].places[0].note = '변경'; assert.equal((await getOfflineTripStatus(source)).state, 'stale');
  await removeOfflineTrip(source.id); assert.equal((await getOfflineTripStatus(source)).state, 'none'); assert.ok(env.cache.names.has('another-app'));
}));
test('quota failure replacing a package preserves old pointer/files; later retry commits new one', async () => withBrowser(async env => {
  const source = trip(); await saveOfflineTrip(source); const old = structuredClone(env.rows.get(source.id));
  source.days[0].places[0].note = '변경'; env.cache.state.failPutAt = env.cache.state.putCount + 2;
  await assert.rejects(saveOfflineTrip(source), /저장 공간/); assert.deepEqual(env.rows.get(source.id), old); assert.ok(env.cache.names.has(old.cacheName)); assert.equal(env.cache.names.size, 1);
  assert.equal((await readOfflineTripSnapshot(source.id)).days[0].places[0].note, '내 방문 메모');
  env.cache.state.failPutAt = 0; await saveOfflineTrip(source); assert.notEqual(env.rows.get(source.id).cacheName, old.cacheName); assert.ok(!env.cache.names.has(old.cacheName)); assert.equal((await getOfflineTripStatus(source)).state, 'saved');
}));
test('missing external/404 photos are counted without caching them or inventing successful coverage', async () => withBrowser(async env => {
  const source = trip(); source.cover = 'https://images.example.invalid/a.jpg'; source.days[0].places[0].image = '/spotlog/assets/missing.webp';
  const result = await saveOfflineTrip(source); assert.equal(result.state, 'saved'); assert.equal(result.imageCount, 0); assert.equal(result.missingImages, 2); assert.match(result.message, /2장/);
  assert.ok(!env.requests.some(url => url.includes('example.invalid'))); assert.equal(env.rows.get(source.id).imageUrls.length, 0);
}));
test('abort, hash mismatch and invalid manifest preserve previous verified package', async () => withBrowser(async env => {
  const source = trip(); await saveOfflineTrip(source); const previous = env.rows.get(source.id).cacheName;
  env.wrongHash = true; await assert.rejects(saveOfflineTrip(source), /갱신/); env.wrongHash = false;
  env.badManifest = true; await assert.rejects(saveOfflineTrip(source), /파일 구성/); env.badManifest = false;
  const controller = new AbortController(); env.abortImage = controller; await assert.rejects(saveOfflineTrip(source, { signal: controller.signal }), error => error.name === 'AbortError');
  assert.equal(env.rows.get(source.id).cacheName, previous); assert.equal(env.cache.names.size, 1);
}));
test('partial browser eviction shows unavailable with repair; malformed unrelated metadata cannot break good trips', async () => withBrowser(async env => {
  const source = trip(); await saveOfflineTrip(source); const old = env.rows.get(source.id); const cache = env.cache.names.get(old.cacheName); cache.delete(`${base}assets/customer.js`);
  const missing = await getOfflineTripStatus(source); assert.equal(missing.state, 'unavailable'); assert.equal(missing.canSave, true);
  await saveOfflineTrip(source); env.rows.set('foreign-corrupt', { id: 'foreign-corrupt', cacheName: null, shellUrls: null }); assert.equal((await getOfflineTripStatus(source)).state, 'saved'); assert.equal(Object.keys(await listOfflineTripStatuses()).length, 1);
  env.rows.set(source.id, { id: source.id, cacheName: 'another-app', savedAt: null }); const bad = await getOfflineTripStatus(source); assert.equal(bad.state, 'unavailable'); assert.equal(bad.canSave, true);
  await saveOfflineTrip(source); assert.equal((await getOfflineTripStatus(source)).state, 'saved');
}));
test('draft/public/trash/native/offline saves do not register workers or cache data', async () => withBrowser(async env => {
  for (const patch of [{ purpose: 'JOURNAL' }, { visibility: 'PUBLIC' }, { isMine: false }, { trash: {} }, { planStage: 'DRAFT' }, { businessCandidates: [{}] }]) await assert.rejects(saveOfflineTrip({ ...trip(), ...patch }));
  assert.equal(env.requests.length, 0); navigator.onLine = false; await assert.rejects(saveOfflineTrip(trip()), /인터넷/); assert.equal(env.requests.length, 0);
  window.ReactNativeWebView = {}; const state = await getOfflineTripStatus(trip()); assert.equal(state.canSave, false); await assert.rejects(saveOfflineTrip(trip()), /앱의 오프라인/); assert.equal(env.requests.length, 0);
}));
test('cancel during service-worker preparation returns promptly without caching a package', async () => withBrowser(async env => {
  navigator.serviceWorker.ready = new Promise(() => {});
  const controller = new AbortController(), pending = saveOfflineTrip(trip(), { signal: controller.signal });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(pending, error => error.name === 'AbortError'); assert.equal(env.rows.size, 0); assert.equal(env.cache.names.size, 0);
}));
test('native/DEV-style source cleanup removes verified deployed-scope copy without worker requests or foreign cache deletion', async () => withBrowser(async env => {
  const source = trip(); await saveOfflineTrip(source); const record = env.rows.get(source.id), requestsBefore = env.requests.length;
  const foreign = await caches.open('unrelated-cache'); await foreign.put(`${origin}/private`, new Response('foreign'));
  window.ReactNativeWebView = {};
  await removeOfflineTrip(source.id); assert.ok(!env.rows.has(source.id)); assert.ok(!env.cache.names.has(record.cacheName)); assert.ok(env.cache.names.has('unrelated-cache')); assert.equal(env.requests.length, requestsBefore);
  env.rows.set('malformed', { id: 'malformed', cacheName: 'unrelated-cache' }); await removeOfflineTrip('malformed'); assert.ok(!env.rows.has('malformed')); assert.ok(env.cache.names.has('unrelated-cache'));
}));
test('actual DEV base / cleanup can delete a saved /spotlog/ package while save stays unavailable', async () => withBrowser(async env => {
  const source = trip(); await saveOfflineTrip(source); const record = env.rows.get(source.id), requestCount = env.requests.length;
  const file = new URL('../src/offlineTrips.ts', import.meta.url), photos = new URL('../src/placePhotos.ts', import.meta.url).href;
  const code = readFileSync(file, 'utf8').replace("from './placePhotos.ts'", `from '${photos}'`).replaceAll('import.meta.env?.BASE_URL', "'/'").replaceAll('import.meta.env?.DEV', 'true');
  const review = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(code, { mode: 'strip' })).toString('base64')}`);
  assert.equal((await review.getOfflineTripStatus(source)).canSave, false);
  await review.removeOfflineTrip(source.id); assert.ok(!env.rows.has(source.id)); assert.ok(!env.cache.names.has(record.cacheName)); assert.equal(env.requests.length, requestCount);
}));
test('service worker cold-navigation fallback is selected-package-only; API/admin/manual/tiles never intercepted', async () => {
  const listeners = {}, rows = new Map(), cache = storage(), cacheName = 'spotlog-offline-trip-v1-12345678-1234-1234-1234-123456789abc';
  const record = { id: 't', schemaVersion: 1, cacheName, savedAt: new Date().toISOString(), shellUrls: [...fixtures.keys()], imageUrls: [`${origin}${image}`] };
  rows.set('t', record); rows.set('bad', { schemaVersion: 1, cacheName, savedAt: null, shellUrls: null });
  const packageCache = await cache.api.open(cacheName); await packageCache.put(`${base}index.html`, new Response('offline-shell')); await packageCache.put(`${base}assets/customer.js`, new Response('offline-js')); await packageCache.put(`${origin}${image}`, new Response('offline-image'));
  const context = vm.createContext({ URL, Response, indexedDB: database(rows), caches: cache.api, fetch: async () => { throw new Error('offline'); }, self: { registration: { scope: base }, addEventListener: (name, fn) => { listeners[name] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } } });
  vm.runInContext(readFileSync(new URL('../public/spotlog-offline-sw.js', import.meta.url), 'utf8'), context);
  const run = async request => { let result; listeners.fetch({ request, respondWith: promise => { result = promise; } }); return result ? await result : null; };
  assert.equal(await (await run({ method: 'GET', mode: 'navigate', url: `${base}#trip-t` })).text(), 'offline-shell');
  assert.equal(await (await run({ method: 'GET', mode: 'cors', url: `${base}assets/customer.js` })).text(), 'offline-js');
  assert.equal(await (await run({ method: 'GET', mode: 'cors', url: `${origin}${image}` })).text(), 'offline-image');
  for (const url of [`${base}admin.html`, `${base}manual/admin/`, `${origin}/api/admin/v1`, `${base}assets/customer.js?token=private`, 'https://tile.openstreetmap.org/1/2/3.png', `${base}__offline__/trip/t`]) assert.equal(await run({ method: 'GET', mode: 'navigate', url }), null);
  assert.equal(await run({ method: 'POST', mode: 'cors', url: base }), null);
  rows.delete('t'); assert.equal((await run({ method: 'GET', mode: 'navigate', url: base })).type, 'error'); assert.equal(cache.names.size, 1);
});
