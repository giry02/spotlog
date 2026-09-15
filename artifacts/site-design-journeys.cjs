const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = 'http://127.0.0.1:5173';
const out = path.resolve('web/public/design-guide');
const selectors = ['.app-header','.app-header h1','.app-header small','.header-action','.journey-intro','.journey-intro h2','.section-heading h2','.journey-card','.journey-main','.journey-copy','.journey-copy strong','.journey-copy em','.journey-share','.primary','.tabbar','.tabbar button','.tabbar button span','.detail-topbar','.detail-topbar button','.detail-hero','.detail-title h1','.detail-title span','.journal-lead','.journal-lead .summary','.journal-lead .story','.guide-facts','.journal-meta','.day-tabs','.day-tabs button','.day-tabs-back','.day-tabs button small','.day-tabs button strong','.day-heading','.day-heading h2','.day-heading p','.guide-place-embed','.guide-place-copy','.guide-place-copy h3','.guide-place-copy p','.guide-place-copy blockquote','.guide-place-copy button','.story-text-block h3','.story-text-block p','.story-image-block','.story-image-block figcaption','.detail-footer','.detail-footer button','.day-route-section','.day-route-title h3','.route-map','.journey-social','.journey-social h2','.comment-form textarea','.comment-form button','.editor-topbar','.editor-topbar strong','.save-editor','.editor-cover','.editor-basics','.editor-basics input','.editor-basics label > span','.editor-basics textarea','.editor-row','.editor-day-tabs','.editor-day-tabs button','.day-editor-heading input','.editor-text-block','.editor-text-block textarea','.insert-toolbar','.insert-toolbar button','.editor-footer','.editor-footer button','.profile-topbar','.profile-topbar h1','.profile-card','.profile-card h3','.profile-card p','.profile-card button','.profile-stats','.profile-stats strong','.profile-stats span','.creator-level-card','.creator-level-card h2','.creator-level-card p','.creator-notification-card','.notification-switch','.notification-options select','.notification-options button','.settings-list','.settings-list strong','.settings-list > div','.phase-sheet','.phase-sheet-header','.phase-sheet-header h2','.phase-sheet-header p','.phase-sheet-body','.ui-field','.ui-field-label','.ui-field input','.ui-field select','.phase-sheet button','.place-picker','.picker-tabs button','.picker-card'];
async function capture(page, name, width) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(220);
  const result = await page.evaluate(selectors => ({ overflow: document.documentElement.scrollWidth > innerWidth, elements: selectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(el => el.getClientRects().length).slice(0,2).map((el,index) => { const s=getComputedStyle(el),r=el.getBoundingClientRect(); const props=['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','borderColor','borderRadius','minHeight','height','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','gap','position','top','bottom','boxShadow']; return {selector,index,text:el.textContent.trim().slice(0,60),...Object.fromEntries(props.map(p=>[p,s[p]])),width:r.width,renderedHeight:r.height}; })) }), selectors);
  if(width===390) await page.screenshot({path:path.join(out,`journey-${name}.png`)});
  console.log(width,name,result.elements.length,result.overflow);
  return {name,width,...result};
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const bootstrap=await browser.newPage();await bootstrap.goto(root);
  const data=await bootstrap.evaluate(async()=>{const m=await import('/src/data.ts');return {journeys:m.initialJourneys};});
  await bootstrap.close();
  const source=data.journeys.find(j=>!j.isMine)||data.journeys[0];
  const own={...source,id:'design-audit-own',title:'제주의 장면을 모은 여행',isMine:true,visibility:'PRIVATE',status:'PLANNING',saves:0};
  const results=[],errors=[];
  const cases=[{name:'trips',route:'trips',ready:'.journey-card'},{name:'trips-empty',route:'trips',ready:'.journey-intro',empty:true},{name:'public-detail',route:`journey-${source.id}`,ready:'.detail-title'},{name:'own-detail',route:'journey-design-audit-own',ready:'.detail-title'},{name:'detail-day',route:`journey-${source.id}`,ready:'.day-tabs',scroll:'.day-heading'},{name:'detail-map',route:`journey-${source.id}`,ready:'.day-tabs',scroll:'.day-route-section'},{name:'editor',route:'edit-design-audit-own',ready:'.journey-editor'},{name:'editor-blocks',route:'edit-design-audit-own',ready:'.journey-editor',scroll:'.day-editor-heading'},{name:'profile',route:'profile',ready:'.profile-card'},{name:'profile-settings',route:'profile',ready:'.settings-list',scroll:'.creator-notification-card'},{name:'create-sheet',route:'trips',ready:'.journey-intro',click:'button[aria-label="새 여행"]'},{name:'place-sheet',route:'edit-design-audit-own',ready:'.journey-editor',clickText:'장소'}];
  cases.push({name:'social',route:`journey-${source.id}`,ready:'.journey-social',scroll:'.journey-social'},{name:'creator',route:`journey-${source.id}`,ready:'.detail-creator',scroll:'.detail-creator'},{name:'profile-options',route:'profile',ready:'.notification-switch',toggle:'.notification-switch',scroll:'.creator-notification-card'},{name:'settings',route:'profile',ready:'.settings-list',scroll:'.settings-list'});
  try { for(const width of [320,390,460]) for(const item of cases){
    const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    await context.addInitScript(journeys=>{if(location.protocol==='http:'){localStorage.setItem('spotlog.web.journeys.v4',JSON.stringify(journeys));localStorage.setItem('spotlog.web.saved.v3','[]');}},[...data.journeys.filter(j=>!j.isMine),...(item.empty?[]:[own])]);
    const page=await context.newPage(); page.on('pageerror',e=>errors.push({name:item.name,width,error:e.message}));
    await page.goto(`${root}/#${item.route}`,{waitUntil:'domcontentloaded'});await page.locator(item.ready).first().waitFor({timeout:15000});
    if(item.toggle) await page.locator(item.toggle).click();
    if(item.scroll) await page.locator(item.scroll).first().evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    if(item.click) await page.locator(item.click).click();
    if(item.clickText) await page.locator('.insert-toolbar').getByRole('button',{name:item.clickText,exact:true}).click();
    if(item.click||item.clickText) await page.locator('.phase-sheet').waitFor();
    results.push(await capture(page,item.name,width));await context.close();
  }}finally{await browser.close();fs.writeFileSync('artifacts/site-design-journeys.json',JSON.stringify({results,errors,missing:['Profile edit bottom sheet does not exist. Avatar opens OS file picker; current profile is edited only through avatar upload.']},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
