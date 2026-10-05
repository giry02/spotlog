const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('spotlog.local.repository.v2')) {
      localStorage.setItem('spotlog.web.saved.v3', JSON.stringify(['jeju-hyeopjae', 'jeju-osulloc', 'jeju-saebyeol']));
      localStorage.setItem('spotlog.web.journeys.v4', JSON.stringify([]));
    }
  });
  const stored = () => page.evaluate(() => {
    const repository = JSON.parse(localStorage.getItem('spotlog.local.repository.v2'));
    return { journeys: JSON.parse(repository.records['spotlog.web.journeys.v4']).filter(item => item.isMine), library: JSON.parse(repository.records['spotlog.saved-library.v1']) };
  });
  await page.goto('http://127.0.0.1:5173/#saved');
  await page.getByRole('heading', { name: '저장한 장소', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '여행에 담기', exact: true }).count(), 0);
  await page.locator('.library-place-card').filter({ has: page.getByRole('heading', { name: '새별오름', exact: true }) }).getByRole('button', { name: '보관함에 분류', exact: true }).click();
  await page.getByRole('button', { name: '새 보관함에 추가', exact: true }).click();
  await page.getByLabel('보관함 이름', { exact: true }).fill('제주 천천히');
  await page.getByRole('button', { name: '보관함 만들기', exact: true }).click();
  await page.getByRole('button', { name: '일자별로 배치하기', exact: true }).waitFor();
  assert.equal((await stored()).journeys.length, 0);
  await page.getByRole('button', { name: '일자별로 배치하기', exact: true }).click();
  await page.getByLabel('시작 날짜 선택').fill('2026-10-01');
  await page.getByRole('button', { name: '2일 일정으로 배치 시작', exact: true }).click();
  await page.locator('.library-day-tabs button').filter({ hasText: 'DAY 2' }).click();
  await page.getByRole('button', { name: 'DAY 2에 배치', exact: true }).click();
  const initial = await stored();
  assert.equal(initial.journeys.length, 1);
  assert.equal(initial.journeys[0].days[0].places.length, 0);
  assert.equal(initial.journeys[0].days[1].places[0].id, 'jeju-saebyeol');
  assert.equal(initial.journeys[0].days[1].date, '2026-10-02');
  assert.equal(initial.library.collections[0].linkedJourneyId, initial.journeys[0].id);
  assert.equal(await page.getByRole('button', { name: 'DAY 2 배치됨', exact: true }).isDisabled(), true);
  await page.screenshot({ path: path.resolve('artifacts/saved-flow-390.png') });
  await page.getByRole('button', { name: '새별오름 배치 관리', exact: true }).click();
  assert.equal(await page.getByRole('dialog').locator('select').count(), 0);
  await page.getByRole('dialog').getByRole('button', { name: 'DAY 2', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'DAY 2에 재방문 추가', exact: true }).click();
  assert.equal((await stored()).journeys[0].days[1].places.length, 2);
  await page.getByRole('button', { name: 'DAY 2 방문 1 배치 해제', exact: true }).click();
  assert.equal((await stored()).journeys[0].days[1].places.length, 1);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '일정 보기', exact: true }).click();
  await page.locator('.journey-detail').waitFor();
  await page.goBack();
  await page.locator('.library-day-tabs button.active').filter({ hasText: 'DAY 2' }).waitFor();
  await page.reload();
  await page.locator('.library-day-tabs button.active').filter({ hasText: 'DAY 2' }).waitFor();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.screenshot({ path: path.resolve('artifacts/saved-flow-320.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS classify → collection → 2-day setup → DAY 2 → repeat → exact removal → schedule/back/reload; 390/320 screenshots; no errors.');
  const legacy = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const legacyPage = await legacy.newPage();
  const oldPlace = initial.journeys[0].days[1].places[0];
  const oldJourney = (id, dayNumber) => ({ ...initial.journeys[0], id, title: id === 'old-a' ? '기존 일정 A' : '기존 일정 B', days: [1, 2].map(day => ({ day, date: `DAY ${day}`, title: '', story: '', places: day === dayNumber ? [{ ...oldPlace, visitId: `${id}-visit` }] : [], blocks: day === dayNumber ? [{ id: `${id}-block`, type: 'PLACE', placeId: oldPlace.id, visitId: `${id}-visit` }] : [] })) });
  await legacyPage.addInitScript(({ journeys, placeId }) => {
    if (!localStorage.getItem('spotlog.local.repository.v2')) {
      localStorage.setItem('spotlog.web.saved.v3', JSON.stringify([placeId]));
      localStorage.setItem('spotlog.web.journeys.v4', JSON.stringify(journeys));
      localStorage.setItem('spotlog.saved-library.v1', JSON.stringify({ collections: [{ id: 'old-collection', name: '예전 보관함', placeIds: [placeId] }], notes: { [placeId]: '기존 메모' } }));
    }
  }, { journeys: [oldJourney('old-a', 1), oldJourney('old-b', 2)], placeId: oldPlace.id });
  const legacyState = () => legacyPage.evaluate(() => {
    const records = JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records;
    return { journeys: JSON.parse(records['spotlog.web.journeys.v4']).filter(item => item.isMine), library: JSON.parse(records['spotlog.saved-library.v1']), saved: JSON.parse(records['spotlog.web.saved.v3']) };
  });
  await legacyPage.goto('http://127.0.0.1:5173/#saved');
  await legacyPage.locator('.library-collections').getByRole('button', { name: /예전 보관함/ }).click();
  await legacyPage.getByRole('button', { name: '일자별로 배치하기', exact: true }).click();
  await legacyPage.getByText('이미 만든 일정에 이어서 배치하기', { exact: true }).click();
  await legacyPage.getByLabel('기존 일정 연결', { exact: true }).selectOption('old-a');
  await legacyPage.getByRole('button', { name: '이 일정의 DAY로 배치 시작', exact: true }).click();
  assert.equal((await legacyState()).journeys.length, 2);
  assert.equal((await legacyState()).library.collections[0].linkedJourneyId, 'old-a');
  await legacyPage.getByRole('button', { name: '새별오름 배치 관리', exact: true }).click();
  assert.equal(await legacyPage.getByRole('dialog').locator('select').count(), 0);
  await legacyPage.getByRole('button', { name: 'DAY 1 방문 1 배치 해제', exact: true }).click();
  let currentLegacy = await legacyState();
  assert.equal(currentLegacy.journeys.find(item => item.id === 'old-a').days[0].places.length, 0);
  assert.equal(currentLegacy.journeys.find(item => item.id === 'old-b').days[1].places[0].visitId, 'old-b-visit');
  assert.equal(currentLegacy.library.notes[oldPlace.id], '기존 메모');
  await legacyPage.getByRole('button', { name: '닫기', exact: true }).click();
  await legacyPage.evaluate(() => {
    const key = 'spotlog.local.repository.v2';
    const record = JSON.parse(localStorage.getItem(key));
    record.records['spotlog.web.journeys.v4'] = JSON.stringify(JSON.parse(record.records['spotlog.web.journeys.v4']).filter(item => item.id !== 'old-a'));
    localStorage.setItem(key, JSON.stringify(record));
  });
  await legacyPage.reload();
  await legacyPage.getByText('연결한 일정을 사용할 수 없습니다.', { exact: false }).waitFor();
  await legacyPage.getByRole('button', { name: '일자별로 배치하기', exact: true }).click();
  await legacyPage.getByRole('button', { name: '2일 일정으로 배치 시작', exact: true }).click();
  currentLegacy = await legacyState();
  assert.notEqual(currentLegacy.library.collections[0].linkedJourneyId, 'old-a');
  assert.equal(currentLegacy.journeys.find(item => item.id === 'old-b').days[1].places[0].visitId, 'old-b-visit');
  await legacyPage.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'spotlog.local.repository.v2') throw new DOMException('Test quota', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await legacyPage.getByRole('button', { name: 'DAY 1에 배치', exact: true }).click();
  const failed = await legacyState();
  assert.equal(failed.journeys.find(item => item.id === failed.library.collections[0].linkedJourneyId).days[0].places.length, 0);
  assert.equal(await legacyPage.getByRole('button', { name: 'DAY 1 배치됨', exact: true }).count(), 0);
  await legacyPage.locator('.local-storage-warning').waitFor();
  console.log('PASS legacy collection → link existing once → remove exact visit only → stale-link recovery → quota failure does not show assignment success.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
