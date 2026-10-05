const fs = require('node:fs');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
 try {for(const width of [320,390,460]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const page=await context.newPage();
  await page.goto('http://127.0.0.1:5173/#home');await page.evaluate(()=>document.fonts.ready);await page.locator('.home-guide-card').first().scrollIntoViewIfNeeded();
  if(width===390)await page.screenshot({path:'web/public/design-guide/discovery-home-lower.png'});
  results.push({name:'home-lower',width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await context.close();
  const errorContext=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await errorContext.addInitScript(()=>localStorage.setItem('spotlog.local.repository.v2','qa-isolated-invalid-data'));
  const errorPage=await errorContext.newPage();await errorPage.goto('http://127.0.0.1:5173/#saved');await errorPage.evaluate(()=>document.fonts.ready);
  await errorPage.getByRole('button',{name:'백업·복구',exact:true}).click();await errorPage.locator('.phase-sheet').waitFor();
  if(width===390)await errorPage.screenshot({path:'web/public/design-guide/utility-backup.png'});
  results.push({name:'backup',width,overflow:await errorPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),repositoryPreserved:await errorPage.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2')==='qa-isolated-invalid-data')});await errorContext.close();
 }}finally{await browser.close();}
 fs.writeFileSync('artifacts/site-design-extra.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
