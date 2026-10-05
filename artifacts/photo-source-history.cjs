const { chromium } = require('C:/Users/Giry/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const b = await chromium.launch({channel:'msedge',headless:true}); const p = await b.newPage({viewport:{width:390,height:844}});
  p.on('console',m=> { if(m.text().startsWith('QA')) console.log(m.text()); });
  await p.addInitScript(() => {
    for(const method of ['pushState','replaceState','back','go']) { const original=history[method]; history[method]=function(...args){ console.log('QA',method,JSON.stringify(args), 'current',JSON.stringify(history.state)); return original.apply(this,args); }; }
    addEventListener('popstate',e=>console.log('QA pop',JSON.stringify(e.state)),true);
  });
  await p.goto('http://127.0.0.1:5173/#home');
  await p.getByRole('button',{name:/가고 싶은 여행을 이야기해 주세요 AI 여행 만들기/}).click();
  await p.getByRole('textbox',{name:/^어떤 여행/}).fill('부산 1박 2일 바다');
  await p.getByRole('button',{name:'초안 만들기',exact:true}).click();
  await p.getByRole('dialog').locator('.public-photo-credit button').first().click();
  await p.waitForTimeout(200);
  console.log('BEFORE ESC',await p.evaluate(()=>({state:history.state,dialogs:[...document.querySelectorAll('[role=dialog]')].map(d=>d.innerText.slice(0,80))})));
  await p.keyboard.press('Escape');await p.waitForTimeout(400);
  console.log('AFTER ESC',await p.evaluate(()=>({state:history.state,dialogs:[...document.querySelectorAll('[role=dialog]')].map(d=>d.innerText.slice(0,80))})));
  await b.close();
})();
