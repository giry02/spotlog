const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'data-supply-reports-qa');
fs.mkdirSync(out, { recursive: true });
const originalCounts = { 'development-plan': 40, 'development-summary': 15, 'ai-guide-plan': 61, 'ai-guide-summary': 9 };
const configs = {};
for (const kind of Object.keys(originalCounts)) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'web/public/reports/report.js'), 'utf8'), context);
  context.Report = { ...context.window.Report, mount(data) { configs[kind] = data; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'web/public/reports/ai-recommendation-sections.js'), 'utf8'), context);
  context.SpotlogRecommendationSections = context.window.SpotlogRecommendationSections;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'web/public/reports', `${kind}.js`), 'utf8'), context);
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], records = [], links = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    for (const [kind, data] of Object.entries(configs)) {
      const count = data.slides.length;
      assert.ok(count > originalCounts[kind], `${kind}: additions missing`);
      await page.goto(`http://127.0.0.1:5173/spotlog-${kind}.html`);
      await page.waitForSelector('.slide.active');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.slide').count(), count);
      const contents = await page.locator('#report').textContent();
      for (const phrase of ['API HUB', 'RAG', '사진', '좌우', '1차']) assert.ok(contents.includes(phrase), `${kind}: ${phrase}`);
      const md = fs.readFileSync(path.join(root, 'docs/handoff', `${kind.replaceAll('-', '_').toUpperCase()}.md`), 'utf8');
      assert.equal((md.match(/<a id="slide-\d+"><\/a>/g) || []).length, count, `${kind}: markdown pages`);
      for (const slide of data.slides) assert.ok(md.includes(slide.title.replace(/<br\s*\/?\s*>/g, ' ')) || md.includes(slide.title.replace(/<[^>]*>/g, '')), `${kind}: markdown title ${slide.title}`);
      for (let number = 1; number <= count; number++) {
        await page.evaluate(n => location.hash = `slide-${n}`, number);
        await page.waitForFunction(n => document.querySelector('.slide.active')?.id === `slide-${n}`, number);
        const metrics = await page.locator('.slide.active').evaluate(s => ({ height: s.offsetHeight, horizontal: document.documentElement.scrollWidth > innerWidth, overlap: s.querySelector('.slide-content').getBoundingClientRect().bottom > s.querySelector('.slide-footer').getBoundingClientRect().top + 1 }));
        records.push({ kind, number, viewport: 1440, ...metrics });
        if (number > originalCounts[kind]) await page.screenshot({ path: path.join(out, `${kind}-${number}.png`) });
      }
      await page.locator('[data-prev]').click();
      assert.equal(await page.locator('.slide.active').getAttribute('id'), `slide-${count - 1}`);
      await page.locator('[data-next]').click();
      await page.keyboard.press('Home');
      await page.waitForFunction(() => document.querySelector('.slide.active').id === 'slide-1');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.slide.active').id === 'slide-2');
      await page.locator('[data-toc]').click();
      await page.locator(`dialog a[href="#slide-${count}"]`).click();
      await page.waitForFunction(n => document.querySelector('.slide.active').id === `slide-${n}`, count);
      links.push(...await page.locator('a[href*="spotlog-"]').evaluateAll(a => a.map(link => ({ href: link.getAttribute('href'), resolved: link.href }))));
      await page.emulateMedia({ media: 'print' });
      const print = await page.locator('.slide').evaluateAll(slides => slides.map(s => ({ number: s.id, overflow: s.scrollHeight > s.clientHeight + 1, overlap: s.querySelector('.slide-content').getBoundingClientRect().bottom > s.querySelector('.slide-footer').getBoundingClientRect().top + 1 })));
      records.push({ kind, print });
      for (let number = originalCounts[kind] + 1; number <= count; number++) await page.locator(`#slide-${number}`).screenshot({ path: path.join(out, `${kind}-${number}-print.png`) });
      await page.emulateMedia({ media: 'screen' });
      for (const width of [320, 390, 460]) {
        await page.setViewportSize({ width, height: 844 });
        for (let number = 1; number <= count; number++) {
          await page.evaluate(n => location.hash = `slide-${n}`, number);
          await page.waitForFunction(n => document.querySelector('.slide.active')?.id === `slide-${n}`, number);
          const metrics = await page.locator('.slide.active').evaluate(s => ({ horizontal: document.documentElement.scrollWidth > innerWidth, overlap: s.querySelector('.slide-content').getBoundingClientRect().bottom > s.querySelector('.slide-footer').getBoundingClientRect().top + 1 }));
          records.push({ kind, number, viewport: width, ...metrics });
        }
        await page.screenshot({ path: path.join(out, `${kind}-${width}.png`) });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      console.log(`${kind}: ${count} pages checked`);
    }
  } finally { await browser.close(); }
  const failures = records.filter(r => r.horizontal || r.overlap || (r.viewport === 1440 && r.height > 770) || r.print?.some(p => p.overflow || p.overlap));
  for (const link of links) if (!link.href.startsWith('#') && /spotlog-(development|ai-guide)-(plan|summary)\.html/.test(link.href)) assert.ok(link.resolved.startsWith('http://127.0.0.1:5173/'), `local report link escaped: ${link.href}`);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ errors, counts: Object.fromEntries(Object.entries(configs).map(([k,v]) => [k,v.slides.length])), records, links, failures }, null, 2));
  console.log(JSON.stringify({ errors, checked: records.filter(r => r.number).length, failures }));
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
})().catch(error => { console.error(error); process.exitCode = 1; });
