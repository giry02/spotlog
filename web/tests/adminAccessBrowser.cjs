const {chromium,expect}=require(process.env.SPOTLOG_PLAYWRIGHT||'C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.SPOTLOG_ADMIN_URL||'http://127.0.0.1:5210',out=process.env.SPOTLOG_ADMIN_QA_DIR||'C:/Users/Giry/Documents/Spotlog/artifacts/admin-recheck-20261010/access';
fs.mkdirSync(out,{recursive:true});
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true}),checks=[],errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/admin.html');await expect(page.getByRole('heading',{name:'오늘의 운영 작업',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:850});const opener=page.getByRole('button',{name:'관리자 메뉴 열기',exact:true});await opener.focus();await page.keyboard.press('Enter');const closeMenu=page.locator('.admin-sidebar').getByRole('button',{name:'메뉴 닫기',exact:true});await expect(closeMenu).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.getByRole('link',{name:'고객 화면 열기'})).toBeFocused();await page.keyboard.press('Tab');await expect(closeMenu).toBeFocused();await page.keyboard.press('Escape');await expect(opener).toBeFocused();await expect(page.getByRole('navigation')).toHaveCount(0);checks.push('compact menu keyboard entry focus loop escape and focus return');await page.setViewportSize({width:1440,height:1000});
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('spotlog.admin.review.v1')));
  let failure='',meStatus=200,commandStatus=200,resourceStatus=200,operatorId='server-admin';
  await page.route('**/api/admin/v1/**',async route=>{
   const url=new URL(route.request().url());
   if(failure==='network')return route.abort('failed');
   if(url.pathname.endsWith('/me'))return route.fulfill({status:meStatus,contentType:'application/json',body:JSON.stringify(meStatus===200?{operatorId,name:'접근 검수 관리자',role:'ADMIN'}:{error:{code:'SESSION_EXPIRED',message:'관리자 인증이 만료됐어요.'}})});
   if(url.pathname.endsWith('/snapshot'))return route.fulfill({status:200,contentType:'application/json',body:failure==='malformed'?'not json':JSON.stringify(state)});
   if(url.pathname.endsWith('/commands'))return route.fulfill({status:commandStatus,contentType:'application/json',body:JSON.stringify({error:{code:commandStatus===401?'SESSION_EXPIRED':'SERVER_ERROR',message:'시험용 저장 실패'}})});
   if(url.pathname.includes('/resources/')){const size=Number(url.searchParams.get('pageSize')),number=Number(url.searchParams.get('page'));return route.fulfill({status:resourceStatus,contentType:'application/json',body:JSON.stringify({items:state.places.slice((number-1)*size,number*size),total:state.places.length,page:number,pageSize:size,revision:state.revision})});}
   return route.fulfill({status:404,body:'{}'});
  });
  await page.goto(base+'/admin.html?mode=api');await expect(page.getByRole('heading',{name:'오늘의 운영 작업',exact:true})).toBeVisible();checks.push('initial authorized API');
  meStatus=401;await page.getByRole('button',{name:'새로 조회',exact:true}).click();await expect(page.getByRole('heading',{name:'관리자 연결 대기',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'오늘의 운영 작업',exact:true})).toBeHidden();await expect(page.getByText('접근 검수 관리자',{exact:true})).toHaveCount(0);checks.push('expired refresh conceals previous operator data');
  meStatus=200;await page.getByRole('button',{name:'다시 연결',exact:true}).click();await expect(page.getByRole('heading',{name:'오늘의 운영 작업',exact:true})).toBeVisible();checks.push('authorized reconnection');
  await page.getByRole('navigation').getByRole('button',{name:'장소·업체',exact:true}).click();await page.getByRole('button',{name:/검수용 바다 전망대/}).first().click();const description=page.getByLabel('장소 소개',{exact:true});await description.fill('인증 오류 뒤 재연결해도 보존할 입력');
  commandStatus=401;await page.getByRole('button',{name:'초안 저장',exact:true}).click();await expect(page.getByRole('heading',{name:'관리자 연결 대기',exact:true})).toBeVisible();await expect(description).toBeHidden();checks.push('expired command conceals editor');
  await page.getByRole('button',{name:'다시 연결',exact:true}).click();await expect(description).toBeVisible();await expect(description).toHaveValue('인증 오류 뒤 재연결해도 보존할 입력');checks.push('same operator input preserved through reconnect');
  commandStatus=500;await page.getByRole('button',{name:'초안 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('시험용 저장 실패');await expect(description).toHaveValue('인증 오류 뒤 재연결해도 보존할 입력');checks.push('server failure retains editor');
  failure='malformed';await page.getByRole('button',{name:'새로 조회',exact:true}).click();await expect(page.getByRole('heading',{name:'관리자 연결 대기',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('JSON');checks.push('invalid reload does not reuse previous authorization');
  failure='network';await page.getByRole('button',{name:'다시 연결',exact:true}).click();await expect(page.getByRole('alert')).toContainText('네트워크');await expect(page.getByRole('alert')).not.toContainText('Failed to fetch');checks.push('network failure explained in Korean');
  failure='';meStatus=403;await page.getByRole('button',{name:'다시 연결',exact:true}).click();await expect(page.getByRole('heading',{name:'관리자 연결 대기',exact:true})).toBeVisible();checks.push('forbidden account remains blocked');
  meStatus=200;operatorId='different-admin';await page.getByRole('button',{name:'다시 연결',exact:true}).click();await expect(description).toBeVisible();await expect(description).toHaveValue(state.places.find(place=>place.placeId==='review-landmark').draft.description);checks.push('different operator does not inherit previous editor input');
  await page.getByRole('navigation').getByRole('button',{name:'장소·업체',exact:true}).click();resourceStatus=403;await page.getByLabel('장소 검색',{exact:true}).fill('권한 시험');await expect(page.getByRole('heading',{name:'관리자 연결 대기',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('접근 권한');checks.push('list authorization failure also blocks shared workspace');
  await page.screenshot({path:path.join(out,'access-blocked.png')});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log('Passed '+checks.length+' administrator access states');await context.close();
 }finally{await browser.close();}
}
main().catch(error=>{fs.writeFileSync(path.join(out,'failure.txt'),error.stack);console.error(error);process.exitCode=1;});
