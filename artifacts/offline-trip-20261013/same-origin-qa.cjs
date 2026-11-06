/* Actual local DEV -> built preview migration QA; fresh, disposable browser profile only.
 * Original stored source URLs are never rewritten. Service/user APIs are not called.
 */
process.env.SPOTLOG_OFFLINE_QA_URL = 'http://127.0.0.1:5210/spotlog/';
const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { createPlan, offlineSave, packageRecord, cachedSnapshot, cacheInventory, snapshot, records, clean, sheetClosed } = require('./browser-qa.cjs');
const dev = 'http://127.0.0.1:5210/', built = dev + 'spotlog/';
const out = path.join(__dirname, 'qa-same-origin'); fs.mkdirSync(out, { recursive: true });
const results = { date: '2026-10-13', base: built, checks: [], errors: [], pass: false };
const write = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
const record = (name, detail = 'pass') => { results.checks.push({ name, detail }); write(); console.log('PASS', name); };
const shot = async (page, name) => { await clean(page); await page.screenshot({ path: path.join(out, name + '.png'), animations: 'disabled' }); };
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'spotlog-same-origin-offline-qa-'));
const launch = () => chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true, viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', serviceWorkers: 'allow' });
async function main() {
  let context = await launch(), page = await context.newPage();
  const errors = [], watch = target => target.on('pageerror', error => errors.push(error.message)); watch(page);
  try {
    const target = await createPlan(page, '실제 DEV 사진', dev), other = await createPlan(page, '보존할 다른 여행', dev);
    const sourceUrl = target.days[0].places[0].image;
    assert.ok(/^\/@fs\/.+\/Spotlog\/assets\/spotlog\/busan-business\/.+\.webp$/.test(sourceUrl), 'real original DEV catalog photo expected');
    const photo = await context.request.get(new URL(sourceUrl, dev).href); assert.equal(photo.status(), 200); assert.ok(photo.headers()['content-type'].startsWith('image/'));
    await page.evaluate(() => localStorage.setItem('spotlog.admin.offline-qa.sentinel', 'same origin synthetic administrator record'));
    await page.goto(built + '#journey-' + target.id, { waitUntil: 'domcontentloaded' }); await offlineSave(page);
    let saved = await packageRecord(page, target.id), copied = await cachedSnapshot(page, saved);
    assert.equal(copied.days[0].places[0].image, sourceUrl); assert.ok(saved.imageUrls.includes(new URL(sourceUrl, dev).href)); assert.equal(saved.missingImages, 0);
    assert.equal(JSON.stringify(await snapshot(page, target.id)), JSON.stringify(target));
    await page.goto(built + '#journey-' + other.id); await offlineSave(page); const otherSaved = await packageRecord(page, other.id);
    record('actual DEV Busan licensed photo sources save in same-origin built preview without rewriting original trip URLs', { images: saved.imageCount, missingImages: saved.missingImages });
    await context.setOffline(true); await context.close(); context = await launch(); await context.setOffline(true); page = await context.newPage(); watch(page);
    await page.goto(built + '#journey-' + target.id, { waitUntil: 'domcontentloaded' }); await expect(page.locator('.personal-trip')).toBeVisible();
    await expect(page.locator('.plan-stop').first().locator('img')).toBeVisible();
    await expect.poll(() => page.locator('.plan-stop').first().locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await shot(page, 'same-origin-dev-photo-offline-cold-start');
    assert.equal((await snapshot(page, target.id)).days[0].places[0].image, sourceUrl); record('cold browser process restart displays actual saved /@fs photo with network disabled');
    await context.setOffline(false);
    const vanished = saved.imageUrls.find(url => url.includes('/@fs/'));
    await page.evaluate(async ({ cacheName, url }) => { await (await caches.open(cacheName)).delete(url); }, { cacheName: saved.cacheName, url: vanished });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.plan-offline-message')).toContainText('기기에 저장한 파일 일부가 없어졌어요');
    await expect(page.getByRole('button', { name: '오프라인 저장', exact: true })).toBeEnabled(); await offlineSave(page);
    const repaired = await packageRecord(page, target.id); assert.notEqual(repaired.cacheName, saved.cacheName); saved = repaired;
    assert.ok(await page.evaluate(async ({ cacheName, url }) => !!await (await caches.open(cacheName)).match(url), { cacheName: saved.cacheName, url: vanished }));
    record('evicted selected photo is identified; one-tap online repair replaces package without blocking valid retry');
    await page.getByRole('button', { name: '저장 관리', exact: true }).click();
    await page.evaluate(() => { window.__offlineQaOriginalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker); navigator.serviceWorker.register = () => new Promise(() => {}); });
    await page.getByRole('dialog').getByRole('button', { name: '오프라인 저장 업데이트', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: '저장 취소', exact: true })).toBeVisible();
    const cancelledAt = Date.now(); await page.getByRole('dialog').getByRole('button', { name: '저장 취소', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: '저장 취소', exact: true })).toHaveCount(0, { timeout: 2000 });
    assert.ok(Date.now() - cancelledAt < 2200, 'pending worker registration cancellation is prompt');
    assert.equal((await packageRecord(page, target.id)).cacheName, saved.cacheName); assert.equal(JSON.stringify(await snapshot(page, target.id)), JSON.stringify(target));
    await page.evaluate(() => { navigator.serviceWorker.register = window.__offlineQaOriginalRegister; delete window.__offlineQaOriginalRegister; });
    await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click(); await sheetClosed(page);
    record('cancel during unresolved worker registration immediately releases UI and keeps previous complete package and trip');
    await page.goto(dev + '#journey-' + target.id, { waitUntil: 'domcontentloaded' }); await expect(page.locator('.personal-trip')).toBeVisible();
    await page.getByRole('button', { name: '여행 메뉴', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '휴지통으로 이동', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: '휴지통으로 옮길까요?', exact: true }); await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: '휴지통으로 이동', exact: true }).click(); await sheetClosed(page);
    await expect.poll(() => packageRecord(page, target.id)).toBe(null);
    assert.ok((await snapshot(page, target.id)).trash); assert.equal((await snapshot(page, target.id)).visibility, 'PRIVATE');
    assert.equal(JSON.stringify(await snapshot(page, other.id)), JSON.stringify(other)); assert.equal((await packageRecord(page, other.id)).cacheName, otherSaved.cacheName);
    assert.equal((await cacheInventory(page)).some(item => item.name === saved.cacheName), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('spotlog.admin.offline-qa.sentinel')), 'same origin synthetic administrator record');
    await shot(page, 'dev-source-trash-cleans-offline-copy'); record('actual source DEV trash UI removes only its built-preview offline package; other trip/package and admin record preserved');
    await context.setOffline(true); await page.goto(built + '#journey-' + target.id, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.personal-trip')).toHaveCount(0); await expect(page.locator('.error-page')).toBeVisible();
    assert.ok((await snapshot(page, target.id)).trash); assert.equal(await packageRecord(page, target.id), null);
    await shot(page, 'trashed-trip-never-resurrects-offline'); record('offline old trip link cannot resurrect trashed source from a cached snapshot');
    assert.deepEqual(errors, []); results.pass = true; write(); console.log(JSON.stringify({ pass: true, checks: results.checks.length, out }));
  } finally { await context.close(); }
}
main().catch(error => { results.errors.push(String(error.stack || error)); write(); console.error(error); process.exitCode = 1; });
