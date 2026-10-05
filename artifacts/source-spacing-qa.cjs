const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const stage = process.argv[2] || 'before';
const output = 'artifacts/source-spacing-qa';
(async () => {
  fs.mkdirSync(output, {recursive:true}); const records = [];
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const width of [320,390,460]) {
      const context = await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
      const page = await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:5173/#journey-public-busan-coast-day'); await page.evaluate(()=>document.fonts.ready);
      const snapshot=await page.evaluate(()=>{
        const first=document.querySelector('.story-image-block'); const caption=first.querySelector('figcaption'); const credit=first.querySelector('.public-photo-credit-button');
        const textRects=el=>{ const range=document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()]; };
        const capRects=textRects(caption); const creditRect=textRects(credit)[0];
        const lead=document.querySelector('.journal-lead'); const leadButton=lead.querySelector('.public-photo-credit-button');
        const style=el=>{ const s=getComputedStyle(el);return {font:s.font,fontSize:s.fontSize,padding:s.padding,margin:s.margin,height:el.getBoundingClientRect().height};};
        return {referenceGap:capRects[0].top-first.querySelector('img').getBoundingClientRect().bottom,captionSourceGap:creditRect.top-capRects.at(-1).bottom,coverSourceGap:textRects(leadButton)[0].top-lead.getBoundingClientRect().top,caption:style(caption),button:style(credit),lead:style(lead),horizontal:document.documentElement.scrollWidth>innerWidth};
      });
      const lead=page.locator('.journal-lead'); await lead.evaluate(el=>el.scrollIntoView({block:'start'}));
      await page.screenshot({path:`${output}/${stage}-lead-${width}.png`});
      const figure=page.locator('.story-image-block').first(); await figure.locator('img').evaluate(el=>el.decode().catch(()=>{}));
      await figure.evaluate(el=>el.scrollIntoView({block:'center'})); await page.screenshot({path:`${output}/${stage}-caption-${width}.png`});
      await figure.getByRole('button',{name:'사진 출처',exact:true}).click(); await page.getByRole('dialog',{name:'사진 출처',exact:true}).waitFor();
      assert.ok((await page.getByRole('dialog').innerText()).includes('공공누리 제1유형'));
      await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'detached'});
      assert.equal(snapshot.horizontal,false); assert.deepEqual(errors,[]);
      records.push({width,...snapshot}); console.log(JSON.stringify({width,reference:snapshot.referenceGap,captionSource:snapshot.captionSourceGap,coverSource:snapshot.coverSourceGap}));
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${output}/${stage}.json`,JSON.stringify(records,null,2));
})();
