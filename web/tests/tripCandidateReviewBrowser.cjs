const {chromium}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output=process.env.SPOTLOG_CANDIDATE_QA_DIR||path.resolve('artifacts/app-improvements-20261012/candidates');
fs.mkdirSync(output,{recursive:true});
const results=[];
const base=process.env.SPOTLOG_CANDIDATE_URL||'http://127.0.0.1:5210/tests/trip-candidate-review.html';
async function run(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const width of [320,390,460]){
      const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base);await page.getByRole('dialog',{name:'여행 마지막 확인'}).waitFor();
      await page.getByText('사진 미표시',{exact:true}).waitFor();
      const metrics=await page.evaluate(()=>{
        const style=selector=>getComputedStyle(document.querySelector(selector));
        return {overflow:document.body.scrollWidth>innerWidth||[...document.querySelectorAll('.candidate-choice-group,.candidate-choice-row')].some(el=>el.scrollWidth>el.clientWidth+1),name:style('.candidate-place-copy strong').fontSize,description:style('.candidate-description').fontSize,distance:style('.candidate-distance').fontSize,trash:document.querySelector('.candidate-choice-row>.ui-icon-button').getBoundingClientRect().height,photo:document.querySelector('.candidate-place-photo').getBoundingClientRect().width,broken:[...document.images].some(img=>img.complete&&!img.naturalWidth)};
      });
      assert.deepEqual(metrics,{overflow:false,name:'16px',description:'14px',distance:'12px',trash:44,photo:64,broken:false});
      await page.screenshot({path:path.join(output,`${width}-comparison.png`)});results.push({width,state:'photos-distance-features-missing-and-failure',metrics});
      assert.equal(await page.locator('.candidate-features small').filter({hasText:'바다 전망'}).count(),2);
      await page.getByText('사진 없는 음식점',{exact:true}).click();
      assert.equal(await page.locator('input[value="food-two"]').isChecked(),true);
      await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('button',{name:'후보 확인 열기'}).click();
      assert.equal(await page.locator('input[value="food-two"]').isChecked(),true);
      await page.reload();assert.equal(await page.locator('input[value="food-two"]').isChecked(),true);
      results.push({width,state:'one-tap-selection-close-reload'});
      await page.evaluate(()=>window.reviewCandidateFail=true);
      await page.locator('input[value="food-one"]').click();
      await page.getByRole('alert').waitFor();assert.equal(await page.locator('input[value="food-two"]').isChecked(),true);
      await page.evaluate(()=>window.reviewCandidateFail=false);
      await page.locator('input[value="stay-two"]').check();
      await page.screenshot({path:path.join(output,`${width}-selected-scrolled.png`)});
      await page.getByRole('button',{name:'내 여행 완성',exact:true}).click();
      await page.getByRole('dialog').waitFor({state:'hidden'});
      const confirmed=await page.evaluate(()=>window.reviewCandidates);
      assert.equal(confirmed.planStage,'READY');assert.equal(confirmed.businessCandidates.length,0);
      assert.deepEqual(confirmed.days[0].places.map(p=>p.id),['anchor','food-two','stay-two']);assert.equal(confirmed.days[1].places[0].id,'next');
      results.push({width,state:'failed-save-keeps-choice-confirm-only-chosen-candidates'});assert.deepEqual(errors,[]);await context.close();
    }
    for(const scenario of ['locked','empty','credit']){
      const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`${base}?scenario=${scenario}`);await page.getByRole('dialog').waitFor();
      if(scenario==='locked'){
        assert.equal(await page.locator('input[value="__keep__"]').isChecked(),true);assert.equal(await page.locator('input[value="stay-one"]').isDisabled(),true);assert.equal(await page.locator('input[value="stay-two"]').isDisabled(),true);
        assert.equal(await page.getByText('예약 고정 · 변경하지 않음',{exact:true}).count(),1);
        await page.locator('input[value="food-one"]').check();await page.getByRole('button',{name:'내 여행 완성',exact:true}).click();
        const confirmed=await page.evaluate(()=>window.reviewCandidates);assert.equal(confirmed.days[0].places.at(-1).id,'booked');assert.equal(confirmed.days[0].places.at(-1).bookingFixed,true);
      }else if(scenario==='empty'){
        assert.equal(await page.locator('.candidate-choice-group').count(),0);assert.equal(await page.getByRole('button',{name:'내 여행 완성',exact:true}).isEnabled(),true);
      }else{
        await page.getByRole('button',{name:'사진 출처',exact:true}).first().click();assert.equal(await page.getByRole('dialog').count(),1);await page.getByRole('heading',{name:'사진 출처',exact:true}).waitFor();
        await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();await page.getByRole('heading',{name:'여행 마지막 확인',exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),1);
        await page.evaluate(async()=>{const module=await import('/src/reviewServiceBridge.ts');const image=document.querySelector('.candidate-place-photo img').getAttribute('src');const state=module.emptyReviewServiceState();state.withdrawnImages=[image];localStorage.setItem(module.REVIEW_SERVICE_KEY,JSON.stringify(state));window.dispatchEvent(new Event(module.REVIEW_SERVICE_EVENT));});
        await page.locator('.candidate-option').first().locator('.candidate-place-photo img').waitFor({state:'detached'});
        assert.equal(await page.getByRole('button',{name:'사진 출처',exact:true}).count(),0);
      }
      await page.screenshot({path:path.join(output,`${scenario}.png`)});assert.deepEqual(errors,[]);results.push({width:390,state:scenario});await context.close();
    }
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({pass:true,states:results.length,results},null,2));console.log(JSON.stringify({pass:true,states:results.length,output}));
  }finally{await browser.close();}
}
run().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),String(error.stack));console.error(error);process.exitCode=1;});
