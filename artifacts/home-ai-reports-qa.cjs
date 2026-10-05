const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.join(__dirname, 'home-ai-reports-qa'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], records = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    for (const [kind, count] of [['development-plan', 37], ['development-summary', 12], ['ai-guide-plan', 58], ['ai-guide-summary', 6]]) {
      await page.goto(`http://127.0.0.1:5173/spotlog-${kind}.html`);
      await page.waitForSelector('.slide.active');
      assert.equal(await page.locator('.slide').count(), count);
      const text = await page.locator('#report').textContent();
      assert.ok(text.includes('AI 추천 여행')); assert.ok(text.includes('네이버')); assert.ok(text.includes('로컬 초안'));
      for (let number = 1; number <= count; number++) {
        await page.evaluate(n => location.hash = `slide-${n}`, number);
        await page.waitForFunction(n => document.querySelector('.slide.active')?.id === `slide-${n}`, number);
        const result = await page.locator('.slide.active').evaluate(s => ({ height: s.offsetHeight, horizontal: document.documentElement.scrollWidth > innerWidth, overlap: s.querySelector('.slide-content').getBoundingClientRect().bottom > s.querySelector('.slide-footer').getBoundingClientRect().top + 1 }));
        records.push({ kind, number, ...result });
      }
      await page.screenshot({ path: path.join(out, `${kind}-addition.png`) });
      await page.emulateMedia({ media: 'print' });
      const print = await page.locator('.slide').evaluateAll(slides => slides.map(s => ({ page: s.id, overflow: s.scrollHeight > s.clientHeight + 1, overlap: s.querySelector('.slide-content').getBoundingClientRect().bottom > s.querySelector('.slide-footer').getBoundingClientRect().top + 1 })));
      records.push({ kind, print });
      await page.emulateMedia({ media: 'screen' });
      await page.setViewportSize({ width: 390, height: 844 });
      for (let number = 1; number <= count; number++) {
        await page.evaluate(n => location.hash = `slide-${n}`, number);
        await page.waitForFunction(n => document.querySelector('.slide.active')?.id === `slide-${n}`, number);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${kind} mobile ${number}`);
      }
      await page.screenshot({ path: path.join(out, `${kind}-addition-mobile.png`) });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  } finally { await browser.close(); }
  const failures = records.filter(r => r.horizontal || r.overlap || r.height > 770 || r.print?.some(p => p.overflow || p.overlap));
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ errors, records, failures }, null, 2));
  console.log(JSON.stringify({ errors, pages: records.filter(r => r.number).length, failures }));
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
})().catch(e => { console.error(e); process.exit(1); });
