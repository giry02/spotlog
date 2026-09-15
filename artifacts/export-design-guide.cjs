// Read-only capture of the approved guide. Source file creation uses apply_patch.
const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('http://127.0.0.1:5173/#style-guide',{waitUntil:'domcontentloaded'});
  await page.locator('.site-design-guide').waitFor();
  console.log(JSON.stringify(await page.evaluate(()=>{
   const guide=document.querySelector('.site-design-guide').cloneNode(true);
   const anchors=['sg-foundation','sg-screens','sg-components','sg-process',...Array.from(guide.querySelectorAll('.sg-screen-group'),e=>e.id)];
   guide.querySelectorAll('.sg-index button,.sg-screen-index button').forEach((button,i)=>button.dataset.section=anchors[i]);
   const back=guide.querySelector('.sg-toolbar button');back.dataset.service='true';back.setAttribute('aria-label','Spotlog 서비스로');
   guide.querySelector('.sg-toolbar small').textContent='현재 전 화면 기준 · 검토용';
   guide.querySelectorAll('img').forEach(img=>img.setAttribute('src','./design-guide/'+img.getAttribute('src').split('/').pop()));
   guide.querySelectorAll('.sg-shots a').forEach(a=>a.setAttribute('href','./design-guide/'+a.getAttribute('href').split('/').pop()));
   const note=document.createElement('p');note.className='sg-caption';note.textContent='이 문서는 현재 로컬 구현의 디자인 기준입니다. 미공개 기능은 참고 캡처로만 포함되며, 실제 서비스 기능을 함께 배포한 것은 아닙니다.';guide.querySelector('.sg-boundary').after(note);
   guide.querySelector('.sg-footnote').textContent='기준일 2026.09.10 · 현재 구현 화면과 검수용 데이터 기준 · 실제 사용자 성과·정식 운영 기능과 구분함 · 서비스 화면의 디자인과 기능은 이 문서 게시로 변경하지 않음.';
   return {html:guide.outerHTML,images:Array.from(guide.querySelectorAll('img'),img=>img.getAttribute('src').split('/').pop())};
  })));
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
