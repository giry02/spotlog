const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const origin = 'http://127.0.0.1:5173';
const forest = { id: 'seoul-seoulforest', kind: 'LANDMARK', name: '서울숲', area: '서울 성동', address: '서울 성동구 뚝섬로 273', lat: 37.5444, lng: 127.0374, image: '', description: '기존 기록', note: '원본을 보존할 메모', duration: '1시간' };
const oldJourney = (id, inDay) => ({ id, title: id === 'qa-existing-a' ? '기존 여행 A' : '기존 여행 B', region: '서울', dateRange: '2026-10-01 ~ 2026-10-02', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: '원본 유지', story: '기존 원문 유지', tags: [], saves: 0, author: '테스트', isMine: true, days: [1, 2].map(day => ({ day, date: `2026-10-0${day}`, title: `${day}일차 기록`, story: '기존 날짜 글', places: day === inDay ? [{ ...forest, visitId: `${id}-forest` }] : [], blocks: day === inDay ? [{ id: `${id}-block`, type: 'PLACE', placeId: forest.id, visitId: `${id}-forest` }, { id: `${id}-text`, type: 'TEXT', body: '이 글은 방문을 해제해도 남아야 합니다.' }] : [] })) });
const seed = {
  'spotlog.web.saved.v3': JSON.stringify(['jeju-hyeopjae', 'gangneung-anmok', forest.id]),
  'spotlog.web.journeys.v4': JSON.stringify([oldJourney('qa-existing-a', 1), oldJourney('qa-existing-b', 2)]),
  'spotlog.saved-library.v1': JSON.stringify({ collections: [{ id: 'legacy-folder', name: '기존 제주 보관함', placeIds: ['jeju-hyeopjae', forest.id], linkedJourneyId: 'qa-existing-a' }], notes: { [forest.id]: '보존할 개인 메모' } }),
};
const card = (page, id) => page.locator(`.saved-places .landmark-guide-card[data-place-id="${id}"]`);
const saved = page => page.locator('.saved-places');
const flow = page => page.locator('.my-trips-from-saved');
const mine = state => state.journeys.filter(j => j.isMine);
const journey = (state, id) => state.journeys.find(j => j.id === id);
const originalJourneys = state => mine(state).filter(j => /^qa-existing-/.test(j.id));
const screenshot = (page, name) => page.screenshot({ path: path.resolve(`artifacts/saved-entry-${name}.png`) });
async function state(page) {
  return page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records;
    return { journeys: JSON.parse(records['spotlog.web.journeys.v4']), saved: JSON.parse(records['spotlog.web.saved.v3']), libraryRaw: records['spotlog.saved-library.v1'], oldLibraryRaw: localStorage.getItem('spotlog.saved-library.v1'), backupRaw: localStorage.getItem('spotlog.local.before-migration.v2') };
  });
}
async function assertSaved(page) {
  await saved(page).getByRole('heading', { name: '저장한 장소', exact: true }).waitFor();
  assert.match(page.url(), /#saved$/);
  assert.equal(await saved(page).locator('select, form, input[type=date], .saved-trip-target, .saved-date-strip').count(), 0);
  assert.equal(await saved(page).getByRole('button', { name: /DAY|담김 해제/ }).count(), 0);
  assert.equal(await saved(page).getByRole('button', { name: '여행 만들기', exact: true }).count(), 1);
  assert.equal(await saved(page).getByRole('button', { name: /저장한 장소로 AI 여행 만들기/ }).count(), 1);
}
async function assertFlow(page, mode) {
  await flow(page).getByRole('heading', { name: '내 여행', exact: true }).waitFor();
  assert.match(page.url(), /#trips$/);
  const nav = await page.evaluate(() => ({ history: history.state, active: document.querySelector('.tabbar button.active')?.textContent }));
  assert.equal(nav.active, '내 여행');
  assert.equal(nav.history.tab, 'trips');
  assert.equal(nav.history.tripIntent.mode, mode);
  assert.equal(nav.history.journeyId, null);
  assert.equal(await page.locator('.journey-detail, .journey-editor').count(), 0);
  assert.equal(await saved(page).isVisible(), false);
}
async function detail(page, id, day = 1) {
  await page.locator('.journey-detail').waitFor();
  assert.equal(new URL(page.url()).hash, `#journey-${id}`);
  assert.match(await page.locator('.journey-detail .day-tabs [aria-current=page]').innerText(), new RegExp(`DAY ${day}\\b`));
  const nav = await page.evaluate(() => history.state);
  assert.equal(nav.tab, 'trips');
  assert.equal(nav.journeyId, id);
  assert.equal(nav.detailDay, day);
  assert.equal(nav.tripIntent, null);
  assert.equal(nav.editorId, null);
}
async function addEntry(page, placeId = forest.id) {
  await card(page, placeId).getByRole('button', { name: '내 여행에 담기', exact: true }).click();
  await assertFlow(page, 'add');
}
async function selectDay(page, id, day) {
  await page.getByLabel('담을 여행 선택', { exact: true }).selectOption(id);
  assert.equal(await flow(page).getByRole('button', { name: '담을 날짜를 선택해 주세요', exact: true }).isDisabled(), true);
  await flow(page).getByRole('group', { name: '담을 날짜', exact: true }).getByRole('button', { name: new RegExp(`DAY ${day}\\b`) }).click();
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const boxes = await page.locator('.my-trips-from-saved:visible button, .saved-trip-entries:visible button').evaluateAll(buttons => buttons.map(button => { const box = button.getBoundingClientRect(); return { left: box.left, right: box.right, width: innerWidth }; }));
  assert.ok(boxes.every(box => box.left >= -1 && box.right <= box.width + 1), JSON.stringify(boxes));
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], checks = [];
  const createPage = async (records = seed, width = 390) => {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 740 : 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(initial => { if (!localStorage.getItem('spotlog.local.repository.v2')) Object.entries(initial).forEach(([key, value]) => localStorage.setItem(key, value)); }, records);
    await page.goto(`${origin}/#saved`);
    await assertSaved(page);
    return page;
  };
  try {
    const page = await createPage();
    const initial = await state(page);
    assert.equal(initial.libraryRaw, seed['spotlog.saved-library.v1']);
    assert.equal(initial.oldLibraryRaw, seed['spotlog.saved-library.v1']);
    await noOverflow(page);
    await screenshot(page, 'saved-390');
    await page.setViewportSize({ width: 320, height: 740 });
    await noOverflow(page);
    await screenshot(page, 'saved-320');
    await page.setViewportSize({ width: 390, height: 844 });
    checks.push('Saved has only entry buttons; no journey/DAY selectors or creation form; 320/390px fit');

    await addEntry(page);
    assert.deepEqual(await state(page), initial);
    assert.equal(await page.getByLabel('담을 여행 선택', { exact: true }).inputValue(), '');
    await page.reload();
    await assertFlow(page, 'add');
    assert.deepEqual((await page.evaluate(() => history.state)).tripIntent.placeIds, [forest.id]);
    assert.deepEqual(await state(page), initial);
    await selectDay(page, 'qa-existing-a', 2);
    await screenshot(page, 'select-day-390');
    await page.setViewportSize({ width: 320, height: 740 });
    await noOverflow(page);
    await screenshot(page, 'select-day-320');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('담을 여행 선택', { exact: true }).selectOption('qa-existing-b');
    assert.equal(await flow(page).getByRole('button', { name: '담을 날짜를 선택해 주세요', exact: true }).isDisabled(), true);
    await selectDay(page, 'qa-existing-a', 2);
    await flow(page).getByRole('button', { name: 'DAY 2에 담기', exact: true }).click();
    await detail(page, 'qa-existing-a', 2);
    const afterAdd = await state(page), changed = journey(afterAdd, 'qa-existing-a');
    assert.equal(changed.days[1].places.length, 1);
    assert.equal(changed.days[1].places[0].id, forest.id);
    assert.ok(changed.days[1].places[0].visitId);
    assert.notEqual(changed.days[1].places[0].visitId, changed.days[0].places[0].visitId);
    assert.deepEqual(changed.days[0], journey(initial, changed.id).days[0]);
    assert.deepEqual(journey(afterAdd, 'qa-existing-b'), journey(initial, 'qa-existing-b'));
    assert.deepEqual(afterAdd.saved, initial.saved);
    assert.equal(afterAdd.libraryRaw, initial.libraryRaw);
    assert.equal(afterAdd.backupRaw, initial.backupRaw);
    await page.reload();
    await detail(page, 'qa-existing-a', 2);
    await page.goBack();
    await assertSaved(page);
    await page.goForward();
    await detail(page, 'qa-existing-a', 2);
    await screenshot(page, 'confirmed-day2-390');
    checks.push('Add navigates to My Trips before changes; pending intent reloads; explicit DAY 2 confirmed and survives detail reload/back/forward');
    checks.push('Only chosen journey/day changes; other DAY, journey, original text, saved places and legacy backup records preserved');

    await page.goBack();
    await assertSaved(page);
    await addEntry(page);
    await selectDay(page, 'qa-existing-b', 2);
    assert.match(await flow(page).innerText(), /이미 DAY 2에 담겨 있어요/);
    await flow(page).getByRole('button', { name: '이 날짜 보기', exact: true }).click();
    await detail(page, 'qa-existing-b', 2);
    assert.deepEqual(await state(page), afterAdd);
    checks.push('Already included DAY opens detail without duplicate insertion or removing the visit');

    await page.goBack();
    await assertSaved(page);
    await saved(page).getByRole('button', { name: '여행 만들기', exact: true }).click();
    await assertFlow(page, 'create');
    assert.deepEqual(await state(page), afterAdd);
    await page.getByLabel('여행 이름', { exact: true }).fill('만들지 않을 여행');
    await flow(page).getByRole('button', { name: '저장한 장소로 돌아가기', exact: true }).click();
    await assertSaved(page);
    assert.deepEqual(await state(page), afterAdd);
    await saved(page).getByRole('button', { name: /저장한 장소로 AI 여행 만들기/ }).click();
    await assertFlow(page, 'ai');
    assert.deepEqual(await state(page), afterAdd);
    await page.goBack();
    await assertSaved(page);
    assert.deepEqual(await state(page), afterAdd);
    checks.push('Normal and AI creation navigate first; cancelling either flow leaves all stored content unchanged');

    await saved(page).getByRole('button', { name: '여행 만들기', exact: true }).click();
    await assertFlow(page, 'create');
    await page.getByLabel('여행 이름', { exact: true }).fill('새 여행 생성 검수');
    await page.getByLabel('새 여행 기간', { exact: true }).selectOption('3');
    await page.getByLabel('출발 날짜', { exact: true }).fill('2026-10-11');
    await screenshot(page, 'create-390');
    await page.setViewportSize({ width: 320, height: 740 });
    await noOverflow(page);
    await screenshot(page, 'create-320');
    await flow(page).getByRole('button', { name: '여행 만들기', exact: true }).click();
    const afterCreate = await state(page), created = mine(afterCreate).find(j => j.title === '새 여행 생성 검수');
    assert.ok(created);
    assert.equal(created.days.length, 3);
    assert.equal(created.days[0].date, '2026-10-11');
    assert.equal(created.days[2].date, '2026-10-13');
    assert.equal(created.days[0].places.length, 3);
    assert.equal(created.days[1].places.length, 0);
    assert.deepEqual(originalJourneys(afterCreate), originalJourneys(afterAdd));
    await detail(page, created.id, 1);
    await page.goBack();
    await assertSaved(page);
    assert.equal(afterCreate.libraryRaw, initial.libraryRaw);
    assert.equal(afterCreate.backupRaw, initial.backupRaw);
    checks.push('Manual creation inputs are in My Trips; requested dates and duration preserved; confirmed new trip opens detail');

    const aiPage = await createPage({ ...seed, 'spotlog.web.saved.v3': JSON.stringify([forest.id]) });
    const beforeAi = await state(aiPage);
    await saved(aiPage).getByRole('button', { name: /저장한 장소로 AI 여행 만들기/ }).click();
    await assertFlow(aiPage, 'ai');
    assert.deepEqual(await state(aiPage), beforeAi);
    assert.match(await flow(aiPage).innerText(), /로컬 시연/);
    await aiPage.getByLabel('AI 여행 기간', { exact: true }).selectOption('7');
    await flow(aiPage).getByRole('button', { name: '이 장소로 여행 만들기', exact: true }).click();
    const afterAi = await state(aiPage), generated = mine(afterAi).find(j => !/^qa-existing-/.test(j.id));
    assert.ok(generated);
    assert.equal(generated.days.length, 7);
    assert.equal(generated.days.flatMap(day => day.places).length, 1);
    assert.deepEqual(originalJourneys(afterAi), originalJourneys(beforeAi));
    await detail(aiPage, generated.id);
    assert.equal(afterAi.libraryRaw, initial.libraryRaw);
    checks.push('AI is disclosed as local sample and pads all 7 requested days even with one selected place');

    const firstPage = await createPage({ ...seed, 'spotlog.web.journeys.v4': '[]' });
    const beforeFirst = await state(firstPage);
    await addEntry(firstPage);
    assert.match(await flow(firstPage).innerText(), /아직 내 여행이 없어요/);
    assert.deepEqual(await state(firstPage), beforeFirst);
    await flow(firstPage).getByRole('button', { name: '새 여행 만들기', exact: true }).click();
    await assertFlow(firstPage, 'create');
    assert.deepEqual((await firstPage.evaluate(() => history.state)).tripIntent.placeIds, [forest.id]);
    await firstPage.getByLabel('여행 이름', { exact: true }).fill('첫 여행');
    await flow(firstPage).getByRole('button', { name: '여행 만들기', exact: true }).click();
    const first = mine(await state(firstPage))[0];
    assert.equal(first.days[0].places.length, 1);
    assert.equal(first.days[0].places[0].id, forest.id);
    await detail(firstPage, first.id);
    await firstPage.goBack();
    await assertSaved(firstPage);
    checks.push('No existing journeys falls back to creation in My Trips and carries only the chosen place; back skips completed form');

    for (const mode of ['add', 'create', 'ai']) {
      const quotaPage = await createPage();
      const beforeQuota = await state(quotaPage);
      if (mode === 'add') { await addEntry(quotaPage); await selectDay(quotaPage, 'qa-existing-a', 2); }
      else { await saved(quotaPage).getByRole('button', { name: mode === 'create' ? '여행 만들기' : /저장한 장소로 AI 여행 만들기/, exact: mode === 'create' }).click(); await assertFlow(quotaPage, mode); }
      await quotaPage.evaluate(() => { const write = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'spotlog.local.repository.v2') throw new DOMException('Injected test failure', 'QuotaExceededError'); return write.call(this, key, value); }; });
      await flow(quotaPage).getByRole('button', { name: mode === 'add' ? 'DAY 2에 담기' : mode === 'create' ? '여행 만들기' : '이 장소로 여행 만들기', exact: true }).click();
      await flow(quotaPage).getByRole('alert').waitFor();
      await assertFlow(quotaPage, mode);
      assert.deepEqual(await state(quotaPage), beforeQuota);
    }
    checks.push('Quota failures in add, manual creation and AI creation remain in My Trips with error and unchanged persisted records');

    const unsavePage = await createPage();
    const beforeUnsave = await state(unsavePage);
    await card(unsavePage, forest.id).getByRole('button', { name: '저장 해제', exact: true }).click();
    await unsavePage.getByRole('dialog').getByRole('button', { name: '저장 해제', exact: true }).click();
    await unsavePage.getByRole('dialog').waitFor({ state: 'hidden' });
    const afterUnsave = await state(unsavePage);
    assert.deepEqual(afterUnsave.journeys, beforeUnsave.journeys);
    assert.deepEqual(afterUnsave.saved, beforeUnsave.saved.filter(id => id !== forest.id));
    assert.equal(afterUnsave.libraryRaw, initial.libraryRaw);
    assert.equal(afterUnsave.oldLibraryRaw, initial.oldLibraryRaw);
    checks.push('Saved removal only affects saved list; visits, text, old collections and migration backup remain');
  } finally {
    await browser.close();
    fs.writeFileSync(path.resolve('artifacts/saved-entry-qa.json'), JSON.stringify({ errors, checks }, null, 2));
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ passed: checks.length, errors, checks }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
