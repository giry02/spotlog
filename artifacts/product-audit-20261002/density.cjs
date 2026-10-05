const fs=require('fs');
const {chromium}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const {snapshot}=require('./audit.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:320,height:844},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(6000);
 const report={saved:[],screens:[],result:null,errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5210/?audit=density#places-photo');await page.locator('.photo-landmark-reel[data-active=true]').waitFor();
  for(let n=0;n<12;n++){
   const active=page.locator('.photo-landmark-reel[data-active=true]'),id=await active.getAttribute('data-place-id');
   if(report.saved.some(p=>p.id===id))break;
   const label=await active.locator('h2').textContent();await active.getByRole('button',{name:label+' 저장',exact:true}).click();report.saved.push({id,label});
   await page.keyboard.press('ArrowDown');await page.waitForFunction(id=>document.querySelector('.photo-landmark-reel[data-active=true]')?.dataset.placeId!==id,id);
  }
  await page.goto('http://127.0.0.1:5210/?audit=density#saved');await page.locator('.saved-card').first().waitFor();report.screens.push(await snapshot(page,320,'saved-many',false));
  await page.getByRole('button',{name:'바로 만들기',exact:true}).click();report.screens.push(await snapshot(page,320,'saved-many-period',false));
  await page.getByRole('button',{name:'1박 2일 · 바로 만들기',exact:true}).click();
  report.result=await page.evaluate(()=>({hash:location.hash,error:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent),text:document.querySelector('.personal-trip')?.innerText,dialog:document.querySelector('[role=dialog]')?.innerText}));
  report.screens.push(await snapshot(page,320,'saved-many-auto-result',false));
  console.log(JSON.stringify({saved:report.saved,result:report.result,overflows:report.screens.map(s=>({name:s.name,overflow:s.overflow})),errors:report.errors},null,2));
 }finally{fs.writeFileSync(__dirname+'/density-results.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
