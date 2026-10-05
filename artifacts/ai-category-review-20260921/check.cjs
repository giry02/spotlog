const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  const results = [];
  try {
    for (const width of [320,390,460]) {
      const context = await browser.newContext({viewport:{width,height:900}});
      const page = await context.newPage();
      const errors = []; page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:5210/#home');
      await page.getByRole('button',{name:/AI 여행 만들기/}).click();
      const sheet = page.locator('.phase-sheet');
      assert.equal(await sheet.locator('select').count(),4);
      assert.equal(await sheet.locator('details').count(),0);
      await sheet.locator('textarea').fill('부산 1박 2일, 해운대 바다를 보고 맛집과 숙소도 추천해줘. 카페는 빼줘.');
      await sheet.getByRole('button',{name:'초안 만들기',exact:true}).click();
      await sheet.locator('.ai-travel-preview').waitFor();
      const route = sheet.locator('.ai-planner-route');
      for (const kind of ['LANDMARK','FOOD','STAY']) {
        assert.ok(await route.locator(`.ai-planner-kind[data-kind="${kind}"]`).count()>0,kind);
      }
      const styles = await route.evaluate(el=>({
        overflow:el.scrollWidth>el.clientWidth,
        badges:[...el.querySelectorAll('.ai-planner-kind')].map(n=>({kind:n.dataset.kind,label:n.textContent,size:getComputedStyle(n).fontSize,color:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor,icon:!!n.querySelector('svg')})),
        titles:[...el.querySelectorAll('.ai-planner-route-copy>strong')].map(n=>getComputedStyle(n).fontSize),
      }));
      assert.equal(styles.overflow,false);
      assert.ok(styles.badges.every(b=>b.size==='12px'&&b.icon));
      assert.ok(styles.titles.every(size=>size==='16px'||size==='14px'));
      const kindColors = new Map(styles.badges.map(b=>[b.kind,b.color]));
      assert.equal(new Set(kindColors.values()).size,kindColors.size);
      assert.equal(await route.locator('.ai-planner-gap').count(),0);
      assert.ok(await route.locator('.ai-planner-photo-empty').count()>0);
      await route.evaluate(el=>{const body=el.closest('.phase-sheet-body');body.scrollTop+=el.getBoundingClientRect().top-body.getBoundingClientRect().top-16;});
      await sheet.screenshot({path:path.join(__dirname,`route-${width}.png`)});
      await route.locator('li').last().evaluate(el=>{const body=el.closest('.phase-sheet-body');body.scrollTop+=el.getBoundingClientRect().bottom-body.getBoundingClientRect().bottom+100;});
      await sheet.screenshot({path:path.join(__dirname,`route-end-${width}.png`)});
      await sheet.getByRole('button',{name:'일정 수정',exact:true}).click();
      const business = sheet.locator('.ai-planner-business-section');
      await business.getByRole('button',{name:'숙소',exact:true}).click();
      const candidateNames = await business.locator('.ai-planner-business-copy>strong').allTextContents();
      assert.ok(candidateNames.length>=5);
      await business.evaluate(el=>{const body=el.closest('.phase-sheet-body');body.scrollTop+=el.getBoundingClientRect().top-body.getBoundingClientRect().top-16;});
      await sheet.screenshot({path:path.join(__dirname,`stay-candidates-${width}.png`)});
      assert.equal(await sheet.evaluate(el=>el.scrollWidth>el.clientWidth),false);
      await sheet.getByRole('button',{name:'수정 완료',exact:true}).click();
      await sheet.getByRole('button',{name:'닫기',exact:true}).click();
      await page.reload();
      await page.getByRole('button',{name:/AI 여행 만들기/}).click();
      await sheet.locator('.ai-travel-preview').waitFor();
      assert.ok(await sheet.locator('.ai-planner-kind[data-kind="STAY"]').count()>0);
      const draft = await page.evaluate(()=>JSON.parse(localStorage.getItem('spotlog.ai-planner-draft.v1:local-profile')).draft.preview.data.journey);
      const newIds = draft.days.flatMap(day=>day.places).filter(p=>p.id.startsWith('catalog-busan-')).map(p=>p.id);
      assert.ok(newIds.length>=3);
      await sheet.getByRole('button',{name:/내 여행에 저장/}).click();
      await page.locator('.personal-trip').waitFor();
      const saved = await page.evaluate(id=>JSON.parse(JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records['spotlog.web.journeys.v4']).find(journey=>journey.id===id),draft.id);
      assert.equal(saved.visibility,'PRIVATE');
      assert.deepEqual(saved.days.flatMap(day=>day.places).map(p=>p.id),draft.days.flatMap(day=>day.places).map(p=>p.id));
      assert.deepEqual(errors,[]);
      results.push({width,...styles,candidateNames,restored:true,savedNewPlaceIds:newIds,errors});
      await context.close();
    }
    fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
