const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const out = path.resolve('artifacts/saved-public-restore-qa');
const local = 'http://127.0.0.1:5173/';
const live = 'https://giry02.github.io/spotlog/';
const seedJourney = { id: 'qa-public-restore', title: '저장 복원 검증 여행', region: '국내', dateRange: '날짜 미정', duration: '당일 여행', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: '원본 유지', story: '기존 여행 기록 보존', tags: [], saves: 0, author: '테스트', isMine: true, days: [{ day: 1, date: 'DAY 1', title: '첫날', story: '삭제하지 않는 이야기', places: [], blocks: [{ id: 'qa-keep-text', type: 'TEXT', body: '보존할 원문' }] }] };
const seed = {
  'spotlog.web.saved.v3': JSON.stringify(['jeju-hyeopjae', 'gangneung-anmok', 'seoul-seoulforest']),
  'spotlog.web.journeys.v4': JSON.stringify([seedJourney]),
  'spotlog.saved-library.v1': JSON.stringify({ collections: [{ id: 'old-folder', name: '보존할 분류', placeIds: ['jeju-hyeopjae'] }], notes: { 'jeju-hyeopjae': '보존할 메모' } }),
};
const selectors = ['.saved-page', '.saved-page .app-header', '.saved-page .app-header h1', '.saved-page .app-header small', '.ai-trip-card', '.ai-trip-heading', '.ai-trip-heading h2', '.ai-trip-card > p', '.ai-day-picker', '.ai-day-picker button', '.ai-generate-button', '.ai-sample-button', '.saved-region-filter', '.saved-region-filter h2', '.saved-region-chips button', '.saved-region-section', '.saved-region-heading', '.saved-card', '.saved-card > img', '.saved-card-copy', '.saved-card-copy h3', '.saved-card-copy p', '.saved-place-time', '.add-to-trip', '.saved-empty', '.saved-empty .outline'];
async function snapshot(page) {
  return page.evaluate(selectors => selectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(el => el.getClientRects().length).map((el, index) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    const props = ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','borderRadius','borderColor','minHeight','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','gap','boxShadow','gridTemplateColumns'];
    return { selector, index, text: el.tagName === 'IMG' ? el.alt : el.textContent.trim(), ...Object.fromEntries(props.map(prop => [prop, s[prop]])), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 };
  })), selectors);
}
async function state(page) {
  return page.evaluate(() => { const records = JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records; return { saved: JSON.parse(records['spotlog.web.saved.v3']), journeys: JSON.parse(records['spotlog.web.journeys.v4'] ?? '[]'), library: records['spotlog.saved-library.v1'], migration: localStorage.getItem('spotlog.local.before-migration.v2') }; });
}
const card = (page, name) => page.locator('.saved-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (let i = 0; i < 90 && !fs.readFileSync('web/src/App.tsx', 'utf8').includes('function Saved('); i++) await new Promise(resolve => setTimeout(resolve, 1000));
  assert.ok(fs.readFileSync('web/src/App.tsx', 'utf8').includes('function Saved('), 'Restored Saved source not ready');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], comparisons = [], checks = [];
  const createPage = async (url, width, records = seed) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(records => { if (/^https?:$/.test(location.protocol) && !sessionStorage.getItem('qa-public-seeded')) { Object.entries(records).forEach(([key, value]) => localStorage.setItem(key, value)); sessionStorage.setItem('qa-public-seeded', 'yes'); } }, records);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push({ url, message: error.message }));
    await page.goto(`${url}#saved`, { waitUntil: 'domcontentloaded' });
    await page.locator('.saved-page').waitFor(); await page.evaluate(() => document.fonts.ready);
    return page;
  };
  try {
    for (const width of [320, 390, 460]) {
      for (const empty of [false, true]) {
        const records = empty ? { ...seed, 'spotlog.web.saved.v3': '[]' } : seed;
        const actualPage = await createPage(local, width, records), referencePage = await createPage(live, width, records);
        const actual = await snapshot(actualPage), expected = await snapshot(referencePage);
        const differences = actual.flatMap((item, index) => Object.entries(item).filter(([key, value]) => expected[index]?.[key] !== value).map(([property, value]) => ({ selector: item.selector, index: item.index, property, actual: value, expected: expected[index]?.[property] })));
        if (actual.length !== expected.length) differences.push({ property: 'elementCount', actual: actual.length, expected: expected.length });
        const overflow = await actualPage.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        await actualPage.screenshot({ path: path.join(out, `${width}-${empty ? 'empty' : 'saved'}-local.png`) });
        await referencePage.screenshot({ path: path.join(out, `${width}-${empty ? 'empty' : 'saved'}-github.png`) });
        comparisons.push({ width, empty, elements: actual.length, overflow, differences });
        console.log(`COMPARE ${width} ${empty ? 'empty' : 'saved'}: ${differences.length} differences`);
        await actualPage.context().close(); await referencePage.context().close();
      }
    }
    const page = await createPage(local, 390);
    const before = await state(page);
    await page.locator('.ai-day-picker').getByRole('button', { name: '2일', exact: true }).click();
    await card(page, '서울숲').locator('.add-to-trip').click();
    let data = await state(page), target = data.journeys.find(j => j.id === seedJourney.id);
    assert.equal(target.days.length, 2); assert.ok(target.days[1].places.some(p => p.id === 'seoul-seoulforest'));
    assert.equal(target.days[0].blocks[0].body, '보존할 원문'); assert.match(await card(page, '서울숲').locator('.add-to-trip').innerText(), /DAY 2 담김 해제/); checks.push('DAY 2 add creates missing DAY, retains original DAY 1 and shows added state');
    await page.reload(); await page.locator('.saved-page').waitFor();
    assert.match(await card(page, '서울숲').locator('.add-to-trip').innerText(), /DAY 2 담김 해제/); data = await state(page); assert.equal(data.library, before.library); assert.equal(data.migration, before.migration); checks.push('Reload retains latest repository, retired library and migration snapshot');
    await card(page, '서울숲').locator('.add-to-trip').click(); data = await state(page); target = data.journeys.find(j => j.id === seedJourney.id); assert.equal(target.days[1].places.length, 0); assert.ok(data.saved.includes('seoul-seoulforest')); checks.push('DAY removal preserves bookmark');
    await card(page, '서울숲').locator('.add-to-trip').click();
    await card(page, '서울숲').getByRole('button', { name: '서울숲 저장 취소', exact: true }).click(); data = await state(page); assert.ok(!data.saved.includes('seoul-seoulforest')); assert.ok(data.journeys.find(j => j.id === seedJourney.id).days[1].places.some(p => p.id === 'seoul-seoulforest')); checks.push('Bookmark removal preserves existing journey visit');
    await page.locator('.saved-region-chips').getByRole('button', { name: /제주/ }).click(); assert.equal(await page.locator('.saved-region-section').count(), 1);
    await page.locator('.saved-region-heading').click(); assert.equal(await page.locator('.saved-list').count(), 0); await page.locator('.saved-region-heading').click(); assert.equal(await page.locator('.saved-card').count(), 1); checks.push('Region filter, collapse and expand');
    await page.locator('.ai-generate-button').click(); await page.locator('.journey-detail').waitFor(); data = await state(page); const generated = data.journeys.filter(j => j.isMine && j.id !== seedJourney.id); assert.equal(generated.length, 1); assert.equal(generated[0].days.length, 2); assert.equal(generated[0].days.flatMap(d => d.places).length, 2); checks.push('Saved-place AI draft opens trip detail with requested duration');
    await page.context().close();
    const emptyPage = await createPage(local, 390, { ...seed, 'spotlog.web.saved.v3': '[]' });
    await emptyPage.locator('.ai-generate-button').click(); await emptyPage.locator('.journey-detail').waitFor(); data = await state(emptyPage); assert.ok(data.journeys.some(j => j.isMine && j.id !== seedJourney.id && j.days.flatMap(d => d.places).length > 0)); assert.deepEqual(data.saved, []); checks.push('Empty Saved allows sample AI generation without changing bookmarks');
    await emptyPage.context().close();
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ comparisons, checks, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors, differenceCount: comparisons.reduce((sum, item) => sum + item.differences.length, 0) }, null, 2));
    assert.equal(errors.length, 0); assert.equal(comparisons.filter(item => item.overflow).length, 0); assert.equal(comparisons.reduce((sum, item) => sum + item.differences.length, 0), 0);
  } catch (error) {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ comparisons, checks, errors, failure: error.stack }, null, 2)); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
