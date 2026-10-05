const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const repoKey = 'spotlog.local.repository.v2';
const journeysKey = 'spotlog.web.journeys.v4';
const savedKey = 'spotlog.web.saved.v3';
const place = { id: 'seoul-seoulforest', kind: 'LANDMARK', name: '서울숲', area: '서울 성동', address: '서울 성동구', lat: 37.54, lng: 127.04, image: '/qa-forest.jpg', description: '산책', note: '', duration: '1시간' };
const trip = (id, placementDay) => ({ id, title: id === 'qa-a' ? '서울 첫 여행' : '서울 두 번째 여행', region: '서울', dateRange: '날짜 미정', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: 'QA 격리 데이터', story: '', tags: [], saves: 0, author: 'QA', isMine: true,
  days: [1, 2].map((day) => ({ day, date: `DAY ${day}`, title: `${day}일차`, story: '원래 메모', places: day === placementDay ? [{ ...place, visitId: `${id}-v-${day}` }] : [], blocks: [{ id: `${id}-text-${day}`, type: 'TEXT', body: '원래 글' }, ...(day === placementDay ? [{ id: `${id}-p-${day}`, type: 'PLACE', placeId: place.id, visitId: `${id}-v-${day}` }] : [])] })) });
const envelope = (journeys = []) => ({ schemaVersion: 2, updatedAt: '2026-09-10T00:00:00Z', records: { [journeysKey]: JSON.stringify(journeys), [savedKey]: JSON.stringify([place.id, 'gangneung-anmok']) } });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const results = [];
  fs.mkdirSync('artifacts/app-trip-ai-flow-qa', { recursive: true });
  async function scenario(name, width, journeys, run, route = 'saved') {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: repoKey, value: envelope(journeys) });
    const page = await context.newPage(); page.setDefaultTimeout(7000); const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(`http://127.0.0.1:5173/#${route}`); await page.evaluate(() => document.fonts.ready);
      const report = await run(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []); results.push({ name, width, ok: true, ...report }); console.log('PASS', name, width);
    } catch (error) { await page.screenshot({ path: `artifacts/app-trip-ai-flow-qa/${name}-${width}-failure.png` }); results.push({ name, width, ok: false, error: String(error), errors }); console.log('FAIL', name, width, String(error)); }
    finally { await context.close(); }
  }
  const read = async (page) => page.evaluate(({ repo, key }) => JSON.parse(JSON.parse(localStorage.getItem(repo)).records[key]), { repo: repoKey, key: journeysKey });
  const raw = async (page) => page.evaluate((key) => localStorage.getItem(key), repoKey);
  const open = async (page) => { await page.getByRole('button', { name: /^서울숲, / }).click(); const dialog = page.getByRole('dialog', { name: '내 여행에 담기' }); await dialog.waitFor(); return dialog; };
  try {
    for (const width of [320, 390, 460]) {
      await scenario('new-and-remove', width, [], async (page) => {
        let dialog = await open(page);
        await dialog.getByRole('combobox', { name: '여행 기간', exact: true }).selectOption('2');
        await dialog.getByRole('textbox', { name: /^출발 날짜/ }).fill('2026-10-31');
        await dialog.getByRole('button', { name: 'DAY 2 11월 1일', exact: true }).click();
        await page.screenshot({ path: `artifacts/app-trip-ai-flow-qa/saved-new-${width}.png` });
        await dialog.getByRole('button', { name: '여행 만들고 DAY 2에 담기', exact: true }).click();
        await dialog.waitFor({ state: 'detached' }); await page.locator('.day-tabs .active').waitFor();
        assert.match(await page.locator('.day-tabs .active').innerText(), /DAY 2/);
        let mine = (await read(page)).filter((journey) => journey.isMine);
        assert.equal(mine.length, 1); assert.equal(mine[0].days.length, 2); assert.equal(mine[0].days[0].places.length, 0); assert.equal(mine[0].days[1].places[0].id, place.id);
        assert.equal(mine[0].visibility, 'PRIVATE');
        await page.goBack(); await page.locator('.saved-card').first().waitFor();
        const beforeCancel = await raw(page); dialog = await open(page);
        const defaultDay = await dialog.locator('.phase-day-options .active').innerText();
        await dialog.getByRole('group', { name: '담을 DAY', exact: true }).getByRole('button', { name: /^DAY 2/ }).click();
        assert.equal(await dialog.getByText('이미 DAY 2에 담겨 있어요.', { exact: true }).count(), 1);
        await page.goBack(); await dialog.waitFor({ state: 'detached' }); assert.equal(await raw(page), beforeCancel);
        dialog = await open(page); await dialog.getByRole('group', { name: '담을 DAY', exact: true }).getByRole('button', { name: /^DAY 2/ }).click();
        await dialog.getByRole('button', { name: '서울숲 DAY 2 담김 해제', exact: true }).click();
        mine = (await read(page)).filter((journey) => journey.isMine); assert.equal(mine[0].days[1].places.length, 0);
        assert.equal(await page.evaluate(({ repo, key, placeId }) => JSON.parse(JSON.parse(localStorage.getItem(repo)).records[key]).includes(placeId), { repo: repoKey, key: savedKey, placeId: place.id }), true);
        await page.screenshot({ path: `artifacts/app-trip-ai-flow-qa/saved-removed-${width}.png` });
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
        return { newDay2: true, defaultDayOnReopen: defaultDay, backCancelUnchanged: true, exactRemoveKeepsBookmark: true };
      });
      await scenario('existing-two-trips', width, [trip('qa-a', 1), trip('qa-b', 2)], async (page) => {
        let dialog = await open(page);
        await dialog.getByRole('combobox', { name: '담을 여행', exact: true }).selectOption('qa-b');
        await dialog.getByRole('group', { name: '담을 DAY', exact: true }).getByRole('button', { name: /^DAY 2/ }).click();
        const beforeDuplicate = await raw(page);
        await dialog.getByRole('button', { name: 'DAY 2 보기', exact: true }).click();
        await dialog.waitFor({ state: 'detached' }); assert.equal(await raw(page), beforeDuplicate);
        assert.match(await page.locator('.day-tabs .active').innerText(), /DAY 2/);
        await page.goBack(); dialog = await open(page); await dialog.getByRole('combobox', { name: '담을 여행', exact: true }).selectOption('qa-b');
        await dialog.getByRole('group', { name: '담을 DAY', exact: true }).getByRole('button', { name: /^DAY 2/ }).click();
        await dialog.getByRole('button', { name: '서울숲 DAY 2 담김 해제', exact: true }).click();
        let stored = await read(page); assert.equal(stored.find((journey) => journey.id === 'qa-a').days[0].places.length, 1); assert.equal(stored.find((journey) => journey.id === 'qa-b').days[1].places.length, 0);
        await dialog.getByRole('button', { name: 'DAY 1', exact: true }).click(); await dialog.getByRole('button', { name: 'DAY 1에 담기', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
        stored = await read(page); const a = stored.find((journey) => journey.id === 'qa-a'); const b = stored.find((journey) => journey.id === 'qa-b');
        assert.equal(a.days[0].places.length, 1); assert.equal(b.days[0].places.length, 1); assert.equal(b.days[1].places.length, 0);
        assert.notEqual(a.days[0].places[0].visitId, b.days[0].places[0].visitId); assert.equal(b.days[0].blocks[0].body, '원래 글');
        await page.goBack(); dialog = await open(page); await dialog.getByRole('combobox', { name: '담을 여행', exact: true }).selectOption('qa-b');
        assert.equal(await dialog.getByRole('combobox', { name: '담을 여행', exact: true }).locator('option').count(), 3);
        await dialog.getByRole('group', { name: '담을 DAY', exact: true }).getByRole('button', { name: /^DAY 2/ }).click();
        await dialog.getByRole('button', { name: 'DAY 2에 담기', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
        stored = await read(page); const repeated = stored.find((journey) => journey.id === 'qa-b');
        assert.equal(repeated.days[0].places.length, 1); assert.equal(repeated.days[1].places.length, 1);
        assert.notEqual(repeated.days[0].places[0].visitId, repeated.days[1].places[0].visitId);
        return { duplicateNoWrite: true, separateJourneysPreserved: true, exactVisitRemoved: true, samePlaceDifferentDay: true, publicTargetsNotOffered: true };
      });
      await scenario('storage-failure', width, [], async (page) => {
        const dialog = await open(page); const before = await raw(page);
        await page.evaluate((key) => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === key) throw new DOMException('QA quota', 'QuotaExceededError'); return original.call(this, k, v); }; }, repoKey);
        await dialog.getByRole('button', { name: '여행 만들고 DAY 1에 담기', exact: true }).click();
        await dialog.getByRole('alert').waitFor(); assert.equal(await raw(page), before); assert.equal(await dialog.count(), 1);
        await page.screenshot({ path: `artifacts/app-trip-ai-flow-qa/saved-failure-${width}.png` });
        return { originalDataPreserved: true, draftStayedOpen: true };
      });
      await scenario('home-ai', width, [], async (page) => {
        await page.getByRole('button', { name: /가고 싶은 여행을 이야기해 주세요 AI 여행 만들기/ }).click();
        let dialog = page.getByRole('dialog', { name: 'AI 여행 만들기' }); await dialog.waitFor();
        const before = await raw(page);
        await dialog.getByRole('textbox', { name: /^어떤 여행/ }).fill('파리에서 일주일 여행을 하고 싶어요.');
        await dialog.getByRole('button', { name: '초안 만들기', exact: true }).click(); await dialog.getByRole('alert').waitFor(); assert.equal(await raw(page), before);
        await dialog.getByRole('textbox', { name: /^어떤 여행/ }).fill('부산 1박 2일, 바다를 보고 카페는 빼고 덜 걷고 싶어요.');
        assert.equal(await dialog.getByRole('combobox', { name: '여행 지역', exact: true }).inputValue(), '부산');
        assert.equal(await dialog.getByRole('combobox', { name: '여행 기간', exact: true }).inputValue(), '2');
        assert.equal(await dialog.getByRole('combobox', { name: '여행 속도', exact: true }).inputValue(), 'slow');
        await page.screenshot({ path: `artifacts/app-trip-ai-flow-qa/ai-input-${width}.png` });
        await dialog.getByRole('button', { name: '초안 만들기', exact: true }).click();
        dialog = page.getByRole('dialog', { name: '여행 초안 미리보기' }); await dialog.waitFor();
        assert.equal(await raw(page), before); assert.equal(await dialog.locator('.ai-travel-day').count(), 2);
        await page.screenshot({ path: `artifacts/app-trip-ai-flow-qa/ai-preview-${width}.png` });
        await dialog.getByRole('button', { name: '이 초안으로 내 여행 만들기', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });
        const mine = (await read(page)).filter((journey) => journey.isMine); assert.equal(mine.length, 1); assert.equal(mine[0].visibility, 'PRIVATE'); assert.equal(mine[0].days.length, 2);
        assert.equal(mine[0].days.flatMap((day) => day.places).some((place) => place.kind === 'CAFE'), false);
        await page.goBack(); assert.equal(await page.locator('.home-page').count(), 1); assert.equal(await page.getByRole('dialog').count(), 0);
        return { unknownShowsError: true, previewDoesNotSave: true, explicitApprovalCreatesPrivate: true, cafeExcluded: true, backReturnsHome: true };
      }, 'home');
    }
    await scenario('ai-storage-failure', 390, [], async (page) => {
      await page.getByRole('button', { name: /가고 싶은 여행을 이야기해 주세요 AI 여행 만들기/ }).click();
      let dialog = page.getByRole('dialog', { name: 'AI 여행 만들기' }); await dialog.getByRole('textbox', { name: /^어떤 여행/ }).fill('서울 당일치기 숲 산책'); await dialog.getByRole('button', { name: '초안 만들기', exact: true }).click();
      dialog = page.getByRole('dialog', { name: '여행 초안 미리보기' }); await dialog.waitFor(); const before = await raw(page);
      await page.evaluate((key) => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === key) throw new DOMException('QA quota', 'QuotaExceededError'); return original.call(this, k, v); }; }, repoKey);
      await dialog.getByRole('button', { name: '이 초안으로 내 여행 만들기', exact: true }).click(); await dialog.getByRole('alert').waitFor(); assert.equal(await raw(page), before); assert.equal(await dialog.count(), 1);
      return { originalDataPreserved: true, previewPreserved: true };
    }, 'home');
  } finally { await browser.close(); }
  fs.writeFileSync('artifacts/app-trip-ai-flow-qa/results.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
})().catch((error) => { console.error(error); process.exit(1); });
