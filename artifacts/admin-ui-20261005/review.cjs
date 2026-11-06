const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const stage = process.argv[2] || 'before';
const output = path.join(__dirname, stage);
fs.mkdirSync(output, { recursive: true });
const menus = ['운영 현황', '장소·업체', '노출·추천', '여행기·커뮤니티', '회원·문의', 'AI·검색 운영', '운영 설정·이력'];
const widths = [1440, 1024, 820, 800, 390, 360, 320];
async function fit(page, name, width) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, main: document.querySelector('.admin-main').clientWidth, mainScroll: document.querySelector('.admin-main').scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.width + 1, name + ' page overflow ' + width);
  assert.ok(dimensions.mainScroll <= dimensions.main + 1, name + ' main overflow ' + width);
  return { name, width, dimensions };
}
async function navigate(page, name) {
  const opener = page.getByRole('button', { name: '관리자 메뉴 열기', exact: true });
  if (await opener.isVisible()) await opener.click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
  await page.locator('.admin-sidebar').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => undefined))));
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [], results = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5210/admin.html');
    await expect(page.getByRole('heading', { name: '오늘의 운영 작업' })).toBeVisible();
    await page.evaluate(() => localStorage.setItem('spotlog-ui-private-sentinel', 'keep private itinerary unchanged'));
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      for (let i = 0; i < menus.length; i++) {
        await navigate(page, menus[i]);
        if (menus[i] === '노출·추천') await page.getByRole('tab', { name: '노출 설정', exact: true }).click();
        await page.locator('.admin-main').evaluate(el => el.scrollTop = 0);
        results.push(await fit(page, menus[i], width));
        await page.screenshot({ path: path.join(output, `${width}-${i + 1}.png`) });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await navigate(page, '노출·추천');
    await page.getByRole('tab', { name: '노출 설정', exact: true }).click();
    const panel = page.locator('.admin-page-body:not([hidden]) .admin-panel').filter({ has: page.getByRole('heading', { name: '채널별 노출', exact: true }) });
    await panel.screenshot({ path: path.join(output, 'exposure-panel.png') });
    const gaps = await panel.evaluate(el => {
      const a = el.querySelector('.admin-field').getBoundingClientRect(), b = el.querySelector('.admin-toolbar').getBoundingClientRect(), c = el.querySelector('.admin-list').getBoundingClientRect();
      const button = el.querySelector('.admin-toolbar button').getBoundingClientRect(), input = el.querySelector('.admin-toolbar input').getBoundingClientRect();
      return { channelToSearch: b.top - a.bottom, searchToList: c.top - b.bottom, searchHeight: input.height, resetHeight: button.height };
    });
    results.push({ name: 'channel search spacing', gaps });
    if (stage === 'after') { assert.ok(gaps.channelToSearch >= 16); assert.ok(gaps.searchToList >= 16); assert.ok(Math.abs(gaps.searchHeight - gaps.resetHeight) <= 1); }
    await page.getByRole('button', { name: '노출 추가', exact: true }).click();
    await page.getByLabel('노출 제목', { exact: true }).fill('간격 검수 미저장 입력');
    await navigate(page, '운영 현황');
    await navigate(page, '노출·추천');
    await expect(page.getByLabel('노출 제목', { exact: true })).toHaveValue('간격 검수 미저장 입력');
    await page.screenshot({ path: path.join(output, 'exposure-edit.png') });
    await navigate(page, '장소·업체');
    await page.getByRole('button', { name: /검수용 바다 전망대/ }).click();
    await page.getByRole('tab', { name: '기본 정보', exact: true }).click();
    await expect(page.getByLabel('장소명', { exact: true })).toBeVisible();
    await page.locator('.admin-main').evaluate(el => el.scrollTop = 0);
    await page.screenshot({ path: path.join(output, 'place-editor.png') });
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      for (const tab of ['위치', '사진·영상', '주변 업체', '안내·번역', 'AI 자료', '이력']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        results.push(await fit(page, '장소 상세 · ' + tab, width));
        if (tab === '사진·영상') {
          const image = page.locator('.admin-page-body:not([hidden]) .admin-media-heading img').first();
          await expect(image).toBeVisible();
          const media = await image.evaluate(el => ({ rendered: el.getBoundingClientRect().width, natural: el.naturalWidth }));
          assert.ok(media.rendered <= 96, 'oversized media ' + width);
          await expect(page.getByRole('heading', { name: '파일 정보', exact: true })).toBeVisible();
          await expect(page.getByRole('heading', { name: '출처·사용 조건', exact: true })).toHaveCount(1);
          await image.scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(output, `${width}-place-media.png`) });
          results.push({ name: 'media dimensions', width, ...media });
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await navigate(page, '노출·추천');
    await page.getByRole('tab', { name: '운영 추천 여행기', exact: true }).click();
    await page.getByRole('button', { name: '새 초안 만들기', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'journal-editor.png') });
    await navigate(page, 'AI·검색 운영');
    for (const tab of ['검색 자료', '색인 작업', '품질 시험', '요청 현황', '실행 정책']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.locator('.admin-main').evaluate(el => el.scrollTop = 0);
      await page.screenshot({ path: path.join(output, `ai-${tab}.png`) });
    }
    for (const width of [1024, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      results.push(await fit(page, 'AI 실행 정책', width));
      await page.screenshot({ path: path.join(output, `${width}-ai-policy.png`) });
    }
    await navigate(page, '운영 설정·이력');
    await page.getByRole('tab', { name: '연결·수급', exact: true }).click();
    const limit = page.locator('.admin-page-body:not([hidden]) .admin-inline-form').first();
    await limit.locator('input').fill('100');
    await page.getByLabel('검수용 역할 전환').selectOption('OPERATOR');
    await expect(limit.getByRole('button')).toBeDisabled();
    await page.getByLabel('검수용 역할 전환').selectOption('ADMIN');
    await expect(limit.getByRole('button')).toBeEnabled();
    for (const width of [1440, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await limit.scrollIntoViewIfNeeded();
      results.push(await fit(page, '운영 설정 · 한도 입력', width));
      await page.screenshot({ path: path.join(output, `${width}-connection-limit.png`) });
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('spotlog-ui-private-sentinel')), 'keep private itinerary unchanged');
    const consumer = await context.newPage();
    await consumer.setViewportSize({ width: 390, height: 844 });
    await consumer.goto('http://127.0.0.1:5210/#home');
    await expect(consumer.locator('.app-shell')).toBeVisible();
    assert.equal(await consumer.locator('.admin-app').count(), 0);
    await consumer.screenshot({ path: path.join(output, 'consumer-home.png') });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ stage, results, errors, privateStoragePreserved: true, unfinishedDraftPreserved: true, roleRestrictionsPreserved: true }, null, 2));
    console.log(stage, 'layout states:', results.length, 'spacing:', JSON.stringify(gaps), 'exceptions:', errors.length);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
