const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('spotlog.local.repository.v2', JSON.stringify({ schemaVersion: 2, updatedAt: '2026-09-10T00:00:00Z', records: { 'spotlog.web.journeys.v4': '[]', 'spotlog.web.saved.v3': JSON.stringify(['public-busan-dongbaek']) } }));
    window.historyLog = [];
    for (const method of ['pushState', 'replaceState', 'back', 'go']) {
      const native = history[method].bind(history);
      history[method] = (...args) => { window.historyLog.push([method, ...args]); return native(...args); };
    }
    window.addEventListener('popstate', event => window.historyLog.push(['popstate', event.state]), true);
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/#saved');
  await page.getByRole('button', { name: /^동백섬, / }).click();
  await page.waitForTimeout(200);
  console.log('PARENT', await page.evaluate(() => ({ state: history.state, log: window.historyLog })));
  await page.locator('[role="dialog"] .public-photo-credit button').click();
  await page.waitForTimeout(200);
  console.log('DETAIL', await page.evaluate(() => ({ state: history.state, log: window.historyLog })));
  await page.goBack(); await page.waitForTimeout(300);
  console.log('BACK', await page.evaluate(() => ({ state: history.state, log: window.historyLog, dialogs: [...document.querySelectorAll('[role="dialog"]')].map(el => el.textContent.slice(0, 100)) })));
  await browser.close();
})();
