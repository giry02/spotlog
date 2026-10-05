const assert = require('assert/strict');
const fs = require('fs');
const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const { snapshot } = require('./audit.cjs');
const base = 'http://127.0.0.1:5210/';
const report = { checks: [], screens: [], errors: [] };
let page;
const stable = () => page.waitForFunction(() => !history.state?.spotlogSheet);
const button = name => page.getByRole('button', { name, exact: true });
const write = () => fs.writeFileSync(__dirname + '/extra-state-results.json', JSON.stringify(report, null, 2));
async function capture(width, name) {
  const result = await snapshot(page, width, name, false);
  assert.equal(result.overflow || result.bodyOverflow, false);
  assert.equal(result.imageFailures.length, 0);
  report.screens.push(result); write();
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', e => { report.errors.push(e.message); write(); });
    await page.goto(base + '?review=toast#places-photo');
    const active = page.locator('.photo-landmark-reel[data-active=true]');
    await active.waitFor();
    const name = await active.locator('h2').textContent();
    await active.getByRole('button', { name: name + ' 저장', exact: true }).click();
    await page.waitForTimeout(1200);
    await active.getByRole('button', { name: name + ' 저장 해제', exact: true }).click();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.toast').count(), 1);
    report.checks.push('new notification is not dismissed by an earlier notification timer');
    await active.getByRole('button', { name: name + ' 저장', exact: true }).click();
    await page.getByRole('button', { name: /지역 변경/ }).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForFunction(() => history.state?.spotlogSheet);
    assert.equal(await page.locator('.toast').count(), 0);
    report.checks.push('old save notice is cleared when a new sheet opens');
    await button('닫기').click(); await stable();
    await page.goto(base + '?review=extra#home');
    await page.locator('button.home-find-guides').filter({ hasText: 'AI 여행 만들기' }).click();
    await page.locator('.ai-planner textarea').fill('부산 1박 2일 바다');
    await button('초안 만들기').click(); await page.locator('.ai-planner-route').waitFor();
    await page.locator('.ai-planner-save button').click(); await page.locator('.personal-trip').waitFor();
    const hash = await page.evaluate(() => location.hash);
    await button('이날의 동선 지도').click();
    await page.locator('.plan-route').waitFor();
    await button('지도 접기').click();
    assert.equal(await page.locator('.plan-route').count(), 0);
    report.checks.push('moved map control still opens and collapses the route');
    await button('여행 메뉴').click(); await button('여행 이름 · 날짜').click();
    const longName = '부모님과 함께 여유롭게 돌아보는 부산 바다 풍경과 맛있는 식당 그리고 편안한 숙소 여행';
    await page.locator('.plan-form input').first().fill(longName);
    await button('변경 저장').click(); await stable();
    for (const width of [320, 390, 460]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('.plan-cover').scrollIntoViewIfNeeded();
      await capture(width, 'long-title-private');
      const cover = await page.locator('.plan-cover').evaluate(e => ({ cover: e.getBoundingClientRect().height, content: e.querySelector('div').getBoundingClientRect().height, text: e.querySelector('h1').textContent }));
      assert.equal(cover.text, longName); assert.ok(cover.cover >= cover.content - 1);
      assert.ok(await page.locator('.editor-topbar').evaluate(e => e.getBoundingClientRect().height <= 70));
    }
    await page.goto(base + '?review=extra#profile'); await button('프로필 · 이용 설정').click();
    await button('English').click(); await button('Close').click(); await stable();
    await page.goto(base + '?review=extra' + hash); await page.locator('.personal-trip').waitFor();
    for (const width of [320, 390, 460]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('.plan-cover').scrollIntoViewIfNeeded();
      await capture(width, 'english-private');
      const tools = await page.locator('.phase-three-trip-tools button').evaluateAll(nodes => nodes.map(n => ({ width: n.clientWidth, scroll: n.scrollWidth, height: n.getBoundingClientRect().height })));
      assert.ok(tools.every(t => t.scroll <= t.width + 1), JSON.stringify(tools));
      assert.ok(tools.every(t => t.height === tools[0].height), JSON.stringify(tools));
    }
    report.checks.push('long titles stay complete in the cover while the private header remains one line at all three widths');
    report.checks.push('English private tools stay aligned and readable at all three widths');
    assert.equal(report.errors.length, 0); write();
    console.log(JSON.stringify({ checks: report.checks, screens: report.screens.length, errors: report.errors }));
    await context.close();
  } catch (e) {
    report.errors.push(e.stack); write();
    if (page) await page.screenshot({ path: __dirname + '/extra-state-failure.png' });
    throw e;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
