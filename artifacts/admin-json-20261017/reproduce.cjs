const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage(), responses=[], errors=[];
  page.on('pageerror', e=>errors.push(String(e)));
  page.on('response', r=>{if(r.url().includes('/api/')) responses.push({url:r.url(),status:r.status(),type:r.headers()['content-type']});});
  await page.goto('https://giry02.github.io/spotlog/admin.html', {waitUntil:'networkidle'});
  await page.screenshot({path:__dirname+'/before.png',fullPage:true});
  const result={url:page.url(),body:await page.locator('body').innerText(),responses,errors};
  fs.writeFileSync(__dirname+'/before.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
