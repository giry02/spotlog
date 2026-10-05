const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const { snapshot } = require('./audit.cjs');
const base = 'http://127.0.0.1:5210/';
const report = { checks: [], screens: [], layout: [], errors: [] };
let page, width;
const button = name => page.getByRole('button', { name, exact: true });
const write = () => fs.writeFileSync(__dirname + '/regression-results.json', JSON.stringify(report, null, 2));
const pass = (name, detail) => { report.checks.push({ width, name, detail }); write(); };
async function capture(name) {
  const result = await snapshot(page, width, name, false);
  report.screens.push(result);
  assert.equal(result.overflow, false, name + ': document overflow');
  assert.equal(result.bodyOverflow, false, name + ': body overflow');
  assert.equal(result.imageFailures.length, 0, name + ': broken images');
  write();
}
async function firstCardY(selector) {
  return page.locator(selector).first().evaluate(e => e.getBoundingClientRect().top);
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (width of [320, 390, 460]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      page = await context.newPage(); page.setDefaultTimeout(10000);
      page.on('pageerror', e => { report.errors.push({ width, error: e.message }); write(); });
      await page.goto(base + '?review=regions#places-photo');
      await page.locator('.photo-landmark-reel[data-active=true]').waitFor();
      const names = [];
      for (let n = 0; n < 12; n++) {
        const active = page.locator('.photo-landmark-reel[data-active=true]');
        const id = await active.getAttribute('data-place-id');
        const name = await active.locator('h2').textContent();
        await active.getByRole('button', { name: name + ' 저장', exact: true }).click();
        names.push(name);
        await page.keyboard.press('ArrowDown');
        await page.waitForFunction(id => document.querySelector('.photo-landmark-reel[data-active=true]')?.dataset.placeId !== id, id);
      }
      await page.goto(base + '?review=regions#saved');
      await page.locator('.saved-card').first().waitFor();
      await capture('saved-many');
      await button('바로 만들기').click();
      assert.equal(await page.locator('.saved-trip-region-options [aria-pressed=true]').count(), 0);
      assert.equal(await button('여행 지역을 먼저 골라주세요').isDisabled(), true);
      assert.equal(await page.locator('.toast').count(), 0);
      await capture('region-required');
      const regions = page.locator('.saved-trip-region-options button');
      const selected = regions.filter({ hasText: '부산' });
      assert.equal(await selected.count(), 1);
      await selected.click();
      const selectedText = await selected.innerText();
      const expectedCount = Number(selectedText.match(/(\d+)곳/)[1]);
      await capture('region-selected');
      await button('닫기').click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => !history.state?.spotlogSheet);
      await button('바로 만들기').click();
      assert.match(await page.locator('.saved-trip-region-options [aria-pressed=true]').innerText(), /부산/);
      await button('1박 2일 · 바로 만들기').click();
      await page.locator('.personal-trip').waitFor();
      assert.equal(await page.locator('.day-tabs-track button').first().innerText(), 'DAY 1');
      const dayOneCount = await page.locator('.plan-stop:not(.plan-timeline-gap)').count();
      await button('DAY 2').click();
      const dayTwoCount = await page.locator('.plan-stop:not(.plan-timeline-gap)').count();
      assert.equal(dayOneCount + dayTwoCount, expectedCount);
      await button('DAY 1').click();
      const cardNames = await page.locator('.plan-stop-copy strong').allTextContents();
      assert.ok(cardNames.every(n => ['해운대해수욕장', '동백섬', '광안리해수욕장'].includes(n)), cardNames.join(', '));
      pass('multi-region auto requires choice and retains that scope after close/reopen', { expectedCount, dayOneCount, dayTwoCount, cardNames });
      const tools = await page.locator('.phase-three-trip-tools button').evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, height: n.getBoundingClientRect().height, y: n.getBoundingClientRect().y })));
      assert.ok(tools.every(t => Math.abs(t.height - tools[0].height) < 1));
      assert.ok(tools.every(t => Math.abs(t.y - tools[0].y) < 1));
      await capture('scoped-private');
      await page.goto(base + '?review=regions#saved');
      assert.equal(await page.locator('.saved-card').count(), 12);
      await page.locator('.saved-region-chips').getByRole('button', { name: /^부산/ }).click();
      await button('바로 만들기').click();
      assert.equal(await page.locator('.saved-trip-region-options').count(), 0);
      assert.equal(await button('1박 2일 · 바로 만들기').isDisabled(), false);
      await button('닫기').click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => !history.state?.spotlogSheet);
      pass('other saved regions retained; filtered one-region creation has no extra choice', { savedCount: 12 });
      await page.goto(base + '?review=ai#home');
      await page.locator('button.home-find-guides').filter({ hasText: 'AI 여행 만들기' }).click();
      const prompt = '부산 2박 3일 음식점 카페 숙박 포함, 부모님과 바다 풍경을 여유롭게 보고 싶어요';
      await page.locator('.ai-planner textarea').fill(prompt);
      assert.equal(await page.locator('.ai-planner textarea').evaluate(e => getComputedStyle(e).fontSize), '16px');
      assert.equal(await page.locator('.ai-planner select').count(), 4);
      await button('초안 만들기').click(); await page.locator('.ai-planner-route').waitFor();
      await page.locator('.ai-planner-save button').click(); await page.locator('.personal-trip').waitFor();
      const y = await firstCardY('.plan-stop');
      const kinds = await page.locator('.plan-stop-copy .ai-planner-kind').evaluateAll(nodes => nodes.map(n => ({ kind: n.dataset.kind, text: n.textContent, color: getComputedStyle(n).color, font: getComputedStyle(n).fontSize, icon: !!n.querySelector('svg') })));
      for (const kind of ['LANDMARK', 'FOOD', 'CAFE', 'STAY']) {
        assert.ok(kinds.some(k => k.kind === kind && k.icon && k.font === '12px'), JSON.stringify(kinds));
      }
      assert.notEqual(kinds.find(k => k.kind === 'LANDMARK').color, kinds.find(k => k.kind === 'FOOD').color);
      await capture('ai-private');
      await page.locator('.plan-stop').first().getByRole('button', { name: / · 장소 메뉴$/ }).click();
      await button('완료').click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => !history.state?.spotlogSheet);
      const nextDone = page.locator('.plan-next-complete');
      const nextLabel = await nextDone.getAttribute('aria-label');
      await nextDone.click();
      assert.equal(await page.locator('.plan-visit-state').count(), 2);
      assert.equal(await page.getByRole('dialog').count(), 0);
      await page.reload(); await page.locator('.personal-trip').waitFor();
      assert.equal(await page.locator('.plan-visit-state').count(), 2);
      pass('next visit completion is one tap and survives reload', nextLabel);
      await capture('next-completed');
      await button('여행 메뉴').click();
      await button('여행 이름 · 날짜').click();
      await page.locator('input[type=date]').fill('2026-10-06');
      await button('변경 저장').click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => !history.state?.spotlogSheet);
      assert.equal(await page.locator('.day-tabs-track button').first().locator('small').textContent(), 'DAY 1');
      assert.match(await page.locator('.day-tabs-track button').first().locator('strong').textContent(), /10/);
      await capture('dated-private');
      pass('dated DAY retains number and calendar date');
      await page.goto(base + '?review=guide#places-guide'); await page.locator('.landmark-guide-card').first().waitFor();
      const guideY = await firstCardY('.landmark-guide-card');
      await capture('guide'); report.layout.push({ width, firstPrivateCard: y, firstGuideCard: guideY });
      await page.goto(base + '?review=language#profile');
      await button('프로필 · 이용 설정').click();
      await button('English').click(); await button('Close').click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => !history.state?.spotlogSheet);
      await page.goto(base + '?review=language#saved');
      await page.getByRole('button', { name: 'Create now', exact: true }).click();
      await capture('english-region');
      pass('English region picker and controls render without horizontal overflow');
      await context.close();
    }
    assert.equal(report.errors.length, 0); write();
    console.log(JSON.stringify({ checks: report.checks.length, screens: report.screens.length, layout: report.layout, errors: report.errors }));
  } catch (e) {
    report.errors.push({ width, error: e.stack }); write();
    if (page) await page.screenshot({ path: __dirname + '/regression-failure.png' });
    throw e;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
