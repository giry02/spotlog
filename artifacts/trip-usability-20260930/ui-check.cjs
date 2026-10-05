const fs=require('node:fs');const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const out=__dirname;const records=[];
async function measure(page,label,width){
  const sizes=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,bodyOverflow:document.body.scrollWidth>innerWidth,
    controls:[...document.querySelectorAll('.plan-progress-options button,.plan-local-action,.route-warning-action,.plan-visit-complete')].map(n=>({text:n.textContent,role:n.getAttribute('aria-label'),height:n.getBoundingClientRect().height,size:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight})),
    inputs:[...document.querySelectorAll('.phase-sheet input,.phase-sheet textarea')].map(n=>({type:n.type,size:getComputedStyle(n).fontSize})),
    cover:document.querySelector('.plan-cover')?.getBoundingClientRect().height,
    photo:document.querySelector('.plan-stop-main img')?.getBoundingClientRect().width,
    cardName:document.querySelector('.plan-stop-copy strong')&&getComputedStyle(document.querySelector('.plan-stop-copy strong')).fontSize,
  }));
  assert.equal(sizes.overflow,false,label);assert.equal(sizes.bodyOverflow,false,label);
  for(const item of sizes.controls)assert.equal(item.height,36,`${label}: ${JSON.stringify(item)}`);
  records.push({width,label,...sizes});await page.screenshot({path:`${out}/${label}-${width}.png`});
}
async function close(page){const button=page.getByRole('button',{name:'닫기',exact:true});await button.click();await page.waitForTimeout(250);}
const state=page=>page.evaluate(()=>window.reviewTrip);
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const width of [320,390,460]){
 const context=await browser.newContext({viewport:{width,height:844}});const errors=[];
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route(/router.project-osrm.org|tile.openstreetmap.org/,route=>route.abort());
 await page.goto('http://127.0.0.1:5217/tests/trip-usability.html');await page.locator('.plan-stop').first().waitFor();await measure(page,'before',width);
 await page.goto('http://127.0.0.1:5210/tests/trip-usability.html');await page.locator('.plan-stop').first().waitFor();await measure(page,'initial',width);
 const initial=await state(page);const firstId=initial.days[0].places[0].visitId,foodId=initial.days[0].places[1].visitId;
 await page.getByRole('button',{name:'첫 랜드마크 · 장소 메뉴',exact:true}).click();await page.getByRole('button',{name:'완료',exact:true}).click();await measure(page,'visited',width);
 let trip=await state(page);assert.equal(trip.travelProgress.visits[firstId].status,'done');
 await page.reload();await page.locator('.plan-stop').first().waitFor();trip=await state(page);assert.equal(trip.travelProgress.visits[firstId].status,'done');
 await page.getByRole('button',{name:'점심 식당 · 장소 메뉴',exact:true}).click();await measure(page,'place-menu',width);
 await page.getByRole('button',{name:'건너뛰기',exact:true}).click();trip=await state(page);assert.equal(trip.travelProgress.visits[foodId].status,'skipped');
 await page.getByRole('button',{name:'점심 식당 · 장소 메뉴',exact:true}).click();await page.getByRole('button',{name:'미방문',exact:true}).click();trip=await state(page);assert.equal(trip.travelProgress.visits[foodId],undefined);
 await page.getByRole('button',{name:'점심 식당 · 장소 메뉴',exact:true}).click();await page.getByRole('button',{name:'이 장소만 다른 곳으로 교체',exact:true}).click();await measure(page,'replacement-list',width);
 assert.equal(await page.getByRole('button',{name:'점심 식당 · 현재 장소',exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'이미 담긴 식당 · 이 DAY에 담김',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'다른 점심 식당 · 선택',exact:true}).click();await measure(page,'replacement-confirm',width);assert.equal((await state(page)).days[0].places[1].id,'food');
 await page.getByRole('button',{name:'원래 일정 유지',exact:true}).click();assert.equal((await state(page)).days[0].places[1].id,'food');
 await page.getByRole('button',{name:'점심 식당 · 장소 메뉴',exact:true}).click();await page.getByRole('button',{name:'이 장소만 다른 곳으로 교체',exact:true}).click();await page.getByRole('button',{name:'다른 점심 식당 · 선택',exact:true}).click();
 await page.evaluate(()=>{window.reviewFail=true;});await page.getByRole('button',{name:'이곳으로 교체',exact:true}).click();assert.equal((await state(page)).days[0].places[1].id,'food');await measure(page,'replacement-failure',width);
 await page.evaluate(()=>{window.reviewFail=false;});await page.getByRole('button',{name:'이곳으로 교체',exact:true}).click();trip=await state(page);assert.equal(trip.days[0].places[1].id,'other-food');assert.equal(trip.days[0].places[1].time,'10:15');assert.equal(trip.days[0].places[1].note,'');assert.equal(trip.days[0].places.at(-1).bookingFixed,true);
 await page.locator('[data-day="2"]').click();await page.getByRole('button',{name:'마지막 변경 취소',exact:true}).click();assert.equal((await state(page)).days[0].places[1].id,'food');
 await page.getByRole('button',{name:'이날의 동선 지도',exact:true}).click();await page.getByRole('button',{name:'점심 식당 · 구간 확인·수정',exact:true}).waitFor();await measure(page,'map-warning',width);
 await page.getByRole('button',{name:'점심 식당 · 구간 확인·수정',exact:true}).click();await measure(page,'warning-actions',width);
 await page.getByRole('button',{name:'점심 식당 · 방문 시각 수정',exact:true}).click();await page.locator('input[type=time]').fill('12:00');await page.getByRole('button',{name:'변경 저장',exact:true}).click();trip=await state(page);assert.equal(trip.days[0].places[1].time,'12:00');assert.equal(JSON.stringify(trip.days[1]),JSON.stringify(initial.days[1]));
 await page.locator('[data-day="2"]').click();await page.reload();await page.locator('.plan-stop').first().waitFor();trip=await state(page);assert.equal(trip.travelProgress.dayId,trip.days[1].dayId);assert.equal(await page.locator('.plan-day h2').textContent(),'DAY 2');
 await page.locator('[data-day="1"]').click();await page.getByRole('button',{name:'오후 카페 · 장소 메뉴',exact:true}).click();await page.getByRole('button',{name:'이 장소만 다른 곳으로 교체',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'다른 점심 식당 · 선택',exact:true}).count(),0);
 await page.getByRole('button',{name:'다른 카페 · 상세 보기',exact:true}).click();await page.getByRole('button',{name:'이곳으로 교체',exact:true}).click();trip=await state(page);assert.equal(trip.days[0].places.find(p=>p.visitId===initial.days[0].places[3].visitId).id,'other-cafe');
 await page.getByRole('button',{name:'마지막 변경 취소',exact:true}).click();
 for(const place of (await state(page)).days[0].places){
   if((await state(page)).travelProgress?.visits[place.visitId])continue;
   await page.getByRole('button',{name:`${place.name} · 장소 메뉴`,exact:true}).click();await page.getByRole('button',{name:'완료',exact:true}).click();
 }
 assert.equal(await page.getByRole('button',{name:'이 DAY 확인 끝 · DAY 2 이어가기',exact:true}).count(),1);
 await page.getByRole('button',{name:'이 DAY 확인 끝 · DAY 2 이어가기',exact:true}).click();await page.getByRole('button',{name:'두 번째 랜드마크 · 장소 메뉴',exact:true}).click();await page.getByRole('button',{name:'완료',exact:true}).click();
 assert.equal(await page.getByText('모든 일정의 방문을 확인했어요. 장소 메뉴에서 미방문으로 되돌릴 수 있어요.',{exact:true}).count(),1);
 const navBox=await page.locator('.tabbar').boundingBox();assert.equal(navBox.y+navBox.height,844);await measure(page,'all-visited',width);
 assert.deepEqual(errors,[]);records.push({width,actions:'complete, reload, skip, restore, food/cafe replacement cancel/failure/commit/undo, warning edit, DAY resume, DAY/trip finish',errors});await context.close();
}
fs.writeFileSync(`${out}/ui-results.json`,JSON.stringify(records,null,2));console.log(JSON.stringify({screens:records.filter(r=>r.label).length,widths:[320,390,460],errors:0}));
}finally{await browser.close();}
})().catch(e=>{fs.writeFileSync(`${out}/ui-results.json`,JSON.stringify({records,error:String(e.stack)},null,2));console.error(e);process.exit(1);});
