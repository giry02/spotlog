/* Isolated document-only checks. Never opens service/customer storage. */
const {chromium} = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const report = path.join(root, 'deliverables/spotlog-triple-strategy-20261028.html');
const out = path.join(__dirname, 'equal-focus-revision');
fs.mkdirSync(out, {recursive:true});
const findings = {pages:0,errors:[],checks:[],desktop:[],mobile:[],print:[]};
(async()=>{
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const context = await browser.newContext({viewport:{width:1400,height:950}});
  await context.route(/^https?:/,route=>route.abort());
  const page = await context.newPage();
  page.on('pageerror',e=>findings.errors.push(e.message));
  await page.goto(pathToFileURL(report).href);
  await page.waitForFunction(()=>document.documentElement.dataset.reportReady==='true');
  findings.pages = await page.locator('.slide').count();
  assert.equal(findings.pages,38);
  for(const phrase of ['서비스 범위: 일상 활동·모임·여행','여행이 없어도 지속적으로 이용함','일상 활동·모임의 독립적인 완료 기준','여행도 이 안에서 깊게 지원하는 핵심 이용 영역임']) {
    assert.ok(await page.locator('#report').evaluate((el,t)=>el.textContent.includes(t),phrase),`missing equal-core scope: ${phrase}`);
  }
  const internalLinks=await page.locator('.slide a[href^="#slide-"]').evaluateAll(els=>els.map(el=>el.getAttribute('href')));
  for(const href of internalLinks) assert.equal(await page.locator(href).count(),1,`invalid internal link ${href}`);
  for(const text of ['첫 수락','동네·취향 모임','전체 채팅','활동 채팅','고정 예시','비공개 대화','반복 일정','모집 쉬기']) {
    assert.ok((await page.locator('#report').innerText()).includes(text)||await page.locator('#report').evaluate((el,t)=>el.textContent.includes(t),text),`missing group coverage ${text}`);
  }
  await page.locator('[data-next]').click();
  assert.equal(await page.locator('[data-current]').innerText(),'02');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-current]').innerText(),'03');
  await page.keyboard.press('Home');
  assert.equal(await page.locator('[data-prev]').isDisabled(),true);
  await page.locator('[data-toc]').click();
  await page.locator('dialog a[href="#slide-15"]').click();
  assert.equal(await page.locator('[data-current]').innerText(),'15');
  assert.equal(await page.locator('dialog').isVisible(),false);
  await page.reload();
  assert.equal(await page.locator('[data-current]').innerText(),'15');
  await page.keyboard.press('End');
  assert.equal(await page.locator('[data-next]').isDisabled(),true);
  await page.locator('[data-all]').click();
  assert.equal(await page.locator('.slide:visible').count(),findings.pages);
  await page.locator('[data-all]').click();
  assert.equal(await page.locator('.slide:visible').count(),1);
  findings.checks.push(`${findings.pages} pages / next / keyboard / Home-End / TOC / deep-link reload / all view / group coverage / internal links`);
  for(let n=1;n<=findings.pages;n++){
    await page.evaluate(n=>{location.hash=`slide-${n}`},n);
    await page.waitForFunction(n=>document.querySelector('.slide.active').id===`slide-${n}`,n);
    await page.evaluate(()=>document.activeElement?.blur());
    const box=await page.locator('.slide.active').evaluate(el=>({height:el.getBoundingClientRect().height,overflow:el.scrollWidth-el.clientWidth,title:el.dataset.title}));
    findings.desktop.push({page:n,...box});
    assert.ok(box.overflow<=1,`desktop horizontal overflow ${n}`);
    assert.ok(box.height<=790,`desktop oversized page ${n}: ${box.height}`);
    await page.locator('.slide.active').screenshot({path:path.join(out,`page-${String(n).padStart(2,'0')}.png`)});
  }
  for(const width of [320,390,760]){
    await page.setViewportSize({width,height:844});
    for(let n=1;n<=findings.pages;n++){
      await page.evaluate(n=>{location.hash=`slide-${n}`},n);
      await page.waitForFunction(n=>document.querySelector('.slide.active').id===`slide-${n}`,n);
      const state=await page.evaluate(()=>({body:document.documentElement.scrollWidth-innerWidth,stage:document.querySelector('.stage').scrollWidth-document.querySelector('.stage').clientWidth}));
      findings.mobile.push({width,page:n,...state});
      assert.ok(state.body<=1&&state.stage<=1,`mobile overflow ${width} page ${n}: ${JSON.stringify(state)}`);
      const end=await page.evaluate(()=>{
        const stage=document.querySelector('.stage');stage.scrollTop=stage.scrollHeight;
        const rect=stage.getBoundingClientRect(),footer=document.querySelector('.slide.active .slide-footer').getBoundingClientRect();
        return {bottom:footer.bottom,top:footer.top,stageTop:rect.top,stageBottom:rect.bottom};
      });
      assert.ok(end.bottom<=end.stageBottom+1&&end.top>=end.stageTop,`unreachable mobile footer ${width} page ${n}`);
    }
    await page.evaluate(()=>{location.hash='slide-23'});
    await page.waitForFunction(()=>document.querySelector('.slide.active').id==='slide-23');
    if(width<650) {
      await page.waitForFunction(()=>document.querySelector('.slide.active .table-scroll-hint').dataset.scrollable==='true');
      assert.equal(await page.locator('.slide.active .table-scroll-hint').isVisible(),true);
      await page.locator('.slide.active .table-wrap').focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(()=>document.querySelector('.slide.active .table-wrap').scrollLeft>0);
      assert.equal(await page.locator('[data-current]').innerText(),'23');
      await page.locator('.slide.active .table-wrap').evaluate(el=>{el.scrollLeft=0;el.blur()});
    }
    await page.screenshot({path:path.join(out,`mobile-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:1400,height:950});
  await page.emulateMedia({media:'print'});
  findings.print=await page.locator('.slide').evaluateAll(els=>els.map((el,i)=>{
    const rect=el.getBoundingClientRect(),footer=el.querySelector('.slide-footer').getBoundingClientRect();
    return {page:i+1,height:rect.height,overflow:Math.max(0,footer.bottom+20-rect.bottom),horizontal:el.scrollWidth-el.clientWidth};
  }));
  for(const p of findings.print) assert.ok(p.overflow<=1&&p.horizontal<=1,`print overflow ${JSON.stringify(p)}`);
  await page.pdf({path:path.join(out,'print-check.pdf'),preferCSSPageSize:true,printBackground:true});
  assert.deepEqual(findings.errors,[]);
  findings.checks.push(`${findings.pages} desktop screenshots / ${findings.pages*3} narrow-width page and scroll-end checks / ${findings.pages} print geometry checks / no page exceptions`);
  fs.writeFileSync(path.join(out,'qa-results.json'),JSON.stringify(findings,null,2));
  await browser.close();
  console.log(JSON.stringify({pages:findings.pages,checks:findings.checks,errors:findings.errors}));
})().catch(e=>{fs.writeFileSync(path.join(out,'qa-results.json'),JSON.stringify({...findings,failure:String(e)},null,2));console.error(e);process.exit(1)});
