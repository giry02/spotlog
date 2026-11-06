const {chromium}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:5210',out=__dirname;
const cases=[['validation',400,'','요청을 확인해 주세요'],['session',401,'','로그인이 필요해요'],['conditions',402,'','이용 조건을 확인해 주세요'],['forbidden',403,'','접근할 수 없는 페이지예요'],['missing',404,'','페이지를 찾을 수 없어요'],['limit',429,'','잠시 후 다시 시도해 주세요'],['server',500,'','잠시 문제가 생겼어요'],['gateway',502,'','연결된 서비스의 응답을 받지 못했어요'],['unavailable',503,'','서비스를 잠시 이용할 수 없어요'],['timeout',504,'','응답이 늦어지고 있어요'],['network',0,'','인터넷 연결을 확인해 주세요']];
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
 const inspect=async(p,width,state)=>{
  await p.locator('.error-page, .error-review-page').waitFor();await p.waitForTimeout(60);
  assert.equal(await p.locator('.tabbar').count(),0,state+' tabbar');
  const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth||[...document.querySelectorAll('.error-page,.error-page-actions')].some(el=>el.scrollWidth>el.clientWidth+2));assert.equal(overflow,false,state+' overflow');
  if(await p.locator('.error-page').count()){
   const text=await p.locator('.error-page').innerText();assert.ok(!/\b(?:400|401|402|403|404|429|500|502|503|504)\b/.test(text),state+' visible HTTP code');assert.ok(!text.includes('fixture-private-error'));
   const actions=await p.locator('.error-page-actions button').evaluateAll(bs=>bs.map(b=>({height:b.getBoundingClientRect().height,font:parseFloat(getComputedStyle(b).fontSize),label:b.textContent.trim()})));assert.ok(actions.every(b=>b.height>=44&&b.font>=14&&b.label),JSON.stringify(actions));
   const fonts=await p.locator('.error-page-body>p').evaluateAll(ps=>ps.map(p=>parseFloat(getComputedStyle(p).fontSize)));assert.ok(fonts.every(f=>f>=14));
  }
  results.push({width,state});await p.screenshot({path:path.join(out,width+'-'+state+'.png')});
 };
 try{
  for(const width of [320,390,460]){
   const c=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),p=await c.newPage();let apiRequests=0;p.on('pageerror',e=>errors.push(String(e)));p.on('request',r=>{if(r.url().includes('/api/'))apiRequests++;});
   for(const [type,code,_unused,title]of cases){await p.goto(base+'/error.html?type='+type+'&lang=ko');await p.getByRole('heading',{name:title,exact:true}).waitFor();await inspect(p,width,type);assert.ok((await p.title()).includes(title));if(code===401){await p.getByRole('button',{name:'로그인하기',exact:true}).click();await p.getByRole('heading',{name:'로그인',exact:true}).waitFor();assert.equal(await p.locator('[role=dialog]').count(),1);await p.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('[role=dialog]')&&!window.history.state?.spotlogSheet);}}
   assert.equal(apiRequests,0);await c.close();
  }
  const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(base+'/#profile');await p.locator('.guest-profile-card').waitFor();const records=await p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('spotlog.')).map(k=>[k,localStorage.getItem(k)])));
  for(const [hash,title]of [['unknown-screen','페이지를 찾을 수 없어요'],['%E0%A4%A','요청을 확인해 주세요'],['journey-does-not-exist','페이지를 찾을 수 없어요'],['recommendation-does-not-exist','페이지를 찾을 수 없어요'],['edit-does-not-exist','페이지를 찾을 수 없어요'],['journey-','페이지를 찾을 수 없어요']]){await p.goto(base+'/#'+hash);await p.getByRole('heading',{name:title,exact:true}).waitFor();await inspect(p,390,'route-'+hash.replace(/%/g,'x'));}
  await p.getByRole('button',{name:'홈으로 가기',exact:true}).click();await p.waitForURL('**/#home');await p.locator('.tabbar').waitFor();
  const after=await p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('spotlog.')).map(k=>[k,localStorage.getItem(k)])));assert.deepEqual(after,records,'device records changed');
  await p.goto(base+'/#errors');await p.getByRole('heading',{name:'오류 화면',exact:true}).waitFor();await inspect(p,390,'local-catalog');await p.getByRole('button',{name:'이용 조건 확인',exact:true}).click();await p.getByRole('heading',{name:'이용 조건을 확인해 주세요',exact:true}).waitFor();await p.getByRole('button',{name:'이전 화면으로',exact:true}).click();await p.getByRole('heading',{name:'오류 화면',exact:true}).waitFor();
  await p.goto(base+'/error.html?type=validation&lang=ko');await p.getByRole('button',{name:'이전 화면으로',exact:true}).click();await p.waitForURL('**/#home');
  await p.goto(base+'/error.html?type=unavailable&lang=ko');await p.getByRole('button',{name:'다시 시도',exact:true}).click();await p.getByRole('heading',{name:'서비스를 잠시 이용할 수 없어요',exact:true}).waitFor();assert.ok(p.url().includes('type=unavailable'));
  await p.goto(base+'/404.html?type=server');await p.getByRole('heading',{name:'페이지를 찾을 수 없어요',exact:true}).waitFor();await inspect(p,390,'not-found-file');await p.getByRole('button',{name:'홈으로 가기',exact:true}).click();await p.waitForURL('**/#home');
  await p.goto(base+'/tests/account-state.html?scenario=session-fail#profile');await p.getByRole('heading',{name:'서비스를 잠시 이용할 수 없어요',exact:true}).waitFor();assert.equal(await p.locator('.error-page--inline').count(),1);await inspect(p,390,'account-session-failure');await p.getByRole('button',{name:'다시 시도',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('.error-page'));await p.locator('.guest-profile-card').waitFor();
  await p.setViewportSize({width:320,height:568});await p.goto(base+'/error.html?type=server&lang=ko');await inspect(p,320,'short-server');
  await p.setViewportSize({width:1280,height:900});await p.goto(base+'/error.html?type=forbidden&lang=ko');await inspect(p,1280,'desktop-forbidden');assert.ok(await p.locator('.app-shell').evaluate(e=>e.getBoundingClientRect().width<=460));
  assert.deepEqual(errors,[]);await c.close();
  const f=await browser.newContext({viewport:{width:390,height:844}}),fp=await f.newPage();let renderFailureSeen=false;fp.on('pageerror',e=>{assert.ok(String(e).includes('fixture-private-error'));renderFailureSeen=true;});await fp.goto(base+'/tests/error-pages.html');await fp.getByRole('button',{name:'화면 오류 검수',exact:true}).click();await fp.getByRole('heading',{name:'잠시 문제가 생겼어요',exact:true}).waitFor();assert.ok(!(await fp.locator('body').innerText()).includes('fixture-private-error'));await fp.getByRole('button',{name:'실패 원인 제거',exact:true}).click();await fp.getByRole('button',{name:'다시 시도',exact:true}).click();await fp.getByText('검수 화면 복구 완료', {exact:true}).waitFor();results.push({width:390,state:'render-boundary-recovery',renderFailureSeen});await f.close();
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,states:results.length,results,errors},null,2));fs.rmSync(path.join(out,'failure.txt'),{force:true});process.stdout.write('Passed '+results.length+' error-page states\n');
 }catch(e){fs.writeFileSync(path.join(out,'failure.txt'),String(e.stack));throw e;}finally{await browser.close();}
}
main().catch(e=>{process.stderr.write(String(e.stack));process.exit(1);});
