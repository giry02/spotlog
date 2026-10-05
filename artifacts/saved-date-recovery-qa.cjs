const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  const read = page => page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records;
    return { journeys: JSON.parse(records['spotlog.web.journeys.v4']).filter(journey => journey.isMine), library: JSON.parse(records['spotlog.saved-library.v1']) };
  });
  const open = async ({ collection, journeys = [] }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ collection, journeys }) => {
      if (localStorage.getItem('spotlog.local.repository.v2')) return;
      localStorage.setItem('spotlog.web.saved.v3', JSON.stringify(['jeju-saebyeol']));
      localStorage.setItem('spotlog.web.journeys.v4', JSON.stringify(journeys));
      localStorage.setItem('spotlog.saved-library.v1', JSON.stringify({ collections: [collection], notes: { 'jeju-saebyeol': '보존할 메모' } }));
    }, { collection, journeys });
    await page.goto('http://127.0.0.1:5173/#saved', { waitUntil: 'domcontentloaded' });
    await page.locator('.library-collections').getByRole('button', { name: new RegExp(collection.name) }).click();
    return { context, page };
  };
  const setup = async (page, date) => {
    await page.getByRole('button', { name: '일자별로 배치하기', exact: true }).click();
    if (date) await page.getByLabel('시작 날짜 선택').fill(date);
    await page.getByRole('button', { name: '2일 일정으로 배치 시작', exact: true }).click();
    await page.locator('.library-day-tabs button').filter({ hasText: 'DAY 1' }).waitFor();
  };
  try {
    const collection = { id: 'qa-dated', name: '날짜 검수 보관함', placeIds: ['jeju-saebyeol'] };
    const dated = await open({ collection });
    await setup(dated.page, '2026-10-01');
    await dated.page.getByRole('button', { name: 'DAY 1에 배치', exact: true }).click();
    await dated.page.getByRole('button', { name: '새별오름 배치 관리', exact: true }).click();
    await dated.page.getByRole('button', { name: 'DAY 추가', exact: true }).click();
    await dated.page.getByRole('dialog').getByRole('button', { name: 'DAY 3', exact: true }).waitFor();
    const datedState = await read(dated.page);
    const datedJourney = datedState.journeys[0];
    assert.deepEqual(datedJourney.days.map(day => day.date), ['2026-10-01', '2026-10-02', '2026-10-03']);
    assert.equal(datedJourney.dateRange, '2026-10-01 ~ 2026-10-03');
    assert.equal(datedJourney.duration, '2박 3일');
    console.log('PASS actual-date DAY addition', JSON.stringify({ dates: datedJourney.days.map(day => day.date), dateRange: datedJourney.dateRange, duration: datedJourney.duration }));
    await dated.context.close();

    const undatedJourney = { ...datedJourney, id: 'qa-undated-journey', dateRange: '날짜 미정', duration: '1박 2일', days: datedJourney.days.slice(0, 2).map(day => ({ ...day, date: `DAY ${day.day}` })) };
    const undated = await open({ collection: { ...collection, id: 'qa-undated', name: '날짜 미정 보관함', linkedJourneyId: undatedJourney.id }, journeys: [undatedJourney] });
    await undated.page.getByRole('button', { name: '새별오름 배치 관리', exact: true }).click();
    await undated.page.getByRole('button', { name: 'DAY 추가', exact: true }).click();
    const undatedState = await read(undated.page);
    assert.equal(undatedState.journeys[0].days[2].date, 'DAY 3');
    assert.equal(undatedState.journeys[0].dateRange, '날짜 미정');
    console.log('PASS undated DAY addition', JSON.stringify({ date: undatedState.journeys[0].days[2].date, dateRange: undatedState.journeys[0].dateRange }));
    await undated.context.close();

    const zeroDayJourney = { ...datedJourney, id: 'qa-zero-day', title: '남겨둘 빈 일정', story: '기존 본문 보존', dateRange: '기존 표시 보존', duration: '일정 미정', days: [] };
    const zero = await open({ collection: { ...collection, id: 'qa-zero-collection', name: '빈 일정 연결 보관함', linkedJourneyId: zeroDayJourney.id }, journeys: [zeroDayJourney] });
    await zero.page.getByText('연결한 일정을 사용할 수 없습니다.', { exact: false }).waitFor();
    await setup(zero.page, '2026-10-01');
    const zeroState = await read(zero.page);
    assert.equal(zeroState.journeys.length, 2);
    assert.deepEqual(zeroState.journeys.find(journey => journey.id === zeroDayJourney.id), zeroDayJourney);
    const newId = zeroState.library.collections[0].linkedJourneyId;
    assert.notEqual(newId, zeroDayJourney.id);
    assert.deepEqual(zeroState.journeys.find(journey => journey.id === newId).days.map(day => day.date), ['2026-10-01', '2026-10-02']);
    assert.equal(zeroState.library.notes['jeju-saebyeol'], '보존할 메모');
    console.log('PASS linked owned zero-DAY recovery keeps old record and notes', JSON.stringify({ oldId: zeroDayJourney.id, newId, journeyCount: zeroState.journeys.length }));
    await zero.context.close();
    assert.deepEqual(errors, []);
    console.log('PASS no uncaught browser errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
