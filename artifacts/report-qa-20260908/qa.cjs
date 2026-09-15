const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out = __dirname;
const base = 'file:///C:/Users/Giry/Documents/Spotlog/web/public/';
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const records=[];
  for (const [name,count] of [['development',32],['ai-guide',34]]) {
    const page = await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}spotlog-${name}-plan.html`);
    await page.waitForSelector('html[data-report-ready="true"]');
    assert.equal(await page.locator('.slide').count(),count);
    const screen=[];
    for(let i=1;i<=count;i++){
      await page.evaluate(n=>{location.hash=`slide-${n}`;},i);
      await page.locator(`#slide-${i}.active`).waitFor();
      const m=await page.evaluate(()=>{
        const a=document.querySelector('.slide.active'),s=document.querySelector('.stage');
        const content=a.querySelector('.slide-content');
        const footer=a.querySelector('.slide-footer');
        return {title:a.dataset.title,height:Math.round(a.getBoundingClientRect().height),stage:s.clientHeight,verticalOverflow:s.scrollHeight>s.clientHeight+2,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,footerOverlap:content.getBoundingClientRect().bottom>footer.getBoundingClientRect().top+2,chars:content.textContent.length};
      });
      const file=path.join(out,`${name}-${String(i).padStart(2,'0')}.png`);
      await page.locator('.slide.active').screenshot({path:file});
      screen.push({page:i,...m});
    }
    await page.keyboard.press('Home');assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-1');
    assert.equal(await page.locator('[data-prev]').isDisabled(),true);
    await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-2');
    await page.locator('[data-toc]').click();await page.locator('dialog a[href="#slide-12"]').click();
    assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-12');
    assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);
    await page.reload();await page.waitForSelector('#slide-12.active');
    await page.keyboard.press('End');assert.equal(await page.locator('[data-next]').isDisabled(),true);
    await page.locator('[data-all]').click();assert.equal(await page.locator('.slide:visible').count(),count);
    await page.locator('[data-all]').click();assert.equal(await page.locator('.slide:visible').count(),1);
    await page.evaluate(()=>{location.hash='slide-999';});await page.locator(`#slide-${count}.active`).waitFor();
    await page.evaluate(()=>{location.hash='invalid';});await page.locator('#slide-1.active').waitFor();
    const links=await page.locator('a[href]').evaluateAll(els=>els.map(e=>e.getAttribute('href')));
    for(const href of links.filter(s=>s.startsWith('./')&&!s.startsWith('./#'))){assert.ok(fs.existsSync(path.resolve('web/public',href.split('#')[0])),href);}
    if(name==='ai-guide'){
      await page.evaluate(()=>{location.hash='slide-29';});await page.locator('#slide-29.active').waitFor();
      assert.equal(await page.locator('[data-cost-total]').innerText(),'단가 확인 필요');
      for(const [key,value] of Object.entries({generationCost:'10',questionCost:'2',routeCost:'1',translationCost:'10000',storageCost:'5000'}))await page.locator(`[name="${key}"]`).fill(value);
      assert.equal(await page.locator('[data-cost-total]').innerText(),'51,000 원');
      await page.locator('[name="generationCost"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-29');
      await page.locator('[name="routeCost"]').fill('');assert.equal(await page.locator('[data-cost-total]').innerText(),'단가 확인 필요');
      for(const key of ['generationCost','questionCost','translationCost','storageCost'])await page.locator(`[name="${key}"]`).fill('');
    }
    const mobile=[];
    for(const width of [360,390,430]){
      await page.setViewportSize({width,height:844});
      for(let i=1;i<=count;i++){
        await page.evaluate(n=>{location.hash=`slide-${n}`;},i);await page.locator(`#slide-${i}.active`).waitFor();
        mobile.push(await page.evaluate(({width,i})=>({width,page:i,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,buttonsVisible:[...document.querySelectorAll('[data-prev],[data-next],[data-toc]')].every(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;})}),{width,i}));
      }
      await page.evaluate(()=>{location.hash='slide-13';});await page.locator('#slide-13.active').waitFor();
      await page.screenshot({path:path.join(out,`${name}-mobile-${width}.png`)});
    }
    await page.setViewportSize({width:1440,height:960});
    await page.emulateMedia({media:'print'});
    const print=await page.locator('.slide').evaluateAll(els=>els.map((p,i)=>{const r=p.getBoundingClientRect();const f=p.querySelector('.slide-footer').getBoundingClientRect();const c=p.querySelector('.slide-content').getBoundingClientRect();return {page:i+1,height:r.height,overflow:f.bottom>r.bottom-10,footerOverlap:c.bottom>f.top+1,horizontal:p.scrollWidth>p.clientWidth+2};}));
    await page.pdf({path:path.join(out,`${name}.pdf`),preferCSSPageSize:true,printBackground:true});
    await page.emulateMedia({media:'screen'});
    records.push({name,count,errors,screen,mobile,print,links:[...new Set(links)]});
    await page.close();
    for(let start=1;start<=count;start+=6){
      const composites=[];const rows=Math.ceil(Math.min(6,count-start+1)/2);
      for(let j=0;j<6&&start+j<=count;j++){
        const input=await sharp(path.join(out,`${name}-${String(start+j).padStart(2,'0')}.png`)).resize(700,520,{fit:'contain',background:'#e9ebed'}).png().toBuffer();
        composites.push({input,left:(j%2)*710,top:Math.floor(j/2)*530});
      }
      await sharp({create:{width:1420,height:rows*530,channels:3,background:'#e9ebed'}}).composite(composites).png().toFile(path.join(out,`${name}-contact-${start}.png`));
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(records,null,2));
  const issues=records.flatMap(r=>[...r.errors.map(error=>({name:r.name,error})),...r.screen.filter(x=>x.verticalOverflow||x.horizontalOverflow||x.footerOverlap).map(x=>({name:r.name,type:'screen',...x})),...r.mobile.filter(x=>x.horizontalOverflow||!x.buttonsVisible).map(x=>({name:r.name,type:'mobile',...x})),...r.print.filter(x=>x.overflow||x.footerOverlap||x.horizontal).map(x=>({name:r.name,type:'print',...x}))]);
  console.log(JSON.stringify({counts:records.map(r=>[r.name,r.count]),issues},null,2));
  if(issues.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
