/* Isolated administrator workflow QA. It never reuses an operator profile or calls a live service. */
const { chromium, expect } = require(process.env.SPOTLOG_PLAYWRIGHT || 'C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.SPOTLOG_ADMIN_URL || 'http://127.0.0.1:5210';
const output = process.env.SPOTLOG_ADMIN_QA_DIR || path.resolve(__dirname, '../../artifacts/admin-easy-workflow-20261012/qa');
const key = 'spotlog.admin.review.v1', checks = [], errors = [];
fs.mkdirSync(output, { recursive: true });
const active = page => page.locator('.admin-page-body:not([hidden])');
const snapshot = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const record = (name, detail) => { checks.push({name, detail}); console.log('PASS', name, detail || ''); };
async function menu(page, name) {
  const opener = page.getByRole('button', {name:'관리자 메뉴 열기', exact:true});
  if (await opener.isVisible()) await opener.click();
  await page.getByRole('navigation').getByRole('button', {name, exact:true}).click();
  await expect(page.getByRole('heading', {level:1, name, exact:true})).toBeVisible();
  await page.locator('.admin-sidebar').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined))));
}
async function choose(page, name, value) {
  await active(page).getByRole('combobox', {name, exact:true}).click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}
async function start(page) {
  page.on('pageerror', failure => errors.push(failure.message));
  await page.goto(base + '/admin.html');
  await expect(page.getByRole('heading', {name:'어떤 작업을 할까요?', exact:true})).toBeVisible();
}
async function saved(page) {
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
}
async function checkStep(page, number, label) {
  const checklist = active(page).locator('.admin-place-publish-checks');
  if (await checklist.getAttribute('open') === null) await checklist.locator(':scope > summary').click();
  await active(page).getByRole('button', {name:`${number} ${label}`, exact:true}).click();
}
async function noOverflow(page, caption) {
  const size = await page.evaluate(() => ({width:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth, main:document.querySelector('.admin-main').clientWidth, mainScroll:document.querySelector('.admin-main').scrollWidth}));
  assert.ok(size.scroll <= size.width + 1 && size.mainScroll <= size.main + 1, caption + ' ' + JSON.stringify(size));
}
async function openPlace(page, id) {
  await menu(page, '장소·업체');
  await active(page).getByRole('tab', {name:'장소 목록', exact:true}).click();
  const close = active(page).getByRole('button', {name:'상세 닫기', exact:true});
  if (await close.isVisible()) await close.click();
  const filters = active(page).locator('.admin-place-filter-panel');
  if (await filters.getAttribute('open') === null) await filters.locator(':scope > summary').click();
  await active(page).getByRole('group', {name:'자료 작업 목록', exact:true}).getByRole('button', {name:'전체', exact:true}).click();
  await active(page).getByRole('searchbox', {name:'장소 검색', exact:true}).fill(id);
  await expect(active(page).locator('.admin-place-row')).toHaveCount(1);
  await active(page).locator('.admin-place-row').click();
  await active(page).getByRole('tab', {name:'기본 정보', exact:true}).click();
}
async function apiConflictChecks(browser) {
  const seedContext = await browser.newContext({viewport:{width:1440,height:1000}}), seedPage = await seedContext.newPage(); await start(seedPage);
  const apiState = await seedPage.evaluate(async key => {
    const {generateEditorialDraft} = await import('/src/admin/editorialDraft.ts');
    const state = JSON.parse(localStorage.getItem(key)), draft = generateEditorialDraft(state,{curatedTripId:'api-qa-curated',regionId:'kr-busan',regionName:'부산',dayCount:2,prompt:'식사와 카페를 포함해 천천히',now:'2026-10-12T00:00:00.000Z'});
    draft.revision=1; draft.title='API 기억 보존 · 부산 추천'; state.ops.curatedTrips.push(draft); return state;
  }, key); await seedContext.close();
  const context = await browser.newContext({viewport:{width:1440,height:1000}}), page = await context.newPage();
  page.on('pageerror', failure => errors.push(failure.message));
  let responseMode='CONFLICT', releaseSave, submitted;
  await page.route('**/api/admin/v1/**', async route => {
    const url = new URL(route.request().url());
    if(url.pathname.endsWith('/me')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({operatorId:'api-admin',name:'API 검수 관리자',role:'ADMIN'})});
    if(url.pathname.endsWith('/snapshot')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(apiState)});
    if(url.pathname.endsWith('/commands')) {
      const command=JSON.parse(route.request().postData()), region=command.kind==='region.save', list=region?apiState.regions:apiState.ops.curatedTrips, id=region?'regionId':'curatedTripId', current=list.find(item=>item[id]===command.payload[id]);
      if(responseMode==='CONFLICT') {
        current.revision++; if(region) current.name='서버에서 변경한 부산'; else current.title='서버에서 변경한 추천 여행'; apiState.revision++;
        return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:{code:'CONFLICT',message:'새 서버 버전을 확인해 주세요.'}})});
      }
      submitted=structuredClone(command.payload);
      if(responseMode==='DELAY') await new Promise(resolve=>{releaseSave=resolve;});
      if(current) Object.assign(current,command.payload,{revision:current.revision+1}); else list.push({...command.payload,revision:1}); apiState.revision++;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:apiState,message:'API 계약 검수 저장 완료',replayed:false})});
    }
    if(url.pathname.includes('/resources/')) {
      const number=Number(url.searchParams.get('page')), size=Number(url.searchParams.get('pageSize'));
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:apiState.places.slice((number-1)*size,number*size),total:apiState.places.length,page:number,pageSize:size,revision:apiState.revision})});
    }
    return route.fulfill({status:404,body:'{}'});
  });
  await page.goto(base+'/admin.html?mode=api'); await expect(page.getByRole('heading',{name:'어떤 작업을 할까요?',exact:true})).toBeVisible();
  await menu(page,'노출·추천'); await active(page).getByRole('tab',{name:'추천 여행 만들기',exact:true}).click();
  await active(page).getByRole('button',{name:/API 기억 보존 · 부산 추천/}).click();
  await active(page).getByLabel('여행기 제목',{exact:true}).fill('충돌 뒤에도 유지할 추천 여행 입력');
  await active(page).getByRole('button',{name:'초안 저장',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('새 서버 버전');
  await expect(active(page).getByLabel('여행기 제목',{exact:true})).toHaveValue('충돌 뒤에도 유지할 추천 여행 입력');
  await expect(active(page).getByRole('button',{name:'최신 저장본 불러오기',exact:true})).toBeVisible();
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('spotlog:admin:review-draft:')).length),0);
  record('API recommendation revision conflict preserves in-memory input without writing private contents to local storage');
  await active(page).getByRole('button',{name:'최신 저장본 불러오기',exact:true}).click();
  await expect(active(page).getByLabel('여행기 제목',{exact:true})).toHaveValue('서버에서 변경한 추천 여행');
  responseMode='DELAY'; await active(page).getByLabel('여행기 제목',{exact:true}).fill('저장 요청에 보낸 제목');
  await active(page).getByRole('button',{name:'초안 저장',exact:true}).click();
  await expect.poll(()=>typeof releaseSave).toBe('function');
  await active(page).getByLabel('여행기 제목',{exact:true}).fill('응답 대기 중 새로 쓴 제목'); releaseSave();
  await saved(page); await expect(active(page).getByLabel('여행기 제목',{exact:true})).toHaveValue('응답 대기 중 새로 쓴 제목');
  assert.equal(submitted.title,'저장 요청에 보낸 제목'); assert.equal(apiState.ops.curatedTrips.find(item=>item.curatedTripId==='api-qa-curated').title,'저장 요청에 보낸 제목');
  await expect(active(page).getByRole('button',{name:'최신 저장본 불러오기',exact:true})).toHaveCount(0);
  record('successful delayed API save adopts the new revision and preserves text typed after the request');
  responseMode='CONFLICT'; await menu(page,'장소·업체'); await active(page).getByRole('tab',{name:'지역 설정',exact:true}).click();
  await active(page).getByRole('button',{name:/대한민국 · 부산 kr-busan · v/}).click();
  await active(page).getByLabel('지역 이름',{exact:true}).fill('지역 충돌 뒤에도 유지할 입력'); await active(page).getByRole('button',{name:'지역 저장',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('새 서버 버전');
  await expect(active(page).getByLabel('지역 이름',{exact:true})).toHaveValue('지역 충돌 뒤에도 유지할 입력');
  await expect(active(page).getByRole('button',{name:'최신 저장본 불러오기',exact:true})).toBeVisible();
  assert.equal(apiState.regions.find(region=>region.regionId==='kr-busan').name,'서버에서 변경한 부산');
  record('API region revision conflict also retains the operator input and exposes an explicit reload');
  await menu(page,'운영 현황'); await choose(page,'운영 현황 작업 지역','kr-busan');
  await active(page).getByRole('button',{name:/추천 여행 만들기/}).click();
  await active(page).getByRole('button',{name:'추천 여행 초안 만들기',exact:true}).click();
  await active(page).getByLabel('여행기 제목',{exact:true}).fill('새 추천 여행 API 요청 제목');
  responseMode='DELAY'; releaseSave=undefined;
  await active(page).getByRole('button',{name:'초안 저장',exact:true}).click(); await expect.poll(()=>typeof releaseSave).toBe('function');
  await active(page).getByLabel('여행기 제목',{exact:true}).fill('새 추천 여행 API 응답 중 추가 입력');
  await active(page).locator('summary').filter({hasText:'지역·기간·여행 조건'}).click();
  await active(page).getByLabel('어떤 여행을 만들까요? (선택)',{exact:true}).fill('새 API 응답 중 추가한 조건 입력'); releaseSave();
  await saved(page);
  await expect(active(page).getByLabel('여행기 제목',{exact:true})).toHaveValue('새 추천 여행 API 응답 중 추가 입력');
  const conditions=active(page).locator('summary').filter({hasText:'지역·기간·여행 조건'});
  if(await conditions.locator('..').getAttribute('open')===null) await conditions.click();
  await expect(active(page).getByLabel('어떤 여행을 만들까요? (선택)',{exact:true})).toHaveValue('새 API 응답 중 추가한 조건 입력');
  assert.equal(apiState.ops.curatedTrips.find(trip=>trip.curatedTripId===submitted.curatedTripId).title,'새 추천 여행 API 요청 제목');
  record('new API draft-to-saved transition also preserves text and conditions typed while the save is pending');
  assert.deepEqual(errors,[]); await context.close();
}
async function registrationLayoutChecks(browser) {
  for (const width of [1440,1024,390]) {
    const context=await browser.newContext({viewport:{width,height:900}}), page=await context.newPage(); await start(page);
    await choose(page,'운영 현황 작업 지역','kr-busan'); await active(page).getByRole('button',{name:/장소 등록/}).click();
    await expect(active(page).getByRole('heading',{name:'새 장소 초안',exact:true})).toBeVisible();
    const filters=active(page).locator('.admin-place-filter-panel'), summary=filters.locator(':scope > summary');
    await expect(filters).not.toHaveAttribute('open');
    await summary.focus(); await summary.press('Enter'); await expect(filters).toHaveAttribute('open','');
    await summary.press('Space'); await expect(filters).not.toHaveAttribute('open');
    await page.locator('.admin-main').evaluate(element=>element.scrollTop=0);
    const name=active(page).getByLabel('장소명',{exact:true}), nameBox=await name.boundingBox();
    await page.screenshot({path:path.join(output,'registration-'+width+'.png')});
    fs.writeFileSync(path.join(output,'registration-layout-'+width+'.json'),JSON.stringify(await page.evaluate(()=>({scrollY,mainScroll:document.querySelector('.admin-main').scrollTop,details:[...document.querySelectorAll('.admin-page-body:not([hidden]) details')].map(element=>({name:element.querySelector('summary')?.textContent,open:element.open,y:element.getBoundingClientRect().y,height:element.getBoundingClientRect().height})),panels:[...document.querySelectorAll('.admin-page-body:not([hidden]) .admin-panel')].map(element=>({name:element.querySelector('h2')?.textContent,y:element.getBoundingClientRect().y,height:element.getBoundingClientRect().height,display:getComputedStyle(element).display}))})),null,2));
    assert.ok(nameBox.y>=0 && nameBox.y+nameBox.height<860, `${width} registration begins below first viewport: ${JSON.stringify(nameBox)}`);
    assert.equal(await name.evaluate(element=>getComputedStyle(element).fontSize),'16px');
    await page.screenshot({path:path.join(output,'registration-'+width+'.png')});
    await name.fill('등록 화면 간격 검수 · 부산');
    const description=active(page).getByLabel('장소 소개',{exact:true}); await description.scrollIntoViewIfNeeded();
    await description.fill('등록 화면에서 설명을 입력하고 버튼이 편집 내용을 덮지 않는지 확인해요.');
    const descriptionBox=await description.boundingBox(), sticky=await active(page).locator('.admin-sticky-actions').boundingBox();
    assert.ok(descriptionBox.y+descriptionBox.height<=sticky.y+1 || descriptionBox.y>=sticky.y+sticky.height, `${width} sticky actions cover description: ${JSON.stringify({descriptionBox,sticky})}`);
    await expect(active(page).getByRole('button',{name:'초안 저장',exact:true})).toBeEnabled();
    await noOverflow(page, width+' registration');
    record('registration starts within first viewport, uses 16px input and keeps description clear of sticky actions', {width,nameY:Math.round(nameBox.y)});
    await context.close();
  }
}
async function main() {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    if(process.argv.includes('--api-only')) { await apiConflictChecks(browser); fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({base,generatedAt:new Date().toISOString(),checks,errors},null,2)); return; }
    if(process.argv.includes('--layout-only')) { await registrationLayoutChecks(browser); fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({base,generatedAt:new Date().toISOString(),checks,errors},null,2)); return; }
    const context = await browser.newContext({viewport:{width:1440, height:1000}}), page = await context.newPage();
    await start(page);
    await page.evaluate(() => localStorage.setItem('admin-easy-private-sentinel', 'private customer itinerary is preserved'));
    const baseline = await snapshot(page), legacyRegions = baseline.ops.references.filter(item => item.category === 'REGION');
    await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(7);
    await expect(active(page).getByRole('combobox', {name:'운영 현황 담당 범위', exact:true})).toContainText('전체 담당');
    await expect(active(page).locator('.admin-more-operations')).not.toHaveAttribute('open');
    for (const name of ['장소 등록', '검수하기', '추천 여행 만들기']) await expect(active(page).getByRole('button', {name:new RegExp(name)})).toBeVisible();
    record('overview begins with three primary actions; advanced operations are collapsed and seven menus remain');

    await choose(page, '운영 현황 작업 지역', 'kr-busan');
    await active(page).getByRole('button', {name:/장소 등록/}).click();
    await expect(active(page).getByRole('heading', {name:'새 장소 초안', exact:true})).toBeVisible();
    await expect(active(page).getByRole('combobox', {name:'등록 지역', exact:true})).toContainText('부산');
    await expect(active(page).getByLabel('자료 제공자', {exact:true})).toBeHidden();
    await expect(active(page).getByLabel('회사·브랜드 ID · 선택', {exact:true})).toBeHidden();
    await expect(active(page).getByRole('button', {name:'검수하고 공개', exact:true})).toBeDisabled();
    await choose(page, '장소 종류', 'FOOD');
    const placeName = '사용성 검수 · 부산 식당', placeIntro = '분리된 관리자 검수 자료이며 실제 방문 안내가 아닙니다.';
    await active(page).getByLabel('장소명', {exact:true}).fill(placeName);
    await active(page).getByLabel('주소', {exact:true}).fill('부산 해운대 가상 검수 주소 101');
    await active(page).getByLabel('장소 소개', {exact:true}).fill(placeIntro);
    await choose(page, '영업 상태', 'OPEN');
    await active(page).getByRole('button', {name:'초안 저장', exact:true}).click(); await saved(page);
    let state = await snapshot(page), registered = state.places.find(item => item.draft.name === placeName);
    assert.equal(registered.draft.regionId, 'kr-busan'); assert.equal(registered.draft.kind, 'FOOD'); assert.equal(registered.state, 'DRAFT'); assert.equal(registered.published, undefined);
    record('Busan context is preserved in direct restaurant registration and incomplete content saves only as draft');

    await checkStep(page, 2, '위치 확인');
    await expect(active(page).getByLabel('위도 · WGS84', {exact:true})).toBeVisible();
    for (const [label,value] of [['위도 · WGS84','35.161'],['경도 · WGS84','129.161'],['좌표 확인 근거','고립 브라우저 검수 좌표'],['좌표 출처 URL','https://example.org/qa/location'],['좌표 확인일','2026-10-12']]) await active(page).getByLabel(label, {exact:true}).fill(value);
    await active(page).getByLabel('주소·좌표·근거를 직접 확인했어요', {exact:true}).check();
    await checkStep(page, 4, '출처·사용 범위');
    for (const [label,value] of [['자료 제공자','QA 고립 자료'],['자료 출처 URL','https://example.org/qa/place'],['자료 확인일','2026-10-12']]) await active(page).getByLabel(label, {exact:true}).fill(value);
    await active(page).getByLabel('화면 표시 허용', {exact:true}).check(); await active(page).getByLabel('자료 보관 허용', {exact:true}).check();
    await expect(active(page).getByRole('button', {name:'검수하고 공개', exact:true})).toBeEnabled();
    await active(page).getByRole('button', {name:'검수하고 공개', exact:true}).click(); await saved(page);
    state = await snapshot(page); registered = state.places.find(item => item.placeId === registered.placeId);
    assert.equal(registered.state, 'PUBLISHED'); assert.equal(registered.published.description, placeIntro); assert.equal(registered.published.location.verified, true);
    await expect(active(page).getByRole('button', {name:'추천 여행 만들기 →', exact:true})).toBeVisible();
    assert.equal(await active(page).getByLabel('장소명', {exact:true}).evaluate(element => getComputedStyle(element).fontSize), '16px');
    assert.ok(Number.parseFloat(await active(page).getByRole('button', {name:'검수하고 공개', exact:true}).evaluate(element => getComputedStyle(element).fontSize)) >= 14);
    await page.screenshot({path:path.join(output,'02-place-public-ready.png')});
    record('checklist jumps to location and rights; only complete verified data can be explicitly published');

    await active(page).getByRole('button', {name:'추천 여행 만들기 →', exact:true}).click();
    await expect(active(page).getByRole('heading', {name:'추천 여행 새로 만들기', exact:true})).toBeVisible();
    await expect(active(page).getByRole('combobox', {name:'여행 지역', exact:true})).toContainText('부산');
    await choose(page, '여행 기간', '2');
    await active(page).getByLabel('어떤 여행을 만들까요? (선택)', {exact:true}).fill('부산에서 2일. 식사, 카페, 숙소를 포함해서 천천히 둘러보기');
    await active(page).getByRole('button', {name:'추천 여행 초안 만들기', exact:true}).click();
    await expect(active(page).getByRole('tab', {name:'DAY 1', exact:true})).toBeVisible(); await expect(active(page).getByRole('tab', {name:'DAY 2', exact:true})).toBeVisible();
    const tripTitle = '사용성 검수 · 부산 2일 추천 여행';
    await active(page).getByLabel('여행기 제목', {exact:true}).fill(tripTitle);
    await expect(active(page).getByLabel('DAY 소개', {exact:true})).toBeHidden();
    await active(page).locator('summary').filter({hasText:'DAY 제목·소개'}).click();
    await active(page).getByLabel('DAY 1 제목', {exact:true}).fill('부산 첫날 · 순서 확인');
    await active(page).getByLabel('DAY 소개', {exact:true}).fill('공개 장소를 순서대로 배치한 운영 추천 초안');
    await active(page).locator('summary').filter({hasText:'DAY 제목·소개'}).click();
    await page.screenshot({path:path.join(output,'03-recommendation-draft.png')});
    await active(page).getByRole('button', {name:'초안 저장', exact:true}).click(); await saved(page);
    state = await snapshot(page); let trip = state.ops.curatedTrips.find(item => item.title === tripTitle);
    assert.equal(trip.visibility, 'PRIVATE'); assert.equal(trip.days.length, 2);
    assert.equal(trip.days[0].title, '부산 첫날 · 순서 확인'); assert.equal(trip.days[0].introduction, '공개 장소를 순서대로 배치한 운영 추천 초안');
    assert.ok(trip.days.flatMap(day => day.visits).every(visit => state.places.some(place => place.placeId === visit.placeId && place.state === 'PUBLISHED')));
    record('published places lead directly to same-region recommendation draft with two days and private save');

    await active(page).getByRole('button', {name:'확인하고 공개', exact:true}).click(); await saved(page);
    state = await snapshot(page); trip = state.ops.curatedTrips.find(item => item.title === tripTitle);
    assert.equal(trip.visibility, 'PUBLIC');
    await active(page).getByRole('button', {name:'메인에 게시', exact:true}).click();
    await expect(active(page).getByLabel('화면에 보일 제목', {exact:true})).toHaveValue(tripTitle);
    await expect(active(page).getByRole('combobox', {name:'대상', exact:true})).toContainText(tripTitle);
    await choose(page, '게시 여부', 'on');
    await active(page).getByRole('button', {name:'게시 설정 저장', exact:true}).click(); await saved(page);
    state = await snapshot(page);
    const exposure = state.ops.exposures.find(item => item.title === tripTitle);
    assert.ok(exposure?.enabled); assert.ok([trip.curatedTripId, trip.editorialJournal.journalId].includes(exposure.targetId));
    await active(page).getByRole('tab', {name:'고객 화면 보기', exact:true}).click();
    await expect(active(page).locator('.admin-preview').filter({hasText:tripTitle})).toHaveCount(1);
    const consumer = await context.newPage(); consumer.on('pageerror', failure => errors.push(failure.message));
    await consumer.setViewportSize({width:390,height:844}); await consumer.goto(base + '/#home');
    await expect(consumer.locator('.home-guide-card').filter({hasText:tripTitle})).toHaveCount(1);
    await noOverflow(page, 'main publishing preview'); await page.screenshot({path:path.join(output,'04-main-publication.png')});
    record('recommendation publication and main placement are distinct actions with correct target and customer preview');
    await consumer.close();

    await menu(page, '장소·업체'); await active(page).getByRole('button', {name:'CSV 가져오기', exact:true}).click();
    await active(page).getByLabel('CSV 내용', {exact:true}).fill('name,kind,area,address,description\n사용성 검수 · 부산 카페,CAFE,부산,가상 검수 주소 102,고립 브라우저 CSV 검수');
    await active(page).getByRole('button', {name:'가져오기 미리보기', exact:true}).click();
    await active(page).getByRole('button', {name:'오류 없는 1개 초안 등록', exact:true}).click(); await saved(page);
    state = await snapshot(page); const imported = state.places.find(item => item.draft.name === '사용성 검수 · 부산 카페');
    assert.equal(imported.draft.regionId, 'kr-busan'); assert.equal(imported.state, 'DRAFT'); assert.equal(imported.meta.reviewStatus, 'NEEDS_CHECK');
    await active(page).getByRole('button', {name:'확인 필요', exact:true}).click();
    await active(page).getByRole('searchbox', {name:'장소 검색', exact:true}).fill(imported.placeId);
    await expect(active(page).locator('.admin-place-row')).toHaveCount(1);
    await active(page).locator('.admin-place-row').click();
    await expect(active(page).getByRole('button', {name:'검수하고 공개', exact:true})).toBeDisabled();
    record('import keeps chosen region and review-needed status; quick review finds the item and preserves publication blockers');

    await openPlace(page, registered.placeId);
    const publishedBeforeEdit = (await snapshot(page)).places.find(item => item.placeId === registered.placeId).published;
    await active(page).getByLabel('장소 소개', {exact:true}).fill('미저장 입력은 메뉴·탭·새로고침에서도 보존되어야 해요.');
    await menu(page, '노출·추천'); await openPlace(page, registered.placeId);
    await expect(active(page).getByLabel('장소 소개', {exact:true})).toHaveValue('미저장 입력은 메뉴·탭·새로고침에서도 보존되어야 해요.');
    await page.reload(); await openPlace(page, registered.placeId);
    await expect(active(page).getByLabel('장소 소개', {exact:true})).toHaveValue('미저장 입력은 메뉴·탭·새로고침에서도 보존되어야 해요.');
    assert.deepEqual((await snapshot(page)).places.find(item => item.placeId === registered.placeId).published, publishedBeforeEdit);
    record('unfinished input survives menu navigation and reload without changing published content');

    await menu(page, '운영 현황'); await active(page).getByRole('button', {name:'지역 설정', exact:true}).click();
    await expect(page.getByRole('heading', {level:1, name:'장소·업체', exact:true})).toBeVisible();
    await expect(active(page).getByRole('heading', {name:'등록 지역', exact:true})).toBeVisible();
    assert.deepEqual((await snapshot(page)).ops.references.filter(item => item.category === 'REGION'), legacyRegions);
    await menu(page, '운영 현황');
    await choose(page, '운영 현황 작업 지역', 'kr-busan');
    await active(page).locator('.admin-more-operations > summary').click();
    await active(page).locator('.admin-region-table').getByRole('button', {name:'부산 자료 보기', exact:true}).click();
    await expect(active(page).getByRole('tab', {name:'장소 목록', exact:true})).toHaveAttribute('aria-selected','true');
    await expect(active(page).getByRole('combobox', {name:'지역', exact:true})).toContainText('부산');
    await expect(active(page).getByRole('searchbox', {name:'장소 검색', exact:true})).toHaveValue('');
    const scoped = (await snapshot(page)).places.filter(item => item.draft.regionId === 'kr-busan' || item.draft.regionId?.startsWith('kr-busan-'));
    await expect(active(page).getByRole('heading', {name:`등록 자료 ${scoped.length}개`, exact:true})).toBeVisible();
    record('regional data shortcut returns from region settings to the correct place list and resets old filters');
    await menu(page, '운영 설정·이력'); await active(page).getByRole('tab', {name:'분류·운영 기준', exact:true}).click();
    await active(page).getByRole('combobox', {name:'기준 종류', exact:true}).click();
    await expect(page.getByRole('option', {name:'지역', exact:true})).toHaveCount(0);
    await page.keyboard.press('Escape');
    record('canonical region manager is in Places; duplicate reference category is hidden and stored legacy data is preserved');

    for (const width of [390,1024,1440,1920]) {
      await page.setViewportSize({width,height:1000});
      for (const name of ['운영 현황','장소·업체','노출·추천','여행기·커뮤니티','회원·문의','AI·검색 운영','운영 설정·이력']) {
        await menu(page, name); await noOverflow(page, width + ' ' + name);
        if (width === 1920) {
          const tabs = await active(page).getByRole('tab').allTextContents();
          for (const label of tabs) { await active(page).getByRole('tab', {name:label, exact:true}).click(); await noOverflow(page, name + '/' + label); }
        }
      }
      await menu(page, '운영 현황'); await page.locator('.admin-main').evaluate(element => element.scrollTop = 0);
      await page.screenshot({path:path.join(output, 'overview-' + width + '.png')});
      record('seven administrator menus fit without body or main overflow', String(width));
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('admin-easy-private-sentinel')), 'private customer itinerary is preserved');
    assert.deepEqual(errors, []); record('customer storage is untouched and no uncaught browser exceptions');
    await context.close();

    const operatorContext = await browser.newContext({viewport:{width:1440,height:1000}}), operator = await operatorContext.newPage();
    await start(operator);
    await operator.getByRole('combobox', {name:'역할 전환', exact:true}).click(); await operator.getByRole('option', {name:'운영자', exact:true}).click();
    await expect(active(operator).getByRole('combobox', {name:'운영 현황 담당 범위', exact:true})).toContainText('내 담당 자료');
    await expect(active(operator).locator('.admin-more-operations')).not.toHaveAttribute('open');
    await menu(operator, '운영 설정·이력'); await active(operator).getByRole('tab', {name:'운영자·권한', exact:true}).click();
    for (const button of await active(operator).getByRole('button', {name:'세션 종료', exact:true}).all()) await expect(button).toBeDisabled();
    await menu(operator, 'AI·검색 운영'); await active(operator).getByRole('tab', {name:'실행 정책', exact:true}).click();
    await expect(active(operator).getByLabel('정책 이름', {exact:true})).toBeDisabled();
    record('ordinary operators start in their assigned work and cannot change administrator sessions or AI policies');
    await operatorContext.close();

    const legacyContext = await browser.newContext({viewport:{width:1440,height:1000}}), legacy = await legacyContext.newPage();
    await start(legacy);
    const legacyKeys = await legacy.evaluate(async key => {
      const {generateEditorialDraft} = await import('/src/admin/editorialDraft.ts'), {reviewDraftKey} = await import('/src/admin/useReviewDraft.ts');
      const state = JSON.parse(localStorage.getItem(key));
      const draft = generateEditorialDraft(state, {curatedTripId:'legacy-qa-curated',regionId:'kr-busan',regionName:'부산',dayCount:2,prompt:'식사와 카페를 포함해서 천천히',now:'2026-10-12T00:00:00.000Z'});
      draft.title = '이전 입력을 보존한 부산 추천';
      const keys = [reviewDraftKey('operator-admin','curated','new'),reviewDraftKey('operator-admin','curated-conditions','new')];
      localStorage.setItem(keys[0],JSON.stringify({schemaVersion:1,value:draft}));
      localStorage.setItem(keys[1],JSON.stringify({schemaVersion:1,value:{region:'kr-busan',dayCount:2,prompt:'이전에 적은 부산 식사·카페 요청'}}));
      return keys;
    }, key);
    await choose(legacy, '운영 현황 작업 지역', 'kr-jeju'); await menu(legacy, '노출·추천');
    await active(legacy).getByRole('button', {name:'이어서 작성', exact:true}).click();
    await expect(active(legacy).getByLabel('여행기 제목', {exact:true})).toHaveValue('이전 입력을 보존한 부산 추천');
    await active(legacy).locator('summary').filter({hasText:'지역·기간·여행 조건'}).click();
    await expect(active(legacy).getByRole('combobox', {name:'여행 지역', exact:true})).toContainText('부산');
    await expect(active(legacy).getByLabel('어떤 여행을 만들까요? (선택)', {exact:true})).toHaveValue('이전에 적은 부산 식사·카페 요청');
    for (const draftKey of legacyKeys) assert.ok(await legacy.evaluate(key => localStorage.getItem(key), draftKey));
    await active(legacy).getByLabel('여행기 제목', {exact:true}).fill('이전 입력 저장 완료 · 부산 추천');
    await menu(legacy, '운영 현황'); await choose(legacy, '운영 현황 작업 지역', 'kr-seoul'); await menu(legacy, '노출·추천');
    await expect(active(legacy).getByLabel('여행기 제목', {exact:true})).toHaveValue('이전 입력 저장 완료 · 부산 추천');
    await expect(active(legacy).getByRole('combobox', {name:'여행 지역', exact:true})).toContainText('부산');
    await active(legacy).getByRole('button', {name:'초안 저장', exact:true}).click(); await saved(legacy);
    for (const draftKey of legacyKeys) assert.equal(await legacy.evaluate(key => localStorage.getItem(key), draftKey), null);
    const legacySaved = (await snapshot(legacy)).ops.curatedTrips.find(item => item.curatedTripId === 'legacy-qa-curated');
    assert.equal(legacySaved.regionId,'kr-busan'); assert.equal(legacySaved.visibility,'PRIVATE');
    record('legacy recommendation cache is recovered explicitly; changing global region does not overwrite it and success alone clears the old cache');
    await legacyContext.close();

    const conflictContext = await browser.newContext({viewport:{width:1440,height:1000}}), first = await conflictContext.newPage(), second = await conflictContext.newPage();
    for (const editor of [first,second]) { await start(editor); await openPlace(editor, 'review-food'); }
    await active(first).getByLabel('장소명', {exact:true}).fill('첫 화면 입력 유지');
    await active(second).getByLabel('장소명', {exact:true}).fill('두 번째 화면 저장본');
    await active(second).getByRole('button', {name:'초안 저장', exact:true}).click(); await saved(second);
    await expect(active(first).getByText(/입력을 유지했으며 저장·공개를 중단했어요/)).toBeVisible();
    await expect(active(first).getByLabel('장소명', {exact:true})).toHaveValue('첫 화면 입력 유지');
    await expect(active(first).getByRole('button', {name:'초안 저장', exact:true})).toBeDisabled();
    await expect(active(first).getByRole('button', {name:'검수하고 공개', exact:true})).toBeDisabled();
    record('same-place concurrent edit retains input and blocks stale save and publication');
    await conflictContext.close();

    const apiContext = await browser.newContext({viewport:{width:1440,height:1000}}), apiPage = await apiContext.newPage();
    await apiPage.route('**/api/admin/v1/**', route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'UNAVAILABLE',message:'연결 검수 대기'}})}));
    await apiPage.goto(base + '/admin.html?mode=api');
    await expect(apiPage.getByRole('heading', {name:'관리자 연결 대기', exact:true})).toBeVisible();
    await expect(apiPage.getByRole('button', {name:'검수하고 공개', exact:true})).toHaveCount(0);
    assert.equal(await apiPage.evaluate(key => localStorage.getItem(key), key), null);
    record('unavailable server keeps the access gate instead of fabricating work or creating a local administrator');
    await apiContext.close();
    fs.writeFileSync(path.join(output,'results.json'), JSON.stringify({base,generatedAt:new Date().toISOString(),checks,errors}, null, 2));
    console.log('ADMIN_EASY_WORKFLOW_CHECKS', checks.length);
  } finally { await browser.close(); }
}
main().catch(error => { fs.writeFileSync(path.join(output,'failure.json'), JSON.stringify({error:error.stack,checks,errors}, null, 2)); console.error(error); process.exitCode = 1; });
