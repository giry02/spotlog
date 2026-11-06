const {chromium}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const out=__dirname;
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];const errors=[];
 try{
  for(const width of [320,390,460]){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
   await context.addInitScript(()=>{window.__gps=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__gps++;},watchPosition(){throw new Error('background GPS');}},configurable:true});});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));let requests=0;page.on('request',r=>{if(r.url().includes('/api/account'))requests++;});
   const verify=async name=>{const overflow=await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)>innerWidth+1);assert.equal(overflow,false,name+' overflow');await page.screenshot({path:path.join(out,`${width}-${name}.png`)});results.push({width,state:name});};
   await page.goto('http://127.0.0.1:5210/#home');await page.getByRole('button',{name:'프로필',exact:true}).click();
   const storageBefore=await page.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2'));
   await page.getByRole('button',{name:'계정 · 로그인',exact:true}).click();await page.getByRole('heading',{name:'로그인 · 회원가입',exact:true}).waitFor();
   assert.equal(await page.locator('.social-login-buttons button').count(),2);assert.equal(await page.locator('input[type=password]').count(),0);
   const dimensions=await page.locator('.social-login-buttons button').evaluateAll(bs=>bs.map(b=>({height:b.getBoundingClientRect().height,font:parseFloat(getComputedStyle(b).fontSize)})));
   assert.ok(dimensions.every(b=>b.height>=44&&b.font>=14));await verify('login');
   await page.getByRole('button',{name:'Google로 계속하기'}).click();await page.getByRole('button',{name:'필수 항목만 동의'}).click();
   for(const name of ['age','terms','collection'])assert.equal(await page.locator(`input[name=${name}]`).isChecked(),true);
   assert.equal(await page.locator('input[name=marketing]').isChecked(),false);assert.equal(await page.getByRole('button',{name:'동의하고 가입하기'}).isDisabled(),true);
   await page.locator('input[name=marketing]').check();await page.getByRole('button',{name:'서비스 이용약관 보기',exact:true}).click();await page.getByRole('heading',{name:'서비스 이용약관',exact:true}).waitFor();
   assert.equal(await page.getByRole('dialog').count(),1);const font=await page.locator('.policy-section p').first().evaluate(p=>getComputedStyle(p).fontSize);assert.equal(font,'16px');await verify('terms');
   await page.getByRole('button',{name:'상세 닫기',exact:true}).click();assert.equal(await page.locator('input[name=marketing]').isChecked(),true);
   await page.getByRole('button',{name:'필수 항목만 동의'}).click();assert.equal(await page.locator('input[name=marketing]').isChecked(),false);await verify('consent');
   await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
   await page.getByRole('button',{name:'계정 · 로그인',exact:true}).click();await page.getByRole('button',{name:'Apple로 계속하기'}).click();assert.equal(await page.locator('.signup-provider-summary strong').textContent(),'Apple로 가입');await verify('apple-consent');
   await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
   await page.getByRole('button',{name:'약관 · 개인정보',exact:true}).click();await page.getByRole('heading',{name:'약관 · 개인정보',exact:true}).waitFor();await verify('privacy');
   for(const title of ['서비스 이용약관','개인정보 처리방침','개인정보 수집·이용 동의','위치기반서비스 이용약관','혜택·소식 수신 동의']){
    await page.getByRole('button',{name:title+' 보기',exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.ok(await page.locator('.policy-section').count()>2);await page.getByRole('button',{name:'상세 닫기',exact:true}).click();
   }
   await page.getByRole('button',{name:'내 위치 동의 화면 보기'}).click();await page.getByRole('checkbox').check();assert.equal(await page.getByRole('button',{name:'현재 위치 사용'}).isDisabled(),true);await verify('location');
   await page.getByRole('button',{name:'위치기반서비스 이용약관 보기',exact:true}).click();await page.getByRole('heading',{name:'위치기반서비스 이용약관',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('heading',{name:'내 위치 이용 안내',exact:true}).waitFor();assert.equal(await page.getByRole('checkbox').isChecked(),true);
   await page.getByRole('button',{name:'위치 없이 돌아가기'}).click();await page.getByRole('heading',{name:'약관 · 개인정보',exact:true}).waitFor();
   await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>window.__gps),0);assert.equal(requests,0);assert.equal(await page.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2')),storageBefore);
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:5210/tests/frontend-completion.html');
  const close=async()=>{await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});};
  await page.getByRole('button',{name:'가입 동의',exact:true}).click();await page.getByRole('button',{name:'필수 항목만 동의'}).waitFor();assert.equal(await page.getByRole('button',{name:'동의하고 가입하기'}).isDisabled(),true);
  await page.getByRole('button',{name:'필수 항목만 동의'}).click();assert.equal(await page.getByRole('button',{name:'동의하고 가입하기'}).isEnabled(),true);await page.locator('input[name=terms]').uncheck();assert.equal(await page.getByRole('button',{name:'동의하고 가입하기'}).isDisabled(),true);await page.locator('input[name=terms]').check();await page.getByRole('button',{name:'동의하고 가입하기'}).click();await page.getByRole('heading',{name:'내 계정',exact:true}).waitFor();assert.match(await page.locator('.account-identity').textContent(),/이메일 미제공/);await close();results.push({state:'fixture-required-consent-and-signup'});
  await page.getByRole('button',{name:'가입 재시도',exact:true}).click();await page.getByRole('button',{name:'필수 항목만 동의'}).click();await page.getByRole('button',{name:'동의하고 가입하기'}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('input[name=terms]').isChecked(),true);assert.equal(await page.locator('input[name=marketing]').isChecked(),false);await page.getByRole('button',{name:'동의하고 가입하기'}).click();await page.getByRole('heading',{name:'내 계정',exact:true}).waitFor();await close();results.push({state:'fixture-signup-failure-retry'});
  await page.getByRole('button',{name:'약관 변경',exact:true}).click();await page.getByRole('button',{name:'필수 항목만 동의'}).click();await page.getByRole('button',{name:'동의하고 가입하기'}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('input[name=terms]').isChecked(),false);assert.equal(await page.getByRole('button',{name:'동의하고 가입하기'}).isDisabled(),true);await page.getByRole('button',{name:'계정 다시 확인'}).click();await page.getByRole('button',{name:'필수 항목만 동의'}).click();await page.getByRole('button',{name:'동의하고 가입하기'}).click();await page.getByRole('heading',{name:'내 계정',exact:true}).waitFor();await close();results.push({state:'fixture-policy-conflict-reconsent'});
  await page.getByRole('button',{name:'계정 실패',exact:true}).click();await page.getByRole('button',{name:'Google로 계속하기'}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('heading',{name:'로그인 · 회원가입',exact:true}).count(),1);await close();results.push({state:'fixture-oauth-failure'});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,states:results.length,errors}));await context.close();
 }finally{await browser.close();}
}
main().catch(e=>{fs.writeFileSync(path.join(out,'failure.txt'),String(e.stack));console.error(e);process.exitCode=1;});
