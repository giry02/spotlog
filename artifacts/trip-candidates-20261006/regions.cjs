const { chromium }=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:850}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const results=[];
  const base=process.env.SPOTLOG_CANDIDATE_URL||'http://127.0.0.1:5216/';await page.goto(base);
  await page.evaluate(async()=>{
    const {placeCatalog}=await import('/src/data.ts'),{buildPersonalPlan,normalizePlan}=await import('/src/tripPlan.ts'),{createLocalRepository}=await import('/src/localRepository.ts');
    const trips=['seoul-seoulforest','gangneung-anmok','public-gyeongju-cheomseongdae'].map(id=>{const p=placeCatalog.find(p=>p.id===id);if(!p)throw Error('missing anchor '+id);return normalizePlan({...buildPersonalPlan([p],2,p.name+' 업체 검수','Spotlog 여행자'),planStage:'DRAFT'});});
    if(!createLocalRepository(localStorage).setItem('spotlog.web.journeys.v4',JSON.stringify(trips)))throw Error('fixture error');
  });
  await page.reload();
  for(const anchor of ['서울숲','안목해변','첨성대']){
    await page.goto(base+'#trips');await page.getByText(anchor+' 업체 검수',{exact:true}).click();await page.getByRole('button',{name:'주변 업체',exact:true}).click();
    const counts={};
    for(const kind of ['맛집','카페','숙소']){
      await page.getByRole('button',{name:kind,exact:true}).click();
      if(await page.getByRole('button',{name:'더 넓게 찾기 · 15km',exact:true}).count())await page.getByRole('button',{name:'더 넓게 찾기 · 15km',exact:true}).click();
      counts[kind]=await page.locator('.nearby-business').count();assert(counts[kind]>=2,anchor+' '+kind);
      if(kind==='카페'){const choices=page.locator('.nearby-business button.outline');await choices.nth(0).click();await choices.nth(1).click();assert.equal(await choices.nth(0).isDisabled(),true);}
    }
    await page.screenshot({path:__dirname+`/region-${anchor}.png`,fullPage:true});await page.getByRole('button',{name:'후보 담기 완료',exact:true}).click();
    assert.equal(await page.locator('.plan-stop').count(),1);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);results.push({anchor,counts,shortlistedCafes:2,actualVisits:1});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(__dirname+'/regions.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
