/* Isolated local itinerary drag review. Never uses the user's browser/profile. */
const {chromium,expect}=require(process.env.SPOTLOG_PLAYWRIGHT||'C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SPOTLOG_APP_URL||'http://127.0.0.1:5210';
const output=process.env.SPOTLOG_DRAG_QA_DIR||path.resolve(__dirname,'../../artifacts/trip-drag-order-20261012/qa');
fs.mkdirSync(output,{recursive:true});
const results={date:'2026-10-12',checks:[],errors:[]};
const write=()=>fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
const record=(width,name,detail='pass')=>{results.checks.push({width,name,detail});write();console.log('PASS',width,name);};
const snapshot=page=>page.evaluate(()=>JSON.parse(JSON.stringify(window.planViewQa.journey)));
const order=trip=>trip.days[0].places.map(place=>place.visitId);
const card=(page,id)=>page.locator(`[data-plan-visit="${id}"]`);
const handle=(page,id)=>card(page,id).locator('.plan-drag-handle');
const rootGroups=trip=>{
  const groups=[];
  for(const place of trip.days[0].places){
    const parent=place.anchorVisitId&&groups.find(group=>group[0].visitId===place.anchorVisitId);
    if(parent)parent.push(place);else groups.push([place]);
  }
  return groups;
};
const movable=trip=>rootGroups(trip).filter(group=>group[0].kind!=='STAY');
function preserved(before,after){
  assert.deepEqual(after.days[1],before.days[1],'other DAY changed');
  assert.deepEqual(after.businessCandidates,before.businessCandidates,'candidate groups changed');
  assert.equal(after.visibility,'PRIVATE');assert.equal(after.purpose,'PLAN');
  assert.equal(after.planStage,'DRAFT');
  assert.deepEqual(after.days[0].places.filter(place=>place.kind==='STAY'),before.days[0].places.filter(place=>place.kind==='STAY'),'stay/booking metadata changed');
  assert.deepEqual([...after.days[0].places].sort((a,b)=>a.visitId.localeCompare(b.visitId)),[...before.days[0].places].sort((a,b)=>a.visitId.localeCompare(b.visitId)),'visit fields changed instead of only order');
}
async function start(page,mode='draft',variant){
  await page.goto(`${base}/tests/plan-view-edit.html?mode=${mode}`);
  await page.waitForFunction(()=>Boolean(window.planViewQa));
  await page.evaluate(()=>{localStorage.removeItem(window.planViewQa.storageKey);window.planViewQaFail=false;});
  await page.reload();await page.waitForFunction(()=>Boolean(window.planViewQa));
  if(variant){
    await page.evaluate(async variant=>{
      const {insertNearby,appendPlanPlace}=await import('/src/tripPlan.ts');
      const {placeCatalog}=await import('/src/data.ts');
      let trip=structuredClone(window.planViewQa.journey),day=trip.days[0];
      const sources=placeCatalog.filter(place=>place.area.startsWith('부산'));
      if(variant==='linked'||variant==='long'){
        const food=sources.find(place=>place.kind==='FOOD'&&place.image&&!day.places.some(visit=>visit.id===place.id));
        const cafe=sources.find(place=>place.kind==='CAFE'&&place.image&&!day.places.some(visit=>visit.id===place.id));
        trip=insertNearby(trip,day.dayId,day.places[0].visitId,food,'lunch');
        trip=insertNearby(trip,day.dayId,day.places[0].visitId,cafe,'afternoon');
      }
      if(variant==='long'){
        for(const source of sources.filter(place=>place.kind==='LANDMARK'&&!trip.days.some(day=>day.places.some(visit=>visit.id===place.id))).slice(0,7))trip=appendPlanPlace(trip,day.dayId,source);
      }
      trip.planStage='DRAFT';localStorage.setItem(window.planViewQa.storageKey,JSON.stringify(trip));
    },variant);
    await page.reload();await page.waitForFunction(()=>Boolean(window.planViewQa));
  }
}
async function clean(page){
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  assert.equal(await page.getByRole('dialog').count(),0,'drag accidentally opened place detail');
  const failures=await page.locator('img').evaluateAll(nodes=>nodes.filter(node=>{const r=node.getBoundingClientRect();return r.height&&r.top<innerHeight&&r.bottom>0&&node.complete&&!node.naturalWidth;}).map(node=>node.currentSrc));
  assert.deepEqual(failures,[],'visible images broken');
  const sizes=await page.locator('.plan-drag-handle').evaluateAll(nodes=>nodes.map(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,name:node.getAttribute('aria-label'),touch:getComputedStyle(node).touchAction})));
  assert.ok(sizes.every(size=>size.width>=44&&size.height>=44&&size.name?.includes('끌어서 순서 변경')&&size.touch==='none'),'drag handle touch/accessibility target');
  assert.equal(await page.locator('.plan-dragging,.plan-drop-before,.plan-drop-end').count(),0,'drag state remained after release');
}
async function grab(page,id){
  await handle(page,id).scrollIntoViewIfNeeded();
  const r=await handle(page,id).boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+12,{steps:3});
  await expect(page.locator('.plan-dragging').first()).toBeVisible();return {x,y};
}
async function dropAfter(page,sourceId,targetId){
  const point=await grab(page,sourceId);
  await card(page,targetId).scrollIntoViewIfNeeded();
  const r=await card(page,targetId).boundingBox();
  await page.mouse.move(point.x,r.y+r.height-8,{steps:12});
  await page.mouse.up();await expect(page.locator('.plan-dragging')).toHaveCount(0);
}
async function desktop(page,width){
  await start(page);const before=await snapshot(page),groups=movable(before),first=groups[0];
  await dropAfter(page,first[0].visitId,groups.at(-1)[0].visitId);
  const after=await snapshot(page);preserved(before,after);
  assert.deepEqual(order(after),[...groups.slice(1).flat(),...first,...rootGroups(before).filter(group=>group[0].kind==='STAY').flat()].map(place=>place.visitId));
  await clean(page);await page.screenshot({path:path.join(output,`${width}-drag-order.png`),animations:'disabled'});
  await page.reload();await page.waitForFunction(()=>Boolean(window.planViewQa));assert.deepEqual(await snapshot(page),after);await expect(page.locator('.personal-trip')).toHaveClass(/plan-edit-mode/);
  await page.locator('.plan-mode-action').click();await expect(page.locator('.personal-trip')).toHaveClass(/plan-view-mode/);assert.equal(await page.locator('.plan-drag-handle').count(),0);
  assert.equal((await snapshot(page)).planStage,'READY');assert.equal((await snapshot(page)).visibility,'PRIVATE');
  record(width,'desktop drag, draft reload, explicit completion, readonly handles removed');
}
async function linked(page,width){
  await start(page,'candidate','linked');const before=await snapshot(page),groups=movable(before),source=groups[0];
  assert.ok(source.length>=3,'test must include linked FOOD/CAFE');
  await dropAfter(page,source[1].visitId,groups.at(-1)[0].visitId);
  const after=await snapshot(page);preserved(before,after);
  const tail=after.days[0].places.filter(place=>place.kind!=='STAY').slice(-source.length);
  assert.deepEqual(tail,source,'linked source did not move its root group intact');await clean(page);
  await page.getByRole('button',{name:'마지막 변경 취소',exact:true}).click();assert.deepEqual(await snapshot(page),before);
  record(width,'linked child drag moves anchor/food/cafe together; booking, candidates and other DAY preserved; undo exact');
}
async function cancellation(page,width){
  await start(page);const before=await snapshot(page),id=before.days[0].places[0].visitId;
  await grab(page,id);await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await snapshot(page),before);await clean(page);
  await grab(page,id);await handle(page,id).dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse',isPrimary:true,bubbles:true});await page.mouse.up();assert.deepEqual(await snapshot(page),before);await clean(page);
  await grab(page,id);await handle(page,id).dispatchEvent('lostpointercapture',{pointerId:1,pointerType:'mouse',isPrimary:true,bubbles:true});await page.mouse.up();assert.deepEqual(await snapshot(page),before);await clean(page);
  await grab(page,id);await page.mouse.move(20,28,{steps:8});await page.mouse.up();assert.deepEqual(await snapshot(page),before);await clean(page);
  await handle(page,id).click();assert.deepEqual(await snapshot(page),before);assert.equal(await page.getByRole('dialog').count(),0,'handle tap opened details');
  record(width,'Escape, pointercancel, lostpointercapture, header drop and handle tap never save or open a popup');
}
async function externalUpdate(page,width){
  await start(page,'draft','linked');const before=await snapshot(page),id=before.days[0].places[0].visitId;
  await grab(page,id);
  const incoming=JSON.parse(JSON.stringify(before));incoming.days[0].places[0].time='10:45';incoming.days[0].places[0].bookingFixed=true;
  await page.evaluate(incoming=>window.planViewQaUpdate(incoming),incoming);
  await expect(page.locator('.plan-dragging')).toHaveCount(0);await page.mouse.up();
  assert.deepEqual(await snapshot(page),incoming,'stale drag overwrote incoming visit update');await clean(page);
  record(width,'incoming booking/time update cancels active drag without overwriting current order or data');
}
async function keyboardAndFailure(page,width){
  await start(page);const before=await snapshot(page),groups=movable(before),id=groups[0][0].visitId;
  await handle(page,id).focus();await page.keyboard.press('ArrowDown');
  const after=await snapshot(page);preserved(before,after);assert.deepEqual(order(after),[...groups[1],...groups[0],...groups.slice(2).flat(),...rootGroups(before).filter(group=>group[0].kind==='STAY').flat()].map(place=>place.visitId));
  await handle(page,id).focus();await page.keyboard.press('ArrowUp');assert.deepEqual(order(await snapshot(page)),order(before));
  await page.evaluate(()=>window.planViewQaFail=true);await dropAfter(page,id,groups.at(-1)[0].visitId);assert.deepEqual(order(await snapshot(page)),order(before));await expect(page.getByRole('alert').first()).toBeVisible();await clean(page);
  for(const stay of before.days[0].places.filter(place=>place.kind==='STAY'))assert.equal(await handle(page,stay.visitId).count(),0,'stay must not be draggable');
  record(width,'keyboard reorder supported; failed save keeps previous order; STAY has no drag handle');
}
async function autoScroll(page,width){
  await start(page,'draft','long');const before=await snapshot(page),id=before.days[0].places[0].visitId,sourceGroup=movable(before)[0];
  const point=await grab(page,id),initial=await page.locator('.content').evaluate(node=>node.scrollTop),edge=await page.evaluate(()=>Math.min(innerHeight-14,document.querySelector('.content').getBoundingClientRect().bottom-14));
  await page.mouse.move(point.x,edge,{steps:12});
  await page.waitForFunction(initial=>document.querySelector('.content').scrollTop>initial+120,initial);
  const scroll=await page.locator('.content').evaluate(node=>node.scrollTop);await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await snapshot(page),before);
  await dropAfter(page,sourceGroup[0].visitId,movable(before).at(-1)[0].visitId);preserved(before,await snapshot(page));await clean(page);
  record(width,'long DAY edge scrolling works; cancellation preserves data; full-length reorder before stay',`scrolled ${Math.round(scroll-initial)}px`);
}
async function touch(page,width){
  await start(page,'draft','linked');const before=await snapshot(page),groups=movable(before),id=groups[0][1].visitId;
  const cdp=await page.context().newCDPSession(page);
  const dispatch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x:Math.round(x),y:Math.round(y),radiusX:2,radiusY:2,force:1}]});
  await handle(page,id).scrollIntoViewIfNeeded();let r=await handle(page,id).boundingBox();const x=r.x+r.width/2,y=r.y+r.height/2;
  await dispatch('touchStart',x,y);await dispatch('touchMove',x,y+14);await expect(page.locator('.plan-dragging').first()).toBeVisible();
  await card(page,groups.at(-1)[0].visitId).scrollIntoViewIfNeeded();r=await card(page,groups.at(-1)[0].visitId).boundingBox();await dispatch('touchMove',x,r.y+r.height-8);await dispatch('touchEnd');
  const after=await snapshot(page);preserved(before,after);assert.deepEqual(after.days[0].places.filter(place=>place.kind!=='STAY').slice(-groups[0].length),groups[0]);await clean(page);
  await page.locator('.content').evaluate(node=>node.scrollTop=0);const top=await page.locator('.content').evaluate(node=>node.scrollTop);
  await dispatch('touchStart',width/2,730);for(let i=1;i<=7;i++)await dispatch('touchMove',width/2,730-i*65);await dispatch('touchEnd');
  await page.waitForFunction(top=>document.querySelector('.content').scrollTop>top+80,top);assert.deepEqual(await snapshot(page),after);await clean(page);
  const remaining=after.days[0].places.find(place=>place.kind!=='STAY');await handle(page,remaining.visitId).scrollIntoViewIfNeeded();r=await handle(page,remaining.visitId).boundingBox();await dispatch('touchStart',r.x+r.width/2,r.y+r.height/2);await dispatch('touchMove',r.x+r.width/2,r.y+r.height/2+14);await dispatch('touchCancel');assert.deepEqual(await snapshot(page),after);await clean(page);
  await cdp.detach();record(width,'real touch drag preserves linked group; ordinary card swipe scrolls; touch cancel retains order');
}
async function run(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const width of [320,390,460]){
      const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await desktop(page,width);await linked(page,width);await cancellation(page,width);await externalUpdate(page,width);await keyboardAndFailure(page,width);await autoScroll(page,width);assert.deepEqual(errors,[]);await context.close();
    }
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await touch(page,390);assert.deepEqual(errors,[]);await context.close();
  }finally{await browser.close();write();}
}
run().catch(error=>{results.errors.push(error.stack);write();console.error(error);process.exitCode=1;});
