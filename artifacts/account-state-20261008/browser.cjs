const {chromium}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:5210',out=__dirname;
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
 const inspect=async(page,width,state)=>{assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+1),false,state+' overflow');assert.ok(await page.getByRole('dialog').count()<=1,state+' duplicate dialogs');await page.screenshot({path:path.join(out,width+'-'+state+'.png')});results.push({width,state});};
 const close=async page=>{await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});};
 const fillSignup=async page=>{await page.getByLabel('활동 이름',{exact:true}).fill('검수 여행자');await page.getByLabel('이메일',{exact:true}).fill('qa@example.invalid');await page.locator('input[type=password]').first().fill('correct-password');await page.getByLabel('비밀번호 확인',{exact:true}).fill('correct-password');await page.getByRole('button',{name:'필수 항목만 동의'}).click();};
 try{
 for(const width of [320,390,460]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{window.__gps=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__gps++;},watchPosition(){throw new Error('background GPS');}}});});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));let accountRequests=0;page.on('request',r=>{if(r.url().includes('/api/account'))accountRequests++;});
  await page.goto(base+'/#profile');await page.locator('.guest-profile-card').waitFor();
  assert.equal(await page.locator('.creator-stats,.creator-level-card,.profile-avatar-upload').count(),0);
  assert.ok(!(await page.locator('.profile-page').innerText()).includes('새싹'));assert.equal(await page.getByRole('button',{name:'로그인',exact:true}).count(),1);await inspect(page,width,'guest-profile');
  const original=await page.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2'));
  await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('heading',{name:'로그인',exact:true}).waitFor();
  assert.equal(await page.locator('input[type=password]').count(),1);assert.equal(await page.locator('.social-login-buttons button').count(),2);assert.equal(await page.getByRole('button',{name:'이메일로 로그인'}).isDisabled(),true);await inspect(page,width,'email-login');
  const roles=await page.locator('.account-email-form input').evaluateAll(el=>el.map(e=>parseFloat(getComputedStyle(e).fontSize)));assert.ok(roles.every(n=>n>=16));
  await page.getByRole('dialog').getByRole('button',{name:'이메일 회원가입',exact:true}).click();await fillSignup(page);assert.equal(await page.locator('input[name=marketing]').isChecked(),false);assert.equal(await page.getByRole('button',{name:'동의하고 인증번호 받기'}).isDisabled(),true);
  await page.getByLabel('비밀번호 확인',{exact:true}).fill('different-password');await page.getByText('비밀번호가 서로 달라요.').waitFor();await page.getByLabel('비밀번호 확인',{exact:true}).fill('correct-password');
  await page.getByRole('button',{name:'서비스 이용약관 보기',exact:true}).click();await page.getByRole('heading',{name:'서비스 이용약관',exact:true}).waitFor();assert.equal(await page.locator('.policy-section p').first().evaluate(e=>getComputedStyle(e).fontSize),'16px');await inspect(page,width,'terms');
  await page.getByRole('button',{name:'상세 닫기',exact:true}).click();assert.equal(await page.getByLabel('활동 이름',{exact:true}).inputValue(),'검수 여행자');assert.equal(await page.locator('input[name=terms]').isChecked(),true);await inspect(page,width,'email-signup');await close(page);
  await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('button',{name:'비밀번호 찾기'}).click();await page.getByLabel('이메일',{exact:true}).fill('qa@example.invalid');assert.equal(await page.getByRole('button',{name:'재설정 안내 받기'}).isDisabled(),true);await inspect(page,width,'password-help');await close(page);
  await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('button',{name:'Apple로 계속하기'}).click();await page.getByRole('button',{name:'필수 항목만 동의'}).click();assert.equal(await page.getByRole('button',{name:'동의하고 가입하기'}).isDisabled(),true);await inspect(page,width,'social-consent');await close(page);
  await page.getByRole('button',{name:'약관 · 개인정보'}).click();await page.getByRole('button',{name:'내 위치 동의 화면 보기'}).click();await page.getByRole('checkbox').check();assert.equal(await page.getByRole('button',{name:'현재 위치 사용'}).isDisabled(),true);await inspect(page,width,'location-preview');await close(page);
  assert.equal(await page.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2')),original);assert.equal(await page.evaluate(()=>window.__gps),0);assert.equal(accountRequests,0);
  await page.getByRole('button',{name:'기기 기록 보기'}).click();await page.getByText('로그인하지 않아도 초안을 만들 수 있어요.',{exact:false}).waitFor();await inspect(page,width,'guest-device-records');
  await context.close();

  const fixtureContext=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});const f=await fixtureContext.newPage();f.on('pageerror',e=>errors.push(String(e)));
  await f.goto(base+'/tests/account-state.html'+(width===390?'?scenario=signup-fail':'')+'#profile');await f.locator('.guest-profile-card').waitFor();await f.getByRole('button',{name:'이메일 회원가입',exact:true}).click();await f.getByLabel('활동 이름',{exact:true}).waitFor();
  await fillSignup(f);assert.equal(await f.getByRole('button',{name:'동의하고 인증번호 받기'}).isEnabled(),true);await f.locator('input[name=terms]').uncheck();assert.equal(await f.getByRole('button',{name:'동의하고 인증번호 받기'}).isDisabled(),true);await f.locator('input[name=terms]').check();
  await f.getByRole('button',{name:'동의하고 인증번호 받기'}).click();
  if(width===390){await f.getByRole('alert').waitFor();assert.equal(await f.getByLabel('활동 이름',{exact:true}).inputValue(),'검수 여행자');assert.equal(await f.locator('input[name=terms]').isChecked(),true);await inspect(f,width,'signup-failure-preserves-input');await f.getByRole('button',{name:'동의하고 인증번호 받기'}).click();}
  await f.getByRole('heading',{name:'이메일 인증',exact:true}).waitFor();assert.equal(await f.locator('.member-account-card').count(),0);assert.equal(await f.getByRole('button',{name:'인증하고 시작하기'}).isDisabled(),true);
  await f.getByLabel('인증번호',{exact:true}).fill('000000');await f.getByRole('button',{name:'인증하고 시작하기'}).click();await f.getByRole('alert').waitFor();assert.equal(await f.locator('.member-account-card').count(),0);
  await f.getByRole('button',{name:'인증번호 다시 받기'}).click();await f.getByText('인증번호를 다시 보냈어요. 최신 번호를 확인하세요.').waitFor();await inspect(f,width,'email-verification');
  await f.getByLabel('인증번호',{exact:true}).fill('123456');await f.getByRole('button',{name:'인증하고 시작하기'}).click();await f.locator('.account-identity').waitFor();await close(f);
  await f.getByRole('heading',{name:'인증된 검수 회원',exact:true}).waitFor();assert.equal(await f.getByRole('button',{name:'로그인',exact:true}).count(),0);assert.equal(await f.locator('.device-profile-preview').getAttribute('open'),null);await inspect(f,width,'member-profile');
  const recordBeforeLogout=await f.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2'));await f.getByRole('button',{name:'계정 관리 · 로그아웃'}).click();await f.getByRole('button',{name:'로그아웃',exact:true}).click();await f.getByRole('heading',{name:'로그인',exact:true}).waitFor();await close(f);await f.locator('.guest-profile-card').waitFor();assert.equal(await f.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2')),recordBeforeLogout);await inspect(f,width,'logout-profile');
  await fixtureContext.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(base+'/tests/account-state.html?scenario=session-fail#profile');await p.getByRole('alert').waitFor();assert.equal(await p.locator('.member-account-card').count(),0);await p.getByRole('button',{name:'다시 확인',exact:true}).click();await p.getByRole('alert').waitFor({state:'hidden'});await inspect(p,390,'session-failure-retry');
 await p.getByRole('button',{name:'로그인',exact:true}).click();await p.getByLabel('이메일',{exact:true}).fill('qa@example.invalid');await p.getByLabel('비밀번호',{exact:true}).fill('wrong-password');await p.getByRole('button',{name:'이메일로 로그인'}).click();await p.getByRole('alert').waitFor();assert.equal(await p.locator('.member-account-card').count(),0);assert.equal(await p.getByLabel('이메일',{exact:true}).inputValue(),'qa@example.invalid');
 await p.getByLabel('비밀번호',{exact:true}).fill('correct-password');await p.getByRole('button',{name:'이메일로 로그인'}).click();await p.locator('.account-identity').waitFor();await close(p);await inspect(p,390,'email-login-retry');
 await p.goto(base+'/tests/account-state.html?scenario=expired#profile');await p.locator('.member-account-card').waitFor();await p.getByRole('button',{name:'계정 관리 · 로그아웃'}).click();await p.getByRole('button',{name:'로그아웃',exact:true}).click();await p.getByText('로그인이 만료됐어요.',{exact:false}).waitFor();await close(p);await p.locator('.guest-profile-card').waitFor();await inspect(p,390,'expired-session');
 await context.close();

 const socialContext=await browser.newContext({viewport:{width:390,height:844}}),s=await socialContext.newPage();s.on('pageerror',e=>errors.push(String(e)));
 await s.goto(base+'/#home');await s.locator('.promoted-trip button').first().waitFor();await s.locator('.promoted-trip button').first().click();await s.locator('.journey-social').waitFor();const socialBefore=await s.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2'));
 await s.getByLabel('댓글 작성',{exact:true}).fill('로그인 뒤에도 유지할 댓글');await s.locator('.comment-composer button').click();await s.getByRole('heading',{name:'로그인',exact:true}).waitFor();await inspect(s,390,'guest-comment-login');await close(s);assert.equal(await s.getByLabel('댓글 작성',{exact:true}).inputValue(),'로그인 뒤에도 유지할 댓글');assert.equal(await s.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2')),socialBefore);
 await s.locator('.quick-cheers button').first().click();await s.getByRole('heading',{name:'로그인',exact:true}).waitFor();await close(s);assert.equal(await s.locator('.quick-cheers button[aria-pressed=true]').count(),0);
 await s.locator('.card-social').first().getByRole('button',{name:/댓글/}).click();await s.getByPlaceholder('이 장소에 대한 이야기를 남겨주세요.').fill('장소 카드 초안 유지');await s.getByRole('button',{name:'댓글 등록',exact:true}).click();await s.getByRole('heading',{name:'로그인',exact:true}).waitFor();await inspect(s,390,'card-comment-login-handoff');await close(s);
 await s.locator('.card-social').first().getByRole('button',{name:/댓글/}).click();assert.equal(await s.getByPlaceholder('이 장소에 대한 이야기를 남겨주세요.').inputValue(),'장소 카드 초안 유지');await close(s);await socialContext.close();
 const oauthContext=await browser.newContext({viewport:{width:390,height:844}}),o=await oauthContext.newPage();o.on('pageerror',e=>errors.push(String(e)));await o.goto(base+'/tests/frontend-completion.html');
 for(const label of ['가입 동의','가입 재시도','약관 변경']){
  await o.getByRole('button',{name:label,exact:true}).click();await o.getByRole('button',{name:'필수 항목만 동의'}).click();await o.getByRole('button',{name:'동의하고 가입하기'}).click();
  if(label!=='가입 동의'){await o.getByRole('alert').waitFor();assert.equal(await o.locator('input[name=terms]').isChecked(),label==='가입 재시도');if(label==='약관 변경'){await o.getByRole('button',{name:'계정 다시 확인'}).click();await o.getByRole('button',{name:'필수 항목만 동의'}).click();}await o.getByRole('button',{name:'동의하고 가입하기'}).click();}
  await o.getByRole('heading',{name:'내 계정',exact:true}).waitFor();await inspect(o,390,'social-'+label);await close(o);
 }
 await o.getByRole('button',{name:'계정 실패',exact:true}).click();await o.getByRole('button',{name:'Google로 계속하기'}).click();await o.getByRole('alert').waitFor();assert.equal(await o.locator('.account-identity').count(),0);await inspect(o,390,'oauth-failure');await close(o);await oauthContext.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,states:results.length,results,errors},null,2));if(fs.existsSync(path.join(out,'failure.txt')))fs.unlinkSync(path.join(out,'failure.txt'));console.log(JSON.stringify({passed:true,states:results.length,errors}));
 }finally{await browser.close();}
}
main().catch(e=>{fs.writeFileSync(path.join(out,'failure.txt'),String(e.stack));console.error(e);process.exitCode=1;});
