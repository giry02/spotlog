const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const release = 'C:/Users/Giry/.codex/worktrees/admin-manual-release-20261012/Spotlog';
const root = path.join(release, 'web/dist/manual/admin');
const out = __dirname;
const url = 'https://giry02.github.io/spotlog/manual/admin/';
const live = process.env.SPOTLOG_MANUAL_LIVE === '1';
const prefix = live ? 'live' : 'release';
const manifest = JSON.parse(fs.readFileSync(path.join(release, 'docs/manual/admin-20261012/manual-data.json'), 'utf8'));
const checks = [], errors = [], unexpected = [], loadedPng = new Set();
const check = (name, okay, detail = '') => { checks.push({ name, okay: !!okay, detail }); if (!okay) throw new Error(name + ': ' + detail); };
async function context(browser, viewport) {
  const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  if (!live) await context.route('**/*', async route => {
    const request = route.request().url();
    if (!request.startsWith(url)) { unexpected.push(request); return route.abort(); }
    const part = decodeURIComponent(new URL(request).pathname.slice('/spotlog/manual/admin/'.length)) || 'index.html';
    const file = path.resolve(root, part);
    if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { unexpected.push(request); return route.fulfill({ status: 404, body: 'Missing local fixture' }); }
    const extension = path.extname(file);
    const contentType = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png' }[extension] || 'application/octet-stream';
    await route.fulfill({ status: 200, contentType, body: fs.readFileSync(file) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  if (live) {
    page.on('response', response => {
      if (response.url().startsWith(url) && response.status() >= 400) unexpected.push({ url: response.url(), status: response.status() });
      if (response.url().startsWith(url) && response.url().endsWith('.png') && response.status() === 200) loadedPng.add(response.url());
    });
    page.on('requestfailed', request => { if (request.url().startsWith(url)) unexpected.push({ url: request.url(), failure: request.failure() }); });
  }
  await page.goto(url);
  await expect(page.locator('#manual-search-state')).toContainText('처음 사용하기');
  return { context, page };
}
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const { context: desktopContext, page } = await context(browser, { width: 1440, height: 1000 });
    if (live) {
      const standalone = await page.request.get(url + 'spotlog-admin-manual.html');
      check('standalone HTML HTTP 200', standalone.status() === 200, standalone.status());
    }
    check('HTTPS administrator link', await page.locator('[data-live-admin-link]').getAttribute('href') === 'https://giry02.github.io/spotlog/admin.html');
    check('local screenshot header', await page.getByText('2026.10.12 로컬 검수 화면 기준', { exact: true }).isVisible());
    check('53 pages', await page.locator('.guide-page').count() === 53);
    check('310 numbered features', await page.locator('.guide-shot .guide-marker').count() === 310);
    const decoded = await page.evaluate(async images => Promise.all(images.map(async src => {
      const img = new Image(); img.src = src;
      try { await img.decode(); return { src, okay: img.naturalWidth > 0 && img.naturalHeight > 0 }; }
      catch { return { src, okay: false }; }
    })), manifest.pages.map(page => page.image));
    check('all 53 PNG decode', decoded.length === 53 && decoded.every(item => item.okay), decoded.filter(item => !item.okay));
    check('relative asset paths', await page.evaluate(() => [...document.querySelectorAll('img,script[src],link[rel=stylesheet]')].every(el => {
      const value = el.getAttribute(el.tagName === 'LINK' ? 'href' : 'src');
      return !value || value.startsWith('assets/') || ['manual.js','manual.css'].includes(value);
    })));
    for (const menu of manifest.menus) {
      await page.locator('.guide-nav [data-menu-link="' + menu.id + '"]').click();
      await expect(page.locator('#manual-search-state')).toContainText(menu.name);
      const visible = await page.locator('.guide-page:not([hidden])').evaluateAll(items => items.map(item => item.id));
      const expected = manifest.pages.filter(page => page.menu === menu.id).map(page => page.id);
      check('menu ' + menu.name, JSON.stringify(visible) === JSON.stringify(expected), visible.length);
      check('desktop overflow ' + menu.id, !(await overflow(page)));
    }
    await page.locator('#manual-search').fill('메인');
    check('search main', await page.locator('.guide-page:not([hidden])').count() > 0);
    await page.locator('#manual-search').fill('존재하지않는검색어xyz');
    check('search empty', await page.locator('#manual-no-results').isVisible());
    await page.locator('#manual-search-clear').click();
    check('search clear', await page.locator('#manual-search').inputValue() === '');
    await page.locator('.guide-nav [data-menu-link="places"]').click();
    const specimen = manifest.pages.find(page => page.menu === 'places');
    const marker = page.locator('#' + specimen.id + ' .guide-marker').first();
    await marker.click();
    check('number selects description', await page.locator('#' + specimen.id + '-callout-1').evaluate(el => el.classList.contains('is-active')));
    const enlarge = page.locator('#' + specimen.id + ' .guide-capture-tools [data-enlarge]');
    await enlarge.click();
    check('viewer opens', await page.locator('#manual-viewer').evaluate(el => el.open));
    await page.locator('#manual-zoom-canvas .guide-marker').first().click();
    check('viewer number description', await page.locator('#manual-zoom-details h3').innerText() === '1. ' + specimen.callouts[0].label);
    await page.locator('#manual-zoom-original').click();
    check('viewer original', await page.locator('#manual-zoom-ratio').innerText() === '100%');
    await page.locator('#manual-zoom-in').click();
    check('viewer plus', await page.locator('#manual-zoom-ratio').innerText() === '115%');
    await page.locator('#manual-zoom-out').click();
    check('viewer minus', await page.locator('#manual-zoom-ratio').innerText() === '100%');
    await page.locator('#manual-zoom-fit').click();
    check('viewer fit', await page.locator('#manual-zoom-canvas').evaluate(el => el.clientWidth <= el.parentElement.clientWidth));
    await page.keyboard.press('Escape');
    check('viewer escape closes', !(await page.locator('#manual-viewer').evaluate(el => el.open)));
    check('viewer focus returns', await enlarge.evaluate(el => el === document.activeElement));
    await page.locator('.guide-nav [data-menu-link="start"]').click();
    await page.screenshot({ path: path.join(out, prefix + '-start-desktop.png'), fullPage: false });
    await desktopContext.close();
    const { context: mobileContext, page: mobile } = await context(browser, { width: 390, height: 844 });
    check('mobile start overflow', !(await overflow(mobile)));
    await mobile.screenshot({ path: path.join(out, prefix + '-start-mobile.png'), fullPage: false });
    for (const menu of manifest.menus) {
      await mobile.locator('.guide-nav [data-menu-link="' + menu.id + '"]').click();
      check('mobile overflow ' + menu.id, !(await overflow(mobile)));
    }
    await mobile.locator('.guide-nav [data-menu-link="places"]').click();
    await mobile.locator('#' + specimen.id + ' .guide-capture-tools [data-enlarge]').click();
    check('mobile viewer overflow', !(await overflow(mobile)));
    await mobile.screenshot({ path: path.join(out, prefix + '-viewer-mobile.png'), fullPage: false });
    await mobileContext.close();
    check('no JS errors', errors.length === 0, errors);
    check('no external or missing requests', unexpected.length === 0, unexpected);
    if (live) check('53 actual network PNG HTTP 200', loadedPng.size === 53, [...loadedPng]);
    const resultFile = live ? 'live-browser-verification.json' : 'browser-release-verification.json';
    fs.writeFileSync(path.join(out, resultFile), JSON.stringify({ url, localRouteOnly: !live, checks, errors, unexpected }, null, 2));
    console.log(JSON.stringify({ pass: checks.length, screens: 53, features: 310, actualPngResponses: loadedPng.size, errors, unexpected, results: path.join(out, resultFile) }));
  } catch (error) {
    fs.writeFileSync(path.join(out, live ? 'live-browser-verification.json' : 'browser-release-verification.json'), JSON.stringify({ url, localRouteOnly: !live, checks, errors, unexpected, failure: error.message }, null, 2));
    throw error;
  } finally { await browser.close(); }
})();
