const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('fs');
const assert = require('node:assert/strict');
const base = process.env.SPOTLOG_CANDIDATE_URL || 'http://127.0.0.1:5216/';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
  for(const width of [320,390,460]){
    const context=await browser.newContext({viewport:{width,height:850}}),page=await context.newPage();const errors=[];page.setDefaultTimeout(10000);
    page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
    await page.evaluate(async()=>{
      const {placeCatalog,initialJourneys}=await import('/src/data.ts');
      const {buildPersonalPlan,normalizePlan}=await import('/src/tripPlan.ts');
      const {createLocalRepository}=await import('/src/localRepository.ts');
      const anchor=placeCatalog.find(p=>p.id==='public-busan-haeundae');
      const trip=normalizePlan({...buildPersonalPlan([anchor],3,'후보 검수 여행','Spotlog 여행자'),planStage:'DRAFT'});
      const journal={...structuredClone(initialJourneys[0]),id:'qa-journal',purpose:'JOURNAL',isMine:true,visibility:'PRIVATE',title:'보존할 내 여행기'};
      if(!createLocalRepository(localStorage).setItem('spotlog.web.journeys.v4',JSON.stringify([trip,journal])))throw Error('fixture write failed');
    });
    await page.goto(base+'#trips');await page.reload();
    await page.getByRole('tab',{name:/내 여행기/}).click();await page.getByText('보존할 내 여행기',{exact:true}).waitFor();assert.equal(await page.getByText('후보 검수 여행',{exact:true}).count(),0);
    await page.getByRole('tab',{name:/내 여행\d|내 여행 \d/}).click().catch(()=>page.locator('#trip-plans-tab').click());
    assert.equal(await page.getByText('보존할 내 여행기',{exact:true}).count(),0);
    await page.getByText('후보 검수 여행',{exact:true}).click();
    await page.getByRole('button',{name:'주변 업체',exact:true}).click();
    for(const name of ['금수복국 해운대본점','거대갈비']) await page.locator('.nearby-business').filter({hasText:name}).getByRole('button',{name:name+' · 담기',exact:true}).click();
    assert.equal(await page.getByRole('dialog').count(),1);
    assert.equal(await page.locator('.nearby-business button[disabled]').count(),2);
    await page.getByRole('button',{name:'후보 담기 완료',exact:true}).click();
    assert.equal(await page.locator('.plan-stop').count(),1);
    await page.getByRole('button',{name:'주변 업체',exact:true}).click();await page.getByRole('button',{name:'숙소',exact:true}).click();
    for(const name of ['웨스틴 조선 부산','신라스테이 해운대']){
      await page.locator('.nearby-business').filter({hasText:name}).getByRole('button',{name:name+' · 담기',exact:true}).click();
      await page.getByRole('button',{name:'숙소 후보 담기',exact:true}).click();
    }
    await page.getByRole('button',{name:'후보 담기 완료',exact:true}).click();
    await page.getByRole('button',{name:'마지막 확인',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'내 여행 완성',exact:true}).isDisabled(),true);
    await page.getByRole('radio',{name:/거대갈비/}).check();
    console.log('close-review',width,page.url());await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});await page.waitForTimeout(450);console.log('reload',page.url());await page.reload();console.log('after reload',page.url(),(await page.locator('body').innerText()).slice(0,400));
    console.log('reopen');await page.getByRole('button',{name:'마지막 확인',exact:true}).click();assert.equal(await page.getByRole('radio',{name:/거대갈비/}).isChecked(),true);
    await page.getByRole('radio',{name:/신라스테이 해운대/}).check();const radioStyle=await page.getByRole('radio',{name:/신라스테이 해운대/}).evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,parent:getComputedStyle(el.parentElement).display}));assert.deepEqual(radioStyle,{width:18,height:18,parent:'flex'});await page.screenshot({path:__dirname+`/review-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'내 여행 완성',exact:true}).click();
    const names=await page.locator('.plan-stop-copy strong').allTextContents();assert.deepEqual(names,['해운대해수욕장','거대갈비','신라스테이 해운대']);
    assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('button',{name:'마지막 확인',exact:true}).count(),0);
    await page.locator('.plan-journal-link').click();
    const state=await page.evaluate(async()=>JSON.parse((await import('/src/localRepository.ts')).createLocalRepository(localStorage).getItem('spotlog.web.journeys.v4')));
    const trip=state.find(j=>j.title==='후보 검수 여행'&&j.purpose==='PLAN'),journal=state.find(j=>j.sourceTripId===trip.id);
    assert.equal(trip.planStage,'READY');assert.equal(journal.purpose,'JOURNAL');assert.equal(journal.businessCandidates,undefined);assert.equal(state.find(j=>j.id==='qa-journal').title,'보존할 내 여행기');
    assert(!journal.days.flatMap(d=>d.places).some(p=>['catalog-busan-geumsu','catalog-busan-westin'].includes(p.id)));
    assert.deepEqual(errors,[]);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
    results.push({width,names,draftReload:true,separateLibraries:true,privateJournalCopy:true,errors});await context.close();
  }
  fs.writeFileSync(__dirname+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
