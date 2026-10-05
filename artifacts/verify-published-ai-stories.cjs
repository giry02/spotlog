const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = 'https://giry02.github.io/spotlog/';
const output = path.join(__dirname, 'publication-live');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    await page.goto(base + '?release=8313515#community');
    await page.getByRole('button', { name: 'AI 추천 여행', exact: true }).click();
    await page.locator('.community-card').first().waitFor();
    assert.equal(await page.locator('.community-card').count(), 4);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, 'ai-tab.png'), fullPage: true });
    await page.getByRole('button', { name: '여행기 먼저 보기' }).first().click();
    await page.locator('.journey-detail').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.story-image-block img')].length > 0 && [...document.querySelectorAll('.story-image-block img')].every(i => i.complete && i.naturalWidth > 0));
    await page.locator('.public-photo-credit-button').first().click();
    await page.getByRole('dialog').waitFor();
    await page.screenshot({ path: path.join(output, 'source-dialog.png') });
    await page.goto(base + 'spotlog-documents.html?release=8313515');
    const documents = [
      ['전체 계획서', 'development', 47], ['AI 개발', 'ai', 67],
      ['데이터 수집', 'data', 32], ['요약본', 'summary-development', 19],
    ];
    for (const [title, key, count] of documents) {
      await page.getByRole('tab', { name: title, exact: true }).click();
      const frame = page.frameLocator(`iframe[data-doc="${key}"]`);
      await frame.locator('.slide.active').waitFor();
      assert.equal(await frame.locator('.slide').count(), count);
    }
    await page.getByRole('link', { name: 'AI 요약', exact: true }).click();
    const aiSummary = page.frameLocator('iframe[data-doc="summary-ai"]');
    await aiSummary.locator('.slide.active').waitFor();
    assert.equal(await aiSummary.locator('.slide').count(), 12);
    // The baseline and release MapLibre bundles have the same SHA256. Track this
    // inherited missing worker separately; do not claim a clean map check.
    const knownMapWarnings = errors.filter(e => e === '404 ' + base + 'assets/maplibre-gl-worker.mjs');
    const unexpectedErrors = errors.filter(e => !knownMapWarnings.includes(e));
    assert.deepEqual(unexpectedErrors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ commit: '8313515ad8f90aa5c8bf05e30d12993a73521694', aiStories: 4, documents: 5, errors, knownMapWarnings, unexpectedErrors, checkedAt: new Date().toISOString() }, null, 2));
    console.log('Published AI tab, four stories, photos, attribution, and five documents verified. Known inherited map worker warnings: ' + knownMapWarnings.length);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
