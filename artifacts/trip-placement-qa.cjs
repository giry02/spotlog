const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  fs.mkdirSync('artifacts/trip-placement-qa', { recursive: true });
  try {
    for (const width of [320, 390, 460]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://127.0.0.1:5173/#places-guide');
      await page.evaluate(() => document.fonts.ready);
      const stored = await page.evaluate(() => JSON.stringify(localStorage));
      await page.evaluate(async () => { const module = await import('/@fs/C:/Users/Giry/Documents/Spotlog/artifacts/trip-placement-fixture.tsx'); window.unmountTripFixture = module.mountTripPlacementFixture(true); });
      const dialog = page.getByRole('dialog', { name: '내 여행에 담기' }); await dialog.waitFor();
      await dialog.getByRole('combobox', { name: '여행 기간', exact: true }).selectOption('2');
      await dialog.getByRole('textbox', { name: /^출발 날짜/ }).fill('2026-10-31');
      await dialog.getByRole('button', { name: 'DAY 2 11월 1일', exact: true }).click();
      await page.screenshot({ path: `artifacts/trip-placement-qa/${width}-new-day2.png` });
      await dialog.getByRole('button', { name: '여행 만들고 DAY 2에 담기', exact: true }).click();
      const result = await page.evaluate(() => JSON.parse(document.documentElement.dataset.placementResult));
      assert.equal(result.journeys[0].days[1].places[0].id, 'qa-place'); assert.equal(result.journeys[0].days[0].places.length, 0);
      await dialog.getByRole('combobox', { name: '여행 기간', exact: true }).selectOption('1');
      assert.equal(await dialog.getByRole('button', { name: /^DAY 2/ }).count(), 0);
      assert.equal(await dialog.getByRole('button', { name: '여행 만들고 DAY 1에 담기', exact: true }).count(), 1);
      await dialog.getByRole('combobox', { name: '여행 기간', exact: true }).selectOption('7');
      await dialog.getByRole('button', { name: 'DAY 7 11월 6일', exact: true }).click();
      await page.screenshot({ path: `artifacts/trip-placement-qa/${width}-day7.png` });
      const bounds = await dialog.evaluate((node) => { const r = node.getBoundingClientRect(); return { x: r.x, right: r.right, h: r.height, radius: getComputedStyle(node).borderTopLeftRadius }; });
      assert.ok(bounds.x >= 0 && bounds.right <= width + 1); assert.ok(bounds.h <= 844 * .88 + 1); assert.equal(bounds.radius, '24px');
      await dialog.getByRole('combobox', { name: '담을 여행', exact: true }).selectOption('qa-own');
      assert.equal(await dialog.getByRole('combobox', { name: '여행 기간', exact: true }).count(), 0);
      await dialog.getByRole('button', { name: '서울숲 DAY 1 담김 해제', exact: true }).click();
      assert.equal(await dialog.getByText('이미 DAY 1에 담겨 있어요.', { exact: true }).count(), 0);
      await dialog.getByRole('button', { name: 'DAY 2', exact: true }).click();
      await dialog.getByRole('button', { name: 'DAY 2에 담기', exact: true }).click();
      await page.screenshot({ path: `artifacts/trip-placement-qa/${width}-included.png` });
      assert.equal(await dialog.getByText('이미 DAY 2에 담겨 있어요.', { exact: true }).count(), 1);
      assert.equal(await dialog.getByRole('button', { name: '서울숲 DAY 2 담김 해제', exact: true }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), stored);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
      assert.deepEqual(errors, []); results.push({ width, bounds, errors, newDay2: true, periodClamp: true, day7Scroll: true, existingRemovalAndAdd: true, storageUntouched: true });
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync('artifacts/trip-placement-qa/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
})().catch((error) => { console.error(error); process.exit(1); });
