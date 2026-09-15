const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.SPOTLOG_QA_OUTPUT || path.join(__dirname, 'documents-hub-qa');
fs.mkdirSync(output, { recursive: true });
const base = process.env.SPOTLOG_QA_BASE || 'http://127.0.0.1:5173/';
const records = [], errors = [];
const docs = [
  ['development', 'spotlog-development-plan.html', 47],
  ['ai', 'spotlog-ai-guide-plan.html', 67],
  ['data', 'spotlog-data-supply-plan.html', 32],
  ['summary-development', 'spotlog-development-summary.html', 19],
  ['summary-ai', 'spotlog-ai-guide-summary.html', 12],
];
async function ready(page, key) {
  const iframe = page.locator(`iframe[data-doc="${key}"]`);
  await iframe.waitFor({ state: 'visible' });
  await page.waitForFunction(key => document.querySelector(`iframe[data-doc="${key}"]`)?.dataset.ready === 'true', key);
  return await (await iframe.elementHandle()).contentFrame();
}
function layout() {
  const slide = document.querySelector('.slide.active'), footer = slide.querySelector('.slide-footer');
  const leaves = [...slide.querySelector('.slide-content').querySelectorAll('p,li,td,th,h3')].filter(el => !el.closest('thead') || getComputedStyle(el.closest('thead')).position !== 'absolute');
  const contentBottom = Math.max(0, ...leaves.map(el => el.getBoundingClientRect().bottom));
  return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, slideHeight: slide.getBoundingClientRect().height,
    footerOverlap: Math.max(0, contentBottom - footer.getBoundingClientRect().top),
    clipping: Math.max(0, footer.getBoundingClientRect().bottom - slide.getBoundingClientRect().bottom),
    title: slide.dataset.title };
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [1440, 320, 390, 460]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      await page.goto(base + 'spotlog-documents.html');
      for (const [key, file, count] of docs) {
        await page.evaluate(key => location.hash = key, key);
        const frame = await ready(page, key);
        assert.equal(await frame.locator('.slide').count(), count);
        assert.equal(await frame.locator('body.report-embedded').count(), 1);
        assert.equal(await frame.locator('.toolbar').isVisible(), false);
        const shell = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight }));
        if (shell.scrollWidth > width + 1 || shell.scrollHeight > shell.height + 1) errors.push(`hub overflow ${width} ${key}: ${JSON.stringify(shell)}`);
        await frame.locator('[data-next]').click();
        assert.equal(await frame.locator('.slide.active').getAttribute('id'), 'slide-2');
        await page.waitForFunction(file => document.getElementById('open-document').getAttribute('href') === './' + file + '#slide-2', file);
        await frame.locator('[data-prev]').click();
        await frame.locator('[data-toc]').click();
        await frame.locator('.contents-dialog a[href="#slide-3"]').click();
        assert.equal(await frame.locator('.slide.active').getAttribute('id'), 'slide-3');
        await frame.locator('.slide.active').press('ArrowRight');
        assert.equal(await frame.locator('.slide.active').getAttribute('id'), 'slide-4');
        await frame.locator('.slide.active').press('Home');
        records.push({ type: 'navigation', width, key, count });
        if (key === 'data') {
          for (let i = 1; i <= count; i++) {
            await frame.evaluate(i => location.hash = '#slide-' + i, i);
            await frame.locator(`#slide-${i}.active`).waitFor();
            const result = await frame.evaluate(layout);
            records.push({ type: 'data-screen', page: i, ...result });
            if (result.scrollWidth > width + 1 || result.footerOverlap > 1 || result.clipping > 1) errors.push(`data layout ${width}/${i}: ${JSON.stringify(result)}`);
          }
          await frame.evaluate(() => location.hash = '#slide-7');
          await frame.locator('#slide-7.active').waitFor();
          await page.screenshot({ path: path.join(output, `hub-data-${width}.png`) });
        }
      }
      // Both summary choices remain in the same page; previously selected pages are retained.
      await page.locator('#tab-summary').click();
      await page.locator('#summary-options a[href="#summary-development"]').click();
      let frame = await ready(page, 'summary-development');
      await frame.locator('[data-next]').click();
      await page.locator('#tab-data').click(); await ready(page, 'data');
      await page.locator('#tab-summary').click(); frame = await ready(page, 'summary-development');
      assert.equal(await frame.locator('.slide.active').getAttribute('id'), 'slide-2');
      await page.screenshot({ path: path.join(output, `hub-summary-${width}.png`) });
      // The outer print action must print the selected document, not only the visible iframe page.
      await frame.evaluate(() => { window.print = () => { document.body.dataset.printTest = 'called'; }; });
      await page.locator('#print-document').click();
      assert.equal(await frame.locator('body').getAttribute('data-print-test'), 'called');
      // Parent tab keyboard focus remains separate from slide keyboard navigation.
      await page.locator('#tab-summary').focus(); await page.keyboard.press('Home'); await ready(page, 'development');
      await page.keyboard.press('ArrowRight'); await ready(page, 'ai');
      await page.keyboard.press('ArrowLeft'); await ready(page, 'development');
      await page.screenshot({ path: path.join(output, `hub-cover-${width}.png`) });
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    for (const [key, file, count] of docs) {
      await page.goto(base + file); await page.locator('.slide.active').waitFor();
      assert.equal(await page.locator('.toolbar .documents-link').count(), 1);
      if (key === 'data') {
        assert.equal(await page.locator('del').count(), 0);
        const localLinks = await page.locator('.slide-content a').evaluateAll(links => links.map(a => a.getAttribute('href')).filter(href => !/^https?:/.test(href)));
        assert.ok(localLinks.every(href => /^\.\/spotlog-.*\.html$/.test(href)), JSON.stringify(localLinks));
      }
      await page.emulateMedia({ media: 'print' });
      const printed = await page.locator('.slide').evaluateAll(slides => slides.map((s, index) => {
        const box = s.getBoundingClientRect(), footer = s.querySelector('.slide-footer').getBoundingClientRect();
        const bottom = Math.max(0, ...[...s.querySelector('.slide-content').querySelectorAll('p,li,td,th,h3')].map(el => el.getBoundingClientRect().bottom));
        return { page: index + 1, height: box.height, clipping: Math.max(0, footer.bottom - box.bottom), footerOverlap: Math.max(0, bottom - footer.top) };
      }));
      assert.equal(printed.length, count);
      for (const result of printed) {
        records.push({ type: 'print', key, ...result });
        if (result.clipping > 1 || result.footerOverlap > 1) errors.push(`print ${key}: ${JSON.stringify(result)}`);
      }
      await page.emulateMedia({ media: 'screen' });
      await page.setViewportSize({ width: 320, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) errors.push(`standalone toolbar width ${key}`);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.goto(base + 'spotlog-documents.html#data');
    let dataFrame = await ready(page, 'data');
    await dataFrame.evaluate(() => location.hash = '#slide-32');
    await dataFrame.locator('#slide-32.active').waitFor();
    await dataFrame.locator('#slide-32 a[href="./spotlog-ai-guide-plan.html"]').click();
    await ready(page, 'ai'); assert.equal(await page.locator('iframe:visible').count(), 1);
    await page.goBack(); await ready(page, 'data');
    // Loading failure is explicit, and the standalone fallback stays available.
    await page.route('**/spotlog-development-summary.html?embed=1', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>Unavailable test fixture</p>' }));
    await page.locator('#tab-summary').click();
    await page.waitForFunction(() => document.getElementById('document-status').textContent.includes('불러오지 못했습니다'));
    assert.equal(await page.locator('#print-document').isDisabled(), true);
    assert.ok((await page.locator('#open-document').getAttribute('href')).includes('spotlog-development-summary.html'));
    records.push({ type: 'link-state-print-error', pass: true });
    await context.close();
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ records, errors }, null, 2));
  }
  console.log(JSON.stringify({ records: records.length, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
