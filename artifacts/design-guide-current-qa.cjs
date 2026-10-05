const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve('artifacts/design-guide-current-qa');
const journey = {id:'qa-guide-current',title:'보존할 여행',region:'국내',dateRange:'날짜 미정',duration:'당일 여행',status:'PLANNING',visibility:'PRIVATE',cover:'',summary:'원본 보존',story:'원본 보존',tags:[],saves:0,author:'검증',isMine:true,days:[{day:1,date:'DAY 1',title:'첫날',story:'이야기 보존',places:[],blocks:[{id:'keep',type:'TEXT',body:'보존할 글'}]}]};
const seed = {'spotlog.web.saved.v3':JSON.stringify(['seoul-seoulforest','gangneung-anmok']),'spotlog.web.journeys.v4':JSON.stringify([journey])};
const selectors=['.ai-trip-card','.ai-trip-heading','.ai-trip-icon','.ai-trip-heading small','.ai-trip-heading h2','.ai-trip-kpi','.ai-trip-card > p','.ai-day-picker','.ai-day-picker > span','.ai-day-picker > div','.ai-day-picker button:not(.active)','.ai-day-picker button.active','.ai-generate-button','.saved-region-filter','.saved-region-filter small','.saved-region-filter h2','.saved-region-chips','.saved-region-chips button:not(.active)','.saved-region-chips button.active','.saved-region-groups','.saved-region-section','.saved-region-heading','.saved-region-heading strong','.saved-region-heading small','.saved-region-heading > span:nth-child(2)','.saved-region-section .saved-list','.saved-card','.saved-card > img','.saved-card-copy','.saved-card-eyebrow > span','.saved-card-eyebrow em','.saved-card-copy h3','.saved-card-copy p','.saved-place-time','.saved-card > button','.add-to-trip','.add-to-trip.is-added'];
const props=['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','backgroundImage','borderRadius','borderColor','borderWidth','minHeight','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','gap','boxShadow'];
async function snapshot(page) {return page.evaluate(({selectors,props})=>selectors.flatMap(selector=>[...document.querySelectorAll(selector)].map((el,index)=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {selector,index,...Object.fromEntries(props.map(p=>[p,s[p]])),width:r.width,height:r.height};})),{selectors,props});}
async function repository(page){return page.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2'));}
async function records(page){return JSON.parse(await repository(page)).records;}
const card=(page,name)=>page.locator('.saved-card').filter({has:page.getByRole('heading',{name,exact:true})});
(async()=>{
 fs.mkdirSync(out,{recursive:true}); const browser=await chromium.launch({channel:'msedge',headless:true});
 const results={comparisons:[],checks:[],errors:[]};
 const open=async(width,route,empty=false)=>{
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await context.addInitScript(seed=>{if(!sessionStorage.getItem('qa-guide-seed')){Object.entries(seed).forEach(([key,value])=>localStorage.setItem(key,value));sessionStorage.setItem('qa-guide-seed','1');}}, {...seed,...(empty?{'spotlog.web.saved.v3':'[]'}:{})});
  const page=await context.newPage(); page.on('pageerror',error=>results.errors.push(error.message)); await page.goto(`http://127.0.0.1:5173/#${route}`,{waitUntil:'domcontentloaded'}); await page.locator(route==='style-guide'?'.style-guide':'.saved-page').waitFor(); await page.evaluate(()=>document.fonts.ready); return page;
 };
 try{
  for(const width of [320,390,460]){
   const actual=await open(width,'saved'),guide=await open(width,'style-guide');
   await actual.locator('.ai-day-picker').getByRole('button',{name:'1일',exact:true}).click(); await card(actual,'안목해변').locator('.add-to-trip').click(); await actual.locator('.ai-day-picker').getByRole('button',{name:'2일',exact:true}).click(); await actual.mouse.move(0,0);
   const live=await snapshot(actual),reference=await snapshot(guide);
   const differences=live.flatMap((item,index)=>Object.entries(item).filter(([key,value])=>reference[index]?.[key]!==value).map(([property,value])=>({selector:item.selector,index:item.index,property,actual:value,guide:reference[index]?.[property]})));
   if(live.length!==reference.length) differences.push({property:'count',actual:live.length,guide:reference.length});
   const overflow=await guide.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('.style-guide').scrollWidth>document.querySelector('.style-guide').clientWidth);
   await actual.locator('.content').evaluate(el=>el.scrollTop=0); await actual.locator('.toast').waitFor({state:'hidden'});
   await actual.screenshot({path:path.join(out,`${width}-saved.png`)}); await guide.screenshot({path:path.join(out,`${width}-guide-top.png`)});
   await guide.locator('.content').evaluate(el=>el.scrollTop=420); await guide.screenshot({path:path.join(out,`${width}-guide-cards.png`)});
   results.comparisons.push({width,elements:live.length,overflow,differences});
   assert.equal(await actual.locator('.ai-sample-button').count(),0); assert.equal(await actual.getByText('제주 랜드마크 4곳 샘플도 보기').count(),0); assert.equal(await guide.locator('.ai-sample-button').count(),0);
   await actual.context().close(); await guide.context().close();
  }
  const guide=await open(390,'style-guide'),before=await repository(guide);
  await guide.getByRole('button',{name:'검색 모양 예시'}).click();
  await guide.locator('.ai-day-picker').getByRole('button',{name:'1일',exact:true}).click();
  await guide.locator('.ai-day-picker').getByRole('button',{name:'2일',exact:true}).click();
  await guide.locator('.ai-generate-button').click(); await guide.waitForFunction(()=>!document.querySelector('.ai-generate-button').disabled);
  await card(guide,'서울숲').locator('.add-to-trip').click(); await card(guide,'서울숲').locator('.add-to-trip').click();
  await card(guide,'안목해변').locator('.add-to-trip').click(); await card(guide,'안목해변').locator('.add-to-trip').click();
  await guide.getByRole('button',{name:'서울숲 저장 취소 모양 예시'}).click();
  await guide.locator('.saved-region-chips').getByRole('button',{name:/서울/}).click(); await guide.locator('.saved-region-chips').getByRole('button',{name:/전체/}).click();
  await guide.locator('.saved-region-heading').first().click(); await guide.locator('.saved-region-heading').first().click();
  await guide.locator('.landmark-guide-actions').getByRole('button',{name:'이 장소 저장',exact:true}).click();
  await guide.getByRole('button',{name:'내 여행에 담기',exact:true}).click();
  await guide.getByRole('button',{name:'장소 추가',exact:true}).click();
  await guide.getByPlaceholder('예: 제주 주말 여행').fill('가이드 입력 검증');
  await guide.getByRole('button',{name:'하단 팝업 보기'}).click(); await guide.getByRole('button',{name:'확인',exact:true}).click();
  await guide.getByRole('button',{name:'하단 팝업 보기'}).click(); await guide.getByRole('button',{name:'취소',exact:true}).click();
  assert.equal(await repository(guide),before); results.checks.push('Guide interactive samples do not mutate local repository');
  await guide.context().close();
  const empty=await open(390,'saved',true),emptyBefore=await repository(empty);
  assert.equal(await empty.locator('.ai-sample-button').count(),0); assert.equal(await empty.getByText('제주 랜드마크 4곳 샘플도 보기').count(),0); assert.ok(await empty.locator('.ai-generate-button').isDisabled());
  await empty.locator('.ai-generate-button').evaluate(el=>el.click()); assert.equal(await repository(empty),emptyBefore); assert.equal(await empty.locator('.journey-detail').count(),0);
  await empty.screenshot({path:path.join(out,'390-empty.png')}); await empty.getByRole('button',{name:'장소 둘러보기',exact:true}).click(); assert.match(new URL(empty.url()).hash,/places-/); results.checks.push('Empty Saved has no sample link, cannot create sample journey, and discover navigation works'); await empty.context().close();
  const actual=await open(390,'saved');
  await actual.locator('.ai-day-picker').getByRole('button',{name:'2일',exact:true}).click(); await card(actual,'서울숲').locator('.add-to-trip').click();
  let stored=await records(actual),trips=JSON.parse(stored['spotlog.web.journeys.v4']),original=trips.find(j=>j.id===journey.id);
  assert.ok(original.days.find(day=>day.day===2).places.some(place=>place.id==='seoul-seoulforest')); assert.equal(original.days[0].blocks[0].body,'보존할 글'); assert.match(await card(actual,'서울숲').locator('.add-to-trip').innerText(),/DAY 2 담김 해제/);
  await card(actual,'서울숲').locator('.add-to-trip').click(); stored=await records(actual); original=JSON.parse(stored['spotlog.web.journeys.v4']).find(j=>j.id===journey.id); assert.equal(original.days.find(day=>day.day===2).places.length,0); assert.ok(JSON.parse(stored['spotlog.web.saved.v3']).includes('seoul-seoulforest')); results.checks.push('DAY 2 add/remove preserves DAY 1 text and saved bookmark');
  await actual.locator('.ai-generate-button').click(); await actual.locator('.journey-detail').waitFor(); stored=await records(actual); trips=JSON.parse(stored['spotlog.web.journeys.v4']); const generated=trips.filter(j=>j.isMine&&j.id!==journey.id); assert.equal(generated.length,1); assert.equal(generated[0].days.length,2); assert.deepEqual(generated[0].days.flatMap(d=>d.places.map(p=>p.id)).sort(),['gangneung-anmok','seoul-seoulforest']); results.checks.push('Saved-place generation still creates one 2-day trip containing only the two saved places'); await actual.context().close();
  assert.equal(results.errors.length,0); assert.equal(results.comparisons.filter(r=>r.overflow).length,0); assert.equal(results.comparisons.reduce((sum,r)=>sum+r.differences.length,0),0);
 }catch(error){results.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)); await browser.close(); console.log(JSON.stringify(results,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
