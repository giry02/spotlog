/* Isolated DEV component QA. Simulated browser GPS, never customer/admin records.
 * This verifies offline location UI and consent/cancellation, not native device GPS.
 */
const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = process.env.SPOTLOG_OFFLINE_GPS_QA_URL || 'http://127.0.0.1:5210/tests/offline-route.html';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'isolated DEV fixture only');
const out = path.join(__dirname, 'qa-gps'); fs.mkdirSync(out, { recursive: true });
const results = { date: '2026-10-13', base, checks: [], errors: [], pass: false };
const write = () => fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
const record = (name, detail = 'pass') => { results.checks.push({ name, detail }); write(); console.log('PASS', name); };
async function mockGps(context) {
  await context.addInitScript(() => {
    window.__offlineQaGpsCalls = 0; window.__offlineQaGpsMode = 'success';
    navigator.geolocation.getCurrentPosition = (success, failure, options) => {
      window.__offlineQaGpsCalls++;
      window.__offlineQaGpsOptions = options;
      const mode = window.__offlineQaGpsMode;
      if (mode === 'denied') { setTimeout(() => failure({ code: 1, message: 'QA denied', PERMISSION_DENIED: 1 }), 0); return; }
      if (mode === 'timeout') { setTimeout(() => failure({ code: 3, message: 'QA timeout', TIMEOUT: 3 }), 0); return; }
      setTimeout(() => success({ coords: { latitude: 35.09912345, longitude: 129.03076543, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() }), mode === 'pending' ? 1000 : 0);
    };
  });
}
async function agree(page) {
  await page.getByRole('button', { name: '현재 위치 확인', exact: true }).click();
  await expect(page.getByRole('button', { name: '동의하고 위치 확인', exact: true })).toBeDisabled();
  await page.getByLabel('[선택] 이 위치도에서 현재 위치 이용 동의', { exact: true }).check();
  await page.getByRole('button', { name: '동의하고 위치 확인', exact: true }).click();
}
async function layout(page, width, name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow');
  const buttons = await page.locator('.offline-route-marker,.offline-route-location>.outline').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  assert.ok(buttons.every(item => item.width >= 43 && item.height >= 43), '44px location/marker touch controls');
  await page.locator('.offline-route').screenshot({ path: path.join(out, `${width}-${name}.png`), animations: 'disabled' });
}
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 460]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, timezoneId: 'Asia/Seoul' }); await mockGps(context);
      const page = await context.newPage(), errors = [], outgoing = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '?policy=published', { waitUntil: 'domcontentloaded' }); await expect(page.locator('.offline-route')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await context.setOffline(true);
      page.on('request', request => { if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') outgoing.push({ url: request.url(), body: request.postData() }); });
      assert.equal(await page.evaluate(() => window.__offlineQaGpsCalls), 0);
      await expect(page.locator('.offline-route-marker')).toHaveCount(2);
      await expect(page.locator('.offline-route-missing')).toContainText('3. 위치 미확인 장소');
      await page.getByRole('button', { name: '2. 국제시장', exact: true }).click();
      await expect(page.getByTestId('selected-visit')).toHaveText('offline-visit-b');
      await expect(page.locator('.offline-route-selection')).toContainText('국제시장');
      await layout(page, width, 'route-order');
      record(`${width}: tile-free route retains visit numbering, selects actual visit and identifies missing coordinate`);
      await agree(page); await expect(page.locator('.offline-route-current')).toBeVisible();
      await expect(page.locator('.offline-route-position')).toContainText('위치 오차 ±8m');
      assert.equal(await page.evaluate(() => window.__offlineQaGpsCalls), 1);
      assert.deepEqual(await page.evaluate(() => window.__offlineQaGpsOptions), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('35.09912345') || value.includes('129.03076543'))), false);
      assert.deepEqual(outgoing, []); await layout(page, width, 'gps-position');
      record(`${width}: explicit feature consent allows one foreground simulated GPS fix while offline; no server transfer or coordinate storage`);
      await page.getByRole('button', { name: '현재 위치 지우기', exact: true }).click(); await expect(page.locator('.offline-route-current')).toHaveCount(0);
      await page.evaluate(() => { window.__offlineQaGpsMode = 'denied'; });
      await agree(page); await expect(page.getByRole('alert')).toContainText('위치 권한이 꺼져 있어요');
      await expect(page.locator('.offline-route-marker')).toHaveCount(2); await layout(page, width, 'gps-denied');
      record(`${width}: GPS permission denial preserves saved route and offers retry`);
      await page.evaluate(() => { window.__offlineQaGpsMode = 'timeout'; });
      await page.getByRole('button', { name: '동의하고 위치 확인', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('시간이 걸려요');
      await page.evaluate(() => { window.__offlineQaGpsMode = 'success'; });
      await page.getByRole('button', { name: '동의하고 위치 확인', exact: true }).click(); await expect(page.locator('.offline-route-current')).toBeVisible();
      await page.getByRole('button', { name: '다른 DAY 열기', exact: true }).click(); await expect(page.locator('.offline-route-current')).toHaveCount(0);
      await expect(page.locator('.offline-route-position')).toHaveCount(0); record(`${width}: timeout retry succeeds; another DAY clears current coordinates and consent`);
      await page.evaluate(() => { window.__offlineQaGpsMode = 'pending'; }); await agree(page);
      await page.getByRole('button', { name: '다른 DAY 열기', exact: true }).click(); await page.waitForTimeout(1200);
      await expect(page.locator('.offline-route-current')).toHaveCount(0); await expect(page.locator('.offline-route-position')).toHaveCount(0);
      record(`${width}: pending GPS completion cannot resurrect coordinates after DAY change`);
      await page.getByRole('button', { name: '초안 약관으로 전환', exact: true }).click();
      const before = await page.evaluate(() => window.__offlineQaGpsCalls);
      await page.getByRole('button', { name: '현재 위치 확인', exact: true }).click();
      await expect(page.getByRole('button', { name: '동의하고 위치 확인', exact: true })).toBeDisabled();
      assert.equal(await page.evaluate(() => window.__offlineQaGpsCalls), before); await layout(page, width, 'draft-policy-blocked');
      assert.deepEqual(outgoing, []); assert.deepEqual(errors, []); record(`${width}: unprepared location policy blocks permission request; no runtime exception or background request`);
      await context.close();
    }
    results.pass = true; write(); console.log(JSON.stringify({ pass: true, checks: results.checks.length, out }));
  } finally { await browser.close(); }
}
main().catch(error => { results.errors.push(String(error.stack || error)); write(); console.error(error); process.exitCode = 1; });
