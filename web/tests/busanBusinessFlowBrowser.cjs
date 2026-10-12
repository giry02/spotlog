/* Local Busan customer QA. Fresh, disposable browser contexts only. No user browser or live service writes. */
const {chromium,expect}=require(process.env.SPOTLOG_PLAYWRIGHT||'C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SPOTLOG_APP_URL||'http://127.0.0.1:5210';
const output=process.env.SPOTLOG_BUSAN_QA_DIR||path.resolve(__dirname,'../../artifacts/busan-business-20261012/qa');
fs.mkdirSync(output,{recursive:true});
const results={date:'2026-10-12',checks:[],errors:[]};
const write=()=>fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
function record(width,name,detail='pass'){results.checks.push({width,name,detail});write();console.log('PASS',width,name);}
async function clean(page){
  await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document horizontal overflow');
  assert.ok(await page.getByRole('dialog').count()<=1,'overlapping dialogs');
  const bad=await page.locator('img').evaluateAll(nodes=>nodes.filter(node=>{const box=node.getBoundingClientRect();return box.width>0&&box.height>0&&box.top<innerHeight&&box.bottom>0&&node.complete&&!node.naturalWidth;}).map(node=>node.currentSrc));
  assert.deepEqual(bad,[],'visible broken images');
}
async function photo(page,width,name){await clean(page);await page.screenshot({path:path.join(output,`${width}-${name}.png`),animations:'disabled'});}
async function settledSheetExit(page){await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>!history.state?.spotlogSheet);}
const snapshot=page=>page.evaluate(()=>structuredClone(window.busanQa.journey));
async function start(page,params=''){await page.goto(`${base}/tests/busan-business-flow.html${params}`);await page.waitForFunction(()=>Boolean(window.busanQa));}
async function catalogCoverage(page){
  return page.evaluate(async()=>{
    const {nearbyCandidates}=await import('/src/tripPlan.ts');
    const {getPhotoSource}=await import('/src/photoSources.ts');
    const {plannerBusinessPlaces}=await import('/src/plannerBusinessCatalog.ts');
    const {catalog}=window.busanQa;
    const officialIds=new Set(plannerBusinessPlaces.filter(place=>place.area.startsWith('부산')&&['FOOD','CAFE'].includes(place.kind)).map(place=>place.id));
    const businesses=catalog.filter(place=>officialIds.has(place.id));
    const zones=[['해운대','해운대'],['광안리','광안리'],['남포','자갈치|국제시장|용두산'],['영도','흰여울|태종대'],['송도','송도'],['기장','해동용궁']];
    return {businesses:businesses.length,food:businesses.filter(place=>place.kind==='FOOD').length,cafe:businesses.filter(place=>place.kind==='CAFE').length,
      validIds:new Set(businesses.map(place=>place.id)).size===businesses.length,
      validCoordinates:businesses.every(place=>place.locationVerified!==false&&Number.isFinite(place.lat)&&Number.isFinite(place.lng)),
      detailed:businesses.filter(place=>place.description.length>=35&&!/일정에서 (확인|비교)할/.test(place.description)).length,
      photos:businesses.filter(place=>Boolean(place.image)).length,
      attributed:businesses.filter(place=>Boolean(place.image)&&Boolean(getPhotoSource(place.image))).length,
      branches:['모모스','블랙업'].map(brand=>{const matches=businesses.filter(place=>place.name.includes(brand));return{brand,count:matches.length,distinctIds:new Set(matches.map(place=>place.id)).size,distinctAddresses:new Set(matches.map(place=>place.address)).size,distinctCoordinates:new Set(matches.map(place=>`${place.lat},${place.lng}`)).size};}),
      zones:zones.map(([name,pattern])=>{const anchor=catalog.find(place=>place.kind==='LANDMARK'&&new RegExp(pattern).test(place.name));return{name,id:anchor?.id,landmark:anchor?.name,food:anchor?nearbyCandidates(anchor,catalog,'FOOD',3).length:0,cafe:anchor?nearbyCandidates(anchor,catalog,'CAFE',3).length:0,cafe15:anchor?nearbyCandidates(anchor,catalog,'CAFE',15).length:0};})};
  });
}
async function standalone(page,width){
  await start(page);
  const protectedKeys=['spotlog.admin.review.v1','spotlog.web.saved.v3','spotlog.web.journeys.v4'];
  await page.evaluate(keys=>keys.forEach(key=>localStorage.setItem(key,'protected-'+key)),protectedKeys);
  const original=await page.evaluate(()=>window.busanQa.baseline);
  await page.locator('.plan-day > button.outline.wide').click();
  await page.getByRole('dialog',{name:'DAY 1에 장소 담기',exact:true}).waitFor();
  await page.getByRole('tab',{name:'음식점',exact:true}).click();
  const foodName=await page.locator('.trip-picker-copy strong').first().innerText();
  await page.getByRole('button',{name:/점심에 담기$/}).first().click();
  let current=await snapshot(page);assert.equal(current.days[0].places.length,1);assert.equal(current.days[0].places[0].kind,'FOOD');assert.equal(current.days[0].places[0].planningSlot,'lunch');assert.equal(current.days[0].places[0].anchorVisitId,undefined);
  await page.getByRole('tab',{name:'카페',exact:true}).click();
  const cafeName=await page.locator('.trip-picker-copy strong').first().innerText();
  await page.getByRole('button',{name:/카페 담기$/}).first().click();
  current=await snapshot(page);assert.deepEqual(current.days[0].places.map(place=>place.kind),['FOOD','CAFE']);assert.equal(current.days[0].places[1].planningSlot,'afternoon');
  await page.getByRole('tab',{name:'음식점',exact:true}).click();await page.getByRole('button',{name:'저녁',exact:true}).click();
  const foodRow=page.locator('.trip-picker-place').filter({has:page.getByText(foodName,{exact:true})});
  await foodRow.getByRole('button',{name:foodName+' · 저녁에 담기',exact:true}).click();
  current=await snapshot(page);assert.equal(current.days[0].places.length,3);assert.deepEqual(current.days[0].places.filter(place=>place.kind==='FOOD').map(place=>place.planningSlot),['lunch','dinner']);assert.notEqual(current.days[0].places[0].visitId,current.days[0].places[2].visitId);assert.equal(current.days[0].places[0].id,current.days[0].places[2].id);
  assert.equal(await foodRow.getByRole('button',{name:foodName+' · 담김',exact:true}).isDisabled(),true);
  const typography=await page.evaluate(()=>({name:getComputedStyle(document.querySelector('.trip-picker-copy strong')).fontSize,description:getComputedStyle(document.querySelector('.trip-picker-copy p')).fontSize,metadata:getComputedStyle(document.querySelector('.trip-picker-copy>small')).fontSize,search:getComputedStyle(document.querySelector('.trip-picker-search input')).fontSize,action:document.querySelector('.trip-picker-main>.ui-button').getBoundingClientRect().height,kindButtons:[...document.querySelectorAll('.trip-picker-kinds button')].every(button=>button.getBoundingClientRect().height>=44)}));
  assert.deepEqual(typography,{name:'16px',description:'14px',metadata:'12px',search:'16px',action:44,kindButtons:true});
  await photo(page,width,'standalone-food-cafe-dinner-selected');
  await page.getByRole('button',{name:'일정으로 돌아가기',exact:true}).click();
  await page.getByRole('button',{name:cafeName+' · 위로 이동',exact:true}).click();
  assert.equal((await snapshot(page)).days[0].places[0].name,cafeName);
  await photo(page,width,'standalone-itinerary');record(width,'food/cafe-only itinerary, independent lunch/dinner visits and ordering',typography);
  await page.getByRole('button',{name:'DAY 2',exact:true}).click();
  await page.locator('.plan-day > button.outline.wide').click();await page.getByRole('tab',{name:'음식점',exact:true}).click();
  await page.getByRole('button',{name:/점심에 담기$/}).first().click();
  await page.getByRole('button',{name:'일정으로 돌아가기',exact:true}).click();
  const dayOne=JSON.stringify((await snapshot(page)).days[0]);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.busanQa));
  assert.equal(JSON.stringify((await snapshot(page)).days[0]),dayOne);assert.equal((await snapshot(page)).days[1].places.length,1);
  await page.locator('.plan-day > button.outline.wide').click();await page.getByRole('tab',{name:'카페',exact:true}).click();
  const before=JSON.stringify(await snapshot(page));await page.evaluate(()=>window.busanQaFail=true);
  await page.getByRole('button',{name:/카페 담기$/}).first().click();await page.getByRole('dialog').getByRole('alert').waitFor();assert.equal(JSON.stringify(await snapshot(page)),before);
  assert.equal(await page.getByRole('dialog').count(),1);await page.evaluate(()=>window.busanQaFail=false);
  await page.getByRole('button',{name:'일정으로 돌아가기',exact:true}).click();
  assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/src/data.ts')).placeCatalog.filter(place=>place.area.startsWith('부산')))),original);
  assert.deepEqual(await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),protectedKeys),protectedKeys.map(key=>'protected-'+key));
  record(width,'DAY separation, reload/close/save-failure and original/customer/admin data protection');
  await photo(page,width,'standalone-after-reload');
  await page.evaluate(keys=>keys.forEach(key=>localStorage.removeItem(key)),protectedKeys);
  await start(page,'?locked=1');
  const locked=JSON.stringify((await snapshot(page)).days[0].places[0]);assert.equal(JSON.parse(locked).bookingFixed,true);
  await page.locator('.plan-day > button.outline.wide').click();await page.getByRole('tab',{name:'음식점',exact:true}).click();await page.getByRole('button',{name:/점심에 담기$/}).first().click();
  await page.getByRole('button',{name:'일정으로 돌아가기',exact:true}).click();
  assert.equal(JSON.stringify((await snapshot(page)).days[0].places.at(-1)),locked);
  await photo(page,width,'locked-stay-preserved');record(width,'adding independent food protects locked overnight visit');
  const foodVisit=(await snapshot(page)).days[0].places[0];
  await page.locator('.plan-stop').first().getByRole('button',{name:'주변 업체',exact:true}).click();
  await page.getByRole('button',{name:'카페',exact:true}).click();await page.locator('.nearby-business').first().waitFor();
  await page.locator('.nearby-row>.outline').first().click();
  const grouped=await snapshot(page);assert.equal(grouped.businessCandidates.length,1);assert.equal(grouped.businessCandidates[0].anchorVisitId,foodVisit.visitId);assert.equal(grouped.days[0].places.length,2);
  await page.getByRole('button',{name:'닫기',exact:true}).click();await settledSheetExit(page);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.busanQa));
  assert.equal((await snapshot(page)).businessCandidates[0].anchorVisitId,foodVisit.visitId);
  await page.getByRole('button',{name:'마지막 확인',exact:true}).click();await page.getByRole('dialog',{name:'여행 마지막 확인',exact:true}).waitFor();
  await page.locator('.candidate-choice-group input[type=radio]').first().check();await page.getByRole('button',{name:/내 여행 완성|선택한 후보 반영/}).click();
  const confirmed=await snapshot(page);assert.deepEqual(confirmed.days[0].places.map(place=>place.kind),['FOOD','CAFE','STAY']);assert.equal(confirmed.days[0].places[1].anchorVisitId,foodVisit.visitId);assert.equal(JSON.stringify(confirmed.days[0].places.at(-1)),locked);assert.equal(confirmed.businessCandidates.length,0);
  await photo(page,width,'food-anchor-nearby-cafe-confirmed');record(width,'independent restaurant can anchor nearby cafe shortlist and confirmation');
}
async function nearby(page,width,zone){
  await start(page,`?anchor=${encodeURIComponent(zone.id)}`);
  await page.getByRole('button',{name:'주변 업체',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.locator('.nearby-business').first().waitFor();
  const food=await page.locator('.nearby-business').count();assert.ok(food>0);
  const illustrated=page.locator('.nearby-open').filter({has:page.locator('img')});
  const detail=await illustrated.count()?illustrated.first():page.locator('.nearby-open').first();
  const selectedName=await detail.locator('strong').innerText();
  const foodImage=await detail.locator('img').count()>0;
  if(zone.name!=='기장')assert.equal(foodImage,true,'food has a verified representative image');
  await detail.click();
  await expect(page.getByRole('heading',{name:selectedName,exact:true})).toBeVisible();
  assert.ok((await page.locator('.plan-form>p').first().innerText()).length>=20,'real introduction in detail');
  await photo(page,width,`${zone.name}-food-detail`);
  await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();
  await page.getByRole('button',{name:'카페',exact:true}).click();
  if(!zone.cafe){await page.getByRole('button',{name:'더 넓게 찾기 · 15km',exact:true}).click();await expect(page.getByText('직선 15km 이내 · 이동 거리와 달라요',{exact:true})).toBeVisible();}
  await page.locator('.nearby-business').first().waitFor();
  assert.ok(await page.locator('.nearby-business').count()>0);
  assert.ok(await page.locator('.nearby-open img').count()>0,'cafes have representative images');
  await photo(page,width,`${zone.name}-cafes`);
  await page.locator('.nearby-row>.outline').first().click();
  const saved=await snapshot(page);assert.equal(saved.days[0].places.length,1);assert.equal(saved.businessCandidates[0].kind,'CAFE');assert.ok(saved.businessCandidates[0].anchorVisitId);
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await settledSheetExit(page);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.busanQa));
  assert.equal((await snapshot(page)).businessCandidates[0].options[0].place.id,saved.businessCandidates[0].options[0].place.id);
  record(width,`${zone.name}: nearby photos/introduction/shortlist persists`,{food,foodImage,cafe:zone.cafe,cafe15:zone.cafe15,expanded:!zone.cafe});
}
async function trash(page,width){
  await page.goto(base+'/#trips');await page.locator('.trips-page').waitFor();
  const button=page.getByRole('button',{name:'휴지통',exact:true});
  const geometry=await page.evaluate(()=>{const panel=document.querySelector('#trip-library-panel').getBoundingClientRect();const trash=document.querySelector('.phase-three-trash-link').getBoundingClientRect();return{below:trash.top>=panel.bottom-1};});
  assert.equal(geometry.below,true,'trash belongs below the library content');
  await button.scrollIntoViewIfNeeded();await photo(page,width,'trip-library-bottom');
  await button.click();await expect(page.getByRole('heading',{name:'휴지통',exact:true})).toBeVisible();
  await expect(page.getByText('휴지통이 비어 있어요',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('tab',{name:/내 여행기/}).click();
  assert.ok(await page.evaluate(()=>document.querySelector('.phase-three-trash-link').getBoundingClientRect().top>=document.querySelector('#trip-library-panel').getBoundingClientRect().bottom-1));
  record(width,'trash footer and open/close in both library tabs');
}
async function previewLinks(page,width){
  const original=await snapshot(page),keys=[];
  keys.push(await page.evaluate(()=>window.busanQa.storageKey));
  const routes=['public-busan-gwangalli','public-busan-huinnyeoul','public-busan-songdo'];
  for(const id of routes){
    await start(page,`?anchor=${id}`);const initial=await snapshot(page);
    assert.equal(initial.days[0].places[0].id,id,'each URL opens its own landmark');
    keys.push(await page.evaluate(()=>window.busanQa.storageKey));
    await page.locator('.plan-day > button.outline.wide').click();await page.getByRole('tab',{name:'음식점',exact:true}).click();await page.getByRole('button',{name:/점심에 담기$/}).first().click();
    await page.getByRole('button',{name:'일정으로 돌아가기',exact:true}).click();await settledSheetExit(page);
    const selected=JSON.stringify(await snapshot(page));
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Boolean(window.busanQa));assert.equal(JSON.stringify(await snapshot(page)),selected,'each route keeps its own reload edits');
  }
  await start(page);assert.equal(JSON.stringify(await snapshot(page)),JSON.stringify(original),'standalone meal trip is retained when returning');
  await start(page,'?locked=1');const locked=await snapshot(page);assert.equal(locked.days[0].places.some(place=>place.bookingFixed),true);keys.push(await page.evaluate(()=>window.busanQa.storageKey));
  assert.equal(new Set(keys).size,keys.length,'anchor and locked variants have separate keys');
  record(width,'sequential standalone/Gwangalli/Yeongdo/Songdo links retain their own itinerary and reload state');
}
async function run(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const width of [320,390,460]){
      const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await start(page);const coverage=await catalogCoverage(page);
      if(!process.env.SPOTLOG_BUSAN_CORE_ONLY){
        assert.ok(coverage.businesses>=30);assert.equal(coverage.validIds,true);assert.equal(coverage.validCoordinates,true);assert.ok(coverage.detailed>=30);assert.ok(coverage.photos>=20);assert.equal(coverage.photos,coverage.attributed);
        for(const branch of coverage.branches){assert.ok(branch.count>=2);assert.equal(branch.distinctIds,branch.count);assert.equal(branch.distinctAddresses,branch.count);assert.equal(branch.distinctCoordinates,branch.count);}
        for(const zone of coverage.zones){assert.ok(zone.id,zone.name+' landmark');assert.ok(zone.food>0,zone.name+' food');assert.ok(zone.cafe>0||zone.cafe15>0,zone.name+' cafe or honest 15km expansion');}
        record(width,'Busan business/catalog/source/3km regional coverage',coverage);
      }
      await standalone(page,width);
      if(!process.env.SPOTLOG_BUSAN_CORE_ONLY)for(const zone of coverage.zones)await nearby(page,width,zone);
      await trash(page,width);assert.deepEqual(errors,[]);await context.close();
    }
    const linkContext=await browser.newContext({viewport:{width:390,height:844}}),linkPage=await linkContext.newPage();
    const linkErrors=[];linkPage.on('pageerror',error=>linkErrors.push(error.message));
    await start(linkPage);await linkPage.locator('.plan-day > button.outline.wide').click();await linkPage.getByRole('tab',{name:'음식점',exact:true}).click();await linkPage.getByRole('button',{name:/점심에 담기$/}).first().click();await linkPage.getByRole('button',{name:'일정으로 돌아가기',exact:true}).click();await settledSheetExit(linkPage);
    await previewLinks(linkPage,390);assert.deepEqual(linkErrors,[]);await linkContext.close();
    results.pass=true;write();console.log(JSON.stringify({pass:true,checks:results.checks.length,output}));
  }finally{await browser.close();}
}
run().catch(error=>{results.pass=false;results.errors.push(String(error.stack));write();console.error(error);process.exitCode=1;});
