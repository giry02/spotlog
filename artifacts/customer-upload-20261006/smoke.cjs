const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const out = path.join(__dirname, 'browser'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [], errors = [];
  try {
    const context = await browser.newContext(), page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [320, 390, 460]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['home', 'community', 'places-photo', 'trips', 'saved']) {
        await page.goto('http://127.0.0.1:5212/#' + route);
        await expect(page.locator('.app-shell')).toBeVisible();
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(image => image.src && !image.complete).map(image => new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 2000); }))); });
        const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, images: [...document.images].filter(image => image.getClientRects().length > 0).length, broken: [...document.images].filter(image => image.getClientRects().length > 0 && image.complete && !image.naturalWidth).map(image => image.src) }));
        assert.ok(dimensions.scroll <= dimensions.client + 1, route + ' overflow');
        assert.deepEqual(dimensions.broken, [], route + ' broken images');
        assert.equal(await page.locator('.admin-app').count(), 0);
        await page.screenshot({ path: path.join(out, `${width}-${route}.png`) }); results.push({ width, route, ...dimensions });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:5212/#community');
    await page.getByRole('button', { name: '여행기 먼저 보기', exact: true }).first().click();
    const report = page.getByRole('button', { name: /· 여행기 신고$/ }).first();
    await expect(report).toBeVisible(); await report.click();
    await expect(page.getByRole('heading', { name: '공개 콘텐츠 신고', exact: true })).toBeVisible();
    await page.getByLabel('신고 이유').selectOption('INFORMATION');
    await page.getByLabel('상세 사유 (선택)').fill('고객 프론트 독립 업로드 검수');
    await page.getByRole('button', { name: '로컬 검수 접수', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '로컬 검수 접수' })).toBeVisible();
    const receipt = await page.evaluate(() => JSON.parse(localStorage.getItem('spotlog.review.service.v1')).reports);
    assert.equal(receipt.length, 1); assert.equal(receipt[0].reasonCode, 'INFORMATION');
    await page.screenshot({ path: path.join(out, 'report-receipt.png') });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ routes: results, reportReceipt: true, errors }, null, 2));
    console.log('PASS', results.length, 'customer route states; report receipt; no broken images/overflow/exceptions');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
