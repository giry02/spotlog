const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const forest = { id: 'seoul-seoulforest', kind: 'LANDMARK', name: '서울숲', area: '서울 성동', address: '서울 성동구 뚝섬로 273', lat: 37.5444, lng: 127.0374, image: '', description: '기존 기록', note: '원본을 보존할 메모', duration: '1시간' };
const oldJourney = (id, inDay) => ({ id, title: id === 'qa-existing-a' ? '기존 여행 A' : '기존 여행 B', region: '서울', dateRange: '2026-10-01 ~ 2026-10-02', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: '원본 유지', story: '기존 원문 유지', tags: [], saves: 0, author: '테스트', isMine: true, days: [1, 2].map(day => ({ day, date: `2026-10-0${day}`, title: '', story: '기존 날짜 글', places: day === inDay ? [{ ...forest, visitId: `${id}-forest` }] : [], blocks: day === inDay ? [{ id: `${id}-block`, type: 'PLACE', placeId: forest.id, visitId: `${id}-forest` }, { id: `${id}-text`, type: 'TEXT', body: '이 글은 방문을 해제해도 남아야 합니다.' }] : [] })) });
const seed = {
  'spotlog.web.saved.v3': JSON.stringify(['jeju-hyeopjae', 'gangneung-anmok', 'seoul-seoulforest']),
  'spotlog.web.journeys.v4': JSON.stringify([oldJourney('qa-existing-a', 1), oldJourney('qa-existing-b', 2)]),
  'spotlog.saved-library.v1': JSON.stringify({ collections: [{ id: 'legacy-folder', name: '기존 제주 보관함', placeIds: ['jeju-hyeopjae', 'seoul-seoulforest'], linkedJourneyId: 'qa-existing-a' }], notes: { 'seoul-seoulforest': '보존할 개인 메모' } }),
};

async function readState(page) {
  return page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records;
    return { journeys: JSON.parse(records['spotlog.web.journeys.v4']), saved: JSON.parse(records['spotlog.web.saved.v3']), libraryRaw: records['spotlog.saved-library.v1'], oldLibraryRaw: localStorage.getItem('spotlog.saved-library.v1') };
  });
}

function ownJourneys(state) { return state.journeys.filter(journey => journey.isMine); }
function originalJourneys(state) { return ownJourneys(state).filter(journey => /^qa-existing-/.test(journey.id)); }
function card(page, id) { return page.locator(`.saved-places .landmark-guide-card[data-place-id="${id}"]`); }
async function assertCreationDetail(page, id) {
  await page.locator('.journey-detail').waitFor();
  assert.equal(new URL(page.url()).hash, `#journey-${id}`);
  const navigation = await page.evaluate(() => ({ state: history.state, editor: Boolean(document.querySelector('.journey-editor')) }));
  assert.equal(navigation.state.tab, 'trips');
  assert.equal(navigation.state.journeyId, id);
  assert.equal(navigation.state.editorId, null);
  assert.equal(navigation.editor, false);
}
async function assertFullWidthCard(page, id) {
  const geometry = await page.locator(`.landmark-guide-card[data-place-id="${id}"]`).filter({ visible: true }).evaluate(article => {
    const image = article.querySelector('.landmark-guide-image').getBoundingClientRect();
    const copy = article.querySelector('.landmark-guide-copy').getBoundingClientRect();
    const outer = article.getBoundingClientRect();
    return { imageWidth: image.width, cardWidth: outer.width, imageBottom: image.bottom, textTop: copy.top, imageHeight: image.height };
  });
  assert.ok(geometry.imageWidth >= geometry.cardWidth - 4, JSON.stringify(geometry));
  assert.ok(geometry.textTop >= geometry.imageBottom - 1, JSON.stringify(geometry));
  assert.ok(geometry.imageHeight >= 180, JSON.stringify(geometry));
  return geometry;
}

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const steps = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(records => {
    if (!localStorage.getItem('spotlog.local.repository.v2')) Object.entries(records).forEach(([key, value]) => localStorage.setItem(key, value));
  }, seed);
  try {
    await page.goto('http://127.0.0.1:5173/#saved');
    await page.getByRole('heading', { name: '저장한 장소', exact: true }).waitFor();
    const initial = await readState(page);
    assert.equal(initial.libraryRaw, seed['spotlog.saved-library.v1']);
    assert.equal(initial.oldLibraryRaw, seed['spotlog.saved-library.v1']);
    steps.push('legacy collection records retained byte-for-byte');
    const trip = page.getByLabel('담을 여행 선택', { exact: true });
    await trip.selectOption('qa-existing-a');
    await page.getByRole('group', { name: '기존 여행 A 담을 날짜', exact: true }).getByRole('button', { name: /DAY 2/ }).click();
    assert.match(await page.locator('.saved-date-strip .active').innerText(), /10월 2일/);
    const forestCard = card(page, forest.id);
    await forestCard.getByRole('button', { name: 'DAY 2에 담기', exact: true }).click();
    let current = await readState(page);
    let a = current.journeys.find(journey => journey.id === 'qa-existing-a');
    assert.equal(a.days[1].places.length, 1);
    assert.equal(a.days[1].places[0].id, forest.id);
    assert.deepEqual(a.days[0], initial.journeys.find(journey => journey.id === a.id).days[0]);
    assert.deepEqual(current.journeys.find(journey => journey.id === 'qa-existing-b'), initial.journeys.find(journey => journey.id === 'qa-existing-b'));
    const createdVisit = a.days[1].places[0].visitId;
    await forestCard.getByRole('button', { name: 'DAY 2 담김 해제', exact: true }).click();
    current = await readState(page);
    assert.equal(current.journeys.find(journey => journey.id === 'qa-existing-a').days[1].places.length, 0);
    assert.deepEqual(originalJourneys(current), originalJourneys(initial));
    assert.equal(current.libraryRaw, initial.libraryRaw);
    assert.deepEqual(current.saved, initial.saved);
    assert.ok(createdVisit);
    steps.push('existing trip/date direct add/remove changes only target occurrence');
    await trip.selectOption('qa-existing-b');
    await page.getByRole('group', { name: '기존 여행 B 담을 날짜', exact: true }).getByRole('button', { name: /DAY 2/ }).click();
    await forestCard.getByRole('button', { name: 'DAY 2 담김 해제', exact: true }).click();
    current = await readState(page);
    const b = current.journeys.find(journey => journey.id === 'qa-existing-b');
    assert.equal(b.days[1].places.length, 0);
    assert.equal(b.days[1].blocks.length, 1);
    assert.equal(b.days[1].blocks[0].type, 'TEXT');
    assert.deepEqual(current.journeys.find(journey => journey.id === 'qa-existing-a'), initial.journeys.find(journey => journey.id === 'qa-existing-a'));
    const originalsBeforeCreate = originalJourneys(current);
    steps.push('original text remains after bound visit removal; other journey untouched');
    await page.reload();
    await trip.waitFor();
    assert.equal(await trip.inputValue(), 'qa-existing-b');
    assert.match(await page.locator('.saved-date-strip .active').innerText(), /DAY 2/);
    assert.equal(await page.locator('.saved-places').getByText(/보관함/).count(), 0);
    await assertFullWidthCard(page, 'gangneung-anmok');
    await page.locator('.content').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: path.resolve('artifacts/saved-simple-390.png') });
    await card(page, 'gangneung-anmok').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.resolve('artifacts/saved-simple-card-390.png') });
    steps.push('DAY selection persists and saved card has full-width guide image layout');
    await page.getByRole('button', { name: '새 여행', exact: true }).click();
    await page.getByRole('dialog').getByLabel('여행 이름', { exact: true }).fill('검수용 새 여행');
    await page.getByLabel('새 여행 기간', { exact: true }).selectOption('3');
    await page.getByLabel('출발 날짜', { exact: true }).fill('2026-10-11');
    await page.getByRole('button', { name: '여행 만들기', exact: true }).click();
    current = await readState(page);
    const manual = ownJourneys(current).find(journey => journey.title === '검수용 새 여행');
    assert.ok(manual);
    assert.equal(manual.days.length, 3);
    assert.equal(manual.days[0].date, '2026-10-11');
    assert.equal(manual.days[2].date, '2026-10-13');
    assert.equal(manual.days[0].places.length, 3);
    assert.equal(manual.days[1].places.length, 0);
    assert.deepEqual(originalJourneys(current), originalsBeforeCreate);
    assert.equal(current.libraryRaw, initial.libraryRaw);
    await assertCreationDetail(page, manual.id);
    await page.reload();
    await assertCreationDetail(page, manual.id);
    await page.screenshot({ path: path.resolve('artifacts/saved-simple-created-detail-390.png') });
    await page.goBack();
    await trip.waitFor();
    assert.match(page.url(), /#saved$/);
    steps.push('manual creation opens My Trips detail, dates exact, reload/back stable');
    await page.locator('.content').evaluate(element => { element.scrollTop = 0; });
    await page.getByRole('button', { name: '저장한 장소로 AI 여행 만들기', exact: false }).click();
    await page.getByLabel('AI 여행 기간', { exact: true }).selectOption('2');
    assert.match(await page.getByRole('dialog').innerText(), /로컬 시연/);
    await page.getByRole('button', { name: '이 장소로 여행 만들기', exact: true }).click();
    current = await readState(page);
    const ai = ownJourneys(current).find(journey => !/^qa-existing-/.test(journey.id) && journey.id !== manual.id);
    assert.ok(ai);
    assert.equal(ai.days.length, 2);
    assert.equal(ai.days.flatMap(day => day.places).length, 3);
    assert.deepEqual(originalJourneys(current), originalsBeforeCreate);
    assert.equal(current.libraryRaw, initial.libraryRaw);
    await assertCreationDetail(page, ai.id);
    await page.goBack();
    await trip.waitFor();
    steps.push('AI creation disclosed as local demo, creates new journey and enters My Trips detail');
    await page.setViewportSize({ width: 320, height: 740 });
    await page.locator('.content').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: path.resolve('artifacts/saved-simple-320.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const toastGeometry = await page.locator('.toast').evaluate(element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, viewport: innerWidth, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
    });
    assert.ok(toastGeometry.left >= 0 && toastGeometry.right <= toastGeometry.viewport);
    assert.ok(toastGeometry.scrollWidth <= toastGeometry.clientWidth);
    await assertFullWidthCard(page, 'gangneung-anmok');
    await page.getByRole('button', { name: '새 여행', exact: true }).click();
    await page.screenshot({ path: path.resolve('artifacts/saved-simple-create-320.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.querySelector('.app-shell').inert), false);
    await page.getByRole('navigation', { name: '주요 메뉴', exact: true }).getByRole('button', { name: '내 여행', exact: true }).click();
    await page.getByRole('heading', { name: '내 여행', exact: true }).waitFor();
    assert.match(await page.locator('.content').innerText(), /검수용 새 여행/);
    assert.match(await page.locator('.content').innerText(), new RegExp(ai.title));
    steps.push('320px no horizontal overflow, dialog Escape, both new trips visible in My Trips');

    const createIsolated = async records => {
      const isolated = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const isolatedPage = await isolated.newPage();
      isolatedPage.on('pageerror', error => errors.push(error.message));
      await isolatedPage.addInitScript(initialRecords => {
        if (!localStorage.getItem('spotlog.local.repository.v2')) Object.entries(initialRecords).forEach(([key, value]) => localStorage.setItem(key, value));
      }, records);
      await isolatedPage.goto('http://127.0.0.1:5173/#saved');
      await isolatedPage.getByRole('heading', { name: '저장한 장소', exact: true }).waitFor();
      return isolatedPage;
    };

    const repeated = oldJourney('qa-existing-a', 2);
    repeated.days[1].places.push({ ...forest, visitId: 'repeat-forest-2', time: '15:30' });
    repeated.days[1].blocks.push({ id: 'repeat-block-2', type: 'PLACE', placeId: forest.id, visitId: 'repeat-forest-2' });
    const repeatedPage = await createIsolated({ ...seed, 'spotlog.web.saved.v3': JSON.stringify([forest.id]), 'spotlog.web.journeys.v4': JSON.stringify([repeated, oldJourney('qa-existing-b', 1)]) });
    await repeatedPage.getByRole('group', { name: '기존 여행 A 담을 날짜', exact: true }).getByRole('button', { name: /DAY 2/ }).click();
    await card(repeatedPage, forest.id).getByRole('button', { name: 'DAY 2 담김 해제', exact: true }).click();
    await repeatedPage.getByRole('dialog').waitFor();
    assert.equal(await repeatedPage.getByRole('button', { name: '이 방문 해제', exact: true }).count(), 2);
    await repeatedPage.getByRole('button', { name: '이 방문 해제', exact: true }).first().click();
    await repeatedPage.getByRole('dialog').waitFor({ state: 'hidden' });
    let repeatedState = await readState(repeatedPage);
    assert.deepEqual(repeatedState.journeys.find(journey => journey.id === repeated.id).days[1].places.map(place => place.visitId), ['repeat-forest-2']);
    assert.equal(repeatedState.journeys.find(journey => journey.id === repeated.id).days[1].blocks.length, 2);
    const repeatedJourneysBeforeUnsave = repeatedState.journeys;
    await card(repeatedPage, forest.id).getByRole('button', { name: '저장 해제', exact: true }).click();
    await repeatedPage.getByRole('dialog').getByRole('button', { name: '저장 해제', exact: true }).click();
    await repeatedPage.getByRole('dialog').waitFor({ state: 'hidden' });
    repeatedState = await readState(repeatedPage);
    assert.deepEqual(repeatedState.saved, []);
    assert.deepEqual(repeatedState.journeys, repeatedJourneysBeforeUnsave);
    assert.equal(repeatedState.libraryRaw, seed['spotlog.saved-library.v1']);
    assert.equal(repeatedState.oldLibraryRaw, seed['spotlog.saved-library.v1']);
    steps.push('duplicate same-day visit chooser removes exact visit; global unsave preserves journeys and legacy folders');

    const emptyPage = await createIsolated({ ...seed, 'spotlog.web.saved.v3': JSON.stringify([forest.id]), 'spotlog.web.journeys.v4': '[]' });
    assert.equal(await emptyPage.getByLabel('담을 여행 선택', { exact: true }).count(), 0);
    assert.equal(await card(emptyPage, forest.id).getByRole('button', { name: '위에서 여행 선택', exact: true }).isDisabled(), true);
    await emptyPage.getByRole('button', { name: '새 여행', exact: true }).click();
    await emptyPage.getByRole('dialog').getByLabel('여행 이름', { exact: true }).fill('첫 여행 7일');
    await emptyPage.getByLabel('새 여행 기간', { exact: true }).selectOption('7');
    await emptyPage.getByRole('button', { name: '여행 만들기', exact: true }).click();
    const first = ownJourneys(await readState(emptyPage))[0];
    assert.equal(first.days.length, 7);
    await assertCreationDetail(emptyPage, first.id);
    steps.push('without existing journeys, first creation enters My Trips detail with chosen duration');

    const quotaPage = await createIsolated(seed);
    const beforeQuota = await readState(quotaPage);
    await quotaPage.evaluate(() => {
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key === 'spotlog.local.repository.v2') throw new DOMException('Injected quota failure', 'QuotaExceededError'); return write.call(this, key, value); };
    });
    await quotaPage.getByRole('button', { name: '새 여행', exact: true }).click();
    await quotaPage.getByRole('dialog').getByLabel('여행 이름', { exact: true }).fill('실패해야 하는 여행');
    await quotaPage.getByRole('button', { name: '여행 만들기', exact: true }).click();
    await quotaPage.getByRole('dialog').getByRole('alert').waitFor();
    assert.match(quotaPage.url(), /#saved$/);
    assert.deepEqual(await readState(quotaPage), beforeQuota);
    steps.push('storage quota failure keeps form open and leaves stored journeys untouched');

    const morePage = await createIsolated({ ...seed, 'spotlog.web.saved.v3': JSON.stringify(['jeju-hyeopjae', 'gangneung-anmok', 'seoul-seoulforest', 'jeongseon-rail']) });
    assert.equal(await morePage.locator('.saved-place-list .landmark-guide-card').count(), 3);
    await morePage.locator('.content').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await morePage.waitForFunction(() => document.querySelectorAll('.saved-place-list .landmark-guide-card').length === 4);
    const targetGeometry = await morePage.locator('.saved-trip-target').boundingBox();
    assert.ok(targetGeometry.y >= 0 && targetGeometry.y <= 1);
    await morePage.getByRole('group', { name: '기존 여행 A 담을 날짜', exact: true }).getByRole('button', { name: /DAY 2/ }).click();
    await card(morePage, 'jeongseon-rail').getByRole('button', { name: 'DAY 2에 담기', exact: true }).click();
    assert.equal((await readState(morePage)).journeys.find(journey => journey.id === 'qa-existing-a').days[1].places[0].id, 'jeongseon-rail');
    steps.push('three-card automatic pagination with sticky clickable trip/date controls');

    const savedGeometry = await assertFullWidthCard(morePage, 'gangneung-anmok');
    const savedImage = await card(morePage, 'gangneung-anmok').locator('img').getAttribute('src');
    await morePage.getByRole('navigation', { name: '주요 메뉴', exact: true }).getByRole('button', { name: '장소', exact: true }).click();
    await morePage.getByRole('button', { name: '지역 안내', exact: true }).click();
    await morePage.getByLabel('랜드마크 지역 검색', { exact: true }).fill('안목해변');
    const guideCard = morePage.locator('.place-guide-results .landmark-guide-card[data-place-id="gangneung-anmok"]');
    await guideCard.waitFor();
    const guideGeometry = await assertFullWidthCard(morePage, 'gangneung-anmok');
    assert.equal(await guideCard.locator('img').getAttribute('src'), savedImage);
    assert.equal(guideGeometry.imageHeight, savedGeometry.imageHeight);
    assert.ok(Math.abs(guideGeometry.imageWidth - savedGeometry.imageWidth) <= 4);
    await morePage.getByRole('navigation', { name: '주요 메뉴', exact: true }).getByRole('button', { name: '저장', exact: true }).click();
    await morePage.getByRole('group', { name: '저장한 장소 지역', exact: true }).getByRole('button', { name: /^제주/ }).click();
    assert.equal(await morePage.locator('.saved-place-list .landmark-guide-card').count(), 1);
    await morePage.locator('.content').evaluate(element => { element.scrollTop = 0; });
    await morePage.getByRole('button', { name: '저장한 장소로 AI 여행 만들기', exact: false }).click();
    assert.match(await morePage.getByRole('dialog').innerText(), /제주의 저장한 장소 1곳/);
    await morePage.getByLabel('AI 여행 기간', { exact: true }).selectOption('7');
    await morePage.getByRole('button', { name: '이 장소로 여행 만들기', exact: true }).click();
    const scoped = ownJourneys(await readState(morePage)).find(journey => !/^qa-existing-/.test(journey.id));
    assert.equal(scoped.days.length, 7);
    assert.deepEqual(scoped.days.flatMap(day => day.places).map(place => place.id), ['jeju-hyeopjae']);
    await assertCreationDetail(morePage, scoped.id);
    steps.push('guide/saved card image and dimensions match; region-filtered AI uses only shown place and preserves7day choice');

    const photoContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const photoPage = await photoContext.newPage();
    photoPage.on('pageerror', error => errors.push(error.message));
    await photoPage.goto('http://127.0.0.1:5173/#places-photo');
    await photoPage.locator('.photo-landmark-feed').waitFor();
    const activePhoto = () => photoPage.locator('.photo-landmark-reel[data-active="true"]');
    const firstPhotoPlace = await activePhoto().getAttribute('data-place-id');
    const cdp = await photoContext.newCDPSession(photoPage);
    const gesture = async (from, to) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
      for (let index = 1; index <= 12; index++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * index / 12, y: from.y + (to.y - from.y) * index / 12 }] });
        await photoPage.waitForTimeout(18);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await photoPage.waitForTimeout(600);
    };
    await gesture({ x: 315, y: 370 }, { x: 70, y: 370 });
    assert.equal(await activePhoto().getAttribute('data-place-id'), firstPhotoPlace);
    assert.equal(await activePhoto().locator('.photo-reel-track').getAttribute('data-photo-index'), '1');
    await gesture({ x: 155, y: 610 }, { x: 155, y: 220 });
    assert.notEqual(await activePhoto().getAttribute('data-place-id'), firstPhotoPlace);
    await photoPage.screenshot({ path: path.resolve('artifacts/saved-simple-photo-regression-390.png') });
    await cdp.detach();
    steps.push('photo reel native horizontal same-place photo and vertical next-landmark gestures still work');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ steps, errors, screenshots: 'artifacts/saved-simple-*.png' }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.resolve('artifacts/saved-simple-failure.png') }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
