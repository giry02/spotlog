const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
(async()=>{ const browser=await chromium.launch({channel:'msedge',headless:true}); fs.mkdirSync('artifacts/travel-additions-qa',{recursive:true});
for(const width of [320,390,460]){const context=await browser.newContext({viewport:{width,height:900}}); const page=await context.newPage();
for(const route of ['home','saved','community']){await page.goto('http://127.0.0.1:5173/#'+route); await page.waitForTimeout(500); await page.screenshot({path:`artifacts/travel-additions-qa/before-${route}-${width}.png`});}
await context.close();} await browser.close(); })().catch(e=>{console.error(e);process.exit(1)});
