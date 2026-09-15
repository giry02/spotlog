const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    for (const [kind, count] of [['development-summary',8],['development-plan',33],['ai-guide-plan',57],['ai-guide-summary',5]]) {
      await page.goto('http://127.0.0.1:5194/spotlog-'+kind+'.html');
      await page.waitForSelector('.slide.active');
      assert.equal(await page.locator('.slide').count(),count);
      const content = await page.locator('#report').textContent();
      assert(!/3주|개발자 [ABC]|30인일|2인 기준|1일차|2일차|5일차/.test(content),kind+' stale schedule');
      if(kind==='development-plan') for(let i=1;i<=19;i++) assert(content.includes('F'+String(i).padStart(2,'0')));
      for(let i=1;i<=count;i++) {
        await page.evaluate(i=>location.hash='slide-'+i,i);
        await page.waitForFunction(i=>document.querySelector('.slide.active').id==='slide-'+i,i);
        const metrics=await page.locator('.slide.active').evaluate(s=>({height:s.offsetHeight,horizontal:document.documentElement.scrollWidth>innerWidth,overlap:s.querySelector('.slide-content').getBoundingClientRect().bottom>s.querySelector('.slide-footer').getBoundingClientRect().top+1}));
        results.push({kind,page:i,...metrics});
        if(kind==='development-summary'||(kind==='development-plan'&&[11,16,17,23,24,30].includes(i))||(kind==='ai-guide-plan'&&[45,46].includes(i))) await page.screenshot({path:__dirname+'/'+kind+'-'+i+'.png'});
      }
      await page.keyboard.press('Home');
      await page.waitForFunction(()=>document.querySelector('.slide.active').id==='slide-1');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(()=>document.querySelector('.slide.active').id==='slide-2');
      await page.locator('[data-toc]').click();
      await page.locator('dialog a[href="#slide-1"]').click();
      await page.waitForFunction(()=>document.querySelector('.slide.active').id==='slide-1');
      await page.emulateMedia({media:'print'});
      const print=await page.locator('.slide').evaluateAll(ss=>ss.map(s=>({page:s.id,overflow:s.scrollHeight>s.clientHeight+1,overlap:s.querySelector('.slide-content').getBoundingClientRect().bottom>s.querySelector('.slide-footer').getBoundingClientRect().top+1})));
      results.push({kind,print});
      await page.emulateMedia({media:'screen'});
      if(kind==='development-summary') {
        await page.setViewportSize({width:390,height:844});
        for(let i=1;i<=count;i++) {
          await page.evaluate(i=>location.hash='slide-'+i,i);
          await page.waitForFunction(i=>document.querySelector('.slide.active').id==='slide-'+i,i);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        }
        await page.evaluate(()=>location.hash='slide-4');
        await page.waitForFunction(()=>document.querySelector('.slide.active').id==='slide-4');
        await page.screenshot({path:__dirname+'/mobile.png'});
        await page.setViewportSize({width:1440,height:1000});
      }
    }
  } finally {await browser.close();}
  fs.writeFileSync(__dirname+'/results.json',JSON.stringify({errors,results},null,2));
  const failures=results.filter(r=>r.horizontal||r.overlap||r.height>770||r.print?.some(p=>p.overflow||p.overlap));
  console.log(JSON.stringify({errors,checked:results.filter(r=>r.page).length,failures}));
  assert.equal(errors.length,0);assert.equal(failures.length,0);
})().catch(e=>{console.error(e);process.exitCode=1;});
