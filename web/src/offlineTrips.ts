import type { Journey, Place } from './data';
import { resolvePlacePhotos } from './placePhotos.ts';

export type OfflineTripState = 'none' | 'saved' | 'stale' | 'unavailable';
export interface OfflineTripStatus {
  state: OfflineTripState;
  canSave?: boolean;
  savedAt?: string;
  bytes?: number;
  imageCount?: number;
  missingImages?: number;
  message?: string;
}
interface ShellFile { url: string; bytes: number; digest: string }
interface ShellManifest { schemaVersion: 1; base: string; version: string; files: ShellFile[] }
interface OfflineRecord {
  id: string; schemaVersion: 1; cacheName: string; savedAt: string; fingerprint: string;
  bytes: number; imageCount: number; missingImages: number; shellVersion: string;
  shellUrls: string[]; imageUrls: string[]; snapshotUrl: string;
}
const DATABASE = 'spotlog.offline-trips.v1';
const STORE = 'trips';
const CACHE_PREFIX = 'spotlog-offline-trip-v1-';
const CHANGE_EVENT = 'spotlog-offline-trips-changed';
const MAX_PACKAGE_BYTES = 96 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const BASE = () => new URL(import.meta.env?.BASE_URL ?? '/spotlog/', location.origin);
let queue: Promise<unknown> = Promise.resolve();
let broadcast: BroadcastChannel | null = null;

function supportedMessage(): string | null {
  if (typeof window !== 'undefined' && window.ReactNativeWebView) return '앱의 오프라인 저장은 아직 준비 중이에요. 브라우저에서 여행을 열어 저장해주세요.';
  if (typeof window === 'undefined' || !globalThis.isSecureContext || !('serviceWorker' in navigator) || !globalThis.caches || !globalThis.indexedDB) return '이 브라우저에서는 오프라인 저장을 사용할 수 없어요. HTTPS 주소를 지원하는 브라우저로 열어주세요.';
  if (import.meta.env?.DEV) return '개발 화면에서는 오프라인 저장을 확인할 수 없어요. 빌드 미리보기 화면에서 저장해주세요.';
  return null;
}
function assertOwnPlan(journey: Journey) {
  if (!journey || journey.purpose !== 'PLAN' || !journey.isMine || journey.visibility !== 'PRIVATE' || journey.trash || !journey.id) throw new Error('내 여행의 비공개 일정만 오프라인으로 저장할 수 있어요.');
}
/** The customer's AI request and editor recovery payload are not copied into this package. */
export function offlineTripSnapshot(journey: Journey): Journey {
  assertOwnPlan(journey);
  const cleanPlace = (place: Place): Place => {
    const photos = resolvePlacePhotos(place, [], true).map(photo => ({ mediaId: photo.mediaId, placeId: photo.placeId, sourceId: photo.sourceId, image: photo.image, alt: photo.alt, caption: photo.caption, objectPosition: photo.objectPosition, availability: photo.availability }));
    return {
      id: place.id, visitId: place.visitId, anchorVisitId: place.anchorVisitId, personal: place.personal, locationVerified: place.locationVerified,
      stayDayIds: place.stayDayIds, bookingFixed: place.bookingFixed, planningSlot: place.planningSlot,
      kind: place.kind, name: place.name, area: place.area, address: place.address, lat: place.lat, lng: place.lng,
      image: photos[0]?.image ?? '', photos, description: place.description, note: place.note, duration: place.duration,
      time: place.time, move: place.move, creator: place.creator, hook: place.hook, bestTime: place.bestTime, tags: place.tags,
    };
  };
  return {
    id: journey.id, purpose: 'PLAN', isMine: true, visibility: 'PRIVATE', planStage: journey.planStage,
    title: journey.title, region: journey.region, dateRange: journey.dateRange, duration: journey.duration,
    status: journey.status, cover: journey.cover, summary: journey.summary, story: journey.story, tags: journey.tags,
    author: journey.author, saves: 0, startDate: journey.startDate, sourceTripId: journey.sourceTripId,
    sourceJourneyId: journey.sourceJourneyId, sourceAuthor: journey.sourceAuthor,
    recommendationKind: journey.recommendationKind, recommendationBasis: journey.recommendationBasis,
    travelProgress: journey.travelProgress ? { dayId: journey.travelProgress.dayId, visitId: journey.travelProgress.visitId, visits: Object.fromEntries(Object.entries(journey.travelProgress.visits).map(([id, progress]) => [id, { status: progress.status, recordedAt: progress.recordedAt }])) } : undefined,
    days: journey.days.map(day => ({ dayId: day.dayId, day: day.day, date: day.date, title: day.title, story: day.story,
      places: day.places.map(cleanPlace), blocks: day.blocks.map(block => ({ id: block.id, type: block.type, heading: block.heading, body: block.body, image: block.image, caption: block.caption, placeId: block.placeId, visitId: block.visitId,
        images: block.images?.map(image => ({ id: image.id, image: image.image, caption: image.caption })) })),
      planningGaps: day.planningGaps?.map(gap => ({ id: gap.id, kind: gap.kind, slot: gap.slot, reason: gap.reason, afterVisitId: gap.afterVisitId, beforeVisitId: gap.beforeVisitId })) })),
    businessCandidates: journey.businessCandidates?.map(group => ({ id: group.id, dayId: group.dayId, anchorVisitId: group.anchorVisitId, kind: group.kind, slot: group.slot, selectedId: group.selectedId,
      options: group.options.map(option => ({ fixed: option.fixed, place: cleanPlace(option.place) })) })),
  };
}
/** DAY focus and visit completion live in the existing repository, not the downloaded file set. */
export function offlineTripFingerprint(journey: Journey): string { return JSON.stringify({ ...offlineTripSnapshot(journey), travelProgress: undefined }); }
function assertSaveablePlan(journey: Journey) {
  assertOwnPlan(journey);
  if (journey.planStage === 'DRAFT' || journey.businessCandidates?.length || !Array.isArray(journey.days) || !journey.days.length || !journey.days.some(day => day.places.length > 0)) throw new Error('방문할 곳을 확인하고 내 여행을 완성한 뒤 저장해주세요.');
  const strings = [journey.id, journey.title, journey.region, journey.dateRange, journey.duration, journey.status, journey.cover, journey.summary, journey.story, journey.author];
  if (strings.some(value => typeof value !== 'string') || journey.id.length > 240 || !Array.isArray(journey.tags) || journey.days.length > 30 || !['PLANNING', 'TRAVELING', 'PUBLISHED'].includes(journey.status)) throw new Error('여행 정보를 확인하지 못했어요. 내 여행에서 일정을 다시 확인해주세요.');
  for (const day of journey.days) {
    if (!Number.isInteger(day.day) || day.day < 1 || !Array.isArray(day.places) || !Array.isArray(day.blocks) || day.places.length > 300 || [day.date, day.title, day.story].some(value => typeof value !== 'string')) throw new Error('DAY 정보를 확인하지 못했어요. 내 여행에서 일정을 다시 확인해주세요.');
    for (const place of day.places) if ([place.id, place.name, place.kind, place.area, place.address, place.image, place.description, place.note, place.duration].some(value => typeof value !== 'string') || !['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP', 'LEISURE'].includes(place.kind)) throw new Error('방문 장소 정보를 확인하지 못했어요. 내 여행에서 일정을 다시 확인해주세요.');
  }
}
function imageSources(journey: Journey): string[] {
  const urls = new Set<string>();
  const add = (source?: string) => { if (source) urls.add(source); };
  add(journey.cover);
  for (const day of journey.days) {
    for (const place of day.places) { resolvePlacePhotos(place, [], true).forEach(photo => add(photo.image)); }
    for (const block of day.blocks) { add(block.image); block.images?.forEach(image => add(image.image)); }
  }
  for (const group of journey.businessCandidates ?? []) for (const option of group.options) resolvePlacePhotos(option.place, [], true).forEach(photo => add(photo.image));
  return [...urls];
}
export function permittedOfflineImage(source: string, base = BASE()): string | null {
  try {
    const url = new URL(source, base);
    return canonicalAsset(url.href, /\.(?:png|jpe?g|webp|gif|avif|svg)$/i, base) || permittedReviewPhoto(url, base) ? url.href : null;
  } catch { return null; }
}
function permittedReviewPhoto(url: URL, base: URL): boolean {
  // Existing DEV trips refer to licensed project photos through Vite's /@fs route.
  // This exception is selected-photo-only and exists solely on this computer's loopback host.
  return ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) && url.origin === base.origin
    && !url.username && !url.password && !url.search && !url.hash && !/%2f|%5c|%2e/i.test(url.pathname)
    && /^\/@fs\/[a-z]:\/(?:[^/]+\/)*Spotlog\/assets\/spotlog\/(?:busan-business\/|public-tourism\/)?[^/]+\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(url.pathname);
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('기기 저장 공간을 열지 못했어요. 브라우저 저장 설정을 확인해주세요.'));
    request.onblocked = () => reject(new Error('다른 탭을 닫고 다시 저장해주세요.'));
  });
}
function canonicalAsset(source: unknown, extension: RegExp, base = BASE()): source is string {
  if (typeof source !== 'string') return false;
  try { const url = new URL(source); return url.href === source && url.origin === base.origin && !url.search && !url.hash && !url.username && !url.password && !/%2f|%5c|%2e/i.test(url.pathname) && url.pathname.startsWith(`${base.pathname}assets/`) && extension.test(url.pathname); } catch { return false; }
}
function validRecord(value: unknown, base = BASE()): value is OfflineRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as OfflineRecord;
  return record.schemaVersion === 1 && typeof record.id === 'string' && !!record.id && record.id.length <= 240
    && /^spotlog-offline-trip-v1-[a-f0-9-]{36}$/.test(record.cacheName)
    && typeof record.savedAt === 'string' && Number.isFinite(Date.parse(record.savedAt))
    && typeof record.fingerprint === 'string' && typeof record.shellVersion === 'string' && /^[a-f0-9]{24}$/.test(record.shellVersion)
    && Number.isInteger(record.bytes) && record.bytes >= 0 && record.bytes <= MAX_PACKAGE_BYTES
    && Number.isInteger(record.imageCount) && record.imageCount >= 0 && Number.isInteger(record.missingImages) && record.missingImages >= 0
    && record.snapshotUrl === new URL(`__offline__/trip/${encodeURIComponent(record.id)}`, base).href
    && Array.isArray(record.shellUrls) && record.shellUrls.length > 1 && record.shellUrls.length < 80
    && record.shellUrls.includes(new URL('index.html', base).href)
    && record.shellUrls.every(url => url === new URL('index.html', base).href || canonicalAsset(url, /\.(?:m?js|css|woff2?|ttf|otf)$/, base))
    && Array.isArray(record.imageUrls) && record.imageUrls.every(url => typeof url === 'string' && permittedOfflineImage(url, base) === url)
    && new Set(record.shellUrls).size === record.shellUrls.length && new Set(record.imageUrls).size === record.imageUrls.length;
}
async function rawRecords(): Promise<unknown[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => {
      const rows: unknown[] = Array.isArray(request.result) ? request.result : [];
      resolve(rows);
    };
    request.onerror = () => reject(new Error('오프라인 저장 상태를 읽지 못했어요.'));
    tx.oncomplete = () => db.close(); tx.onabort = () => db.close();
  });
}
async function records(targetId?: string): Promise<OfflineRecord[]> {
  const rows = await rawRecords();
  if (targetId && rows.some(value => value && typeof value === 'object' && (value as { id?: unknown }).id === targetId && !validRecord(value))) throw new Error('이 여행의 오프라인 저장 정보를 읽지 못했어요. 온라인에서 다시 저장해주세요.', { cause: 'CORRUPT_OFFLINE_RECORD' });
  return rows.filter(value => validRecord(value));
}
/** Compare-and-swap also protects browsers without the Web Locks API. */
async function commit(record: OfflineRecord | null, id: string, expected?: string, signal?: AbortSignal, scope = BASE()): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite'); const store = tx.objectStore(STORE);
    const request = store.get(id); let conflict = false, cancelled = false;
    const stop = () => { cancelled = true; try { tx.abort(); } catch { /* Already committed; no pending transaction remains. */ } };
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted) stop();
    request.onsuccess = () => {
      const current = validRecord(request.result, scope) ? request.result.cacheName : undefined;
      if (current !== expected) { conflict = true; tx.abort(); return; }
      if (record) store.put(record); else store.delete(id);
    };
    tx.oncomplete = () => { signal?.removeEventListener('abort', stop); db.close(); resolve(); };
    tx.onabort = tx.onerror = () => { signal?.removeEventListener('abort', stop); db.close(); reject(cancelled ? new DOMException('저장을 취소했어요.', 'AbortError') : new Error(conflict ? '다른 탭에서 저장 상태가 바뀌었어요. 상태를 확인한 뒤 다시 시도해주세요.' : '오프라인 저장을 완료하지 못했어요. 기기 저장 공간을 확인해주세요.')); };
  });
}
function changed(id: string) {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id } }));
  if ('BroadcastChannel' in window) { broadcast ??= new BroadcastChannel(CHANGE_EVENT); broadcast.postMessage({ id }); }
}
export function subscribeOfflineChanges(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANGE_EVENT) : null;
  if (channel) channel.onmessage = () => callback();
  return () => { window.removeEventListener(CHANGE_EVENT, callback); channel?.close(); };
}
async function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const run = () => navigator.locks ? navigator.locks.request('spotlog-offline-trips-v1', operation) : operation();
  const pending = queue.then(run, run); queue = pending.catch(() => {}); return pending;
}
async function hasPackage(record: OfflineRecord): Promise<boolean> {
  if (!record.cacheName.startsWith(CACHE_PREFIX) || !record.shellUrls.length) return false;
  if (!(await caches.keys()).includes(record.cacheName)) return false;
  const cache = await caches.open(record.cacheName);
  return (await Promise.all([...record.shellUrls, record.snapshotUrl, ...record.imageUrls].map(url => cache.match(url)))).every(Boolean);
}
function toStatus(record: OfflineRecord, state: OfflineTripState): OfflineTripStatus {
  return { state, canSave: true, savedAt: record.savedAt, bytes: record.bytes, imageCount: record.imageCount, missingImages: record.missingImages,
    message: record.missingImages ? `사진 ${record.missingImages}장은 저장하지 못했어요. 일정과 저장한 사진은 오프라인에서 볼 수 있어요.` : undefined };
}
export async function getOfflineTripStatus(journey: Journey): Promise<OfflineTripStatus> {
  const unavailable = supportedMessage(); if (unavailable) return { state: 'unavailable', canSave: false, message: unavailable };
  try {
    assertOwnPlan(journey);
    const record = (await records(journey.id)).find(item => item.id === journey.id);
    if (!record) return { state: 'none', canSave: true };
    if (!await hasPackage(record)) return { ...toStatus(record, 'unavailable'), message: '기기에 저장한 파일 일부가 없어졌어요. 온라인에서 다시 저장해주세요.' };
    const currentEntry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
    const shellChanged = currentEntry?.startsWith(new URL('assets/', BASE()).href) && !record.shellUrls.includes(currentEntry);
    return toStatus(record, record.fingerprint === offlineTripFingerprint(journey) && !shellChanged ? 'saved' : 'stale');
  } catch (error) { return { state: 'unavailable', canSave: error instanceof Error && error.cause === 'CORRUPT_OFFLINE_RECORD', message: error instanceof Error ? error.message : '오프라인 저장 상태를 확인하지 못했어요.' }; }
}
export async function listOfflineTripStatuses(): Promise<Record<string, OfflineTripStatus>> {
  if (supportedMessage()) return {};
  try { const items = await records(); return Object.fromEntries(await Promise.all(items.map(async record => [record.id, toStatus(record, await hasPackage(record) ? 'saved' : 'unavailable')]))); } catch { return {}; }
}
export async function readOfflineTripSnapshot(id: string): Promise<Journey | null> {
  if (supportedMessage()) return null;
  const record = (await records(id)).find(item => item.id === id); if (!record || !await hasPackage(record)) return null;
  try { const response = await (await caches.open(record.cacheName)).match(record.snapshotUrl); return response ? await response.json() as Journey : null; } catch { return null; }
}
function abort(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('저장을 취소했어요.', 'AbortError'); }
async function digest(buffer: ArrayBuffer): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
async function fetchFile(url: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(url, { signal, cache: 'no-store', credentials: 'omit', redirect: 'error' });
  if (!response.ok || response.type === 'opaque') throw new Error('오프라인 파일을 내려받지 못했어요. 인터넷 연결 후 다시 저장해주세요.');
  return response;
}
function storedResponse(buffer: ArrayBuffer, response: Response): Response {
  const headers = new Headers(response.headers);
  // Fetch exposes decompressed bytes. Their stored headers must describe those bytes.
  for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie', 'connection']) headers.delete(name);
  return new Response(buffer, { headers });
}
function validManifest(value: unknown, base: URL): value is ShellManifest {
  if (!value || typeof value !== 'object') return false;
  const item = value as ShellManifest;
  return item.schemaVersion === 1 && item.base === base.pathname && /^[a-f0-9]{24}$/.test(item.version) && Array.isArray(item.files) && item.files.length > 1 && item.files.length < 80
    && item.files.every(file => file && typeof file === 'object' && typeof file.url === 'string')
    && item.files.some(file => file.url === `${base.pathname}index.html`)
    && new Set(item.files.map(file => file.url)).size === item.files.length
    && item.files.every(file => typeof file.url === 'string' && (file.url === `${base.pathname}index.html` || canonicalAsset(new URL(file.url, base.origin).href, /\.(?:m?js|css|woff2?|ttf|otf)$/) && new URL(file.url, base.origin).pathname === file.url)
      && !/[?#\\]/.test(file.url) && Number.isInteger(file.bytes) && file.bytes > 0 && file.bytes <= MAX_PACKAGE_BYTES && /^[a-f0-9]{64}$/.test(file.digest));
}
async function prepareWorker(base: URL, signal?: AbortSignal): Promise<void> {
  abort(signal);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('오프라인 저장 준비 시간이 초과됐어요. 새로고침 후 다시 시도해주세요.')), 15000);
    const stop = () => finish(new DOMException('저장을 취소했어요.', 'AbortError'));
    const finish = (error?: unknown) => { clearTimeout(timeout); signal?.removeEventListener('abort', stop); if (error) reject(error); else resolve(); };
    signal?.addEventListener('abort', stop, { once: true });
    void navigator.serviceWorker.register(new URL('spotlog-offline-sw.js', base).href, { scope: base.pathname, updateViaCache: 'none' }).then(async registration => {
      if (registration.scope !== base.href) throw new Error('현재 주소에서는 오프라인 저장 범위를 확인할 수 없어요.');
      await navigator.serviceWorker.ready;
      abort(signal);
      if (!registration.active) throw new Error('오프라인 저장 준비를 완료하지 못했어요. 다시 시도해주세요.');
    }).then(() => finish(), finish);
  });
}
export async function saveOfflineTrip(journey: Journey, options: { signal?: AbortSignal } = {}): Promise<OfflineTripStatus> {
  const unavailable = supportedMessage(); if (unavailable) throw new Error(unavailable);
  assertSaveablePlan(journey);
  const snapshot = offlineTripSnapshot(journey); const fingerprint = offlineTripFingerprint(journey); const base = BASE();
  return serialized(async () => {
    abort(options.signal);
    if (navigator.onLine === false) throw new Error('인터넷에 연결한 뒤 오프라인으로 저장해주세요.');
    const previous = (await records()).find(item => item.id === journey.id);
    await prepareWorker(base, options.signal); abort(options.signal);
    const manifest: unknown = await (await fetchFile(new URL('spotlog-offline-shell.json', base).href, options.signal)).json();
    if (!validManifest(manifest, base)) throw new Error('오프라인 저장 파일 구성을 확인하지 못했어요. 화면을 새로고침한 뒤 다시 시도해주세요.');
    const cacheName = `${CACHE_PREFIX}${crypto.randomUUID()}`; const cache = await caches.open(cacheName); let committed = false;
    try {
      let bytes = 0;
      const shellUrls: string[] = [];
      for (const file of manifest.files) {
        abort(options.signal); const url = new URL(file.url, base.origin).href;
        const response = await fetchFile(url, options.signal); const buffer = await response.arrayBuffer();
        if (buffer.byteLength !== file.bytes || await digest(buffer) !== file.digest) throw new Error('화면 파일이 갱신됐어요. 새로고침 후 다시 저장해주세요.');
        bytes += buffer.byteLength; if (bytes > MAX_PACKAGE_BYTES) throw new Error('저장할 파일이 너무 커요. 여행의 사진을 줄인 뒤 다시 저장해주세요.');
        await cache.put(url, storedResponse(buffer, response)); shellUrls.push(url);
      }
      const imageUrls: string[] = []; let missingImages = 0;
      for (const source of imageSources(snapshot)) {
        abort(options.signal);
        if (/^data:image\/(?:png|jpeg|webp|gif|avif);base64,/i.test(source)) continue; // Already embedded in the private snapshot.
        const url = permittedOfflineImage(source, base); if (!url) { missingImages++; continue; }
        try {
          const response = await fetchFile(url, options.signal); const contentType = response.headers.get('content-type') ?? '';
          const buffer = await response.arrayBuffer(); abort(options.signal);
          if (!contentType.startsWith('image/') || buffer.byteLength > MAX_IMAGE_BYTES || bytes + buffer.byteLength > MAX_PACKAGE_BYTES) { missingImages++; continue; }
          await cache.put(url, storedResponse(buffer, response)); bytes += buffer.byteLength; imageUrls.push(url);
        } catch (error) { abort(options.signal); if (error instanceof DOMException && error.name === 'QuotaExceededError') throw error; missingImages++; }
      }
      const snapshotUrl = new URL(`__offline__/trip/${encodeURIComponent(journey.id)}`, base).href;
      const body = JSON.stringify(snapshot); bytes += new TextEncoder().encode(body).byteLength;
      if (bytes > MAX_PACKAGE_BYTES) throw new Error('저장할 파일이 너무 커요. 여행의 사진을 줄인 뒤 다시 저장해주세요.');
      await cache.put(snapshotUrl, new Response(body, { headers: { 'content-type': 'application/json' } }));
      const record: OfflineRecord = { id: journey.id, schemaVersion: 1, cacheName, savedAt: new Date().toISOString(), fingerprint, bytes,
        imageCount: imageUrls.length + imageSources(snapshot).filter(source => /^data:image\/(?:png|jpeg|webp|gif|avif);base64,/i.test(source)).length,
        missingImages, shellVersion: manifest.version, shellUrls, imageUrls, snapshotUrl };
      abort(options.signal); if (!await hasPackage(record)) throw new Error('저장한 파일을 확인하지 못했어요. 다시 시도해주세요.');
      await commit(record, journey.id, previous?.cacheName, options.signal); committed = true;
      if (previous?.cacheName.startsWith(CACHE_PREFIX)) await caches.delete(previous.cacheName).catch(() => {});
      changed(journey.id); return toStatus(record, 'saved');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') throw new Error('기기 저장 공간이 부족해요. 다른 오프라인 여행을 삭제한 뒤 다시 저장해주세요.');
      throw error;
    } finally { if (!committed) await caches.delete(cacheName).catch(() => {}); }
  });
}
export async function removeOfflineTrip(id: string): Promise<void> {
  // Deleting a source trip also removes its copy when the caller is the DEV root or native shell.
  // Storage cleanup requires no worker registration and does not imply offline-save support.
  if (typeof window === 'undefined' || !globalThis.caches || !globalThis.indexedDB || !id) return;
  await serialized(async () => {
    const rows = await rawRecords();
    const row = rows.find(value => value && typeof value === 'object' && (value as { id?: unknown }).id === id); if (!row) return;
    // The deployed customer base is fixed in Vite. Never trust a stored arbitrary host/scope.
    const deployedScope = new URL('/spotlog/', location.origin);
    const scope = validRecord(row, deployedScope) ? deployedScope : BASE();
    const record = validRecord(row, scope) ? row : null;
    await commit(null, id, record?.cacheName, undefined, scope);
    const shared = record && rows.some(value => value && typeof value === 'object' && (value as { id?: unknown; cacheName?: unknown }).id !== id && (value as { cacheName?: unknown }).cacheName === record.cacheName);
    if (record && !shared) await caches.delete(record.cacheName);
    changed(id);
  });
}
