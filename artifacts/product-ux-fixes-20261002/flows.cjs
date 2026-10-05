const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const { snapshot } = require('./audit.cjs');
const out = __dirname;
const base = 'http://127.0.0.1:5210/';
const report = { screens: [], actions: [], checks: [], errors: [] };
let page, width;
const write = () => fs.writeFileSync(out + '/flow-results.json', JSON.stringify(report, null, 2));
async function capture(name) { report.screens.push(await snapshot(page,width,name,false)); write(); }
async function click(locator, label) { await locator.click(); report.actions.push({ width, label }); write(); }
const button = name => page.getByRole('button',{ name, exact: true });
async function check(label, fn) { const value = await fn(); report.checks.push({ width, label, value }); write(); return value; }
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  for (width of [390,320,460]) {
   const context = await browser.newContext({viewport:{width,height:844}});
   page = await context.newPage(); page.setDefaultTimeout(10000);
   page.on('pageerror',e=>{report.errors.push({width,error:e.message});write();});
   await page.goto(base+'?audit=flow#places-photo');
   const saveButtons = page.getByRole('button',{name:/ 저장$/});
   await saveButtons.first().waitFor();
   const firstLabel=await saveButtons.first().getAttribute('aria-label');
   await click(saveButtons.first(),'사진에서 장소 저장: '+firstLabel);
   await page.goto(base+'?audit=flow#saved');
   await page.locator('.saved-card').first().waitFor();
   await capture('saved-one');
   await click(button('바로 만들기'),'저장 → 바로 만들기');
   await capture('saved-period');
   await click(button('1박 2일 · 바로 만들기'),'기간 기본값 확정 → 바로 생성');
   await page.locator('.personal-trip').waitFor();
   await capture('private-auto');
   await check('저장 자동 생성 결과',()=>page.locator('.personal-trip').innerText());
   await click(page.locator('.plan-stop').filter({has:page.locator('.plan-stop-copy small').filter({hasText:'랜드마크'})}).first().getByRole('button',{name:'주변 업체',exact:true}),'내 여행 랜드마크 → 주변 업체');
   await page.locator('.nearby-search').waitFor();
   await capture('nearby-food');
   const quickAdd=page.locator('.nearby-results .nearby-row > button.outline:not([disabled])');
   if(await quickAdd.count()) {
    const label=await quickAdd.first().getAttribute('aria-label');
    await click(quickAdd.first(),'주변 후보 바로 담기: '+label);
    await page.getByRole('dialog').waitFor({state:'hidden'});
    await capture('private-with-food');
    await check('업체 담기 후',()=>page.locator('.plan-stop').allTextContents());
   } else { await check('주변 후보 없음',()=>page.locator('.nearby-search').locator('..').innerText()); await click(button('닫기'),'주변 닫기'); }
   const placeMenu=page.getByRole('button',{name:/ · 장소 메뉴$/}).first();
   await click(placeMenu,'내 여행 장소 메뉴');
   await capture('visit-menu');
   await click(button('완료'),'방문 완료 표시');
   await check('방문 완료 버튼 후 팝업 유지',()=>page.getByRole('dialog').count());
   if(await button('닫기').count()) await click(button('닫기'),'완료 후 닫기');
   await capture('private-completed');
   const planHash=await page.evaluate(()=>location.hash);
   await page.reload(); await page.locator('.personal-trip').waitFor();
   await check('새로고침 후 방문 상태 유지',()=>page.locator('.plan-visit-state').allTextContents());
   await page.goto(base+'?audit=flow#saved');
   await click(button('날짜별로 담기'),'저장 → 날짜별로 담기');
   await click(button('1박 2일 · 장소 담기'),'기간 기본값 확정 → DAY 담기 활성화');
   await capture('saved-manual');
   await click(page.getByRole('button',{name:/, DAY 1에 담기$/}).first(),'선택 DAY에 저장 카드 한 번 담기');
   await capture('saved-manual-added');
   await click(button('일정 만들기'),'수동 배치 일정 생성');
   await page.locator('.personal-trip').waitFor();
   await page.goto(base+'?audit=flow#home');
   await click(page.locator('button.home-find-guides').filter({hasText:'AI 여행 만들기'}),'홈 → AI 여행 만들기');
   const prompt='부산에서 2박 3일, 엄마 아빠랑 가족여행. 바다 풍경 보고 음식점과 숙박도 추천해줘. 카페도 가고 많이 걷지 않고 여유롭게 다니고 싶어.';
   await page.locator('.ai-planner textarea').fill(prompt);
   await check('문장 입력 후 조건 자동 반영',()=>page.locator('.ai-planner select').evaluateAll(nodes=>nodes.map(node=>({label:node.closest('label')?.textContent,value:node.value,selected:node.selectedOptions[0]?.textContent}))));
   await capture('ai-prompt-filled');
   await click(button('초안 만들기'),'문장 → 초안 만들기 (추가 선택 없음)');
   await page.locator('.ai-planner-route').waitFor();
   await capture('ai-preview');
   await check('AI 초안 구성',()=>page.locator('.ai-planner-route').innerText());
   await check('AI 초안 저장 버튼 위치',()=>page.locator('.ai-planner-save button').evaluate(node=>({text:node.textContent,box:node.getBoundingClientRect().toJSON(),viewport:innerHeight,disabled:node.disabled})));
   await click(page.locator('.ai-planner-save button'),'AI 초안 그대로 내 여행 저장');
   await page.locator('.personal-trip').waitFor();
   await capture('private-ai');
   await check('AI 저장 후 DAY와 장소',()=>page.locator('.personal-trip').innerText());
   const foodMenu=page.locator('.plan-stop').filter({has:page.locator('.plan-stop-copy small').filter({hasText:'음식점'})}).first().getByRole('button',{name:/ · 장소 메뉴$/});
   if(await foodMenu.count()) {
    await click(foodMenu,'음식점 메뉴');
    await click(button('이 장소만 다른 곳으로 교체'),'음식점 한 곳만 교체 열기');
    await capture('replace-food');
    const choice=page.locator('.nearby-results .nearby-row > button.outline:not([disabled])');
    if(await choice.count()) {
     await click(choice.first(),'교체 후보 선택');
     await capture('replace-confirm');
     await click(button('이곳으로 교체'),'교체 확인');
     await page.getByRole('dialog').waitFor({state:'hidden'});
     await capture('private-replaced');
    } else await click(button('닫기'),'교체 후보 없음 닫기');
   }
   await check('내 여행 최하단',async()=>{await page.locator('.plan-journal-link').scrollIntoViewIfNeeded();return page.evaluate(()=>({bodyScroll:document.scrollingElement.scrollTop,tabbar:document.querySelector('.tabbar')?.getBoundingClientRect().toJSON(),viewport:innerHeight}));});
   await capture('private-bottom');
   await page.goto(base+'?audit=flow#saved');
   await page.locator('.saved-card').last().scrollIntoViewIfNeeded();
   await check('저장 화면 스크롤 후 하단 메뉴 고정',()=>page.evaluate(()=>({bodyScroll:document.scrollingElement.scrollTop,tabbar:document.querySelector('.tabbar')?.getBoundingClientRect().toJSON(),viewport:innerHeight})));
   await context.close();
   console.log(JSON.stringify({width,checks:report.checks.filter(c=>c.width===width).map(c=>({label:c.label,value:c.label==='AI 초안 구성'?c.value:c.label==='문장 입력 후 조건 자동 반영'?c.value:undefined})),screens:report.screens.filter(s=>s.width===width).length}));
  }
 } catch(error) {
  report.errors.push({width,error:error.stack});
  if(page) {await page.screenshot({path:out+'/flow-failure.png'});report.failureButtons=await page.getByRole('button').allTextContents();report.failureHash=await page.evaluate(()=>location.hash);}
  write(); throw error;
 } finally { await browser.close();write(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
