const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = 'artifacts/photo-caption-qa';
(async () => {
  fs.mkdirSync(output,{recursive:true}); const results=[];
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const width of [320,390,460]) {
      const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
      const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:5173/#home');
      const seeds=await page.evaluate(async()=>{
        const {publicTourismJourneys,publicTourismSources}=await import('/src/publicTourismContent.ts');
        return {journeys:publicTourismJourneys,sources:publicTourismSources};
      });
      const blocks=seeds.journeys.flatMap(j=>j.days.flatMap(d=>d.blocks.filter(b=>b.type==='IMAGE')));
      assert.ok(blocks.length>=11); assert.ok(blocks.every(b=>!b.caption.includes('\n사진:')));
      const legacy=structuredClone(seeds.journeys[0]);legacy.id='qa-legacy-credits';legacy.isMine=true;legacy.visibility='PRIVATE';legacy.status='PLANNING';legacy.title='보존할 기존 여행';
      for(const day of legacy.days) for(const block of day.blocks) if(block.type==='IMAGE') {
        const s=seeds.sources.find(s=>s.image===block.image);const owner=s.author===s.owner||s.author==='개별 촬영자 미표기'?s.owner:`${s.owner} · ${s.author}`;
        block.caption+=`\n사진: ${owner} · ${s.license}`;
      }
      const original=legacy.days[0].blocks.find(b=>b.type==='IMAGE');
      for (const mode of ['public','legacy']) {
        await page.evaluate(({legacy})=>localStorage.setItem('spotlog.local.repository.v2',JSON.stringify({schemaVersion:2,updatedAt:'2026-09-10T00:00:00Z',records:{'spotlog.web.journeys.v4':JSON.stringify([legacy]),'spotlog.web.saved.v3':'[]'}})),{legacy});
        await page.goto(`http://127.0.0.1:5173/#journey-${mode==='legacy'?legacy.id:seeds.journeys[0].id}`);await page.reload();await page.evaluate(()=>document.fonts.ready);
        const before=await page.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2'));
        const figure=page.locator('.story-image-block').first();await figure.waitFor();
        assert.ok(!(await figure.locator('figcaption').innerText()).includes('공공누리'));
        assert.ok((await figure.locator('figcaption').innerText()).startsWith(original.caption.split('\n사진:')[0]));
        assert.equal(await figure.getByRole('button',{name:'사진 출처',exact:true}).count(),1);
        assert.ok(!(await figure.locator('img').getAttribute('alt')).includes('공공누리'));
        await figure.locator('img').evaluate(img=>img.decode().catch(()=>{}));await figure.evaluate(el=>el.scrollIntoView({block:'center'}));
        await page.screenshot({path:`${output}/${mode}-${width}.png`});
        await figure.getByRole('button',{name:'사진 출처',exact:true}).click();
        const dialog=page.getByRole('dialog',{name:'사진 출처',exact:true});await dialog.waitFor();
        const text=await dialog.innerText();for(const value of ['부산광역시','공공누리 제1유형','2026-09-10']) assert.ok(text.includes(value));
        assert.equal(await dialog.getByRole('link',{name:'공식 자료 보기',exact:true}).count(),1);
        await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
        assert.equal(await page.evaluate(()=>localStorage.getItem('spotlog.local.repository.v2')),before);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        const stored=await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records['spotlog.web.journeys.v4']));
        assert.equal(stored.find(j=>j.id==='qa-legacy-credits').days[0].blocks.find(b=>b.type==='IMAGE').caption,original.caption);
        results.push({width,mode,cleanCaption:true,sourcePopupIntact:true,storedLegacyCaptionUnchanged:true});console.log('PASS',mode,width);
      }
      assert.deepEqual(errors,[]);await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));
})();
