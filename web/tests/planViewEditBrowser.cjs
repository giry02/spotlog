/* Local customer flow review. Fresh contexts only, no user browser or live-service mutations. */
const {chromium,expect}=require(process.env.SPOTLOG_PLAYWRIGHT||'C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SPOTLOG_APP_URL||'http://127.0.0.1:5210';
const output=process.env.SPOTLOG_PLAN_QA_DIR||path.resolve(__dirname,'../../artifacts/plan-view-edit-20261012/qa');
fs.mkdirSync(output,{recursive:true});
const results={date:'2026-10-12',checks:[],errors:[]};
function write(){fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));}
function record(width,name,detail='pass'){results.checks.push({width,name,detail});write();console.log('PASS',width,name);}
const snapshot=page=>page.evaluate(()=>structuredClone(window.planViewQa.journey));
const finish=page=>page.locator('.plan-mode-action');
const edit=page=>page.getByRole('button',{name:/^(일정 수정|여행 수정|수정하기|수정)$/});
async function start(page,mode){await page.goto(`${base}/tests/plan-view-edit.html?mode=${mode}`);await page.waitForFunction(()=>Boolean(window.planViewQa));}
async function settledSheetExit(page){await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>!history.state?.spotlogSheet);}
async function clean(page){
  await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  assert.ok(await page.getByRole('dialog').count()<=1,'overlapping dialogs');
  const broken=await page.locator('img').evaluateAll(nodes=>nodes.filter(node=>{const box=node.getBoundingClientRect();return box.width&&box.height&&box.top<innerHeight&&box.bottom>0&&node.complete&&!node.naturalWidth;}).map(node=>node.currentSrc));
  assert.deepEqual(broken,[],'broken visible image');
  assert.equal(await page.getByRole('button',{name:/방문 수 줄이기|일정 조정|일정 여유롭게|변경안 비교하기/}).count(),0,'unsafe auto-revision entry remains');
  if(await page.locator('.plan-header-actions').count()){
    const geometry=await page.locator('.plan-header-actions>button').evaluateAll(buttons=>buttons.map(button=>({top:button.getBoundingClientRect().top,height:button.getBoundingClientRect().height,font:getComputedStyle(button).fontSize})));
    assert.ok(geometry.every(button=>button.height>=44),'header touch size');assert.ok(Math.max(...geometry.map(button=>button.top))-Math.min(...geometry.map(button=>button.top))<2,'header buttons form one row');
    assert.equal(geometry[0].font,'14px','mode-button typography');
    const cover=await page.locator('.plan-cover').boundingBox();if(cover)assert.equal(cover.height,132,'fixture/customer cover styles match');
    if(await page.locator('.plan-view-map-toggle').count()){
      const heading=await page.locator('.plan-day>.section-heading h2').boundingBox(),map=await page.locator('.plan-view-map-toggle').boundingBox();
      assert.ok(heading.y>=map.y&&heading.y+heading.height<=map.y+map.height,'DAY heading and map share one row');
    }
  }
}
async function shot(page,width,name){await clean(page);await page.screenshot({path:path.join(output,`${width}-${name}.png`),animations:'disabled'});}
async function expectRead(page){
  await expect(page.locator('.personal-trip')).toHaveClass(/plan-view-mode/);
  await expect(edit(page)).toHaveCount(1);
  await expect(page.getByRole('button',{name:'장소 추가',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/위로 이동|아래로 이동/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'주변 업체',exact:true})).toHaveCount(0);
}
async function expectEdit(page){
  await expect(page.locator('.personal-trip')).toHaveClass(/plan-edit-mode/);
  await expect(page.getByRole('button',{name:'장소 추가',exact:true})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'주변 업체',exact:true}).first()).toBeVisible();
  assert.equal(await page.locator('.phase-three-trip-tools button').count(),0,'three-tools row remains in editing');
}
async function ready(page,width){
  await start(page,'ready');
  const original=await snapshot(page),locked=JSON.stringify(original.days[0].places.find(place=>place.bookingFixed));
  await expectRead(page);assert.equal(await page.locator('.plan-route').count(),0,'route collapsed by default');
  await shot(page,width,'ready-reading');
  await edit(page).click();await expectEdit(page);
  await shot(page,width,'ready-editing');
  const cafename=original.days[0].places.find(place=>place.kind==='CAFE').name;
  await page.getByRole('button',{name:cafename+' · 장소 메뉴',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:/위로 이동/}).click();
  await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();await settledSheetExit(page);
  const changed=await snapshot(page);assert.equal(changed.days[0].places[1].name,cafename);
  assert.equal(JSON.stringify(changed.days[0].places.find(place=>place.bookingFixed)),locked);
  assert.equal(JSON.stringify(changed.days[1]),JSON.stringify(original.days[1]));
  await finish(page).last().click();await expectRead(page);await shot(page,width,'ready-after-edit-complete');
  assert.equal((await snapshot(page)).visibility,'PRIVATE');assert.equal((await snapshot(page)).purpose,'PLAN');
  const before=await snapshot(page);await page.reload();await page.waitForFunction(()=>Boolean(window.planViewQa));await expectRead(page);assert.equal(JSON.stringify(await snapshot(page)),JSON.stringify(before));
  record(width,'READY opens for reading; explicit edit, manual order, completion and reload preserve private plan/DAY/booking');
}
async function draft(page,width){
  await start(page,'draft');await expectEdit(page);assert.equal(await page.locator('.plan-route').count(),0);
  const first=(await snapshot(page)).days[0].places[0];await page.getByRole('button',{name:first.name+' · 장소 메뉴',exact:true}).click();
  await page.getByRole('dialog').locator('textarea').fill('완료 전 새로고침해도 유지하는 일정 메모');await page.getByRole('dialog').getByRole('button',{name:'변경 저장',exact:true}).click();await settledSheetExit(page);
  await page.reload();await page.waitForFunction(()=>Boolean(window.planViewQa));await expectEdit(page);
  assert.equal((await snapshot(page)).days[0].places[0].note,'완료 전 새로고침해도 유지하는 일정 메모');assert.equal((await snapshot(page)).planStage,'DRAFT');
  record(width,'unfinished manual edits reload into editing with private draft memo retained');
  const before=await snapshot(page);await page.evaluate(()=>window.planViewQaFail=true);
  await finish(page).last().click();await expectEdit(page);await expect(page.getByRole('alert').first()).toBeVisible();assert.equal(JSON.stringify(await snapshot(page)),JSON.stringify(before));
  await shot(page,width,'draft-complete-save-failure');
  await page.evaluate(()=>window.planViewQaFail=false);await finish(page).last().click();await expectRead(page);assert.equal((await snapshot(page)).planStage,'READY');
  assert.equal((await snapshot(page)).visibility,'PRIVATE');assert.equal((await snapshot(page)).purpose,'PLAN');assert.equal(await page.evaluate(()=>Boolean(window.planViewQa.journal)),false);
  await shot(page,width,'draft-completed-private');record(width,'DRAFT starts in registration; failed completion stays editable; success becomes private read view without publishing/journal');
  await start(page,'empty');await expect(page.getByRole('button',{name:'장소 추가',exact:true})).toBeVisible();
  const emptyComplete=finish(page).last();if(!await emptyComplete.isDisabled())await emptyComplete.click();assert.equal((await snapshot(page)).days.every(day=>!day.places.length),true);assert.equal((await snapshot(page)).planStage,'DRAFT');
  await page.getByRole('button',{name:'장소 추가',exact:true}).click();await page.getByRole('dialog',{name:'DAY 1에 장소 담기',exact:true}).waitFor();
  await page.getByRole('tab',{name:'음식점',exact:true}).click();await page.getByRole('button',{name:/점심에 담기$/}).first().click();
  await page.getByRole('button',{name:'일정으로 돌아가기',exact:true}).click();await settledSheetExit(page);
  await expect(page.getByRole('button',{name:'장소 추가',exact:true})).toBeVisible();
  await finish(page).last().click();await expectRead(page);assert.equal((await snapshot(page)).days[0].places[0].kind,'FOOD');
  record(width,'empty plan cannot finish; direct food selection stays editing until explicit completion');
}
async function candidates(page,width){
  await start(page,'candidate');await expectEdit(page);const before=await snapshot(page),locked=JSON.stringify(before.days[0].places.find(place=>place.bookingFixed));
  await finish(page).last().click();await expect(page.getByRole('dialog',{name:'여행 마지막 확인',exact:true})).toBeVisible();
  assert.equal((await snapshot(page)).days[0].places.length,before.days[0].places.length);
  const review=page.locator('.trip-candidate-review');const choices=review.locator('.candidate-choice-group input[type=radio]');
  await choices.first().check();await page.evaluate(()=>window.planViewQaFail=true);
  await review.getByRole('button',{name:/내 여행 완성|선택한 후보 반영/}).click();await expect(review.getByRole('alert')).toBeVisible();assert.equal((await snapshot(page)).businessCandidates.length,1);
  await page.evaluate(()=>window.planViewQaFail=false);await review.getByRole('button',{name:/내 여행 완성|선택한 후보 반영/}).click();await settledSheetExit(page);await expectRead(page);
  const after=await snapshot(page);assert.equal(after.businessCandidates.length,0);assert.equal(after.days[0].places.filter(place=>place.planningSlot==='dinner').length,1);assert.equal(JSON.stringify(after.days[0].places.find(place=>place.bookingFixed)),locked);
  await shot(page,width,'candidate-confirmed-read');record(width,'registration completion resolves shortlist once; failed confirmation preserves choices; single dinner/locked stay retained');
}
async function readDetails(page,width){
  await start(page,'ready');await expectRead(page);const original=await snapshot(page),place=original.days[0].places.find(place=>place.kind==='FOOD');
  await page.getByRole('button',{name:place.name+' · 장소 정보',exact:true}).click();
  const detail=page.getByRole('dialog');await expect(detail).toBeVisible();await expect(detail.locator('input,textarea')).toHaveCount(0);
  await expect(detail.getByRole('button',{name:'일정에서 빼기',exact:true})).toHaveCount(0);await expect(detail.getByRole('button',{name:'이 장소 수정',exact:true})).toHaveCount(1);
  await shot(page,width,'read-place-information');await detail.getByRole('button',{name:'이 장소 수정',exact:true}).click();
  await expect(detail.locator('textarea')).toHaveCount(1);await expect(detail.getByRole('button',{name:'변경 저장',exact:true})).toBeVisible();
  await detail.getByRole('button',{name:'닫기',exact:true}).click();await settledSheetExit(page);await finish(page).click();await expectRead(page);
  await page.getByRole('button',{name:'이날의 동선 지도',exact:true}).click();await expect(page.locator('.qa-route-preview')).toBeVisible();
  await page.getByRole('button',{name:'지도 접기',exact:true}).click();await expect(page.locator('.qa-route-preview')).toHaveCount(0);
  await page.getByRole('button',{name:'여행 메뉴',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'여행 안내',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'DAY 1 여행 안내',exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>window.planViewQa.guideCalls),1);
  await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();await settledSheetExit(page);
  const after=await snapshot(page);assert.deepEqual(after.days.map(day=>day.places.map(place=>place.visitId)),original.days.map(day=>day.places.map(place=>place.visitId)));
  record(width,'reading place sheet is informational; explicit edit reuses one sheet; map optional and travel guide retained in menu');
}
async function warningEdit(page,width){
  await start(page,'ready');await expectRead(page);const original=await snapshot(page),food=original.days[0].places.find(place=>place.kind==='FOOD');
  await page.getByRole('button',{name:'이날의 동선 지도',exact:true}).click();await page.getByRole('button',{name:'경로 경고 확인',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:food.name+' · 방문 시각 수정',exact:true}).click();
  await expect(page.locator('.personal-trip')).toHaveClass(/plan-edit-mode/);await expect(page.getByRole('dialog').locator('input[type=time]')).toBeVisible();
  await page.getByRole('dialog').locator('input[type=time]').fill('13:30');await page.getByRole('dialog').getByRole('button',{name:'변경 저장',exact:true}).click();await settledSheetExit(page);
  assert.equal((await snapshot(page)).days[0].places.find(place=>place.visitId===food.visitId).time,'13:30');assert.equal((await snapshot(page)).planStage,'DRAFT');
  assert.equal(JSON.stringify((await snapshot(page)).days[0].places.find(place=>place.bookingFixed)),JSON.stringify(original.days[0].places.find(place=>place.bookingFixed)));
  await finish(page).click();await expectRead(page);await shot(page,width,'route-warning-manual-edit-complete');
  record(width,'route-warning time correction explicitly enters editing; only selected time changes; booking retained and completion returns read view');
}
async function travelProgress(page,width){
  await start(page,'ready');await expectRead(page);await expect(page.locator('.plan-travel-next')).toHaveCount(0);
  const planned=await snapshot(page),first=planned.days[0].places[0];await page.getByRole('button',{name:first.name+' · 장소 정보',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'완료',exact:true}).click();await settledSheetExit(page);
  await expect(page.locator('.plan-travel-next')).toBeVisible();assert.equal((await snapshot(page)).travelProgress.visits[first.visitId].status,'done');
  await page.reload();await page.waitForFunction(()=>Boolean(window.planViewQa));await expectRead(page);await expect(page.locator('.plan-travel-next')).toBeVisible();
  assert.equal((await snapshot(page)).travelProgress.visits[first.visitId].status,'done');assert.deepEqual((await snapshot(page)).days,planned.days);
  await start(page,'traveling');await expectRead(page);await expect(page.locator('.plan-travel-next')).toBeVisible();
  const before=await snapshot(page),target=before.days[0].places[0],locked=JSON.stringify(before.days[0].places.find(place=>place.bookingFixed));
  await page.getByRole('button',{name:target.name+' · 방문 완료',exact:true}).click();const done=await snapshot(page);
  assert.equal(done.travelProgress.visits[target.visitId].status,'done');assert.equal(done.planStage,'READY');assert.equal(done.status,'TRAVELING');assert.equal(done.visibility,'PRIVATE');
  assert.equal(JSON.stringify(done.days[0].places.find(place=>place.bookingFixed)),locked);assert.deepEqual(done.days,before.days);
  await page.reload();await page.waitForFunction(()=>Boolean(window.planViewQa));await expectRead(page);await expect(page.locator('.plan-travel-next')).toContainText('1/');assert.equal((await snapshot(page)).travelProgress.visits[target.visitId].status,'done');
  await shot(page,width,'traveling-progress-completed-reload');record(width,'new planning view hides zero-progress toolbar; actual visits/traveling show one-touch progress and preserve completion after reload');
}
async function actualApp(page,width){
  await start(page,'ready');const trip=await snapshot(page);
  await page.goto(base+'/#home');
  const data=await page.evaluate(async trip=>{
    const {buildPersonalPlan,makeJournalFromPlan}=await import('/src/tripPlan.ts');const {placeCatalog}=await import('/src/data.ts');
    const other=buildPersonalPlan([placeCatalog.find(place=>place.kind==='LANDMARK')],1,'기존 다른 내 여행','기기 여행자');other.planStage='READY';
    const journal=makeJournalFromPlan(other,'기기 여행자',{includePlanned:true});journal.title='기존 비공개 여행기';
    localStorage.removeItem('spotlog.local.repository.v2');localStorage.removeItem('spotlog.local.before-migration.v2');
    localStorage.setItem('spotlog.web.journeys.v4',JSON.stringify([trip,other,journal]));localStorage.setItem('spotlog-admin-preservation-sentinel','untouched');sessionStorage.setItem('spotlog.review.account.session.v1','signed');
    return {other,journal};
  },trip);
  await page.goto(base+'/#journey-'+trip.id);await page.reload();await page.locator('.personal-trip').waitFor();await expectRead(page);
  await edit(page).click();await expectEdit(page);await finish(page).last().click();await expectRead(page);
  await page.getByRole('button',{name:/여행 메뉴|여행 관리/}).first().click();
  await expect(page.getByRole('dialog').getByRole('button',{name:/여행기로 남기기|여행기 만들기/})).toHaveCount(1);
  await page.getByRole('dialog').getByRole('button',{name:/여행기로 남기기|여행기 만들기/}).click();
  await page.locator('.editor-page,.journey-editor,.editor').first().waitFor();
  const stored=await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records['spotlog.web.journeys.v4']));
  const original=stored.find(item=>item.id===trip.id),created=stored.find(item=>item.sourceTripId===trip.id&&item.purpose==='JOURNAL');
  assert.equal(original.visibility,'PRIVATE');assert.equal(original.purpose,'PLAN');assert.equal(created.visibility,'PRIVATE');assert.equal(created.sourceTripId,trip.id);
  assert.equal(created.days.flatMap(day=>day.places).some(place=>place.bookingFixed||place.note==='예약 번호는 비공개'),false);
  assert.equal(JSON.stringify(stored.find(item=>item.id===data.other.id)),JSON.stringify(data.other));assert.equal(JSON.stringify(stored.find(item=>item.id===data.journal.id)),JSON.stringify(data.journal));
  assert.equal(await page.evaluate(()=>localStorage.getItem('spotlog-admin-preservation-sentinel')),'untouched');
  await shot(page,width,'actual-app-journal-separate');record(width,'actual customer app completion stays PLAN/private; journal is explicit separate private record; other/admin records protected');
}
async function run(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{for(const width of [320,390,460]){const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await ready(page,width);await draft(page,width);await candidates(page,width);await readDetails(page,width);await warningEdit(page,width);await travelProgress(page,width);await actualApp(page,width);assert.deepEqual(errors,[]);await context.close();
  }}finally{await browser.close();write();}
}
run().catch(error=>{results.errors.push(error.stack);write();console.error(error);process.exitCode=1;});
