/* Isolated Oct 10 admin edit/failure audit. Never uses the operator's active browser profile. */
const { chromium, expect } = require(process.env.SPOTLOG_PLAYWRIGHT || 'C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.SPOTLOG_ADMIN_URL || 'http://127.0.0.1:5210';
const output = process.env.SPOTLOG_ADMIN_QA_DIR || path.resolve(__dirname,'../../artifacts/admin-place-recheck-20261010');
const key = 'spotlog.admin.review.v1';
const cacheKey = 'spotlog.admin.place-editor.v2.LOCAL.operator-admin';
fs.mkdirSync(output,{recursive:true});
const checks = [], errors = [];
const record = name => { checks.push(name); console.log('PASS',name); };
const snapshot = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)),key);
async function ready(page) { await page.goto(base+'/admin.html'); await expect(page.getByRole('heading',{name:'오늘의 운영 작업',exact:true})).toBeVisible(); }
async function menu(page,name) {
  const open = page.getByRole('button',{name:'관리자 메뉴 열기',exact:true});
  if (await open.isVisible()) await open.click();
  await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
}
async function selectPlace(page,id) {
  await menu(page,'장소·업체'); await page.getByRole('searchbox',{name:'장소 검색',exact:true}).fill(id);
  await page.locator('.admin-place-row').filter({has:page.getByText(id,{exact:true})}).click();
  await page.getByRole('tab',{name:'기본 정보',exact:true}).click();
}
async function saved(page) { await expect(page.getByRole('status')).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0); }
async function main() {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}}), page = await context.newPage();
    page.on('pageerror',error => errors.push(error.message)); await ready(page);
    await page.evaluate(() => localStorage.setItem('customer-sentinel','retained private trip'));
    await selectPlace(page,'review-food');
    const original = (await snapshot(page)).places.find(place => place.placeId === 'review-food').published;
    await page.getByLabel('장소명',{exact:true}).fill('검수용 음식점 미저장 입력');
    await page.getByRole('button',{name:'상세 닫기',exact:true}).click();
    await page.locator('.admin-place-row').filter({has:page.getByText('review-food',{exact:true})}).click();
    await expect(page.getByLabel('장소명',{exact:true})).toHaveValue('검수용 음식점 미저장 입력');
    await page.reload(); await selectPlace(page,'review-food');
    await expect(page.getByLabel('장소명',{exact:true})).toHaveValue('검수용 음식점 미저장 입력');
    record('unsaved place input survives detail close and browser reload');
    await page.getByRole('button',{name:'초안 저장',exact:true}).click(); await saved(page);
    const draftSaved = (await snapshot(page)).places.find(place => place.placeId === 'review-food');
    assert.equal(draftSaved.draft.name,'검수용 음식점 미저장 입력'); assert.deepEqual(draftSaved.published,original);
    record('saving public-place changes leaves the published content intact');
    await page.getByRole('button',{name:'공개',exact:true}).click(); await saved(page);
    assert.equal((await snapshot(page)).places.find(place => place.placeId === 'review-food').published.name,'검수용 음식점 미저장 입력');
    record('explicit publication applies the saved content');

    const other = await context.newPage(); other.on('pageerror',error => errors.push(error.message)); await ready(other);
    await selectPlace(page,'review-food'); await selectPlace(other,'review-cafe');
    await page.getByLabel('장소명',{exact:true}).fill('식당 탭 미저장 입력');
    await other.getByLabel('장소명',{exact:true}).fill('카페 탭 미저장 입력');
    const afterTwoTabs = await page.evaluate(cacheKey => JSON.parse(localStorage.getItem(cacheKey)),cacheKey);
    fs.writeFileSync(path.join(output,'two-tab-cache.json'),JSON.stringify(afterTwoTabs,null,2));
    assert.equal(afterTwoTabs.entries['review-food']?.content.name,'식당 탭 미저장 입력');
    assert.equal(afterTwoTabs.entries['review-cafe']?.content.name,'카페 탭 미저장 입력');
    await page.reload(); await selectPlace(page,'review-food');
    await expect(page.getByLabel('장소명',{exact:true})).toHaveValue('식당 탭 미저장 입력');
    record('two tabs editing separate places keep both unfinished inputs');
    await other.close();

    const conflictContext = await browser.newContext({viewport:{width:1440,height:1000}}), firstEditor = await conflictContext.newPage(), secondEditor = await conflictContext.newPage();
    for (const tab of [firstEditor,secondEditor]) { tab.on('pageerror',error => errors.push(error.message)); await ready(tab); await selectPlace(tab,'review-food'); }
    await firstEditor.getByLabel('장소명',{exact:true}).fill('첫 창 입력 유지');
    await secondEditor.getByLabel('장소명',{exact:true}).fill('둘째 창 저장본');
    await secondEditor.getByRole('button',{name:'초안 저장',exact:true}).click(); await saved(secondEditor);
    await expect(firstEditor.getByText(/입력을 유지했으며 저장·공개를 중단했어요/)).toBeVisible();
    await expect(firstEditor.getByLabel('장소명',{exact:true})).toHaveValue('첫 창 입력 유지');
    await expect(firstEditor.getByRole('button',{name:'초안 저장',exact:true})).toBeDisabled();
    await expect(firstEditor.getByRole('button',{name:'공개',exact:true})).toBeDisabled();
    assert.equal((await snapshot(firstEditor)).places.find(place => place.placeId === 'review-food').draft.name,'둘째 창 저장본');
    await firstEditor.screenshot({path:path.join(output,'same-place-conflict.png')});
    await firstEditor.getByRole('button',{name:'기존 입력을 버리고 최신 초안 사용',exact:true}).click();
    await expect(firstEditor.getByLabel('장소명',{exact:true})).toHaveValue('둘째 창 저장본');
    record('same-place concurrent save holds stale input and only explicit discard adopts the newer draft');
    await conflictContext.close();

    const quota = await browser.newContext({viewport:{width:1440,height:1000}}), quotaPage = await quota.newPage();
    quotaPage.on('pageerror',error => errors.push(error.message)); await ready(quotaPage); await selectPlace(quotaPage,'review-food');
    await quotaPage.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key,value) { if (key.startsWith('spotlog.admin.')) throw new DOMException('quota','QuotaExceededError'); return original.call(this,key,value); }; });
    await quotaPage.getByLabel('장소명',{exact:true}).fill('저장 공간 부족 입력');
    await expect(quotaPage.getByText('입력은 이 화면에 유지돼요. 기기에 초안을 보관하지 못했으니 저장 공간을 확인해 주세요.',{exact:true})).toBeVisible();
    await quotaPage.getByRole('button',{name:'초안 저장',exact:true}).click();
    await expect(quotaPage.getByRole('alert')).toContainText('저장하지 못했어요');
    await expect(quotaPage.getByLabel('장소명',{exact:true})).toHaveValue('저장 공간 부족 입력');
    assert.equal((await snapshot(quotaPage)).places.find(place => place.placeId === 'review-food').draft.name,'검수용 바다 식당');
    record('draft and repository storage failures retain input and do not announce success');
    await quota.close();

    const malformed = await browser.newContext({viewport:{width:1440,height:1000}}), malformedPage = await malformed.newPage();
    malformedPage.on('pageerror',error => errors.push(error.message)); await ready(malformedPage);
    const malformedRaw = await malformedPage.evaluate(({key,cacheKey}) => {
      const state = JSON.parse(localStorage.getItem(key)), place = state.places.find(place => place.placeId === 'review-food');
      const content = {...place.draft,provenance:{origin:'STAFF',note:{broken:'nested type'}}};
      const raw = JSON.stringify({schemaVersion:2,operatorId:'operator-admin',entries:{'review-food':{baseRevision:place.revision,content}}});
      localStorage.setItem(cacheKey,raw); return raw;
    },{key,cacheKey});
    await malformedPage.reload(); await selectPlace(malformedPage,'review-food');
    await expect(malformedPage.getByLabel('장소명',{exact:true})).toHaveValue('검수용 바다 식당');
    await expect(malformedPage.getByText(/보관한 미저장 초안의 형식을 읽지 못했어요/)).toBeVisible();
    assert.equal(await malformedPage.evaluate(cacheKey => localStorage.getItem(cacheKey),cacheKey),malformedRaw);
    record('malformed optional provenance is rejected without overwriting the cached source');
    await malformed.close();

    const file = await browser.newContext({viewport:{width:1440,height:1000}}), filePage = await file.newPage();
    filePage.on('pageerror',error => errors.push(error.message)); await ready(filePage); await menu(filePage,'장소·업체');
    await filePage.getByRole('button',{name:'CSV 가져오기',exact:true}).click();
    await filePage.getByLabel('CSV 내용',{exact:true}).fill('name,kind,area,address\n보존할 입력,FOOD,부산,검수 주소');
    await filePage.evaluate(() => { File.prototype.text = async function() { throw new Error('file read failed'); }; });
    await filePage.getByLabel('CSV 파일 선택',{exact:true}).setInputFiles({name:'failed.csv',mimeType:'text/csv',buffer:Buffer.from('name,kind,area,address')});
    await expect(filePage.getByText('CSV 파일을 읽지 못했어요. 기존 입력을 유지했어요. 다른 파일을 선택해 주세요.',{exact:true})).toBeVisible();
    await expect(filePage.getByLabel('CSV 내용',{exact:true})).toContainText('보존할 입력');
    record('CSV read rejection stays inline and preserves entered CSV');
    await filePage.evaluate(() => { File.prototype.text = function() { return new Promise(resolve => window.resolveAuditCsv = resolve); }; });
    await filePage.getByLabel('CSV 파일 선택',{exact:true}).setInputFiles({name:'slow.csv',mimeType:'text/csv',buffer:Buffer.from('name,kind,area,address')});
    await filePage.getByLabel('CSV 내용',{exact:true}).fill('name,kind,area,address\n새로 입력한 자료,FOOD,부산,새 입력 주소');
    await filePage.evaluate(() => window.resolveAuditCsv('name,kind,area,address\n늦게 읽은 이전 파일,FOOD,부산,이전 주소'));
    await expect(filePage.getByLabel('CSV 내용',{exact:true})).toContainText('새로 입력한 자료');
    record('late CSV file completion cannot replace newer manual input');
    const previousState = await snapshot(filePage), previousPlaces = previousState.places.length, originalAddress = previousState.places.find(place => place.placeId === 'review-food').draft.address;
    await filePage.getByLabel('CSV 내용',{exact:true}).fill('name,kind,area,address,regionId\n검수용 바다 식당,FOOD,부산,'+originalAddress+',kr-busan-haeundae\n검수용 바다 식당,FOOD,부산,별도 지점 검수 주소,kr-busan-haeundae');
    await filePage.getByRole('button',{name:'가져오기 미리보기',exact:true}).click();
    await expect(filePage.getByRole('button',{name:'오류 없는 1개 초안 등록',exact:true})).toBeEnabled();
    await filePage.getByRole('button',{name:'오류 없는 1개 초안 등록',exact:true}).click(); await saved(filePage);
    const branch = (await snapshot(filePage)).places.filter(place => place.draft.name === '검수용 바다 식당');
    assert.equal((await snapshot(filePage)).places.length,previousPlaces+1);
    assert.equal(branch.length,2); assert.notEqual(branch[0].placeId,branch[1].placeId); assert.notEqual(branch[0].draft.address,branch[1].draft.address);
    record('CSV duplicate address is held while another same-name branch retains a separate place ID');
    await file.close();

    const rightsContext = await browser.newContext({viewport:{width:1440,height:1000}}), rightsPage = await rightsContext.newPage();
    rightsPage.on('pageerror',error => errors.push(error.message)); await ready(rightsPage); await selectPlace(rightsPage,'review-food');
    await rightsPage.getByRole('tab',{name:'사진·영상',exact:true}).click();
    await rightsPage.getByRole('button',{name:'미디어 URL 등록',exact:true}).click();
    await rightsPage.getByLabel('파일 URL',{exact:true}).last().fill('javascript:alert(1)');
    await expect(rightsPage.getByRole('button',{name:'공개',exact:true})).toBeDisabled();
    await rightsPage.getByRole('button',{name:'미공개 미디어 2 삭제',exact:true}).click();
    await expect(rightsPage.getByRole('button',{name:'초안 저장',exact:true})).toBeDisabled();
    assert.equal(await rightsPage.evaluate(cacheKey => JSON.parse(localStorage.getItem(cacheKey)).entries['review-food'],cacheKey),undefined);
    record('invalid media blocks publication and removing the new media preserves the published photo');
    await rightsPage.getByLabel('공개 미디어 즉시 철회 사유',{exact:true}).fill('검수용 사용권 철회');
    await rightsPage.getByRole('button',{name:'이 공개 미디어 즉시 철회',exact:true}).click(); await saved(rightsPage);
    await expect(rightsPage.getByText(/입력을 유지했으며 저장·공개를 중단했어요/)).toHaveCount(0);
    let rightsPlace = (await snapshot(rightsPage)).places.find(place => place.placeId === 'review-food');
    assert.ok(rightsPlace.revokedMediaIds.includes('review-food-photo'));
    assert.equal(rightsPlace.published.media[0].withdrawn,true); assert.equal(rightsPlace.published.media[0].rights.display,false);
    await rightsPage.getByRole('tab',{name:'기본 정보',exact:true}).click();
    await rightsPage.locator('.admin-danger-zone > summary').click();
    await rightsPage.getByLabel('변경 사유',{exact:true}).fill('검수용 전체 사용 철회');
    await rightsPage.getByRole('button',{name:'사용 철회',exact:true}).click(); await saved(rightsPage);
    rightsPlace = (await snapshot(rightsPage)).places.find(place => place.placeId === 'review-food');
    assert.equal(rightsPlace.revoked,true); assert.equal(rightsPlace.state,'INACTIVE');
    await expect(rightsPage.getByRole('button',{name:'공개',exact:true})).toBeDisabled();
    const eligible = await rightsPage.evaluate(async key => { const {eligiblePublished} = await import('/src/admin/selectors.ts'); return Boolean(eligiblePublished(JSON.parse(localStorage.getItem(key)).places.find(place => place.placeId === 'review-food'))); },key);
    assert.equal(eligible,false); record('immediate photo and place rights withdrawal prevents reuse and republishing');
    await rightsContext.close();
    assert.equal(await page.evaluate(() => localStorage.getItem('customer-sentinel')),'retained private trip');
    assert.deepEqual(errors,[]); record('customer storage remains intact and no uncaught exceptions');
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({checks,errors},null,2));
    await context.close();
  } finally { await browser.close(); }
}
main().catch(error => { fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({checks,errors,error:String(error)},null,2)); console.error(error); process.exitCode=1; });
