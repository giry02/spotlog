const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin='http://127.0.0.1:5173';
const out=path.resolve('artifacts/site-design-global-qa');
const report={widths:[],errors:[],links:[],scope:[]};
const storage = page=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [320,390,460,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.addInitScript(()=>{if(location.protocol==='http:'&&!localStorage.getItem('spotlog.local.repository.v2')){localStorage.setItem('spotlog.web.saved.v3',JSON.stringify(['jeju-hyeopjae']));localStorage.setItem('spotlog.web.journeys.v4','[]');}});
   const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({width,message:e.message}));
   await page.goto(`${origin}/#saved`);await page.locator('.saved-page').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
   const savedShell=await page.locator('.app-shell').evaluate(e=>({width:e.getBoundingClientRect().width,maxWidth:getComputedStyle(e).maxWidth}));
   await page.evaluate(()=>{const state={...history.state,tab:'style-guide',depth:history.state.depth+1,scrollTop:0};history.pushState(state,'','#style-guide');window.dispatchEvent(new PopStateEvent('popstate',{state}));});await page.locator('.site-design-guide').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200);
   const before=await storage(page);const url=page.url();
   const expected=await page.evaluate(async()=>{const m=await import('/src/styleGuideCatalog.ts');return {groups:m.screenGroups.length,images:m.screenGroups.reduce((n,g)=>n+g.shots.length,0)};});
   const groups=await page.locator('.sg-screen-group').count();assert.equal(groups,expected.groups);
   const imageCount=await page.locator('.sg-shots img').count();assert.equal(imageCount,expected.images);
   for(const img of await page.locator('.sg-shots img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());assert.equal(await img.evaluate(el=>el.naturalWidth),390);}
   const links=await page.locator('.sg-shots a').evaluateAll(a=>a.map(x=>x.href));
   if(width===320)for(const href of links){const response=await context.request.get(href);report.links.push({href,status:response.status(),type:response.headers()['content-type']});assert.equal(response.status(),200);}
   const nav=[];
   for(const container of ['.sg-index','.sg-screen-index']){
    const buttons=page.locator(`${container} button`),count=await buttons.count();
    for(let i=0;i<count;i++){
     await buttons.nth(i).click();await page.waitForTimeout(80);assert.equal(page.url(),url);
     const title=await buttons.nth(i).innerText();
     const positions=await page.evaluate(({container,i})=>{const id=container==='.sg-index'?['sg-foundation','sg-screens','sg-components','sg-process'][i]:document.querySelectorAll('.sg-screen-group')[i].id;return {id,top:document.getElementById(id).getBoundingClientRect().top,toolbarBottom:document.querySelector('.sg-toolbar').getBoundingClientRect().bottom};},{container,i});
     assert.ok(positions.top>=positions.toolbarBottom-2&&positions.top<900,width+' nav target hidden '+JSON.stringify(positions));nav.push({title,...positions});
    }
   }
   const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth>innerWidth,content:document.querySelector('.content').scrollWidth>document.querySelector('.content').clientWidth,guide:document.querySelector('.site-design-guide').scrollWidth>document.querySelector('.site-design-guide').clientWidth}));
   assert.deepEqual(overflow,{document:false,content:false,guide:false});assert.deepEqual(await storage(page),before);
   await page.locator('.sg-shots').evaluateAll(elements=>elements.forEach(e=>e.scrollLeft=0));
   if(width===1440){
    await page.locator('.sg-intro').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'desktop-intro.png')});
    await page.locator('#sg-detail').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'desktop-atlas.png')});
    await page.locator('#sg-components').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'desktop-components.png')});
   }
   if(width===390){await page.locator('#sg-detail').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'mobile-atlas.png')});}
   const scope=await page.evaluate(()=>{
    const style=[...document.querySelectorAll('style[data-vite-dev-id]')].find(e=>e.dataset.viteDevId.endsWith('style-guide-page.css'));
    if(!style)throw new Error('Guide CSS missing');
    const rules=[];function visit(list){for(const rule of list){if(rule.selectorText)rules.push(...rule.selectorText.split(',').map(s=>s.trim()));if(rule.cssRules)visit(rule.cssRules);}}visit(style.sheet.cssRules);return rules.filter(s=>!s.startsWith('.site-design-guide')&&!s.startsWith('.app-shell.tab-style-guide'));
   });report.scope.push({width,unscoped:scope});assert.deepEqual(scope,[]);
   await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();await page.locator('.saved-page').waitFor();assert.match(page.url(),/#saved$/);
   const returnedShell=await page.locator('.app-shell').evaluate(e=>({width:e.getBoundingClientRect().width,maxWidth:getComputedStyle(e).maxWidth}));assert.deepEqual(returnedShell,savedShell);assert.equal(returnedShell.maxWidth,'460px');assert.deepEqual(await storage(page),before);
   await page.evaluate(()=>location.hash='style-guide');await page.locator('.site-design-guide').waitFor();await page.getByRole('button',{name:'이전 화면으로',exact:true}).click();await page.locator('.home-lead').waitFor();assert.match(page.url(),/#home$/);assert.deepEqual(await storage(page),before);
   report.widths.push({width,groups,imageCount,navCount:nav.length,nav,overflow,storageUnchanged:true,backToSaved:true,directLinkBackToHome:true,savedShell,returnedShell});console.log(width,groups,imageCount,nav.length,'PASS');await context.close();
  }
  assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
