const {chromium}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:5210',out=__dirname;
const dist='C:/Users/Giry/Documents/Spotlog/web/dist';
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const asset=html.match(/assets\/(customer-[^"/]+\.js)/)?.[1];
assert.ok(asset && asset!=='customer-DsVIEWVM.js','new production bundle required');
const code=fs.readFileSync(path.join(dist,'assets',asset),'utf8');
assert.equal(code.includes('demo@spotlog.test'),false,'no DEV review identity in production');
assert.equal(code.includes('SpotlogDemo123!'),false,'no DEV review password in production');
const names=['카카오','네이버','Google','Apple','이메일'];
const results=[],errors=[];
const record=(name,width)=>{results.push({name,width});console.log(name+' '+width);};
async function inspect(page,width,state){
 assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+1),false);
 assert.ok(await page.getByRole('dialog').count()<=1);
 assert.equal((await page.locator('body').innerText()).includes('검수 계정'),false);
 assert.equal(await page.locator('.member-account-card').count(),0);
 await page.screenshot({path:path.join(out,width+'-prod-'+state+'.png')});record(state,width);
}
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 for(const width of[320,390,460]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{sessionStorage.setItem('spotlog.review.account.session.v1','signed');localStorage.setItem('spotlog.admin.qa-sentinel','administrator data must remain');});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  const requests=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.url());});
  await page.goto(base+'/spotlog/#profile');await page.locator('.guest-profile-card').waitFor();
  assert.ok(await page.locator('script[src*="'+asset+'"]').count());
  await inspect(page,width,'guest-ignores-dev-session');
  await page.locator('.guest-profile-card').getByRole('button',{name:'로그인',exact:true}).click();
  for(const name of names)assert.equal(await page.getByRole('dialog').getByRole('button',{name:new RegExp(name+'.*로그인')}).count(),1);
  await inspect(page,width,'five-login-methods');
  await page.getByRole('button',{name:'이메일로 로그인',exact:true}).click();
  assert.equal(await page.getByLabel('이메일',{exact:true}).inputValue(),'');
  assert.equal(await page.getByLabel('비밀번호',{exact:true}).inputValue(),'');
  await page.getByLabel('이메일',{exact:true}).fill('qa@example.invalid');await page.getByLabel('비밀번호',{exact:true}).fill('correct-password');
  assert.equal(await page.getByRole('button',{name:'이메일로 로그인',exact:true}).isDisabled(),true);
  await inspect(page,width,'unconfigured-email-login');
  await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.locator('.guest-profile-card').getByRole('button',{name:'회원가입',exact:true}).click();
  for(const name of names)assert.equal(await page.getByRole('dialog').getByRole('button',{name:new RegExp(name+'.*회원가입')}).count(),1);
  await inspect(page,width,'five-signup-methods');
  for(const name of names.slice(0,4)){
   await page.getByRole('dialog').getByRole('button',{name:new RegExp(name+'.*회원가입')}).click();
   await page.locator('.account-social-notice').waitFor();
   assert.equal(await page.getByRole('dialog').getByRole('heading',{name:name+' 회원가입',exact:true}).count(),1);
   assert.equal(await page.locator('.signup-consent-list').count(),0);
   await page.getByRole('button',{name:'다른 방식 선택',exact:true}).click();
  }
  record('unconfigured-four-social-signups-never-authenticate',width);
  await page.getByRole('button',{name:'이메일로 회원가입',exact:true}).click();
  await page.getByRole('button',{name:'필수 항목만 동의'}).click();await page.getByRole('button',{name:'동의하고 다음'}).click();
  await page.getByLabel('활동 이름',{exact:true}).fill('미연결 확인');await page.getByLabel('이메일',{exact:true}).fill('qa@example.invalid');
  await page.locator('input[type=password]').first().fill('correct-password');await page.getByLabel('비밀번호 확인',{exact:true}).fill('correct-password');
  assert.equal(await page.getByRole('button',{name:'인증번호 받기',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'인증하고 가입하기'}).isDisabled(),true);
  await inspect(page,width,'unconfigured-email-signup');
  assert.equal(requests.length,0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('spotlog.admin.qa-sentinel')),'administrator data must remain');
  await context.close();
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'prod-results.json'),JSON.stringify({passed:true,asset,states:results.length,results,errors,reviewCredentialsExcluded:true,realAuthenticationConnected:false},null,2));
 console.log(JSON.stringify({passed:true,asset,states:results.length,errors}));
 }finally{await browser.close();}
}
main().catch(e=>{fs.writeFileSync(path.join(out,'prod-failure.txt'),String(e.stack));console.error(e);process.exitCode=1;});
