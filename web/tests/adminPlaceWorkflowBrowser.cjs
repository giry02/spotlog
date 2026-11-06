/* Local isolated place workflow audit; never reuses a customer or administrator browser profile. */
const { chromium, expect } = require(process.env.SPOTLOG_PLAYWRIGHT || 'C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.SPOTLOG_ADMIN_URL || 'http://127.0.0.1:5210';
const output = process.env.SPOTLOG_ADMIN_QA_DIR || 'C:/Users/Giry/AppData/Local/Temp/spotlog-admin-place-workflow-qa';
const storageKey = 'spotlog.admin.review.v1';
fs.mkdirSync(output,{recursive:true});
const checks = [];
const record = name => { checks.push(name); console.log('PASS',name); };
const snapshot = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)),storageKey);
async function menu(page,name) {
  if (await page.getByRole('button',{name:'관리자 메뉴 열기',exact:true}).isVisible()) await page.getByRole('button',{name:'관리자 메뉴 열기',exact:true}).click();
  await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
}
async function choose(page,name,value) {
  const combo = page.getByRole('combobox',{name,exact:true});
  await combo.click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}
async function done(page) { await expect(page.getByRole('status')).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0); }
function recommendedOrder(state) {
  return state.nearbyOverrides.filter(value => value.anchorPlaceId === 'review-landmark' && value.mode === 'FEATURED' && state.places.find(place => place.placeId === value.businessPlaceId).published.kind === 'FOOD').sort((a,b) => a.order-b.order).map(value => value.businessPlaceId);
}
async function main() {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}}), page = await context.newPage(), errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.goto(base+'/admin.html');
    await expect(page.getByRole('heading',{name:'오늘의 운영 작업',exact:true})).toBeVisible();
    await page.evaluate(key => {
      const state = JSON.parse(localStorage.getItem(key)), original = state.places.find(place => place.placeId === 'review-food');
      for (const [suffix,lat] of [['a',35.162],['b',35.163]]) {
        const place = structuredClone(original); place.placeId = 'audit-food-'+suffix;
        for (const content of [place.draft,place.published]) { content.name = '순서 검수 '+suffix; content.address = suffix+' 가상 주소'; content.location.lat = lat; content.media = []; }
        state.places.push(place);
      }
      const anchor = state.places.find(place => place.placeId === 'review-landmark'), media = anchor.draft.media[0];
      anchor.draft.media.push(...Array.from({length:29},(_,index) => ({...structuredClone(media),mediaId:'audit-media-'+index,cover:false,url:''})));
      localStorage.setItem(key,JSON.stringify(state)); localStorage.setItem('spotlog-consumer-sentinel','customer itinerary unchanged');
    },storageKey);
    await page.reload();
    await menu(page,'장소·업체');
    await page.getByRole('button',{name:'CSV 가져오기',exact:true}).click();
    await page.getByLabel('CSV 내용',{exact:true}).fill(' name , kind , area , address ,regionId\nCSV 지역 검수,FOOD,부산,가상 신규 주소,unknown');
    await page.getByRole('button',{name:'가져오기 미리보기',exact:true}).click();
    await expect(page.getByRole('button',{name:'오류 없는 0개 초안 등록',exact:true})).toBeDisabled();
    await expect(page.getByText('등록 지역이 없거나 사용 중지됐어요. 지역을 다시 선택해 주세요.',{exact:true})).toBeVisible();
    for (const width of [1440,320,390,460]) {
      await page.setViewportSize({width,height:900});
      await page.locator('.admin-sidebar').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
      await page.getByRole('combobox',{name:'2행 등록 지역',exact:true}).click();
      const bounds = await page.locator('.admin-select-popup').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x+bounds.width <= width+1 && bounds.y >= 0 && bounds.y+bounds.height <= 901,JSON.stringify(bounds));
      await page.screenshot({path:path.join(output,'csv-region-'+width+'.png')});
      await page.getByRole('searchbox',{name:'2행 등록 지역 검색',exact:true}).press('Escape');
      const size = await page.evaluate(() => ({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,main:document.querySelector('.admin-main').clientWidth,mainScroll:document.querySelector('.admin-main').scrollWidth}));
      assert.ok(size.scroll <= size.width+1 && size.mainScroll <= size.main+1,JSON.stringify(size));
    }
    record('CSV table and searchable region popup fit desktop and three mobile widths');
    await page.setViewportSize({width:1440,height:1000});
    await choose(page,'2행 등록 지역','kr-busan-haeundae');
    await expect(page.getByRole('button',{name:'오류 없는 1개 초안 등록',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'오류 없는 1개 초안 등록',exact:true}).click(); await done(page);
    const imported = (await snapshot(page)).places.find(place => place.draft.name === 'CSV 지역 검수');
    assert.equal(imported.draft.regionId,'kr-busan-haeundae'); assert.equal(imported.draft.rights.display,false); assert.equal(imported.draft.location.verified,false);
    record('CSV invalid region blocks import and correction rechecks before draft registration');
    await page.getByRole('button',{name:/검수용 바다 전망대/}).click();
    await page.getByRole('tab',{name:'주변 업체',exact:true}).click();
    for (const name of ['검수용 바다 식당','순서 검수 a','순서 검수 b']) {
      await page.locator('.admin-page-body:not([hidden]) .admin-list-row').filter({has:page.getByText(name,{exact:true})}).getByRole('button',{name:'추천 선정',exact:true}).click(); await done(page);
    }
    const originalOrder = recommendedOrder(await snapshot(page));
    const first = page.locator('.admin-page-body:not([hidden]) .admin-list-row').filter({has:page.getByText('검수용 바다 식당',{exact:true})});
    await expect(first.getByRole('button',{name:'추천 업체 위로 이동',exact:true})).toBeDisabled();
    await first.getByRole('button',{name:'추천 업체 아래로 이동',exact:true}).click(); await done(page);
    assert.deepEqual(recommendedOrder(await snapshot(page)),[originalOrder[1],originalOrder[0],originalOrder[2]]);
    await first.getByRole('button',{name:'추천 업체 위로 이동',exact:true}).click(); await done(page);
    assert.deepEqual(recommendedOrder(await snapshot(page)),originalOrder);
    record('nearby recommendation up and down actions persist distinct ranks');
    await page.getByRole('tab',{name:'사진·영상',exact:true}).click();
    await expect(page.getByRole('button',{name:'미디어 URL 등록',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'사진 파일 선택',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'미공개 미디어 1 삭제',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'미공개 미디어 30 삭제',exact:true}).click();
    await expect(page.getByRole('button',{name:'미디어 URL 등록',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'초안 저장',exact:true}).click(); await done(page);
    const anchor = (await snapshot(page)).places.find(place => place.placeId === 'review-landmark');
    assert.equal(anchor.draft.media.length,29); assert.equal(anchor.published.media.length,1); assert.equal(anchor.published.media[0].mediaId,'review-landmark-photo');
    record('media limit blocks additions and unpublished removal preserves published identity');
    for (const width of [320,390,460]) {
      await page.setViewportSize({width,height:900});
      await page.getByRole('tab',{name:'주변 업체',exact:true}).click();
      await choose(page,'주변 업체 거리','15');
      const size = await page.evaluate(() => ({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,main:document.querySelector('.admin-main').clientWidth,mainScroll:document.querySelector('.admin-main').scrollWidth}));
      assert.ok(size.scroll <= size.width+1 && size.mainScroll <= size.main+1,JSON.stringify(size));
      await page.screenshot({path:path.join(output,'nearby-'+width+'.png')});
    }
    record('nearby controls and custom distance dropdown fit three mobile widths');
    assert.equal(await page.evaluate(() => localStorage.getItem('spotlog-consumer-sentinel')),'customer itinerary unchanged');
    assert.deepEqual(errors,[]); record('customer sentinel retained and no page exceptions');
    await context.close();
    const paginationContext = await browser.newContext({viewport:{width:1440,height:1000}}), paginationPage = await paginationContext.newPage();
    paginationPage.on('pageerror',error => errors.push(error.message));
    await paginationPage.goto(base+'/admin.html');
    await expect(paginationPage.getByRole('heading',{name:'오늘의 운영 작업',exact:true})).toBeVisible();
    await paginationPage.evaluate(key => {
      const state = JSON.parse(localStorage.getItem(key)), original = state.places.find(place => place.placeId === 'review-food');
      for (let index = 0; index < 13; index++) {
        const place = structuredClone(original); place.placeId = 'pagination-audit-'+index; place.state = 'DRAFT'; delete place.published;
        place.draft.name = '페이지 검수 '+index; place.meta.reviewStatus = 'DRAFT'; state.places.push(place);
      }
      localStorage.setItem(key,JSON.stringify(state));
    },storageKey);
    await paginationPage.reload(); await menu(paginationPage,'장소·업체');
    await paginationPage.getByRole('searchbox',{name:'장소 검색',exact:true}).fill('pagination-audit');
    await expect(paginationPage.getByRole('heading',{name:'등록 자료 13개',exact:true})).toBeVisible();
    await paginationPage.locator('.admin-pagination').getByRole('button',{name:'다음',exact:true}).click();
    await paginationPage.getByRole('button',{name:/페이지 검수 12/}).click();
    await paginationPage.locator('.admin-danger-zone > summary').click();
    await paginationPage.getByLabel('변경 사유',{exact:true}).fill('고립 검수 초안 삭제');
    await paginationPage.getByRole('button',{name:'참조 없는 초안 삭제',exact:true}).click();
    await expect(paginationPage.getByRole('heading',{name:'등록 자료 12개',exact:true})).toBeVisible();
    await expect(paginationPage.locator('.admin-pagination > span')).toHaveText('1 / 1');
    await expect(paginationPage.locator('.admin-place-row')).toHaveCount(12);
    await expect(paginationPage.getByRole('searchbox',{name:'장소 검색',exact:true})).toHaveValue('pagination-audit');
    record('last-page deletion returns to the populated previous page and preserves the search');
    assert.equal((await snapshot(paginationPage)).places.filter(place => place.placeId.startsWith('pagination-audit')).length,12);
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({checks,errors},null,2));
    await paginationContext.close();
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
