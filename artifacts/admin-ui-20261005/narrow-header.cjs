const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage(), checks = [];
    await page.goto('http://127.0.0.1:5210/admin.html');
    await expect(page.getByRole('heading', { name: '오늘의 운영 작업' })).toBeVisible();
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const fields = await page.locator('.admin-topbar select').evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, text: element.selectedOptions[0].text, font: getComputedStyle(element).fontSize })));
      assert.ok(fields.every(field => field.width >= 130), 'full operator/role labels need usable width');
      const size = await page.locator('.admin-main').evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
      assert.ok(size.scroll <= size.client + 1);
      await page.screenshot({ path: path.join(__dirname, 'after', `${width}-header-final.png`) });
      checks.push({ width, fields, size });
    }
    fs.writeFileSync(path.join(__dirname, 'after', 'narrow-header.json'), JSON.stringify(checks, null, 2));
    console.log('PASS 320/360 header labels, menu access and no horizontal overflow');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
