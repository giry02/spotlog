const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const release = 'C:/Users/Giry/Documents/Spotlog-Publish-20260911';
const baseline = 'http://127.0.0.1:5190/spotlog/';
const base = 'http://127.0.0.1:5189/spotlog/';
const output = path.join(__dirname, 'ai-publication-qa'); fs.mkdirSync(output, { recursive: true });
const records = [], errors = [];
const gitFile = name => cp.execFileSync('git', ['show', 'HEAD:' + name], { cwd: release, encoding: 'utf8', maxBuffer: 2000000 }).replaceAll('\r\n', '\n');
for (const name of ['web/src/styles.css', 'web/src/main.tsx']) assert.equal(fs.readFileSync(path.join(release, name), 'utf8').replaceAll('\r\n', '\n'), gitFile(name));
for (const name of ['AiTravelSheet.tsx','AddToTripSheet.tsx','PhotoLandmarkFeed.tsx','phase-one.css','theme.css','localRepository.ts','LandmarkGuideCard.tsx']) assert.ok(!fs.existsSync(path.join(release, 'web/src', name)), 'out-of-scope file: ' + name);
const ts = require('C:/Users/Giry/Documents/Spotlog/node_modules/typescript');
const functions = source => new Map(ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).statements.filter(ts.isFunctionDeclaration).map(s => [s.name?.text, s.getText()]));
const original = functions(gitFile('web/src/App.tsx')), updated = functions(fs.readFileSync(path.join(release, 'web/src/App.tsx'), 'utf8'));
const allowed = new Set(['App','Home','Community','JourneySection','CreatorJourneySection','JourneyDetail','GuidePlaceEmbed','JourneyEditor','EditorPlaceBlock','Profile']);
for (const [name, code] of original) if (!allowed.has(name)) assert.equal(updated.get(name)?.replaceAll('\r\n','\n'), code, 'unrelated function changed: ' + name);
function inspectLayout() {
  const app = document.querySelector('.app-shell');
  return { width: innerWidth, scroll: document.documentElement.scrollWidth, appWidth: app.getBoundingClientRect().width,
    h1: [...document.querySelectorAll('h1')].map(e => e.textContent),
    controls: [...document.querySelectorAll('.app-header,.home-topbar,.home-lead,.ai-trip-card,.place-view-toggle')].map(e => ({className:e.className, width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize,padding:getComputedStyle(e).padding})) };
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320,390,460]) {
      const context = await browser.newContext({ viewport:{width,height:900}, reducedMotion:'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', res => { if(res.url().startsWith(base)&&res.status()>=400) errors.push(res.status()+' '+res.url()); });
      for (const route of ['home','saved','places-guide','places-video']) {
        await page.goto(baseline+'#'+route); await page.locator('.app-shell').waitFor(); await page.evaluate(()=>document.fonts.ready);
        const before = await page.evaluate(inspectLayout);
        await page.screenshot({path:path.join(output, `before-${route}-${width}.png`)});
        await page.goto(base+'#'+route); await page.locator('.app-shell').waitFor(); await page.evaluate(()=>document.fonts.ready);
        const after = await page.evaluate(inspectLayout);
        assert.deepEqual(after, before, 'baseline mismatch '+route+' '+width);
        assert.equal(await page.getByRole('button',{name:'AI 여행 만들기',exact:true}).count(),0);
        assert.equal(await page.locator('.place-view-toggle').getByRole('button',{name:'사진',exact:true}).count(),0);
        await page.screenshot({path:path.join(output, `after-${route}-${width}.png`)});
        records.push({type:'unchanged-screen',route,width});
      }
      await page.goto(base+'#community'); await page.getByRole('button',{name:'AI 추천 여행',exact:true}).click();
      assert.equal(await page.locator('.community-card').count(),4);
      await page.screenshot({path:path.join(output,`ai-tab-${width}.png`)});
      await page.getByRole('button',{name:'부산',exact:true}).click(); assert.equal(await page.locator('.community-card').count(),3);
      await page.getByRole('button',{name:'경주',exact:true}).click(); assert.equal(await page.locator('.community-card').count(),1);
      await page.getByRole('button',{name:'전체',exact:true}).click();
      await page.getByRole('button',{name:'당일치기',exact:true}).click(); assert.equal(await page.locator('.community-card').count(),1);
      await page.locator('.destination-search input').fill('no-such-trip'); assert.equal(await page.locator('.community-card').count(),0);
      await page.getByRole('button',{name:'전체 여행기 보기',exact:true}).click(); assert.equal(await page.locator('.community-card').count(),4);
      assert.equal(await page.getByRole('button',{name:'AI 추천 여행',exact:true}).getAttribute('aria-pressed'),'true');
      // Visit every recommendation, every DAY, and its independent attribution panel.
      for (let trip = 0; trip < 4; trip++) {
        await page.locator('.community-cover').nth(trip).click(); await page.locator('.journey-detail').waitFor();
        const hash = await page.evaluate(()=>location.hash);
        const days = page.locator('.day-tabs button:not(.day-tabs-back)'); const count=await days.count();
        for (let day=0; day<count; day++) {
          await days.nth(day).click();
          await page.waitForFunction(()=>[...document.querySelectorAll('.story-image-block img')].every(img=>img.complete&&img.naturalWidth>0));
          assert.ok(await page.locator('.story-image-block img').count());
          assert.equal(await page.locator('.guide-place-embed img').count(),0);
          records.push({type:'story-day',width,trip,day});
        }
        await page.locator('.public-source-disclosure').click(); await page.getByRole('dialog').waitFor();
        assert.ok(await page.locator('.public-source-item').count());
        assert.ok(await page.getByRole('dialog').getByText('공공누리 제1유형',{exact:true}).count());
        assert.equal(await page.evaluate(()=>document.querySelector('.app-shell').inert),true);
        await page.screenshot({path:path.join(output,`source-${width}-${trip}.png`)});
        await page.goBack(); await page.getByRole('dialog').waitFor({state:'hidden'});
        assert.equal(await page.evaluate(()=>location.hash),hash);
        await page.locator('.story-image-block .public-photo-credit-button').first().click(); await page.getByRole('dialog').waitFor();
        await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'hidden'});
        assert.equal(await page.evaluate(()=>document.querySelector('.app-shell').inert),false);
        await page.locator('.detail-topbar button[aria-label="뒤로"]').click();
        await page.locator('.community-card').first().waitFor();
        assert.equal(await page.locator('.community-card').count(),4);
      }
      await page.locator('.community-cover').first().click();
      const originalHash = await page.evaluate(()=>location.hash);
      await page.getByRole('button',{name:'이 여행 복사해서 만들기',exact:true}).click();
      await page.waitForFunction(previous=>location.hash!==previous&&(location.hash.includes('journey-')||location.hash.includes('edit-')),originalHash);
      assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('spotlog.web.journeys.v4')).some(j=>j.isMine&&j.sourceJourneyId==='public-busan-coast-day')));
      assert.ok(await page.locator('.public-photo-credit').count());
      await page.reload(); await page.locator('.app-shell').waitFor();
      assert.ok(await page.locator('.public-photo-credit').count());
      records.push({type:'filter-copy-refresh',width});
      await context.close();
    }
  } finally { await browser.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({records,errors},null,2)); }
  console.log(JSON.stringify({records:records.length,errors})); if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
