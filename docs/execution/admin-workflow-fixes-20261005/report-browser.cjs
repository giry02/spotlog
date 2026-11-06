const {chromium,expect}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=__dirname,base='http://127.0.0.1:5210',checks=[],errors=[];
const record=(name,evidence)=>{checks.push({name,evidence});console.log('PASS',name);};
const adminState=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('spotlog.admin.review.v1')));
const serviceState=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('spotlog.review.service.v1')));
async function menu(page,name){await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();}
async function main(){
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),admin=await context.newPage(),customer=await context.newPage();
 for(const page of [admin,customer])page.on('pageerror',error=>errors.push(error.message));
 await admin.goto(base+'/admin.html');await expect(admin.getByRole('heading',{name:'오늘의 운영 작업'})).toBeVisible();
 const initial=await adminState(admin),publicJournals=initial.ops.journals.filter(j=>j.sourceKind==='PUBLIC_SAMPLE');
 assert.equal(publicJournals.length,12);assert.ok(publicJournals.every(j=>j.cover&&j.days.length&&j.cards.length));record('12 public source journals have exact consumer IDs and rich reading projections',publicJournals.map(j=>j.journalId));
 const publicTitle=publicJournals.find(j=>j.journalId==='busan-oldtown-to-sea').title;
 await customer.setViewportSize({width:390,height:844});await customer.goto(base+'/#journey-busan-oldtown-to-sea');await expect(customer.locator('.journey-detail')).toBeVisible();
 await customer.evaluate(()=>localStorage.setItem('spotlog-private-qa-sentinel','private itinerary retained'));
 async function submit(button,detail){await button.click();const dialog=customer.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'공개 콘텐츠 신고'})).toBeVisible();await dialog.getByLabel('신고 이유',{exact:true}).selectOption('INFORMATION');await dialog.getByLabel('상세 사유 (선택)',{exact:true}).fill(detail);await dialog.getByRole('button',{name:'로컬 검수 접수',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('로컬 검수 접수');await dialog.getByRole('button',{name:'닫기',exact:true}).last().click();}
 await submit(customer.getByRole('button',{name:/여행기 신고$/}).first(),'QA 여행기 공개 문맥');
 await submit(customer.getByRole('button',{name:/표지 신고$/}).first(),'QA 표지 사진 문맥');
 await submit(customer.getByRole('button',{name:/장소 신고$/}).first(),'QA 장소 정보 문맥');
 await submit(customer.getByRole('button',{name:/작성자 신고$/}).first(),'QA 공개 작성자 문맥');
 await submit(customer.getByRole('button',{name:/골목산책.*신고$/}).first(),'QA 전체 댓글 문맥');
 await expect.poll(async()=>(await adminState(admin)).ops.reports.filter(r=>r.source==='LOCAL_REVIEW').length).toBe(5);
 const reports=(await serviceState(customer)).reports;assert.deepEqual([...new Set(reports.map(r=>r.targetType))].sort(),['COMMENT','JOURNAL','PHOTO','PLACE','PROFILE']);record('five customer report targets reach admin from real UI in the same isolated browser',reports.map(r=>({id:r.reportId,type:r.targetType,target:r.targetId})));
 await submit(customer.getByRole('button',{name:/여행기 신고$/}).first(),'QA duplicate');assert.equal((await serviceState(customer)).reports.length,5);record('duplicate receipt never creates another report');
 await customer.locator('.card-social').getByRole('button',{name:/좋아요$/}).first().click();
 await customer.locator('.quick-cheers').getByRole('button').filter({hasText:'동선이 유용해요'}).click();
 await expect.poll(async()=>{const journal=(await adminState(admin)).ops.journals.find(j=>j.journalId==='busan-oldtown-to-sea');return journal.reactionBreakdown?.HELPFUL===1&&journal.cards.some(card=>card.likes===1&&card.likeUsers?.length===1);}).toBe(true);
 record('deliberate public like and cheer update admin read-only aggregates');
 await menu(admin,'여행기·커뮤니티');await admin.getByRole('tab',{name:'번역 검수',exact:true}).click();
 await admin.locator('.admin-page-body:not([hidden]) .admin-list').getByRole('button').filter({hasText:publicTitle}).click();
 const reviewedEnglish='QA reviewed English: walk through the old town and finish by the sea.';
 await admin.getByLabel('영어 번역',{exact:true}).fill(reviewedEnglish);await admin.getByLabel('검수 메모',{exact:true}).fill('QA 공개 원문 버전 확인');await admin.getByRole('button',{name:'번역 검수 완료',exact:true}).click();
 await customer.locator('.content-language-controls').getByRole('button',{name:'English',exact:true}).click();await expect(customer.getByText(reviewedEnglish,{exact:true})).toBeVisible();
 await customer.locator('.content-language-controls').getByRole('button',{name:'한국어',exact:true}).click();
 record('one global English control displays the exact admin-approved public story');
 await menu(admin,'여행기·커뮤니티');await admin.getByRole('tab',{name:'신고·이의',exact:true}).click();await admin.getByRole('button').filter({hasText:'QA 공개 작성자 문맥'}).first().click();await admin.getByRole('button',{name:'회원 관리로 이동',exact:true}).click();await expect(admin.getByRole('heading',{level:1,name:'회원·문의'})).toBeVisible();await expect(admin.getByRole('heading',{name:'부산산책자',exact:true})).toBeVisible();record('profile report opens the matching public-author member record');
 await menu(admin,'여행기·커뮤니티');await admin.getByRole('button').filter({hasText:'QA 표지 사진 문맥'}).first().click();await expect(admin.locator('.admin-report-context img').first()).toBeVisible();record('photo report preserves exact public photograph context');
 await customer.goto(base+'/#community');await expect(customer.getByText(publicTitle,{exact:true}).first()).toBeVisible();
 await admin.getByRole('button').filter({hasText:'QA 여행기 공개 문맥'}).first().click();await admin.getByRole('button',{name:'여행기와 댓글 문맥 확인',exact:true}).click();await expect(admin.locator('.admin-reading-day')).toHaveCount(2);await expect(admin.locator('.admin-reading-place').first()).toBeVisible();await admin.locator('.admin-page-body:not([hidden])').getByLabel('조치 사유',{exact:true}).fill('QA 공개 문맥 숨김');await admin.getByRole('button',{name:'여행기 숨김',exact:true}).click();
 await expect.poll(async()=>(await serviceState(customer)).journalModeration.find(j=>j.id==='busan-oldtown-to-sea')?.state).toBe('HIDDEN');await expect(customer.getByText(publicTitle,{exact:true})).toHaveCount(0);record('admin hides only the target public journal and customer list updates');
 await admin.getByRole('tab',{name:'신고·이의',exact:true}).click();await admin.getByLabel('신고 처리 사유',{exact:true}).fill('QA 숨김 처리 확인');await admin.getByRole('button',{name:'처리 완료 기록',exact:true}).click();await expect.poll(async()=>(await serviceState(customer)).reports.find(r=>r.targetType==='JOURNAL')?.status).toBe('RESOLVED');record('report resolution status is synchronized to the receipt');
 assert.equal(await customer.evaluate(()=>localStorage.getItem('spotlog-private-qa-sentinel')),'private itinerary retained');assert.deepEqual(errors,[]);record('customer private storage remains intact and no browser runtime errors occur',{errors});
 await admin.screenshot({path:path.join(output,'report-admin-context.png')});await customer.screenshot({path:path.join(output,'report-customer-list.png')});
 fs.writeFileSync(path.join(output,'report-browser-results.json'),JSON.stringify({base,generatedAt:new Date().toISOString(),checks,errors},null,2));
}finally{await browser.close();}}
main().catch(error=>{console.error(error);process.exitCode=1;});
