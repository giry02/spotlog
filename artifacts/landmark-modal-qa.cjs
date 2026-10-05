const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const stage = process.argv[2] || 'before';
const output = `artifacts/landmark-modal-qa/${stage}`;
const repositoryKey = 'spotlog.local.repository.v2';
const journeysKey = 'spotlog.web.journeys.v4';
const savedKey = 'spotlog.web.saved.v3';
const place = { id: 'public-busan-dongbaek', kind: 'LANDMARK', name: '동백섬', area: '부산 해운대', address: '부산 해운대구 우동 710-1', lat: 35.1523895, lng: 129.1526031, image: '', description: 'QA 격리 일정', note: '', duration: '권장 1시간' };
const trip = (id, placementDay) => ({ id, title: id === 'qa-a' ? '부산 첫 여행' : '부산 두 번째 여행', region: '부산', dateRange: '날짜 미정', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: 'QA 격리 데이터', story: '', tags: [], saves: 0, author: 'QA', isMine: true,
  days: [1, 2].map((day) => ({ day, date: `DAY ${day}`, title: `${day}일차`, story: '원래 메모', places: day === placementDay ? [{ ...place, visitId: `${id}-v-${day}` }] : [], blocks: [{ id: `${id}-text-${day}`, type: 'TEXT', body: '원래 글' }, ...(day === placementDay ? [{ id: `${id}-p-${day}`, type: 'PLACE', placeId: place.id, visitId: `${id}-v-${day}` }] : [])] })) });
const envelope = (journeys = []) => ({ schemaVersion: 2, updatedAt: '2026-09-10T00:00:00Z', records: { [journeysKey]: JSON.stringify(journeys), [savedKey]: JSON.stringify([place.id, 'public-busan-haeundae']) } });
const metrics = async (page, selector) => page.locator(selector).first().evaluate((node) => {
  const style = (el) => { if (!el) return null; const s = getComputedStyle(el), r = el.getBoundingClientRect(); return { width: r.width, height: r.height, fontSize: s.fontSize, lineHeight: s.lineHeight, radius: s.borderRadius, padding: s.padding }; };
  return { card: style(node), photo: style(node.querySelector('.landmark-guide-image')), title: style(node.querySelector('h3')), description: style(node.querySelector('.landmark-guide-copy > p')), action: style(node.querySelector('.landmark-guide-actions button')), photoLoaded: Array.from(node.querySelectorAll('img')).every((im) => im.complete && im.naturalWidth > 0) };
});
async function capture(page, name, width) {
  await page.screenshot({ path: `${output}/${name}-${width}.png` });
  const geometry = await page.evaluate(() => { const dialog = document.querySelector('.phase-sheet'); const body = document.querySelector('.phase-sheet-body'); const box = dialog?.getBoundingClientRect(); return { documentOverflow: document.documentElement.scrollWidth > innerWidth, bodyOverflow: body ? body.scrollWidth > body.clientWidth + 1 : false, bounds: box && { left: box.left, right: box.right, height: box.height }, width: innerWidth }; });
  assert.equal(geometry.documentOverflow, false); assert.equal(geometry.bodyOverflow, false);
  if (geometry.bounds) { assert.ok(geometry.bounds.left >= 0); assert.ok(geometry.bounds.right <= width + 1); assert.ok(geometry.bounds.height <= 844 * .88 + 1); }
  return geometry;
}
(async () => {
  fs.mkdirSync(output, { recursive: true }); const results = [];
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  async function scenario(name, width, journeys, route, run) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: repositoryKey, value: envelope(journeys) });
    const page = await context.newPage(); page.setDefaultTimeout(9000); const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    try { await page.goto(`http://127.0.0.1:5173/#${route}`); await page.evaluate(() => document.fonts.ready); const data = await run(page); assert.deepEqual(errors, []); results.push({ name, width, ok: true, ...data }); console.log('PASS', stage, name, width); }
    catch (error) { await page.screenshot({ path: `${output}/${name}-${width}-failure.png` }); results.push({ name, width, ok: false, error: String(error), errors }); console.log('FAIL', name, width, String(error)); }
    finally { await context.close(); }
  }
  const raw = (page) => page.evaluate((key) => localStorage.getItem(key), repositoryKey);
  const openAdd = async (page) => { await page.getByRole('button', { name: /^동백섬, / }).click(); const dialog = page.getByRole('dialog', { name: '내 여행에 담기' }); await dialog.waitFor(); return dialog; };
  try {
    for (const width of [320, 390, 460]) {
      await scenario('discovery', width, [], 'places-guide', async (page) => {
        const card = page.locator('.landmark-guide-card').first(); await card.scrollIntoViewIfNeeded(); await card.locator('img').evaluate((img) => img.decode().catch(() => {}));
        return { geometry: await capture(page, 'discovery-card', width), metrics: await metrics(page, '.landmark-guide-card') };
      });
      await scenario('ai-preview', width, [], 'home', async (page) => {
        await page.getByRole('button', { name: /가고 싶은 여행을 이야기해 주세요 AI 여행 만들기/ }).click();
        let dialog = page.getByRole('dialog', { name: 'AI 여행 만들기' }); await dialog.waitFor(); const before = await raw(page);
        await dialog.getByRole('textbox', { name: /^어떤 여행/ }).fill('부산 1박 2일, 바다를 보고 카페는 빼고 덜 걷고 싶어요.');
        await capture(page, 'ai-input', width); await dialog.getByRole('button', { name: '초안 만들기', exact: true }).click();
        dialog = page.getByRole('dialog', { name: '여행 초안 미리보기' }); await dialog.waitFor();
        await page.locator('.phase-sheet-body').evaluate((node) => node.scrollTop = 0); const geometry = await capture(page, 'ai-preview-top', width);
        const cardCount = await dialog.locator('.landmark-guide-card').count(); let cardMetrics = null;
        if (cardCount) { const card = dialog.locator('.landmark-guide-card').first(); await card.scrollIntoViewIfNeeded(); await card.locator('img').evaluate((img) => img.decode().catch(() => {})); await capture(page, 'ai-preview-card', width); cardMetrics = await metrics(page, '.phase-sheet .landmark-guide-card'); }
        await page.locator('.phase-sheet-body').evaluate((node) => node.scrollTop = node.scrollHeight); await capture(page, 'ai-preview-bottom', width); assert.equal(await raw(page), before);
        if (stage === 'after') { assert.ok(cardCount > 0); assert.equal(cardMetrics.photo.height, 205); assert.equal(cardMetrics.title.fontSize, '21px'); assert.equal(cardMetrics.description.fontSize, '13px'); assert.equal(cardMetrics.photoLoaded, true); assert.ok(await dialog.locator('.landmark-guide-card .public-photo-credit').count() > 0); assert.equal(await dialog.locator('.landmark-guide-card').getByRole('button', { name: '공유', exact: true }).count(), 0); }
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }); assert.equal(await raw(page), before);
        return { geometry, cardCount, cardMetrics, previewAndCancelUnsaved: true };
      });
      await scenario('new-add', width, [], 'saved', async (page) => {
        const before = await raw(page); const dialog = await openAdd(page); await dialog.getByRole('combobox', { name: '여행 기간', exact: true }).selectOption('2'); await dialog.getByRole('textbox', { name: /^출발 날짜/ }).fill('2026-10-31'); await dialog.getByRole('button', { name: 'DAY 2 11월 1일', exact: true }).click();
        await page.locator('.phase-sheet-body').evaluate((node) => node.scrollTop = 0); const geometry = await capture(page, 'add-new-top', width);
        const cardCount = await dialog.locator('.landmark-guide-card').count(); let cardMetrics = null;
        if (cardCount) { const card = dialog.locator('.landmark-guide-card').first(); await card.scrollIntoViewIfNeeded(); await card.locator('img').evaluate((img) => img.decode().catch(() => {})); await capture(page, 'add-new-card', width); cardMetrics = await metrics(page, '.phase-sheet .landmark-guide-card'); }
        await page.locator('.phase-sheet-body').evaluate((node) => node.scrollTop = node.scrollHeight); await capture(page, 'add-new-bottom', width);
        if (stage === 'after') { assert.equal(cardCount, 1); assert.equal(cardMetrics.photo.height, 205); assert.equal(cardMetrics.title.fontSize, '21px'); assert.equal(cardMetrics.photoLoaded, true); assert.equal(await dialog.locator('.landmark-guide-card .public-photo-credit').count(), 1); assert.equal(await dialog.locator('.landmark-guide-card').getByRole('button', { name: '공유', exact: true }).count(), 0); }
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }); assert.equal(await raw(page), before); return { geometry, cardCount, cardMetrics, cancelUnsaved: true };
      });
      await scenario('existing-add', width, [trip('qa-a', 1), trip('qa-b', 2)], 'saved', async (page) => {
        const before = await raw(page); const dialog = await openAdd(page); await dialog.getByRole('combobox', { name: '담을 여행', exact: true }).selectOption('qa-b'); await dialog.getByRole('group', { name: '담을 DAY', exact: true }).getByRole('button', { name: /^DAY 2/ }).click();
        assert.equal(await dialog.getByText('이미 DAY 2에 담겨 있어요.', { exact: true }).count(), 1); assert.equal(await dialog.getByRole('button', { name: '동백섬 DAY 2 담김 해제', exact: true }).count(), 1);
        await page.locator('.phase-sheet-body').evaluate((node) => node.scrollTop = 0); const geometry = await capture(page, 'add-included-top', width);
        const cardCount = await dialog.locator('.landmark-guide-card').count();
        if (cardCount) { await dialog.locator('.landmark-guide-card').first().scrollIntoViewIfNeeded(); await capture(page, 'add-included-card', width); }
        await page.locator('.phase-sheet-body').evaluate((node) => node.scrollTop = node.scrollHeight); await capture(page, 'add-included-bottom', width);
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }); assert.equal(await raw(page), before); return { geometry, cardCount, exactMembershipVisible: true, cancelUnsaved: true };
      });
      if (stage === 'after') await scenario('ai-selection', width, [], 'home', async (page) => {
        await page.getByRole('button', { name: /가고 싶은 여행을 이야기해 주세요 AI 여행 만들기/ }).click();
        let dialog = page.getByRole('dialog', { name: 'AI 여행 만들기' }); await dialog.getByRole('textbox', { name: /^어떤 여행/ }).fill('부산 1박 2일, 바다를 보고 카페는 빼고 덜 걷고 싶어요.'); await dialog.getByRole('button', { name: '초안 만들기', exact: true }).click();
        dialog = page.getByRole('dialog', { name: '여행 초안 미리보기' }); await dialog.waitFor(); const before = await raw(page);
        const days = dialog.getByRole('group', { name: '추천 일정 날짜 선택' });
        let removed = 0;
        for (const number of [1, 2]) {
          await days.getByRole('button', { name: new RegExp(`^DAY ${number},`) }).click();
          const section = dialog.getByRole('region', { name: `DAY ${number} 추천 장소` });
          await section.waitFor();
          while (await section.getByRole('button', { name: /선택됨, 이번 초안에서 제외$/ }).count()) { await section.getByRole('button', { name: /선택됨, 이번 초안에서 제외$/ }).first().click(); removed++; }
        }
        assert.equal(removed, 4); const create = dialog.getByRole('button', { name: '이 초안으로 내 여행 만들기', exact: true }); assert.equal(await create.isDisabled(), true); assert.equal(await raw(page), before);
        await page.locator('.phase-sheet-body').evaluate((node) => node.scrollTop = node.scrollHeight); await capture(page, 'ai-all-excluded', width);
        const stickyBounds = await dialog.evaluate((node) => { const header = node.querySelector('header').getBoundingClientRect(); const tabs = node.querySelector('.ai-travel-day-options').getBoundingClientRect(); return { headerBottom: header.bottom, tabsTop: tabs.top, gap: tabs.top - header.bottom, cssTop: getComputedStyle(node.querySelector('.ai-travel-day-options')).top }; });
        assert.ok(Math.abs(stickyBounds.gap) < 1, 'Scrolled DAY bar must meet the sheet header without a photo slit');
        const returnButton = dialog.getByRole('region', { name: 'DAY 2 추천 장소' }).getByRole('button', { name: /일정에 다시 포함$/ }).first();
        const restoredName = (await returnButton.getAttribute('aria-label')).replace(/ 일정에 다시 포함$/, ''); await returnButton.click();
        assert.equal(await create.isDisabled(), false); assert.equal(await raw(page), before);
        const restoredCard = dialog.getByRole('region', { name: 'DAY 2 추천 장소' }).locator('.landmark-guide-card').filter({ has: page.getByRole('heading', { name: restoredName, exact: true }) });
        await restoredCard.scrollIntoViewIfNeeded(); const selectedColors = await restoredCard.getByRole('button', { name: /선택됨, 이번 초안에서 제외$/ }).evaluate((button) => ({ color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor }));
        await capture(page, 'ai-day2-restored', width); assert.equal(selectedColors.background, 'rgb(227, 242, 237)');
        await create.click(); await dialog.waitFor({ state: 'detached' });
        const mine = await page.evaluate(({ repositoryKey, journeysKey }) => JSON.parse(JSON.parse(localStorage.getItem(repositoryKey)).records[journeysKey]).filter((journey) => journey.isMine), { repositoryKey, journeysKey });
        assert.equal(mine.length, 1); assert.equal(mine[0].visibility, 'PRIVATE'); assert.equal(mine[0].days.length, 2); assert.equal(mine[0].days[0].places.length, 0); assert.equal(mine[0].days[1].places.length, 1); assert.equal(mine[0].days[1].places[0].name, restoredName);
        assert.equal(mine[0].days[0].blocks.filter((block) => block.type === 'PLACE' || block.type === 'IMAGE').length, 0);
        return { allExcludedDisabled: true, daySwitchPreserved: true, previewStateUnsaved: true, selectedColors, stickyBounds, onlyApprovedPlacesSaved: true, emptyDayRetained: true };
      });
    }
    if (stage === 'after') {
      await scenario('photo-failure', 390, [], 'home', async (page) => {
        const before = await raw(page);
        await page.route('**/*', (route) => route.request().resourceType() === 'image' && route.request().url().includes('/public-tourism/') ? route.abort() : route.continue());
        await page.getByRole('button', { name: /가고 싶은 여행을 이야기해 주세요 AI 여행 만들기/ }).click();
        let dialog = page.getByRole('dialog', { name: 'AI 여행 만들기' }); await dialog.getByRole('textbox', { name: /^어떤 여행/ }).fill('부산 당일치기 바다 산책'); await dialog.getByRole('button', { name: '초안 만들기', exact: true }).click();
        dialog = page.getByRole('dialog', { name: '여행 초안 미리보기' }); await dialog.waitFor(); const card = dialog.locator('.landmark-guide-card').first(); await card.scrollIntoViewIfNeeded(); await card.getByRole('img', { name: /사진 불러오기 실패$/ }).waitFor();
        assert.equal(await card.locator('.public-photo-credit').count(), 1); assert.equal(await card.locator('.landmark-guide-image').evaluate((node) => node.getBoundingClientRect().height), 205); await capture(page, 'ai-photo-failure', 390);
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }); assert.equal(await raw(page), before);
        return { photoFailureShown: true, sourceCreditRetained: true, normalCardHeight: true, originalDataPreserved: true };
      });
      await scenario('photo-empty', 390, [], 'places-guide', async (page) => {
        const before = await raw(page); await page.evaluate(async () => { const fixture = await import('/@fs/C:/Users/Giry/Documents/Spotlog/artifacts/trip-placement-fixture.tsx'); window.unmountTripFixture = fixture.mountTripPlacementFixture(true); });
        const dialog = page.getByRole('dialog', { name: '내 여행에 담기' }); await dialog.waitFor(); const card = dialog.locator('.landmark-guide-card'); await card.scrollIntoViewIfNeeded(); await card.getByRole('img', { name: '서울숲 사진 준비 중', exact: true }).waitFor();
        await capture(page, 'add-photo-empty', 390); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }); assert.equal(await raw(page), before);
        return { emptyPhotoShown: true, originalDataPreserved: true };
      });
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
