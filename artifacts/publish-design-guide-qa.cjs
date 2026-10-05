const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'publish-design-guide-qa');
fs.mkdirSync(output, { recursive: true });
const guideUrl = 'http://127.0.0.1:5173/spotlog-design-guide.html';
const results = { url: guideUrl, widths: [], issues: [], sourceChecks: {} };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const width of [320, 390, 460, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => {
      window.__guideWrites = [];
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) {
          window.__guideWrites.push({ method, args });
          return original.apply(this, args);
        };
      }
    });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push({ url: request.url(), type: request.resourceType(), method: request.method() }));
    const response = await page.goto(guideUrl, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    const before = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    const structure = await page.evaluate(() => ({
      groups: document.querySelectorAll('.sg-screen-group').length,
      images: document.images.length,
      nav: document.querySelectorAll('[data-section]').length,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      title: document.title,
      scripts: [...document.scripts].map(script => script.src),
    }));
    assert.equal(structure.groups, 12);
    assert.equal(structure.images, 30);
    assert.equal(structure.nav, 16);
    assert.ok(structure.scrollWidth <= structure.clientWidth, `Document overflow at ${width}`);
    if (width === 1440 || width === 390) await page.screenshot({ path: path.join(output, `${width}-intro.png`) });
    const imageSources = await page.locator('img').evaluateAll(images => images.map(img => img.src));
    const imageResponses = [];
    for (const url of imageSources) {
      const imageResponse = await context.request.get(url);
      imageResponses.push({ url: path.basename(url), status: imageResponse.status() });
      assert.equal(imageResponse.status(), 200);
    }
    const navigation = [];
    const ids = await page.locator('[data-section]').evaluateAll(elements => elements.map(el => el.dataset.section));
    for (const id of ids) {
      await page.locator(`[data-section="${id}"]`).click();
      const position = await page.evaluate(targetId => {
        const box = document.getElementById(targetId).getBoundingClientRect();
        const header = document.querySelector('.sg-toolbar').getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, headerBottom: header.bottom, viewport: innerHeight };
      }, id);
      navigation.push({ id, ...position });
      assert.ok(position.top >= position.headerBottom - 1, `${id} obscured by header at ${width}`);
      assert.ok(position.top < position.viewport - 20, `${id} not visible at ${width}`);
      if (id === 'sg-home' && (width === 1440 || width === 390)) {
        await page.locator('#sg-home img').first().waitFor({ state: 'visible' });
        await page.locator('#sg-home img').first().evaluate(img => img.decode());
        await page.screenshot({ path: path.join(output, `${width}-atlas.png`) });
      }
    }
    const after = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    const writes = await page.evaluate(() => window.__guideWrites);
    assert.equal(after, before);
    assert.equal(writes.length, 0);
    assert.equal(errors.length, 0);
    const appRequests = requests.filter(request => /\/src\/App|\/src\/main|\/api\/|localRepository|useLocalState/.test(request.url));
    assert.equal(appRequests.length, 0);
    const record = { width, structure, imageResponses, navigation, errors, storageUnchanged: before === after, storageWrites: writes, appRequests, requests };
    if (width === 390) {
      const original = await context.newPage();
      await original.goto('http://127.0.0.1:5173/#style-guide', { waitUntil: 'networkidle' });
      const originalText = await original.locator('.sg-inner').innerText();
      const standaloneText = await page.locator('.sg-inner').innerText();
      const originalNormalized = originalText.split('\n').map(line => line.trim()).filter(Boolean);
      const publishedNormalized = standaloneText.split('\n').map(line => line.trim()).filter(Boolean);
      record.contentComparison = {
        onlyLocal: originalNormalized.filter(line => !publishedNormalized.includes(line)),
        onlyStandalone: publishedNormalized.filter(line => !originalNormalized.includes(line)),
      };
      await original.close();
      await page.locator('[data-service]').click();
      await page.waitForURL('http://127.0.0.1:5173/#home');
      await page.locator('.home-page').waitFor();
      record.serviceButton = { url: page.url(), homeVisible: await page.locator('.home-page').isVisible() };
    }
    results.widths.push(record);
    await context.close();
  }
  const html = fs.readFileSync(path.join(root, 'web/public/spotlog-design-guide.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'web/public/design-guide/guide.js'), 'utf8');
  results.sourceChecks = {
    onlyGuideScript: [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => match[1]),
    noStorageOrAppCalls: !/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|Repository|App\.tsx/.test(js),
    serviceAssignment: js.includes("window.location.assign('./#home')"),
  };
  assert.deepEqual(results.sourceChecks.onlyGuideScript, ['./design-guide/guide.js']);
  assert.ok(results.sourceChecks.noStorageOrAppCalls);
  assert.ok(results.sourceChecks.serviceAssignment);
  await browser.close();
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ status: 'passed', widths: results.widths.map(row => row.width), groups: 12, images: 30, navigationTargets: 16, sourceChecks: results.sourceChecks, contentComparison: results.widths.find(row => row.width === 390).contentComparison }, null, 2));
})().catch(error => {
  results.issues.push(error.stack);
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.error(error);
  process.exit(1);
});
