const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    for (const [kind,count,capture] of [['development-plan',36,[9,12,15]],['development-summary',11,[3,6]],['ai-guide-plan',57,[5,45]],['ai-guide-summary',5,[2]]]) {
      await page.goto('http://127.0.0.1:5173/spotlog-'+kind+'.html');
      await page.waitForSelector('.slide.active');
      assert.equal(await page.locator('.slide').count(),count);
      const content=await page.locator('#report').textContent();
      assert(!/collectionId|이름 있는 보관함|보관함 생성·이름|여행별 컬렉션|보관함 이동|담기 창에서/.test(content),kind+' stale collection flow');
      assert(content.includes('내 여행 상세'),kind+' creation destination missing');
      if(kind==='development-plan') for(let i=1;i<=20;i++) assert(content.includes('F'+String(i).padStart(2,'0')));
      for(let i=1;i<=count;i++) {
        await page.evaluate(i=>location.hash='slide-'+i,i);
        await page.waitForFunction(i=>document.querySelector('.slide.active').id==='slide-'+i,i);
        const metrics=await page.locator('.slide.active').evaluate(s=>({height:s.offsetHeight,horizontal:document.documentElement.scrollWidth>innerWidth,overlap:s.querySelector('.slide-content').getBoundingClientRect().bottom>s.querySelector('.slide-footer').getBoundingClientRect().top+1}));
        results.push({kind,page:i,...metrics});
        if(capture.includes(i)) await page.screenshot({path:__dirname+'/saved-direction-'+kind+'-'+i+'.png'});
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
      await page.setViewportSize({width:390,height:844});
      for(let i=1;i<=count;i++) {
        await page.evaluate(i=>location.hash='slide-'+i,i);
        await page.waitForFunction(i=>document.querySelector('.slide.active').id==='slide-'+i,i);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),kind+' mobile width '+i);
      }
      await page.setViewportSize({width:1440,height:1000});
    }
  } finally {await browser.close();}
  fs.writeFileSync(__dirname+'/saved-direction-report-qa.json',JSON.stringify({errors,results},null,2));
  const failures=results.filter(r=>r.horizontal||r.overlap||r.height>770||r.print?.some(p=>p.overflow||p.overlap));
  console.log(JSON.stringify({errors,checked:results.filter(r=>r.page).length,failures}));
  assert.equal(errors.length,0);assert.equal(failures.length,0);
})().catch(e=>{console.error(e);process.exitCode=1;});
