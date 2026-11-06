/* Production PWA QA: fresh, disposable profiles only. No user browser or service writes.
 * Browser geolocation is simulated; this is not physical Android/iOS GPS verification.
 * Run after web build and start a static server with /spotlog/ mapped to web/dist:
 * SPOTLOG_OFFLINE_QA_URL=http://127.0.0.1:5293/spotlog/ node browser-qa.cjs
 */
const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const base = (process.env.SPOTLOG_OFFLINE_QA_URL || 'http://127.0.0.1:5293/spotlog/').replace(/\/?$/, '/');
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'QA is restricted to loopback static builds');
const out = path.join(__dirname, 'qa-browser');
const repoKey = 'spotlog.local.repository.v2', journeysKey = 'spotlog.web.journeys.v4';
const results = { date: '2026-10-13', base, checks: [], errors: [], pass: false };
fs.mkdirSync(out, { recursive: true });
const write = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
const record = (name, detail = 'pass') => { results.checks.push({ name, detail }); write(); console.log('PASS', name); };
const records = page => page.evaluate(({ repoKey, journeysKey }) => JSON.parse(JSON.parse(localStorage.getItem(repoKey)).records[journeysKey]), { repoKey, journeysKey });
const snapshot = async (page, id) => (await records(page)).find(item => item.id === id);
const shot = async (page, name) => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(out, `${name}.png`), animations: 'disabled' }); };
async function clean(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow');
  const broken = await page.locator('img').evaluateAll(nodes => nodes.filter(node => {
    const b = node.getBoundingClientRect(); return b.width && b.height && b.top < innerHeight && b.bottom > 0 && node.complete && !node.naturalWidth;
  }).map(node => node.getAttribute('src')));
  assert.deepEqual(broken, [], 'visible broken images');
}
async function sheetClosed(page) { await page.getByRole('dialog').waitFor({ state: 'hidden' }); await page.waitForFunction(() => !history.state?.spotlogSheet); }
async function createPlan(page, width, entryBase = base) {
  const title = `오프라인 QA 부산 1박 2일 ${width}`;
  await page.goto(entryBase + '#trips', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '저장한 곳으로 여행 만들기', exact: true }).click();
  const create = page.getByRole('dialog');
  await create.locator('select').first().selectOption('2');
  await create.getByLabel('여행 이름 (선택)', { exact: true }).fill(title);
  await create.getByRole('button', { name: '내 여행 만들기', exact: true }).click();
  await expect(page.locator('.personal-trip')).toHaveClass(/plan-edit-mode/);
  for (const [kind, name] of [['음식점', '금수복국 해운대본점'], ['카페', '비비비당']]) {
    await page.getByRole('button', { name: '장소 추가', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('.trip-picker-filter select').selectOption('부산');
    await dialog.getByRole('tab', { name: kind, exact: true }).click();
    await dialog.getByLabel('장소 이름·지역 검색', { exact: true }).fill(name);
    const row = dialog.locator('.trip-picker-place').filter({ has: page.getByText(name, { exact: true }) });
    await row.getByRole('button', { name: kind === '음식점' ? name + ' · 점심에 담기' : name + ' · 카페 담기', exact: true }).click();
    await dialog.getByRole('button', { name: '일정으로 돌아가기', exact: true }).click();
    await sheetClosed(page);
  }
  await page.locator('.plan-mode-action').click();
  await expect(page.locator('.personal-trip')).toHaveClass(/plan-view-mode/);
  const journey = (await records(page)).find(item => item.title === title);
  assert.equal(journey.purpose, 'PLAN'); assert.equal(journey.visibility, 'PRIVATE'); assert.equal(journey.planStage, 'READY');
  assert.equal(journey.days.length, 2); assert.deepEqual(journey.days[0].places.map(item => item.kind), ['FOOD', 'CAFE']);
  return journey;
}
async function cacheInventory(page) {
  return page.evaluate(async () => {
    const result = []; for (const name of await caches.keys()) { const cache = await caches.open(name); result.push({ name, urls: (await cache.keys()).map(request => request.url) }); } return result;
  });
}
async function packageRecord(page, id) {
  return page.evaluate(id => new Promise((resolve, reject) => {
    const opening = indexedDB.open('spotlog.offline-trips.v1', 1);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result, tx = db.transaction('trips', 'readonly'), request = tx.objectStore('trips').get(id);
      request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error);
      tx.oncomplete = tx.onabort = () => db.close();
    };
  }), id);
}
async function cachedSnapshot(page, record) {
  return page.evaluate(async record => {
    const response = await (await caches.open(record.cacheName)).match(record.snapshotUrl);
    return response ? await response.json() : null;
  }, record);
}
async function offlineSave(page, label = '오프라인 저장') {
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByText('오프라인 저장됨', { exact: true }).first()).toBeVisible({ timeout: 45000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
}
function monitor(page, errors) { page.on('pageerror', error => errors.push(error.message)); }
async function launch(profile, width) {
  return chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true, viewport: { width, height: 844 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'allow' });
}
async function openMap(page) {
  const toggle = page.getByRole('button', { name: '이날의 동선 지도', exact: true });
  if (await toggle.count()) await toggle.click();
  await expect(page.locator('.offline-route')).toBeVisible();
}
async function productionFlow(width) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `spotlog-offline-qa-${width}-`)), errors = [];
  let context = await launch(profile, width), page = await context.newPage(); monitor(page, errors);
  let baseline;
  try {
    const entry = await context.request.get(base), html = await entry.text();
    assert.equal(entry.status(), 200); assert.equal(html.includes('/@vite/client'), false, 'real production build required');
    baseline = await createPlan(page, width);
    await page.evaluate(() => localStorage.setItem('spotlog.admin.offline-qa.sentinel', 'unchanged synthetic administrator record'));
    await clean(page); await shot(page, `${width}-before-save`);
    let failedOptionalPhoto;
    if (width === 460) {
      const place = baseline.days[0].places[0];
      const candidate = place.photos?.find(photo => photo.image && photo.image !== place.image);
      if (candidate) {
        failedOptionalPhoto = new URL(candidate.image, base).href;
        await context.route(failedOptionalPhoto, route => route.abort('failed'));
      }
    }
    await offlineSave(page); await clean(page); await shot(page, `${width}-saved-online`);
    if (failedOptionalPhoto) {
      const optionalRecord = await packageRecord(page, baseline.id);
      assert.ok(optionalRecord.missingImages >= 1, 'failed optional photo is honestly counted');
      await expect(page.locator('.plan-offline-message').filter({ hasText: /사진.*(?:포함|저장)/ }).first()).toBeVisible();
      await context.unroute(failedOptionalPhoto);
      record('optional photo download failure keeps usable itinerary and clearly identifies omitted photos', { missingImages: optionalRecord.missingImages });
    }
    assert.equal(JSON.stringify(await snapshot(page, baseline.id)), JSON.stringify(baseline), 'offline save must not change actual trip');
    const inventory = await cacheInventory(page), urls = inventory.flatMap(item => item.urls);
    assert.ok(urls.some(url => /\.(?:webp|jpg|png)(?:$|\?)/i.test(url)), 'chosen photos are cached');
    assert.equal(urls.some(url => /\/api\/|\/admin\.html|\/admin-[^/]+\.js|tile\.openstreetmap|ncpnaver|flowise/i.test(url)), false, 'no admin, API, auth, map-provider cache');
    record(`${width}: one-tap explicit snapshot, photos and customer shell; private trip and admin sentinel untouched`, inventory.map(item => ({ name: item.name, entries: item.urls.length })));
    await context.setOffline(true);
    await page.close(); page = await context.newPage(); monitor(page, errors);
    await page.goto(base + '#journey-' + baseline.id, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.personal-trip')).toHaveClass(/plan-view-mode/);
    await expect(page.getByText('금수복국 해운대본점', { exact: true }).first()).toBeVisible();
    await clean(page); await openMap(page); await clean(page); await shot(page, `${width}-offline-new-tab`);
    assert.equal(await page.locator('.offline-route svg').count() > 0, true, 'route schematic available without map tiles');
    assert.equal(JSON.stringify(await snapshot(page, baseline.id)), JSON.stringify(baseline));
    record(`${width}: close page and reopen offline preserves DAYs, places, photos and tile-free route`);
    await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.locator('.personal-trip')).toBeVisible(); await clean(page);
    await context.close(); context = await launch(profile, width); await context.setOffline(true); page = await context.newPage(); monitor(page, errors);
    await page.goto(base + '#journey-' + baseline.id, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.personal-trip')).toBeVisible(); await clean(page); await openMap(page); await shot(page, `${width}-offline-browser-restart`);
    assert.equal(JSON.stringify(await snapshot(page, baseline.id)), JSON.stringify(baseline));
    assert.equal(await page.evaluate(() => localStorage.getItem('spotlog.admin.offline-qa.sentinel')), 'unchanged synthetic administrator record');
    record(`${width}: full browser process restart and cold navigation work with network disabled`);
    if (width === 390) {
      // CDP's network blockade can leave OS-derived navigator.onLine true after process restart.
      // Keep the real network disabled and independently exercise the browser's Offline signal.
      await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { value: false, configurable: true }); window.dispatchEvent(new Event('offline')); });
      await expect(page.locator('.plan-offline-control')).toContainText('오프라인');
      await expect(page.locator('.offline-route-heading')).toContainText('오프라인');
      await page.goto(base + '#trips'); await expect(page.locator('.trips-page')).toBeVisible();
      await expect(page.locator('.trip-offline-library')).toBeVisible(); await expect(page.locator('.offline-saved-badge').first()).toBeVisible();
      await clean(page); await shot(page, `${width}-offline-library`);
      await page.goto(base + '#journey-' + baseline.id); await expect(page.locator('.personal-trip')).toBeVisible(); await openMap(page);
      await shot(page, `${width}-offline-signal`);
      assert.equal(JSON.stringify(await snapshot(page, baseline.id)), JSON.stringify(baseline));
      record('browser Offline signal shows saved trip badge/library notice and route diagram without modifying the trip');
      await page.evaluate(() => {
        window.__offlineQaGpsCalls = 0;
        const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        navigator.geolocation.getCurrentPosition = (...args) => { window.__offlineQaGpsCalls += 1; return original(...args); };
      });
      await page.getByRole('button', { name: '현재 위치 확인', exact: true }).click();
      await expect(page.getByText('위치 이용 약관과 서비스 설정이 준비되면 사용할 수 있어요. 지금은 GPS 권한을 요청하지 않아요.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '동의하고 위치 확인', exact: true })).toBeDisabled();
      assert.equal(await page.evaluate(() => window.__offlineQaGpsCalls), 0);
      await page.getByRole('button', { name: '위치 동의 닫기', exact: true }).click();
      record('production draft location policy blocks GPS permission requests; stored route remains usable');
      await failureAndRemoval(page, context, baseline);
    }
    assert.deepEqual(errors, [], 'unhandled page exception');
  } finally { await context.close(); }
}
async function failureAndRemoval(page, context, baseline) {
  await context.setOffline(false);
  await page.evaluate(() => { delete navigator.onLine; window.dispatchEvent(new Event('online')); });
  await page.goto(base + '#journey-' + baseline.id, { waitUntil: 'domcontentloaded' });
  await page.locator('.plan-mode-action').click();
  await page.getByRole('button', { name: '금수복국 해운대본점 · 장소 메뉴', exact: true }).click();
  await page.getByRole('dialog').getByLabel('메모 (선택)', { exact: true }).fill('오프라인 QA 변경 메모');
  await page.getByRole('dialog').getByRole('button', { name: '변경 저장', exact: true }).click(); await sheetClosed(page);
  await page.locator('.plan-mode-action').click(); await expect(page.getByRole('button', { name: '저장 업데이트', exact: true })).toBeVisible();
  const edited = await snapshot(page, baseline.id);
  const beforePackage = await packageRecord(page, baseline.id), beforeSnapshot = await cachedSnapshot(page, beforePackage);
  await page.evaluate(() => {
    window.__offlineQaOriginalPut = Cache.prototype.put;
    Cache.prototype.put = function () { return Promise.reject(new DOMException('QA injected storage full', 'QuotaExceededError')); };
  });
  await page.getByRole('button', { name: '저장 업데이트', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /저장|공간|오프라인/ }).first()).toBeVisible({ timeout: 15000 });
  assert.equal(JSON.stringify(await snapshot(page, baseline.id)), JSON.stringify(edited), 'failed package update preserves actual edited trip');
  assert.equal((await packageRecord(page, baseline.id)).cacheName, beforePackage.cacheName, 'failed package update keeps previous active pointer');
  assert.deepEqual(await cachedSnapshot(page, beforePackage), beforeSnapshot, 'failed package update keeps previous verified snapshot');
  await page.evaluate(() => { Cache.prototype.put = window.__offlineQaOriginalPut; delete window.__offlineQaOriginalPut; });
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.locator('.personal-trip')).toBeVisible(); await clean(page);
  record('failed offline package update retains old usable package and all actual edited trip data');
  await context.setOffline(false); await page.getByRole('button', { name: '저장 업데이트', exact: true }).click();
  await expect(page.getByText('오프라인 저장됨', { exact: true }).first()).toBeVisible({ timeout: 45000 });
  const updatedPackage = await packageRecord(page, baseline.id);
  assert.notEqual(updatedPackage.cacheName, beforePackage.cacheName, 'successful retry switches package atomically');
  assert.equal((await cachedSnapshot(page, updatedPackage)).days[0].places[0].note, '오프라인 QA 변경 메모');
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.locator('.personal-trip')).toBeVisible();
  assert.equal(JSON.stringify(await snapshot(page, baseline.id)), JSON.stringify(edited)); record('explicit retry updates snapshot and keeps private visit identity');
  await page.getByRole('button', { name: '여행 메뉴', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '오프라인 저장 삭제', exact: true }).click();
  if (await page.getByRole('dialog').count()) { const confirm = page.getByRole('dialog').getByRole('button', { name: /^(삭제|저장 삭제)$/ }); if (await confirm.count()) await confirm.click(); }
  await expect(page.getByText('오프라인 저장됨', { exact: true })).toHaveCount(0);
  assert.equal(JSON.stringify(await snapshot(page, baseline.id)), JSON.stringify(edited));
  assert.equal(await page.evaluate(() => localStorage.getItem('spotlog.admin.offline-qa.sentinel')), 'unchanged synthetic administrator record');
  assert.equal(await packageRecord(page, baseline.id), null, 'removed package pointer absent');
  assert.equal((await cacheInventory(page)).some(item => item.name === updatedPackage.cacheName), false, 'removed package files absent');
  record('remove explicit offline copy preserves actual trip, notes and administrator data');
  const unknown = await context.newPage();
  await unknown.goto(base + 'admin.html', { waitUntil: 'domcontentloaded' }).catch(() => {});
  assert.equal(await unknown.locator('.admin-shell').count(), 0, 'offline SW must not expose administrator shell');
  await unknown.close(); record('administrator entry is not served by offline customer fallback');
}
async function main() {
  for (const width of [320, 390, 460]) await productionFlow(width);
  results.pass = true; write(); console.log(JSON.stringify({ pass: true, checks: results.checks.length, out }));
}
module.exports = { createPlan, offlineSave, packageRecord, cachedSnapshot, cacheInventory, snapshot, records, clean, sheetClosed };
if (require.main === module) main().catch(error => { results.errors.push(String(error.stack || error)); write(); console.error(error); process.exitCode = 1; });
