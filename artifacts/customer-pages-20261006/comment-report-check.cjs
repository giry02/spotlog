const { chromium, expect } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.SPOTLOG_COMMENT_REVIEW_URL || 'http://127.0.0.1:5216/spotlog/', dev=process.env.SPOTLOG_COMMENT_DEV==='1', out=path.join(__dirname,dev?'comment-dev':base.startsWith('https:')?'comment-live':'comment-review');fs.mkdirSync(out,{recursive:true});
const envelopeKey='spotlog.local.repository.v2',threadKey='spotlog.card-social.v1';
async function enter(page){await page.goto(base+'#community');await page.getByRole('button',{name:'여행기 먼저 보기',exact:true}).first().click();await expect(page.locator('.journey-detail')).toBeVisible();}
async function close(page){await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).first().click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>!window.history.state?.spotlogSheet)).toBe(true);}
async function receipt(page,id,cardId){
 await page.getByLabel('신고 이유').selectOption('ABUSE');await page.getByLabel('상세 사유 (선택)').fill('댓글 신고 검수');await page.getByRole('button',{name:'로컬 검수 접수',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'로컬 검수 접수'})).toBeVisible();
 const reports=await page.evaluate(()=>JSON.parse(localStorage.getItem('spotlog.review.service.v1')).reports), item=reports.find(report=>report.targetId===id);
 assert.ok(item);assert.equal(item.targetType,'COMMENT');assert.equal(item.cardId,cardId);assert.equal(item.reasonCode,'ABUSE');
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}), errors=[], results=[];try{
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 for(const width of [320,390,460]){
  await page.setViewportSize({width,height:844});await enter(page);
  await expect(page.locator('.journal-report-footer button')).toHaveCount(1);await expect(page.locator('.journal-lead .report-context-button,.guide-place-embed .report-context-button,.journal-gallery .report-context-button,.detail-creator .report-context-button')).toHaveCount(0);
  const comment=page.locator('.journey-comment').first(),report=comment.getByRole('button',{name:/댓글 신고$/});await report.scrollIntoViewIfNeeded();
  const dimensions=await report.evaluate(element=>({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height,icon:element.querySelector('svg').getAttribute('width')}));assert.equal(dimensions.width,36);assert.ok(dimensions.height>=36);assert.equal(dimensions.icon,'16');
  await page.screenshot({path:path.join(out,`${width}-journal-comment.png`)});await report.click();await expect(page.getByRole('dialog')).toHaveCount(1);await expect(page.getByRole('heading',{name:'공개 콘텐츠 신고'})).toBeVisible();await expect(page.getByLabel('신고 대상')).toHaveCount(0);if(!dev)await expect(page.getByRole('button',{name:'신고 접수',exact:true})).toBeDisabled();await close(page);
  const social=page.locator('.guide-place-embed .card-social').first();if(await social.getByRole('button').first().getAttribute('aria-pressed')!=='true')await social.getByRole('button').first().click();
  const identity=await page.evaluate(({envelopeKey,threadKey})=>{const envelope=JSON.parse(localStorage.getItem(envelopeKey)),store=JSON.parse(envelope.records[threadKey]),key=Object.keys(store)[0];store[key].comments=[{id:'foreign-root',authorId:'other',author:'다른 여행자',body:'외부 사용자 댓글',createdAt:'2026-10-06T01:00:00.000Z'},{id:'foreign-reply',authorId:'reply-user',author:'답글 여행자',body:'외부 사용자 답글',parentId:'foreign-root',createdAt:'2026-10-06T02:00:00.000Z'},{id:'own-comment',authorId:'local-self',author:'나',body:'내 댓글',createdAt:'2026-10-06T03:00:00.000Z'},{id:'deleted-comment',authorId:'other',author:'삭제 작성자',body:'',deleted:true,createdAt:'2026-10-06T00:00:00.000Z'}];envelope.records[threadKey]=JSON.stringify(store);localStorage.setItem(envelopeKey,JSON.stringify(envelope));return JSON.parse(key);},{envelopeKey,threadKey});
  await page.reload();await page.locator('.guide-place-embed .card-social').first().getByRole('button',{name:/ 댓글 \d+$/}).click();
  await page.locator('.card-comment-sheet').getByRole('textbox',{name:'댓글 작성',exact:true}).fill('작성 중 보존 확인');
  await expect(page.locator('.card-comment').filter({hasText:'내 댓글'}).getByRole('button',{name:/신고$/})).toHaveCount(0);
  await expect(page.locator('.card-comment').filter({hasText:'삭제된 댓글입니다.'}).getByRole('button',{name:/신고$/})).toHaveCount(0);
  await expect(page.locator('.card-comment-sheet .report-context-button--icon')).toHaveCount(2);
  const root=page.locator('.card-comment').filter({hasText:'외부 사용자 댓글'}).first();await root.getByRole('button',{name:/댓글 신고$/}).click();await expect(page.getByRole('heading',{name:'공개 콘텐츠 신고'})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(1);await expect(page.locator('.card-comment-sheet')).toHaveCount(0);
  if(dev)await receipt(page,'foreign-root',identity[1]);else await expect(page.getByRole('button',{name:'신고 접수',exact:true})).toBeDisabled();await close(page);
  await page.locator('.guide-place-embed .card-social').first().getByRole('button',{name:/ 댓글 \d+$/}).click();await expect(page.locator('.card-comment-sheet').getByRole('textbox',{name:'댓글 작성',exact:true})).toHaveValue('작성 중 보존 확인');
  await page.locator('.card-reply').getByRole('button',{name:/답글 신고$/}).click();await expect(page.getByRole('dialog')).toHaveCount(1);if(dev)await receipt(page,'foreign-reply',identity[1]);await page.screenshot({path:path.join(out,`${width}-reply-report.png`)});await close(page);
  await page.locator('.guide-place-embed .card-social').first().getByRole('button',{name:/ 댓글 \d+$/}).click();await page.screenshot({path:path.join(out,`${width}-card-comment-flags.png`)});await close(page);
  const sizes=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(sizes.scroll<=sizes.client+1);results.push({width,icon:dimensions,oneFooter:true,commentReport:true,replyReport:true,onlyOneSheet:true,draftPreserved:true,ownAndDeletedExcluded:true,receiptVerified:dev});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,results,errors,note:'Isolated browser only; synthetic comment fixtures never sent to live service.'},null,2));console.log('PASS comment/reply flags, exact parent receipt, one sheet, draft retention and 3 mobile widths.');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
