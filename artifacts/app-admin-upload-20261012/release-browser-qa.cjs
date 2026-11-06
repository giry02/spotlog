/* Production-only QA: fresh browser contexts; no real user browser, credentials, APIs or records altered. */
const {chromium,expect}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=(process.env.SPOTLOG_RELEASE_URL||'http://127.0.0.1:5312/spotlog/').replace(/\/?$/,'/');
const output=process.env.SPOTLOG_RELEASE_QA_DIR||path.join(__dirname,'qa-static');
const origin=new URL(base).origin,results={base,date:'2026-10-12',checks:[],errors:[],assetFailures:[]};
fs.mkdirSync(output,{recursive:true});
const write=()=>fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
function record(width,name,detail='pass'){results.checks.push({width,name,detail});write();console.log('PASS',width,name);}
async function clean(page){
  await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'full-page horizontal overflow');
  assert.ok(await page.getByRole('dialog').count()<=1,'overlapping dialogs');
  const broken=await page.locator('img').evaluateAll(nodes=>nodes.filter(node=>{const b=node.getBoundingClientRect();return b.width&&b.height&&b.top<innerHeight&&b.bottom>0&&node.complete&&!node.naturalWidth;}).map(node=>new URL(node.currentSrc).pathname));
  assert.deepEqual(broken,[],'visible failed images');
}
async function shot(page,width,name){await clean(page);await page.screenshot({path:path.join(output,`${width}-${name}.png`),animations:'disabled'});}
async function navigate(page,hash,selector){await page.goto(base+'#'+hash,{waitUntil:'domcontentloaded'});await page.locator(selector).waitFor();}
async function buildAssets(context){
  const index=await context.request.get(base),admin=await context.request.get(base+'admin.html');
  assert.equal(index.status(),200);assert.equal(admin.status(),200);
  const html=(await index.text())+(await admin.text());
  for(const expected of [process.env.SPOTLOG_EXPECT_CUSTOMER_ASSET,process.env.SPOTLOG_EXPECT_ADMIN_ASSET].filter(Boolean))assert.ok(html.includes(expected),'published entrypoint matches the verified release asset');
  const links=[...new Set([...html.matchAll(/(?:src|href)="(\/spotlog\/assets\/[^\"]+)"/g)].map(match=>match[1]))];
  let javascript='';for(const pathname of links){const response=await context.request.get(origin+pathname);assert.equal(response.status(),200,pathname);if(pathname.endsWith('.js'))javascript+=await response.text();}
  for(const forbidden of ['demo@spotlog.test','SpotlogDemo123!','busanQa','reviewCandidates','/tests/busan-business-flow.tsx','/@vite/client','/@fs/'])assert.equal(javascript.includes(forbidden),false,'development/test entry excluded: '+forbidden);
  const photos=[...new Set([...javascript.matchAll(/\/spotlog\/assets\/[^"'\s<>]+\.webp/g)].map(match=>match[0]))].filter(value=>/catalog-busan|public-busan/.test(value));
  assert.ok(photos.length>=50,'new Busan gallery assets are included');
  for(const pathname of photos){const response=await context.request.get(origin+pathname);assert.equal(response.status(),200,pathname);assert.ok((await response.body()).length>500);}
  const fixture=await context.request.get(base+'tests/busan-business-flow.html');assert.equal(fixture.status(),404,'DEV fixture excluded from release');
  record('build','customer/admin entrypoints, dev exclusion, Busan photo assets',{htmlFiles:2,entryAssets:links.length,entryAssetPaths:links,busanPhotos:photos.length});
}
async function customer(page,width){
  await navigate(page,'home','.tab-home .home-page');await shot(page,width,'home');record(width,'Home layout and images');
  await navigate(page,'places-guide','.place-discover.is-guide');await page.getByRole('button',{name:/^부산\s*15$/}).click();
  await expect(page.getByRole('heading',{name:'부산 랜드마크',exact:true})).toBeVisible();await page.locator('.landmark-guide-list img').first().waitFor();
  await page.locator('.landmark-guide-list img').evaluateAll(nodes=>Promise.all(nodes.map(node=>node.decode())));
  const photos=await page.locator('.landmark-guide-list img').evaluateAll(nodes=>nodes.map(node=>({src:new URL(node.currentSrc||node.src).pathname,width:node.naturalWidth})));
  assert.ok(photos.length>=3);assert.ok(photos.every(photo=>photo.width>0));await shot(page,width,'busan-places');record(width,'Busan landmarks and actual photo assets',{initialCards:photos.length});
  await navigate(page,'trips','.trips-page');assert.equal(await page.getByRole('button',{name:'휴지통',exact:true}).count(),1);
  const footer=await page.evaluate(()=>document.querySelector('.phase-three-trash-link').getBoundingClientRect().top>=document.querySelector('#trip-library-panel').getBoundingClientRect().bottom-1);assert.equal(footer,true);await shot(page,width,'trips');record(width,'My trips/library/trash footer');
  await page.getByRole('button',{name:'저장한 곳으로 여행 만들기',exact:true}).click();await page.getByRole('dialog').waitFor();
  await page.getByLabel('여행 이름 (선택)',{exact:true}).fill('부산 식사와 카페');await page.getByRole('button',{name:'내 여행 만들기',exact:true}).click();await page.locator('.personal-trip').waitFor();
  await page.getByRole('button',{name:'장소 추가',exact:true}).click();await page.getByRole('dialog',{name:/DAY 1에 장소 담기/}).waitFor();await page.locator('.trip-picker-filter select').selectOption('부산');await page.getByRole('tab',{name:'음식점',exact:true}).click();
  await page.getByRole('button',{name:/점심에 담기$/}).first().click();await page.getByRole('tab',{name:'카페',exact:true}).click();await page.getByRole('button',{name:/카페 담기$/}).first().click();
  await page.getByRole('button',{name:'일정으로 돌아가기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>!history.state?.spotlogSheet);
  assert.equal(await page.locator('.plan-stop').count(),2);assert.equal(await page.locator('.ai-planner-kind[data-kind=FOOD]').count(),1);assert.equal(await page.locator('.ai-planner-kind[data-kind=CAFE]').count(),1);await shot(page,width,'food-cafe-only');record(width,'Production guest can build an independent food/cafe itinerary');
  await navigate(page,'profile','.tab-profile');await expect(page.getByRole('heading',{name:'로그인하고 여행을 이어가세요',exact:true})).toBeVisible();assert.equal(await page.getByText('로그인됨',{exact:true}).count(),0);await shot(page,width,'guest-profile');
  await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('dialog').waitFor();
  const email=page.getByRole('dialog').locator('input[type=email]'),password=page.getByRole('dialog').locator('input[type=password]');assert.equal(await email.inputValue(),'');assert.equal(await password.inputValue(),'');
  assert.equal((await page.locator('body').innerText()).includes('demo@spotlog.test'),false);await shot(page,width,'empty-email-login');await page.getByRole('button',{name:'닫기',exact:true}).click();record(width,'Anonymous profile and production login have no review identity or credentials');
  for(const type of ['validation','session','conditions','forbidden','missing','server','unavailable']){
    const response=await page.goto(base+'error.html?type='+type+'&lang=ko',{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);await page.locator('h1').waitFor();const visible=await page.locator('body').innerText();assert.equal(/\b(?:400|401|402|403|404|500|503)\b/.test(visible),false,'customer sees no HTTP code');await clean(page);record(width,'Customer error '+type);
  }
  await shot(page,width,'error-unavailable');
}
async function admin(page,width){
  await page.goto(base+'admin.html?mode=local',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.setItem('spotlog.admin.review.v1',JSON.stringify({marker:'release-qa-protected',mode:'LOCAL',role:'ADMIN'})));
  await page.reload({waitUntil:'domcontentloaded'});await page.getByText('관리자 연결 대기',{exact:true}).waitFor();
  assert.equal(await page.getByRole('combobox',{name:'역할 전환',exact:true}).count(),0);assert.equal(await page.getByRole('combobox',{name:'작업자',exact:true}).count(),0);assert.equal(await page.locator('.admin-page-body').count(),0);assert.equal(await page.locator('.admin-main input,.admin-main textarea').count(),0);
  assert.equal(await page.getByText('로컬',{exact:true}).count(),0);assert.equal(await page.getByText('서비스',{exact:true}).count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('spotlog.admin.review.v1')),JSON.stringify({marker:'release-qa-protected',mode:'LOCAL',role:'ADMIN'}));await shot(page,width,'admin-connection-gate');record(width,'Admin production always uses API and blocks edits without authorized server state');
}
async function mapWorker(page){
  const workers=[],asset=[];page.on('worker',worker=>workers.push(new URL(worker.url()).pathname));page.on('response',response=>{const u=new URL(response.url());if(u.origin===origin&&/maplibre-gl-worker/.test(u.pathname))asset.push({path:u.pathname,status:response.status()});});
  await navigate(page,'recommendation-curation-busan-coast','.journey-detail');
  await page.locator('.maplibregl-canvas').waitFor({timeout:15000});await page.waitForFunction(()=>Boolean(document.querySelector('.maplibregl-canvas')));
  if(process.env.SPOTLOG_EXPECT_MAP_WORKER_ASSET)assert.ok(asset.some(item=>item.path.endsWith(process.env.SPOTLOG_EXPECT_MAP_WORKER_ASSET)),'map worker matches verified release asset');
  assert.ok(asset.some(item=>item.status===200),'production worker asset returns 200');assert.ok(workers.some(value=>/maplibre-gl-worker/.test(value)),'standalone worker started from same-origin compiled asset');await shot(page,390,'route-map-worker');record(390,'Mobile map worker remains a separate loaded production asset',{asset,workers});
}
async function run(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const resourceContext=await browser.newContext();await buildAssets(resourceContext);await resourceContext.close();
    for(const width of [320,390,460]){
      const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{const u=new URL(response.url());if(u.origin===origin&&u.pathname.startsWith('/spotlog/assets/')&&response.status()>=400)results.assetFailures.push({path:u.pathname,status:response.status()});});
      await customer(page,width);await admin(page,width);assert.deepEqual(errors,[],'unhandled JavaScript exception');await context.close();
    }
    const mapContext=await browser.newContext({viewport:{width:390,height:844}}),mapPage=await mapContext.newPage(),mapErrors=[];mapPage.on('pageerror',error=>mapErrors.push(error.message));await mapWorker(mapPage);assert.deepEqual(mapErrors,[]);await mapContext.close();
    assert.deepEqual(results.assetFailures,[]);results.pass=true;write();console.log(JSON.stringify({pass:true,checks:results.checks.length,base,output}));
  }finally{await browser.close();}
}
run().catch(error=>{results.pass=false;results.errors.push(String(error.stack));write();console.error(error);process.exitCode=1;});
