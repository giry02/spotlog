const {chromium}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const base='https://giry02.github.io/spotlog/',out=__dirname,errors=[],assetFailures=[],results=[];
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [320,390,460]){
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
   page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.url().startsWith(base+'assets/')&&r.status()>=400)assetFailures.push({url:r.url(),status:r.status()});});
   for(const route of ['home','community','places-photo','trips','saved','profile']){
    await page.goto(base+'#'+route);try{await (route==='profile'?page.getByRole('heading',{name:'로그인하고 여행을 이어가세요',exact:true}):page.locator('.tabbar')).waitFor({state:'visible'});}catch(error){await page.screenshot({path:path.join(out,'failure-'+width+'-'+route+'.png')});throw new Error('Route '+route+' width '+width+' '+await page.locator('body').innerText()+' '+error.message);}
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Viewport overflow '+route+' '+width);
    const broken=await page.locator('img').evaluateAll(images=>images.filter(img=>img.complete&&!img.naturalWidth&&img.getBoundingClientRect().width>0).map(img=>img.src));assert.deepEqual(broken,[]);
    results.push({width,route});
   }
   await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('button',{name:'이메일로 로그인',exact:true}).waitFor();
   const email=page.locator('input[type=email]'),password=page.locator('input[type=password]');
   assert.equal(await email.inputValue(),'');assert.equal(await password.inputValue(),'');assert.equal(await page.locator('.account-review-notice').count(),0);
   await email.fill('public-review@example.test');await password.fill('ExampleReviewOnly123!');
   for(const provider of ['Google','Apple']){
    await page.getByRole('button',{name:provider+'로 로그인',exact:true}).click();await page.locator('.account-social-notice').waitFor();
    assert.equal(await email.inputValue(),'public-review@example.test');assert.equal(await password.inputValue(),'ExampleReviewOnly123!');
    assert.equal(await page.getByRole('button',{name:'이메일로 로그인',exact:true}).count(),1);assert.equal(await page.locator('.signup-policy-step').count(),0);
   }
   assert.ok(await page.getByRole('button',{name:'이메일로 로그인',exact:true}).isDisabled());
   await page.screenshot({path:path.join(out,'public-login-'+width+'.png')});results.push({width,route:'production-login-no-demo-social-retains-fields'});await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  for(const type of ['validation','session','conditions','forbidden','missing','server','unavailable']){
   const response=await page.goto(base+'error.html?type='+type+'&lang=ko');assert.equal(response.status(),200);await page.locator('.error-page').waitFor();assert.ok(!/\b(?:400|401|402|403|404|500|503)\b/.test(await page.locator('.error-page').innerText()));results.push({type});
  }
  const missing=await page.goto(base+'release-check/missing?type=server');assert.equal(missing.status(),404);await page.getByRole('heading',{name:'페이지를 찾을 수 없어요',exact:true}).waitFor();await page.getByRole('button',{name:'홈으로 가기',exact:true}).click();await page.waitForURL(base+'#home');results.push({type:'host-404-base-home'});
  assert.deepEqual(errors,[]);assert.deepEqual(assetFailures,[]);await context.close();fs.writeFileSync(path.join(out,'live-results.json'),JSON.stringify({passed:true,states:results.length,results,errors,assetFailures},null,2));process.stdout.write('Passed '+results.length+' live customer states\n');
 }finally{await browser.close();}
}
main().catch(e=>{fs.writeFileSync(path.join(__dirname,'live-failure.txt'),String(e.stack));process.stderr.write(String(e.stack));process.exit(1);});
