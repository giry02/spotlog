const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.join(__dirname, 'home-spacing-qa');
fs.mkdirSync(out, { recursive:true });
const phase = process.argv[2] || 'before';
(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  const records = [], errors = [];
  try {
    for (const width of [320,390,460]) {
      const context = await browser.newContext({ viewport:{width,height:900} });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:5173/#home');
      await page.waitForSelector('.home-lead');
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => {
        const sels=['.home-topbar','.home-topbar > div','.home-topbar span','.home-lead','.home-lead > span','.home-lead h1','.home-lead p','.home-lead + .home-find-guides','.home-section','.home-section .rolling-dots','.home-section .rolling-dots button','.home-section + .home-section','.home-section + .home-section small','.home-section + .home-find-guides'];
        const m={};
        for (const sel of sels) { const el=document.querySelector(sel); if(!el) continue; const r=el.getBoundingClientRect(),s=getComputedStyle(el); m[sel]={top:r.top,bottom:r.bottom,height:r.height,width:r.width,marginTop:s.marginTop,marginBottom:s.marginBottom,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom,fontSize:s.fontSize,lineHeight:s.lineHeight,borderRadius:s.borderRadius,display:s.display}; }
        const gap=(a,b)=>m[b].top-m[a].bottom;
        return {elements:m,gaps:{headerIntro:gap('.home-topbar > div','.home-lead > span'),introAi:gap('.home-lead p','.home-lead + .home-find-guides'),aiSection:gap('.home-lead + .home-find-guides','.home-section'),reference:gap('.home-section .rolling-dots','.home-section + .home-section'),dotsHeading:gap('.home-section .rolling-dots button','.home-section + .home-section small')},horizontal:document.documentElement.scrollWidth>innerWidth};
      });
      records.push({width,...metrics});
      await page.screenshot({path:path.join(out,`${phase}-${width}-home.png`)});
      await page.locator('.home-section + .home-section').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,`${phase}-${width}-reference.png`)});
      await context.close();
    }
  } finally {await browser.close();}
  fs.writeFileSync(path.join(out,`${phase}.json`),JSON.stringify({records,errors},null,2));
  console.log(JSON.stringify({errors,records:records.map(({width,gaps,horizontal})=>({width,gaps,horizontal}))}));
})().catch(e=>{console.error(e);process.exitCode=1;});
