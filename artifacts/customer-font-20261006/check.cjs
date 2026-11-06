const {chromium,expect}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stage=process.env.SPOTLOG_FONT_STAGE||'after',base=process.env.SPOTLOG_FONT_URL||'http://127.0.0.1:5216/';
const out=path.join(__dirname,stage);fs.mkdirSync(out,{recursive:true});
const expected={'.map-label strong':12,'.route-leg small':12,'.route-leg strong':14,'.route-leg em':14,'.route-leg-schedule':14,'.route-schedule-summary':14,'.route-data-note':14,'.route-summary strong':14,'.route-summary span':14,'.journey-social > header > span':12,'.quick-cheers strong':14,'.quick-cheers span':12,'.comment-author > strong':14,'.comment-author > time':12,'.journey-comment p':16,'.comment-composer input':16,'.comment-composer button':14,'.social-kind-note':14};
async function frame(page,selector,name){await page.evaluate(selector=>{const target=document.querySelector(selector),content=document.querySelector('.content'),tabs=document.querySelector('.day-tabs');content.scrollTop+=target.getBoundingClientRect().top-content.getBoundingClientRect().top-(tabs?.getBoundingClientRect().height||0)-12},selector);await page.screenshot({path:path.join(out,name+'.png')});}
async function noOverflow(page){const overflow=await page.evaluate(()=>[document.documentElement,document.querySelector('.content'),...document.querySelectorAll('.route-leg,.route-summary,.journey-social,.quick-cheers,.comment-composer')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>({class:el.className,width:el.clientWidth,scroll:el.scrollWidth})));assert.deepEqual(overflow,[]);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];try{
for(const width of stage==='before'?[390]:[320,390,460]){
const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'#community');await page.getByRole('button',{name:'여행기 먼저 보기',exact:true}).first().click();await expect(page.locator('.route-leg').first()).toBeVisible();
await expect.poll(()=>page.locator('.map-label strong').first().innerText(),{timeout:20000}).not.toContain('계산 중');
await page.evaluate(()=>document.fonts.ready);await frame(page,'.day-route-section',width+'-route');await frame(page,'.journey-social',width+'-social');
const computed={};for(const [selector,size] of Object.entries(expected)){const element=page.locator(selector).first();if(await element.count()){const value=await element.evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),weight:getComputedStyle(el).fontWeight,lineHeight:getComputedStyle(el).lineHeight}));computed[selector]=value;if(stage!=='before')assert.equal(value.size,size,selector);}}
await noOverflow(page);
if(stage!=='before'){
const composer=page.locator('.comment-composer');await composer.locator('input').fill('글자 크기 검수 댓글');await composer.getByRole('button',{name:'등록',exact:true}).click();await expect(page.locator('.journey-comment').filter({hasText:'글자 크기 검수 댓글'})).toBeVisible();
assert.equal(await page.locator('.journey-comment p').first().evaluate(el=>getComputedStyle(el).fontSize),'16px');assert.equal(await page.locator('.comment-author strong').first().evaluate(el=>getComputedStyle(el).fontSize),'14px');await frame(page,'.journey-social',width+'-posted-social');
assert.equal(await composer.locator('input').evaluate(el=>getComputedStyle(el).fontSize),'16px');assert.ok(await composer.locator('button').evaluate(el=>el.getBoundingClientRect().height>=44));
await page.goto(base+'#home');await page.getByRole('button',{name:'일정 자세히 보기',exact:true}).first().click();await expect(page.locator('.comment-empty')).toBeVisible();
assert.equal(await page.locator('.comment-empty strong').evaluate(el=>getComputedStyle(el).fontSize),'14px');assert.equal(await page.locator('.comment-empty span').evaluate(el=>getComputedStyle(el).fontSize),'14px');await frame(page,'.journey-social',width+'-empty-social');await noOverflow(page);
await page.locator('.quick-cheers button').first().click();await expect(page.locator('.quick-cheers button').first()).toHaveAttribute('aria-pressed','true');
if(width===390){await page.getByRole('button',{name:'English',exact:true}).first().click();await frame(page,'.journey-social',width+'-english-social');await noOverflow(page);await page.getByRole('button',{name:'한국어',exact:true}).first().click();}
if(width===320){await page.addStyleTag({content:':root{--type-body:20px;--type-subhead:17.5px;--type-caption:15px}'});await frame(page,'.journey-social',width+'-large-text');await noOverflow(page);}
}
results.push({width,computed,overflow:false,commentPosting:stage!=='before',emptyAndSelected:stage!=='before'});await context.close();
}
if(stage!=='before'){
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#journey-jeju-west-slow');await expect(page.locator('.route-leg-schedule').first()).toBeVisible();await expect.poll(()=>page.locator('.map-label strong').first().innerText(),{timeout:20000}).not.toContain('계산 중');
assert.equal(await page.locator('.route-leg-schedule').first().evaluate(el=>getComputedStyle(el).fontSize),'14px');await frame(page,'.day-route-section','390-jeju-route');await noOverflow(page);results.push({width:390,route:'jeju-west-slow',scheduleFont:14,overflow:false});await context.close();
}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,stage,results,errors,note:'Isolated browser storage; no server writes.'},null,2));console.log('PASS',stage,results.length,'mobile widths, typography, layout and social actions');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
