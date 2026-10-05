const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const origin = 'http://127.0.0.1:5173';
const baseline = fs.readFileSync(path.resolve('artifacts/phase1-baseline/styles.css'), 'utf8');
const out = path.resolve('artifacts/original-style-qa');
const place = { id: 'seoul-seoulforest', kind: 'LANDMARK', name: '서울숲', area: '서울 성동', address: '서울 성동구 뚝섬로 273', lat: 37.5444, lng: 127.0374, image: '', description: '원래 여행 설명을 유지합니다.', note: '개인 메모 보존', duration: '1시간' };
const journey = { id: 'qa-original-style', title: '서울 여행 기록', region: '서울', dateRange: '2026-10-01 ~ 2026-10-02', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: '원본을 보존하는 나의 여행', story: '서울숲을 천천히 걷는 여행입니다.', tags: [], saves: 0, author: '테스트', isMine: true, days: [1, 2].map(day => ({ day, date: `2026-10-0${day}`, title: `${day}일차 기록`, story: '기존 날짜 글', places: day === 1 ? [{ ...place, visitId: 'qa-original-visit' }] : [], blocks: day === 1 ? [{ id: 'qa-original-text', type: 'TEXT', title: '천천히 걷는 하루', body: '사진과 함께 남긴 실제 여행 기록입니다.' }, { id: 'qa-original-place', type: 'PLACE', placeId: place.id, visitId: 'qa-original-visit' }] : [] })) };
const cases = [
  { name: 'home', hash: 'home', ready: '.home-lead h1', selectors: ['.home-topbar strong', '.home-lead h1', '.home-lead p', '.home-section-heading h2', '.home-section-heading p', '.promoted-copy h2', '.promoted-copy p', '.promoted-copy button', '.home-find-guides', '.rolling-controls button', '.tabbar button span'] },
  { name: 'community', hash: 'community', ready: '.community-intro h2', selectors: ['.app-header h1', '.app-header small', '.community-intro h2', '.community-intro p', '.community-results-heading h2', '.community-copy h3', '.community-copy p', '.community-copy button', '.destination-search input', '.duration-filter button', '.tabbar button span'] },
  { name: 'trips', hash: 'trips', ready: '.journey-intro h2', selectors: ['.app-header h1', '.app-header small', '.journey-intro h2', '.section-heading h2', '.section-heading p', '.journey-copy strong', '.journey-copy em', '.primary', '.tabbar button span'] },
  { name: 'profile', hash: 'profile', ready: '.profile-topbar h1', selectors: ['.profile-topbar h1', '.profile-card h3', '.profile-card p', '.profile-stats strong', '.profile-stats span', '.creator-level-card h2', '.creator-level-card p', '.settings-list strong', '.demo-note'] },
  { name: 'editor', hash: 'edit-qa-original-style', ready: '.journey-editor', selectors: ['.editor-topbar strong', '.editor-topbar .save-editor', '.editor-basics > label:first-child input', '.editor-basics label > span', '.editor-basics textarea', '.editor-day-tabs button:not(.day-tabs-back)', '.day-editor-heading input', '.day-editor-heading textarea', '.editor-text-block input', '.editor-text-block textarea', '.editor-footer button'] },
  { name: 'guide', hash: 'places-guide', ready: '.landmark-guide-card', selectors: ['.place-guide-lead h1', '.place-guide-lead p', '.region-directory-heading h2', '.landmark-guide-card', '.landmark-guide-copy', '.landmark-guide-copy h3', '.landmark-guide-copy > strong', '.landmark-guide-copy > p', '.landmark-guide-copy > small', '.landmark-guide-copy blockquote', '.landmark-guide-tags span', '.landmark-guide-actions', '.landmark-guide-actions button'] },
];

async function snapshot(page, selectors) {
  return page.evaluate(selectors => {
    const props = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'backgroundColor', 'borderColor', 'borderRadius', 'borderWidth', 'minHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'gap', 'boxShadow', 'gridTemplateColumns'];
    return selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)).filter(el => el.getClientRects().length).slice(0, 3).map((el, index) => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return { selector, index, text: el.textContent.trim().slice(0, 60), ...Object.fromEntries(props.map(prop => [prop, s[prop]])), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 };
    }));
  }, selectors);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [], errors = [];
  try {
    for (const width of [320, 390, 460]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(({ journey, place }) => {
        if (location.protocol !== 'http:') return;
        if (!localStorage.getItem('spotlog.local.repository.v2')) {
          localStorage.setItem('spotlog.web.journeys.v4', JSON.stringify([journey]));
          localStorage.setItem('spotlog.web.saved.v3', JSON.stringify([place.id, 'jeju-hyeopjae', 'gangneung-anmok']));
        }
      }, { journey, place });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
      for (const sample of cases) {
        await page.goto('about:blank');
        await page.goto(`${origin}/#${sample.hash}`);
        await page.locator(sample.ready).first().waitFor({ timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        const actual = await snapshot(page, sample.selectors);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        await page.screenshot({ path: path.join(out, `${width}-${sample.name}.png`) });
        await page.evaluate(css => {
          const styles = Array.from(document.querySelectorAll('style[data-vite-dev-id]'));
          const original = styles.find(style => /[/\\]styles\.css$/.test(style.dataset.viteDevId));
          const theme = styles.find(style => /[/\\]theme\.css$/.test(style.dataset.viteDevId));
          if (!original || !theme) throw new Error('Expected Vite stylesheet nodes not found');
          original.textContent = css;
          theme.sheet.disabled = true;
        }, baseline);
        await page.evaluate(() => document.fonts.ready);
        const expected = await snapshot(page, sample.selectors);
        const differences = actual.flatMap((item, index) => Object.entries(item).filter(([key, value]) => key !== 'text' && expected[index]?.[key] !== value).map(([property, actualValue]) => ({ selector: item.selector, index: item.index, property, actual: actualValue, original: expected[index]?.[property] })));
        if (width === 390) await page.screenshot({ path: path.join(out, `${width}-${sample.name}-original-reference.png`) });
        const result = { width, page: sample.name, elements: actual.length, overflow, differences };
        results.push(result);
        console.log(`${width} ${sample.name}: ${actual.length} elements, ${differences.length} differences, overflow=${overflow}`);
      }
      await context.close();
    }
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    assert.equal(errors.length, 0, `Page errors: ${errors.join('; ')}`);
    assert.equal(results.filter(x => x.overflow).length, 0, 'Page overflow');
    assert.equal(results.reduce((sum, x) => sum + x.differences.length, 0), 0, 'Style differences from original remain; see results.json');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
