const fs = require('node:fs');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const selectors = ['.app-shell', '.content', '.saved-page', '.saved-page .app-header', '.saved-page .app-header h1', '.saved-page .app-header small', '.header-action', '.ai-trip-card', '.ai-trip-heading', '.ai-trip-icon', '.ai-trip-heading small', '.ai-trip-heading h2', '.ai-trip-kpi', '.ai-trip-card > p', '.ai-day-picker', '.ai-day-picker > span', '.ai-day-picker > div', '.ai-day-picker button:not(.active)', '.ai-day-picker button.active', '.ai-generate-button', '.ai-sample-button', '.saved-region-filter', '.saved-region-filter small', '.saved-region-filter h2', '.saved-region-chips', '.saved-region-chips button:not(.active)', '.saved-region-chips button.active', '.saved-region-chips button span', '.saved-region-groups', '.saved-region-section', '.saved-region-heading', '.saved-region-heading strong', '.saved-region-heading small', '.saved-region-heading > span:nth-child(2)', '.saved-region-section .saved-list', '.saved-card', '.saved-card > img', '.saved-card-copy', '.saved-card-eyebrow > span', '.saved-card-eyebrow em', '.saved-card-copy h3', '.saved-card-copy p', '.saved-place-time', '.saved-card > button', '.add-to-trip', '.add-to-trip.is-added', '.saved-empty', '.empty-icon', '.saved-empty h2', '.saved-empty p', '.saved-empty .outline'];
const props = ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','backgroundImage','borderRadius','borderColor','borderWidth','minHeight','minWidth','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','gap','boxShadow','gridTemplateColumns','whiteSpace','textOverflow','objectFit'];
const journey = { id:'qa-style', title:'검증 여행', region:'국내', dateRange:'날짜 미정', duration:'당일 여행', status:'PLANNING', visibility:'PRIVATE', cover:'', summary:'', story:'', tags:[], saves:0, author:'테스트', isMine:true, days:[{day:1,date:'DAY 1',title:'첫날',story:'',places:[],blocks:[]}] };
const seed = { 'spotlog.web.saved.v3':JSON.stringify(['jeju-hyeopjae','gangneung-anmok','seoul-seoulforest']), 'spotlog.web.journeys.v4':JSON.stringify([journey]) };
async function measure(page) { return page.evaluate(({selectors,props})=>selectors.flatMap(selector=>{const el=document.querySelector(selector); if(!el) return []; const style=getComputedStyle(el), r=el.getBoundingClientRect(); return [{selector,text:el.textContent.trim().slice(0,100),...Object.fromEntries(props.map(p=>[p,style[p]])),x:r.x,y:r.y,width:r.width,height:r.height}];}),{selectors,props}); }
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const results=[];
 try{
  for(const width of [320,390,460]) {
   for(const empty of [false,true]) {
    const context=await browser.newContext({viewport:{width,height:900}, reducedMotion:'reduce'});
    await context.addInitScript(records=>{Object.entries(records).forEach(([key,value])=>localStorage.setItem(key,value));}, {...seed,...(empty?{'spotlog.web.saved.v3':'[]'}:{})});
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:5173/#saved',{waitUntil:'domcontentloaded'});
    await page.locator('.saved-page').waitFor(); await page.evaluate(()=>document.fonts.ready);
    const baseline=await measure(page);
    const sample={width,empty,baseline,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)};
    if(!empty) {
     await page.locator('.saved-card').filter({has:page.getByRole('heading',{name:'서울숲',exact:true})}).locator('.add-to-trip').click();
     await page.mouse.move(0,0);
     sample.added=(await measure(page)).filter(item=>item.selector.includes('is-added')||item.selector.includes('eyebrow em'));
     await page.locator('.add-to-trip.is-added').hover();
     sample.hover=(await measure(page)).filter(item=>item.selector.includes('is-added'));
    }
    const session=await context.newCDPSession(page); await session.send('DOM.enable'); await session.send('CSS.enable');
    const root=await session.send('DOM.getDocument'); sample.platformFonts=[];
    for(const selector of ['.saved-page .app-header h1','.saved-page .app-header small','.ai-trip-heading h2','.ai-trip-heading small']) {
     const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.root.nodeId,selector});
     const fonts=await session.send('CSS.getPlatformFontsForNode',{nodeId}); sample.platformFonts.push({selector,...fonts});
    }
    results.push(sample); await context.close();
   }
  }
 }finally{await browser.close();}
 fs.writeFileSync('artifacts/design-guide-values.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(item=>({width:item.width,empty:item.empty,measurements:item.baseline.length,overflow:item.overflow,fonts:item.platformFonts})),null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
