const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const out = __dirname, results = [], errors = [], findings = [];
const active = page => page.locator('.admin-page-body:not([hidden])');
async function stable(page) { await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))); }); }
async function menu(page, name) { const opener = page.getByRole('button', { name: '관리자 메뉴 열기', exact: true }); if (await opener.isVisible()) { await opener.click(); await stable(page); } await page.getByRole('navigation').getByRole('button', { name, exact: true }).click(); await stable(page); await page.locator('.admin-main').evaluate(element => { element.scrollTop = 0; }); }
async function tab(page, name) { await active(page).getByRole('tab', { name, exact: true }).click(); await stable(page); }
async function inspect(page, width, scene, focus) {
  if (focus && await focus.count()) await focus.first().scrollIntoViewIfNeeded();
  await stable(page);
  const result = await page.evaluate(({width,scene}) => {
    const shown = element => element.getClientRects().length > 0;
    const rect = element => { const r = element.getBoundingClientRect(); return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),right:+r.right.toFixed(1),bottom:+r.bottom.toFixed(1)}; };
    const main = document.querySelector('.admin-main'), body = document.querySelector('.admin-page-body:not([hidden])');
    const elements = [...body.querySelectorAll('*')].filter(shown);
    const outside = elements.filter(element => !element.closest('.admin-table-wrap') && element.getBoundingClientRect().right > main.getBoundingClientRect().right + 1).map(element => ({tag:element.tagName,class:element.className,text:element.textContent.trim().slice(0,80),rect:rect(element)})).slice(0,10);
    const clipped = elements.filter(element => ['admin-card','admin-panel','admin-panel-body','admin-actions','admin-stack','admin-reading-preview','admin-reading-day'].some(name=>element.classList.contains(name)) && !element.closest('.admin-table-wrap') && element.scrollWidth > element.clientWidth + 2).map(element=>({class:element.className,client:element.clientWidth,scroll:element.scrollWidth,text:element.textContent.trim().slice(0,70),rect:rect(element)})).slice(0,10);
    const photos = [...body.querySelectorAll('figure.admin-reading-photo')].filter(shown).map(element=>({rect:rect(element),scrollHeight:element.scrollHeight,clientHeight:element.clientHeight,lastChildBottom:element.lastElementChild ? rect(element.lastElementChild).bottom : null,caption:element.querySelector('figcaption')?.textContent.slice(0,80)}));
    const photoOverflow = photos.filter(photo => photo.scrollHeight > photo.clientHeight + 2 || photo.lastChildBottom > photo.rect.bottom + 2);
    const overlaps = [];
    for (const container of elements.filter(element=>['admin-panel-body','admin-stack','admin-list','admin-reading-preview'].some(name=>element.classList.contains(name)))) {
      const children=[...container.children].filter(shown);
      for(let i=1;i<children.length;i++) { const a=children[i-1].getBoundingClientRect(),b=children[i].getBoundingClientRect(); if(b.top < a.bottom-1 && b.left < a.right && b.right > a.left) overlaps.push({container:container.className,previous:children[i-1].className,next:children[i].className,gap:+(b.top-a.bottom).toFixed(1)}); }
    }
    const controls = [...body.querySelectorAll('button,a.admin-button')].filter(shown).map(element=>({name:element.getAttribute('aria-label')||element.textContent.trim()||element.title,tag:element.tagName,type:element.getAttribute('type')|| (element.tagName==='BUTTON'?'submit-default':''),inForm:!!element.closest('form'),disabled:element.disabled||false,danger:element.classList.contains('admin-danger'),primary:element.classList.contains('primary'),height:+element.getBoundingClientRect().height.toFixed(1),rect:rect(element)}));
    const unnamed = controls.filter(control=>!control.name);
    const formSubmit = controls.filter(control=>control.inForm && ['submit','submit-default'].includes(control.type)).map(({name,type,disabled,primary})=>({name,type,disabled,primary}));
    const labels = [...body.querySelectorAll('input,textarea,select')].filter(shown).filter(element=>!element.getAttribute('aria-label')&&!element.labels?.length).map(element=>({tag:element.tagName,type:element.type,id:element.id}));
    const panels = [...body.querySelectorAll('.admin-panel')].filter(shown).map(element=>({title:element.querySelector('h2')?.textContent,rect:rect(element),bodyGap:getComputedStyle(element.querySelector('.admin-panel-body')).gap}));
    return {width,scene,mainClient:main.clientWidth,mainScroll:main.scrollWidth,outside,clipped,photoOverflow,overlaps:overlaps.slice(0,10),unnamed,unlabelled:labels,formSubmit,controlMinimum:Math.min(...controls.map(control=>control.height)),dangerNames:controls.filter(control=>control.danger).map(control=>control.name),panels};
  }, {width,scene});
  const filename=`${width}-${scene}.png`;
  await page.screenshot({path:path.join(out,filename),animations:'disabled'});
  result.screenshot=filename;results.push(result);
  for(const key of ['outside','clipped','photoOverflow','overlaps','unnamed','unlabelled'])if(result[key].length)findings.push({width,scene,type:key,detail:result[key],screenshot:filename});
  if(result.mainScroll > result.mainClient+1)findings.push({width,scene,type:'main-horizontal-overflow',detail:{client:result.mainClient,scroll:result.mainScroll},screenshot:filename});
}
async function main() {
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 for(const width of [1440,820,390,320]) {
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push({width,message:error.message}));
  await page.goto('http://127.0.0.1:5210/admin.html');await expect(page.getByRole('heading',{name:'오늘의 운영 작업',exact:true})).toBeVisible();await stable(page);
  const before=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('spotlog.admin.review.v1')).ops));
  await menu(page,'여행기·커뮤니티');await inspect(page,width,'report-context',active(page).getByRole('heading',{name:'신고 상세',exact:true}));
  await tab(page,'공개 여행기·댓글');await inspect(page,width,'synthetic-journal',active(page).getByRole('heading',{name:'샘플 여행기 · 바다 산책',exact:true}));
  await active(page).getByRole('tab',{name:'샘플 장소 카드 A',exact:true}).click();await inspect(page,width,'card-comments',active(page).getByRole('tab',{name:'샘플 장소 카드 A',exact:true}));
  const journalData=await page.evaluate(()=>JSON.parse(localStorage.getItem('spotlog.admin.review.v1')).ops.journals.filter(journal=>journal.ownerVisibility==='PUBLIC'&&journal.sourceKind==='PUBLIC_SAMPLE').map(journal=>({id:journal.journalId,title:journal.title,cards:journal.cards.map(card=>({id:card.cardId,name:card.name}))})));
  assert.ok(journalData.length>0,'shared public sample available');
  const first=journalData[0];await active(page).locator('.admin-split>.admin-panel').first().getByRole('button').filter({hasText:first.title}).click();
  await inspect(page,width,'public-journal',active(page).locator('.admin-reading-preview'));
  if(first.cards.length){await active(page).getByRole('tab',{name:first.cards[0].name,exact:true}).click();const selected=active(page).locator('.admin-reading-place.selected').last();await selected.getByText('좋아요한 공개 회원',{exact:true}).click();await inspect(page,width,'public-card-likes',selected);}
  await tab(page,'번역 검수');await inspect(page,width,'translation',active(page).getByRole('heading',{name:'원문·번역 비교',exact:true}));
  await menu(page,'회원·문의');await active(page).locator('.admin-split>.admin-panel').first().getByRole('button').filter({hasText:'검수 회원 B'}).click();await inspect(page,width,'member-deletion',active(page).getByRole('heading',{name:'계정 삭제 요청',exact:true}));
  await tab(page,'문의 처리');await inspect(page,width,'inquiry',active(page).getByLabel('답변 기록',{exact:true}));
  await menu(page,'운영 설정·이력');
  for(const [name,scene] of [['지역 관리','settings-regions'],['분류·운영 기준','settings-references'],['운영자·권한','settings-operators'],['알림','settings-notifications'],['연결·수급','settings-connections'],['휴지통·파일 정리','settings-cleanup'],['변경·조치 이력','settings-audit']]){
   await tab(page,name);
   if(scene==='settings-references'){await active(page).getByLabel('기준 종류',{exact:true}).selectOption('GRADE');await active(page).locator('.admin-split>.admin-panel').first().getByRole('button').filter({hasText:'등급 기준 검수 초안'}).click();}
   if(scene==='settings-operators')await active(page).getByText('운영자 추가',{exact:true}).click();
   if(scene==='settings-connections'){const follow=active(page).locator('details').first();if(await follow.count())await follow.locator('summary').click();}
   await inspect(page,width,scene,active(page).locator('.admin-panel').first().getByRole('heading',{level:2}).first());
  }
  const after=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('spotlog.admin.review.v1')).ops));assert.equal(after,before,'no operation records modified');
  await context.close();console.log('WIDTH COMPLETE',width);
 }
 } finally {await browser.close();}
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({createdAt:new Date().toISOString(),browser:'isolated Edge headless',widths:[1440,820,390,320],scenes:results.length,errors,findings,results},null,2));
 console.log(JSON.stringify({scenes:results.length,errors:errors.length,findings:findings.map(({width,scene,type})=>({width,scene,type}))}));
}
main().catch(error=>{fs.writeFileSync(path.join(out,'partial-results.json'),JSON.stringify({errors,findings,results,failure:error.message},null,2));console.error(error.message);process.exit(1);});
