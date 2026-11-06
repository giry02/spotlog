/* Isolated browser QA only. No real account, admin record or customer browser is changed. */
const {chromium,expect}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const adminUrl=process.env.SPOTLOG_ADMIN_QA_URL||'http://127.0.0.1:5210/admin.html?mode=api';
const output=path.join(__dirname,process.env.SPOTLOG_ADMIN_QA_LABEL||'dev');
const seedPath=path.join(__dirname,'isolated-seed.json');
fs.mkdirSync(output,{recursive:true});
const results={url:adminUrl,date:'2026-10-17',checks:[],scenes:[],errors:[]};
const sentinels={
  'spotlog.admin.review.v1':JSON.stringify({marker:'protected-admin-json-20261017',role:'ADMIN'}),
  'spotlog.local.repository.v2':JSON.stringify({marker:'protected-private-trip-json-20261017'}),
  'spotlog.web.journeys.v4':JSON.stringify([{marker:'protected-legacy-private-trip-json-20261017'}]),
};
const html='<!doctype html><html><body><h1>PRIVATE_RAW_UPSTREAM_DIAGNOSTIC</h1><script>throw new Error("never execute API HTML");</script></body></html>';
const cases=[
  {id:'404-html',status:404,contentType:'text/html',body:html},
  {id:'503-html',status:503,contentType:'text/html',body:html},
  {id:'200-html',status:200,contentType:'text/html',body:html},
  {id:'200-malformed-json',status:200,contentType:'application/json',body:'{"bad":'},
  {id:'401-html',status:401,contentType:'text/html',body:html},
  {id:'403-html',status:403,contentType:'text/html',body:html},
  {id:'204-empty',status:204,contentType:'application/json',body:''},
  {id:'500-json',status:500,contentType:'application/json',body:JSON.stringify({error:{code:'SERVER_ERROR',message:'관리자 서버에서 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'}})},
];
function record(name,detail){results.checks.push({name,detail:detail??'pass'});fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));}
async function contextWithSentinels(browser,width){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(values=>{for(const [key,value]of Object.entries(values))localStorage.setItem(key,value);},sentinels);
  return context;
}
async function assertGated(page,label){
  await expect(page.getByText('관리자 연결 대기',{exact:true})).toBeVisible();
  const text=await page.locator('body').innerText();
  assert.ok(!/JSON|Unexpected token|PRIVATE_RAW_UPSTREAM_DIAGNOSTIC|<!doctype|<html/i.test(text),'technical parser or raw upstream HTML leaked');
  assert.ok((await page.locator('[role=alert]').innerText()).length>10,'actionable error message missing');
  record(label+': readable error, no JSON/parser/raw HTML');
  assert.equal(await page.getByRole('combobox',{name:'역할 전환',exact:true}).count(),0);
  assert.equal(await page.getByRole('combobox',{name:'작업자',exact:true}).count(),0);
  assert.equal(await page.locator('.admin-page-body:visible').count(),0);
  assert.equal(await page.locator('.admin-main input:visible,.admin-main textarea:visible').count(),0);
  assert.equal(await page.getByText('로컬',{exact:true}).count(),0);
  await expect(page.getByText('서비스',{exact:true})).toBeVisible();
  record(label+': authorized server state required; no local role/edit fallback');
  const stored=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(sentinels));
  assert.deepEqual(stored,sentinels);
  record(label+': private trip and admin sentinels preserved');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  await expect(page.getByRole('button',{name:'다시 연결',exact:true})).toBeEnabled();
  record(label+': retry available and no horizontal overflow');
  return text;
}
async function seed(browser){
  if(fs.existsSync(seedPath))return JSON.parse(fs.readFileSync(seedPath,'utf8'));
  assert.ok(/127\.0\.0\.1:5210/.test(adminUrl),'prepare isolated seed on the DEV server before release QA');
  const context=await browser.newContext(),page=await context.newPage();
  await page.goto('http://127.0.0.1:5210/admin.html',{waitUntil:'domcontentloaded'});
  await page.locator('.admin-page-body').waitFor();
  const value=await page.evaluate(()=>JSON.parse(localStorage.getItem('spotlog.admin.review.v1')));
  assert.ok(value?.places?.length>0,'valid local seed unavailable');
  fs.writeFileSync(seedPath,JSON.stringify(value));await context.close();return value;
}
async function failureCase(browser,snapshot,scenario,stage,width){
  const context=await contextWithSentinels(browser,width),page=await context.newPage(),requests=[],errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.route('**/api/admin/v1/**',async route=>{
    const url=new URL(route.request().url());requests.push({path:url.pathname,method:route.request().method()});
    if(stage==='snapshot'&&url.pathname.endsWith('/me'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({operatorId:'operator-admin',name:'QA server administrator',role:'ADMIN'})});
    return route.fulfill({status:scenario.status,contentType:scenario.contentType,body:scenario.body});
  });
  const label=`${width}-${stage}-${scenario.id}`;
  try{
    await page.goto(adminUrl,{waitUntil:'networkidle'});
    const body=await assertGated(page,label);
    const initialRequestCount=requests.length;
    assert.ok(initialRequestCount>0,'expected API request missing');
    if(stage==='session')assert.ok(requests.every(request=>request.path.endsWith('/me')),'failed authorization response must stop snapshot loading');
    else assert.ok(requests.some(request=>request.path.endsWith('/snapshot')),'snapshot failure scenario was not reached');
    assert.equal(requests.some(request=>request.method!=='GET'),false,'unexpected mutation');
    assert.deepEqual(errors,[],'uncaught browser exception');record(label+': requests stop safely with no mutation or JS exception');
    await page.getByRole('button',{name:'다시 연결',exact:true}).click();
    await assertGated(page,label+'-retry');
    assert.equal(requests.length-initialRequestCount,stage==='snapshot'?2:1,'retry should issue exactly one new authorized load attempt');
    if(width===1440&&stage==='session'||width===390&&scenario.id==='404-html')await page.screenshot({path:path.join(output,label+'.png'),fullPage:true,animations:'disabled'});
    results.scenes.push({label,body,requests,errors});
  }catch(error){await page.screenshot({path:path.join(output,label+'-FAILED.png'),fullPage:true}).catch(()=>{});throw error;}
  finally{await context.close();}
}
async function recovery(browser,snapshot){
  const context=await contextWithSentinels(browser,1440),page=await context.newPage();let fail=true;
  await page.route('**/api/admin/v1/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(fail)return route.fulfill({status:503,contentType:'text/html',body:html});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(pathname.endsWith('/me')?{operatorId:'operator-admin',name:'QA server administrator',role:'ADMIN'}:snapshot)});
  });
  await page.goto(adminUrl,{waitUntil:'domcontentloaded'});await assertGated(page,'recovery-failed');
  fail=false;await page.getByRole('button',{name:'다시 연결',exact:true}).click();
  await expect(page.locator('.admin-page-body').first()).toBeVisible();
  await expect(page.getByText('QA server administrator',{exact:true})).toBeVisible();
  assert.equal(await page.getByRole('combobox',{name:'역할 전환',exact:true}).count(),0);
  record('recovery: valid session plus validated snapshot enables API workspace');
  fail=true;await page.getByRole('button',{name:'새로 조회',exact:true}).click();
  await assertGated(page,'recovery-refresh-failed');
  assert.equal(await page.locator('.admin-page-body:visible').count(),0);
  record('recovery: subsequent failed authorization reload hides old editing');
  await page.screenshot({path:path.join(output,'refresh-failed-gate.png'),animations:'disabled'});await context.close();
}
async function actualPublic(browser){
  if(!adminUrl.startsWith('https://giry02.github.io/'))return;
  const context=await contextWithSentinels(browser,1440),page=await context.newPage(),responses=[];
  page.on('response',response=>{if(response.url().includes('/api/admin/v1/'))responses.push({url:response.url(),status:response.status(),type:response.headers()['content-type']});});
  const url=new URL(adminUrl);url.search='?mode=local';await page.goto(url.href,{waitUntil:'networkidle'});
  const body=await assertGated(page,'actual-public');
  assert.ok(responses.some(response=>response.status===404),'actual static hosting API absence should remain visible');
  await page.screenshot({path:path.join(output,'actual-public.png'),fullPage:true});
  results.scenes.push({label:'actual-public',body,responses});record('actual-public: static Pages has no admin API; clear connection failure, no fake local permissions');
  await context.close();
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const snapshot=await seed(browser);for(const scenario of cases){await failureCase(browser,snapshot,scenario,'session',1440);await failureCase(browser,snapshot,scenario,'snapshot',1440);}for(const scenario of cases.slice(0,6))await failureCase(browser,snapshot,scenario,'session',390);await recovery(browser,snapshot);await actualPublic(browser);record('complete',{scenes:results.scenes.length,checks:results.checks.length+1});console.log(JSON.stringify({checks:results.checks.length,scenes:results.scenes.length,output}));}catch(error){results.errors.push(String(error.stack||error));console.error(error);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));await browser.close();}})();
