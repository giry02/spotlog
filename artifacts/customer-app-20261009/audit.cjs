const {chromium, expect} = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const base = 'http://127.0.0.1:5210/', out = __dirname;
const results = {date:'2026-10-09',routes:[],flows:[],errors:[],assetFailures:[]};
function write(){fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
async function stable(page){await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(180);}
async function shot(page,name,width){await page.screenshot({path:path.join(out,`${name}-${width}.png`),animations:'disabled'});}
async function clean(page){
  await stable(page);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+page.url());
  const broken = await page.locator('img').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&n.complete&&!n.naturalWidth;}).map(n=>n.currentSrc));
  assert.deepEqual(broken,[],'broken visible images');
  assert.ok(await page.getByRole('dialog').count()<=1,'stacked dialogs');
}
async function close(page){await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).first().click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>!history.state?.spotlogSheet)).toBe(true);}
async function member(page){
  await page.goto(base+'#profile');await page.getByRole('button',{name:'로그인',exact:true}).click();
  await page.getByRole('button',{name:'이메일로 로그인',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(base+'#journey-jeju-west-slow');await expect(page.locator('.journey-detail')).toBeVisible();
}
async function routes(browser,width){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(9000);
 page.on('pageerror',error=>results.errors.push({width,message:error.message}));
 page.on('response',response=>{if(response.url().startsWith(base)&&(/\/(?:src|assets|@fs)\//.test(response.url()))&&response.status()>=400)results.assetFailures.push({url:response.url(),status:response.status()});});
 for(const route of ['home','community','places-guide','places-photo','places-video','saved','trips','profile','journey-jeju-west-slow']){
  await page.goto(base+'#'+route);await page.locator('.app-shell').waitFor();await clean(page);
  if(route.startsWith('places-')){const sizes=await page.locator('.place-view-toggle button').evaluateAll(nodes=>nodes.map(e=>({font:parseFloat(getComputedStyle(e).fontSize),height:e.getBoundingClientRect().height})));assert.ok(sizes.every(s=>s.font===12&&s.height>=44),'place view caption/touch roles');}
  const before=await page.locator('.tabbar').count()?await page.locator('.tabbar').boundingBox():null;
  if(before){await page.locator('.content').evaluate(el=>el.scrollTop=el.scrollHeight);await page.mouse.wheel(0,3000);await page.waitForTimeout(120);assert.equal(Math.round((await page.locator('.tabbar').boundingBox()).y),Math.round(before.y),'bottom menu moved');await page.mouse.wheel(0,-9000);await page.locator('.content').evaluate(el=>el.scrollTop=0);}
  await shot(page,route,width);
  const text=await page.evaluate(()=>[...document.querySelectorAll('button,input,textarea,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).map(e=>({name:(e.getAttribute('aria-label')||e.textContent||e.placeholder||'').trim().replace(/\s+/g,' ').slice(0,70),font:parseFloat(getComputedStyle(e).fontSize),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
  results.routes.push({width,route,controls:text});write();
 }
 await page.locator('.journey-social').scrollIntoViewIfNeeded();await clean(page);await shot(page,'journal-social',width);
 await expect(page.locator('.journal-report-footer button')).toHaveCount(1);
 await expect(page.locator('.journey-social .journey-comment')).toHaveCount(2);
 const rootReport=page.locator('.journey-social .journey-comment').first().getByRole('button',{name:/댓글 신고$/});await rootReport.click();await expect(page.getByRole('dialog')).toHaveCount(1);await page.getByLabel('신고 이유').selectOption('ABUSE');await clean(page);await close(page);
 const card=page.locator('.guide-place-embed .card-social').first();await card.getByRole('button',{name:/ 댓글 \d+$/}).click();
 const cardInput=page.locator('.card-comment-sheet').getByRole('textbox',{name:'댓글 작성',exact:true});await cardInput.fill('작성 중 보존 검수');
 await page.locator('.card-reply').getByRole('button',{name:/답글 신고$/}).first().click();await expect(page.getByRole('dialog')).toHaveCount(1);await close(page);
 await card.getByRole('button',{name:/ 댓글 \d+$/}).click();await expect(cardInput).toHaveValue('작성 중 보존 검수');await close(page);
 await page.goto(base+'#places-guide');await page.getByRole('textbox',{name:'랜드마크 지역 검색',exact:true}).fill('없는곳검수');await stable(page);await shot(page,'places-empty',width);await expect(page.locator('.landmark-guide-card')).toHaveCount(0);await page.getByRole('button',{name:'검색 지우기',exact:true}).click();await expect(page.locator('.landmark-guide-card').first()).toBeVisible();
 await member(page);
 const ownBody='루트 고객 댓글 검수 '+width;
 await page.locator('.comment-composer input').fill(ownBody);await page.locator('.comment-composer button').click();await expect(page.locator('.journey-comment').first()).toContainText(ownBody);await expect(page.locator('.journey-comment').first().getByRole('button',{name:/신고$/})).toHaveCount(0);
 await page.getByRole('button',{name:/너무 좋아요/}).click();await expect(page.locator('.quick-cheers button').first()).toHaveAttribute('aria-pressed','true');
 await page.reload();await expect(page.locator('.journey-comment').first()).toContainText(ownBody);await expect(page.locator('.quick-cheers button').first()).toHaveAttribute('aria-pressed','true');
 const liveCard=page.locator('.guide-place-embed .card-social').first();await liveCard.getByRole('button').first().click();await expect(liveCard.getByRole('button').first()).toHaveAttribute('aria-pressed','true');await liveCard.getByRole('button',{name:/ 댓글 \d+$/}).click();
 await page.locator('.card-comment-sheet').getByRole('textbox',{name:'댓글 작성',exact:true}).fill('회원 카드 댓글 '+width);await page.getByRole('button',{name:'댓글 등록',exact:true}).click();await expect(page.locator('.card-comment').first()).toContainText('회원 카드 댓글 '+width);await close(page);await page.reload();await liveCard.getByRole('button',{name:/ 댓글 \d+$/}).click();await expect(page.locator('.card-comment').first()).toContainText('회원 카드 댓글 '+width);await close(page);
 await clean(page);results.flows.push({width,oneReportFooter:true,reportHandoff:true,commentDraftPreserved:true,placeEmptyRecovery:true,memberCommentAndReactionPersist:true,cardCommentAndLikePersist:true});write();
 await context.close();
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [320,390,460])await routes(browser,width);assert.deepEqual(results.errors,[]);assert.deepEqual(results.assetFailures,[]);results.passed=true;write();console.log('PASS '+results.routes.length+' routes and '+results.flows.length+' social flows');}finally{await browser.close();write();}})().catch(error=>{results.failure=String(error.stack);write();console.error(error);process.exitCode=1;});
