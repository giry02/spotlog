const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

// New isolated contexts only. Never attach to a user's existing browser/storage.
const out = path.join(__dirname, 'style-guide-qa');
const place = { id: 'seoul-seoulforest', kind: 'LANDMARK', name: '서울숲', area: '서울 성동', address: '서울 성동구 뚝섬로 273', lat: 37.5444, lng: 127.0374, image: '', description: '원본을 보존할 기록', note: '여행자 메모', duration: '1시간' };
const journey = { id: 'qa-style-trip', title: '서울에서 보내는 느긋한 이틀', region: '서울', dateRange: '2026-10-01 ~ 2026-10-02', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: '산책과 사진을 남기는 주말 여행', story: '기존 원문 유지', tags: [], saves: 0, author: '스타일 검수', isMine: true, days: [1,2].map(day => ({ day, date: `2026-10-0${day}`, title: `${day}일차 기록`, story: '날짜별 본문 보존', places: day === 1 ? [{ ...place, visitId: 'qa-style-visit' }] : [], blocks: day === 1 ? [{ id: 'qa-style-block', type: 'PLACE', placeId: place.id, visitId: 'qa-style-visit' }, { id: 'qa-style-text', type: 'TEXT', body: '사진과 장소 사이에 남기는 여행자의 긴 본문입니다. 주변 풍경을 천천히 돌아보며 기록합니다.' }] : [] })) };
const seed = { 'spotlog.web.saved.v3': JSON.stringify(['jeju-hyeopjae','gangneung-anmok','seoul-seoulforest']), 'spotlog.web.journeys.v4': JSON.stringify([journey]) };
const results = { checkedAt: new Date().toISOString(), cases: [], failures: [], measurements: [], screenshots: [], pageErrors: [] };
const check = (name, condition, detail) => { (condition ? results.cases : results.failures).push({ name, detail }); };

async function state(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('spotlog.local.repository.v2')).records); }
async function shoot(page, name, width) {
  const file = path.join(out, `${width}-${name}.png`);
  await page.screenshot({ path: file, animations: 'disabled' }); results.screenshots.push(file);
}
async function measure(page, name, width) {
  const info = await page.evaluate(() => {
    const visible = n => n.checkVisibility() && !n.closest('[hidden]');
    const main = document.querySelector('.content');
    const dialog = document.querySelector('[role=dialog]');
    const scope = dialog || main;
    const controls = [...scope.querySelectorAll('button,input:not([type=file]),select,textarea')].filter(visible).map(n => {
      const r = n.getBoundingClientRect(), s = getComputedStyle(n);
      return { tag: n.tagName, class: n.className, text: (n.textContent || n.getAttribute('aria-label') || n.getAttribute('placeholder') || '').trim().slice(0,60), width: r.width, height: r.height, font: s.fontSize, radius: s.borderRadius, overflow: n.scrollWidth > n.clientWidth + 1 };
    });
    const clippedText = [...scope.querySelectorAll('h1,h2,h3,p,strong,small')].filter(visible).filter(n => {
      if (n.closest('.rolling-track,.home-guides-rolling,.promoted-rolling')) return false;
      const s = getComputedStyle(n);
      return n.clientWidth > 0 && n.scrollWidth > n.clientWidth + 2 && s.overflowX !== 'visible' && s.textOverflow !== 'ellipsis';
    }).map(n => ({ tag:n.tagName,class:n.className,text:n.textContent.trim().slice(0,70),width:n.clientWidth,scroll:n.scrollWidth }));
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, contentWidth: main?.clientWidth, contentScrollWidth: main?.scrollWidth, dialogWidth: dialog?.clientWidth, dialogScrollWidth: dialog?.scrollWidth, controls, clippedText };
  });
  results.measurements.push({ width, name, ...info });
  check(`${width} ${name}: viewport overflow`, info.documentWidth <= width + 1 && (!info.dialogWidth || info.dialogScrollWidth <= info.dialogWidth + 1) && (!info.contentWidth || info.contentScrollWidth <= info.contentWidth + 1), { document:info.documentWidth,content:info.contentWidth,scroll:info.contentScrollWidth,dialog:info.dialogWidth,dialogScroll:info.dialogScrollWidth });
  const primitive = info.controls.filter(n => n.class.includes('ui-button') && !n.class.includes('ui-icon-button'));
  check(`${width} ${name}: shared button contract`, primitive.every(n => n.font === '15px' && n.height >= (n.class.includes('--compact') ? 43.9 : 47.9)), primitive.filter(n => n.font !== '15px' || n.height < (n.class.includes('--compact') ? 43.9 : 47.9)));
  if (info.clippedText.length) results.failures.push({ name:`${width} ${name}: clipped text candidates`, detail:info.clippedText });
}
async function route(page, hash, selector) { await page.goto(`http://127.0.0.1:5173/${hash}`); await page.locator(selector).first().waitFor(); await page.evaluate(() => document.fonts.ready); }

async function runWidth(browser,width) {
  const context = await browser.newContext({ viewport:{width,height:844}, acceptDownloads:true });
  await context.addInitScript(records => { if(!localStorage.getItem('spotlog.local.repository.v2')) Object.entries(records).forEach(([key,value])=>localStorage.setItem(key,value)); }, seed);
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror',error=>results.pageErrors.push({width,message:error.message}));
  try {
    await route(page,'#saved','.saved-places');
    await shoot(page,'saved',width); await measure(page,'saved',width);
    check(`${width} Saved has no journey/DAY/form`, await page.locator('.saved-places select,.saved-trip-target,.saved-places form,.saved-date-strip').count() === 0);
    await page.locator('.saved-places .landmark-guide-card').first().getByRole('button',{name:'내 여행에 담기',exact:true}).click();
    await page.locator('.my-trips-from-saved').waitFor(); await page.getByRole('group',{name:'담을 날짜',exact:true}).getByRole('button',{name:/DAY 2/}).click();
    check(`${width} add selection belongs to My Trips`, new URL(page.url()).hash === '#trips' && await page.locator('.saved-places').isHidden());
    await shoot(page,'my-trips-add',width); await measure(page,'my-trips-add',width); await page.getByRole('button',{name:'저장한 장소로 돌아가기',exact:true}).click(); await page.locator('.saved-places').waitFor();
    await page.locator('.saved-create-entry').click(); await page.locator('.my-trips-from-saved').waitFor(); await shoot(page,'my-trips-create',width); await measure(page,'my-trips-create',width); await page.getByRole('button',{name:'저장한 장소로 돌아가기',exact:true}).click(); await page.locator('.saved-places').waitFor();
    await page.locator('.saved-ai-entry').click(); await page.locator('.my-trips-from-saved').waitFor(); await shoot(page,'my-trips-ai',width); await measure(page,'my-trips-ai',width); await page.getByRole('button',{name:'저장한 장소로 돌아가기',exact:true}).click(); await page.locator('.saved-places').waitFor();
    await page.locator('.saved-places .landmark-guide-card').first().scrollIntoViewIfNeeded();
    await shoot(page,'saved-card',width);
    const snapshot = await state(page);
    await page.getByRole('button',{name:'내 데이터 백업·복구',exact:true}).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await shoot(page,'backup',width); await measure(page,'backup',width);
    check(`${width} backup native file button hidden`, await dialog.locator('input[type=file]').isHidden());
    check(`${width} backup focus begins inside sheet`, await page.evaluate(()=>Boolean(document.activeElement?.closest('[role=dialog]'))));
    for(let i=0;i<8;i++) await page.keyboard.press('Tab');
    check(`${width} backup tab focus trapped`, await page.evaluate(()=>Boolean(document.activeElement?.closest('[role=dialog]'))));
    const dl = page.waitForEvent('download'); await dialog.getByRole('button',{name:'백업 파일 저장',exact:true}).click(); const download = await dl;
    check(`${width} backup downloads JSON`, /^spotlog-backup-.*\.json$/.test(download.suggestedFilename()),download.suggestedFilename()); await download.cancel();
    const chooserPromise = page.waitForEvent('filechooser'); await dialog.getByRole('button',{name:'백업 파일 선택',exact:true}).click(); const chooser = await chooserPromise;
    check(`${width} styled upload invokes native chooser`, !chooser.isMultiple());
    page.once('dialog',d=>d.dismiss()); await chooser.setFiles({name:'cancelled.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    check(`${width} restore cancel preserves data`, JSON.stringify(await state(page)) === JSON.stringify(snapshot));
    await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
    check(`${width} Escape releases app focus/inert`, await page.evaluate(()=>!document.querySelector('.app-shell').inert));
    await route(page,'#style-guide','.style-guide'); await shoot(page,'style-guide',width); await measure(page,'style-guide',width);
    await page.getByRole('button',{name:'하단 팝업 보기'}).click(); await shoot(page,'style-guide-sheet',width); await measure(page,'style-guide-sheet',width); await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'hidden'});
    await route(page,'#home','.home-page'); await shoot(page,'home',width); await measure(page,'home',width);
    const heroGeometry = await page.locator('.promoted-trip').evaluateAll(cards => cards.map(card => { const outer=card.getBoundingClientRect(),copy=card.querySelector('.promoted-copy').getBoundingClientRect(),title=card.querySelector('h2').getBoundingClientRect(),button=card.querySelector('button').getBoundingClientRect();return { title:card.querySelector('h2').textContent,cardHeight:outer.height,copyTop:copy.top-outer.top,copyBottom:copy.bottom-outer.top,titleBottom:title.bottom-outer.top,buttonBottom:button.bottom-outer.top }; }));
    check(`${width} promoted titles and CTA fit all cards`,heroGeometry.every(card=>card.copyTop>=0&&card.copyBottom<=card.cardHeight&&card.buttonBottom<=card.cardHeight),heroGeometry);
    await page.locator('.promoted-trip').first().scrollIntoViewIfNeeded(); await shoot(page,'home-promoted',width);
    await page.getByRole('button',{name:'프로필',exact:true}).click(); await page.locator('.profile-page').waitFor(); await shoot(page,'profile',width); await measure(page,'profile',width);
    await route(page,'#community','.community-page'); await shoot(page,'community',width); await measure(page,'community',width);
    await route(page,'#places-guide','.place-guide-content'); await shoot(page,'guide',width); await measure(page,'guide',width);
    await route(page,'#trips','.trips-page'); await shoot(page,'my-trips',width); await measure(page,'my-trips',width);
    await page.locator('.journey-main').filter({hasText:journey.title}).click(); await page.locator('.journey-detail').waitFor(); await shoot(page,'detail',width); await measure(page,'detail',width);
    await page.locator('.content').evaluate(n=>n.scrollTop=n.scrollHeight); await page.locator('.day-tabs').getByRole('button',{name:/DAY 2/}).click();
    check(`${width} scrolled DAY navigation works`, /DAY 2/.test(await page.locator('.day-tabs button.active').innerText()));
    check(`${width} scrolled detail back reachable`, await page.locator('.day-tabs .day-tabs-back').isVisible()); await shoot(page,'detail-day2',width);
    await page.getByRole('button',{name:'이 여행기 이어서 쓰기',exact:true}).click(); await page.locator('.journey-editor').waitFor(); await shoot(page,'editor',width); await measure(page,'editor',width);
    // Invalid restore is last so its expected error banner does not pollute reference screenshots.
    await route(page,'#saved','.saved-places'); await page.getByRole('button',{name:'내 데이터 백업·복구',exact:true}).click(); await page.getByRole('dialog').waitFor();
    const beforeInvalid = await state(page);
    page.once('dialog',d=>d.accept()); await page.getByRole('dialog').locator('input[type=file]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{not-json')});
    await page.locator('.toast').filter({hasText:/파일.*(읽을 수 없|복원할 수 없)|복원할 수 없는 파일/}).waitFor();
    check(`${width} invalid restore preserves data`, JSON.stringify(await state(page)) === JSON.stringify(beforeInvalid));
  } catch(error) { results.failures.push({name:`${width} execution`,detail:error.stack}); }
  finally { await context.close(); }
}
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [320,390,460]) await runWidth(browser,width);}finally{await browser.close();}check('No browser exceptions',results.pageErrors.length===0,results.pageErrors);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.cases.length,failures:results.failures,screenshots:results.screenshots.length,report:path.join(out,'results.json')},null,2));process.exitCode=results.failures.length?1:0;})().catch(error=>{console.error(error);process.exitCode=1;});
