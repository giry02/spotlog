const fs=require('fs');
const {chromium}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const {snapshot}=require('./audit.cjs');
const base='http://127.0.0.1:5210/',out=__dirname,report={touch:[],shortHeight:[],keyboard:[],contrast:[],zoom:[],errors:[]};
const write=()=>fs.writeFileSync(out+'/interaction-results.json',JSON.stringify(report,null,2));
async function waitFrames(page,n=12){await page.evaluate(n=>new Promise(resolve=>{const step=()=>--n>0?requestAnimationFrame(step):resolve();requestAnimationFrame(step);}),n);}
async function swipe(cdp,start,end){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start[0],y:start[1]}]});for(let n=1;n<=12;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start[0]+(end[0]-start[0])*n/12,y:start[1]+(end[1]-start[1])*n/12}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await mobile.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(e.message));
  const cdp=await mobile.newCDPSession(page);
  await page.goto(base+'?audit=touch#places-photo');await page.locator('.photo-landmark-feed').waitFor();
  const state=()=>page.evaluate(()=>{const active=document.querySelector('.photo-landmark-reel[data-active=true]');return {title:active?.querySelector('h2,h3')?.textContent,photo:active?.querySelector('.photo-reel-count')?.textContent,photoIndex:active?.querySelector('.photo-reel-track')?.dataset.photoIndex,feed:document.querySelector('.photo-landmark-feed')?.scrollTop,track:active?.querySelector('.photo-reel-track')?.scrollLeft,trackWidth:active?.querySelector('.photo-reel-track')?.clientWidth,tabbar:document.querySelector('.tabbar')?.getBoundingClientRect().toJSON(),body:document.scrollingElement.scrollTop};});
  report.touch.push({step:'initial',value:await state()});
  await swipe(cdp,[200,500],[200,160]);await waitFrames(page);report.touch.push({step:'vertical-next',value:await state()});
  await swipe(cdp,[200,160],[200,500]);await waitFrames(page);report.touch.push({step:'vertical-previous',value:await state()});
  await swipe(cdp,[330,360],[60,360]);await page.waitForFunction(()=>{const e=document.querySelector('.photo-landmark-reel[data-active=true] .photo-reel-track');return e&&Math.abs(e.scrollLeft-e.clientWidth)<2;});report.touch.push({step:'horizontal-next',value:await state()});
  await page.screenshot({path:out+'/touch-photo.png'});
  await page.goto(base+'?audit=smallheight#home');await page.locator('button.home-find-guides').filter({hasText:'AI 여행 만들기'}).click();
  await page.locator('.ai-planner textarea').fill('부산 6박 7일 여유롭게');
  await page.setViewportSize({width:390,height:480});
  await page.getByRole('button',{name:'초안 만들기',exact:true}).scrollIntoViewIfNeeded();
  report.shortHeight.push(await snapshot(page,390,'ai-input-short-height',false));
  await page.getByRole('button',{name:'초안 만들기',exact:true}).click();await page.locator('.ai-planner-route').waitFor();
  report.shortHeight.push(await snapshot(page,390,'ai-preview-short-height',false));
  await page.locator('.ai-planner-save button').click();await page.locator('.personal-trip').waitFor();
  const dayTrack=page.locator('.day-tabs-track');await dayTrack.scrollIntoViewIfNeeded();
  const before=await dayTrack.evaluate(e=>e.scrollLeft);
  const box=await dayTrack.boundingBox();await swipe(cdp,[box.x+box.width-25,box.y+20],[box.x+15,box.y+20]);await waitFrames(page);
  report.touch.push({step:'DAY touch horizontal scroll',value:{before,after:await dayTrack.evaluate(e=>e.scrollLeft)}});
  await mobile.close();
  const context=await browser.newContext({viewport:{width:390,height:844}}),desktop=await context.newPage();desktop.setDefaultTimeout(10000);
  for(const [name,hash] of [['home','home'],['guide','places-guide'],['journal','journey-jeju-west-slow']]){
   await desktop.goto(base+'?audit=contrast#'+hash);await desktop.locator('.app-shell').waitFor();
   if(name==='journal')await desktop.locator('.journal-lead').waitFor();
   const low=await desktop.evaluate(()=>{
    const rgb=v=>{const a=v.match(/[\d.]+/g)?.map(Number);return a&&a.length>=3?{c:a.slice(0,3),alpha:a[3]??1}:null;};
    const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const result=[],walk=document.createTreeWalker(document.querySelector('.app-shell'),NodeFilter.SHOW_TEXT);
    while(walk.nextNode()){
     const e=walk.currentNode.parentElement,text=walk.currentNode.textContent.trim();if(!text||!e||e.closest('.sr-only,[aria-hidden=true]')||!e.getClientRects().length||['SCRIPT','STYLE'].includes(e.tagName))continue;
     let p=e,bg=null,skip=false;const s=getComputedStyle(e),fg=rgb(s.color);
     if(!fg||fg.alpha!==1)continue;
     while(p){const ps=getComputedStyle(p);if(ps.backgroundImage!=='none'||Number(ps.opacity)<1){skip=true;break;}const c=rgb(ps.backgroundColor);if(c?.alpha===1){bg=c.c;break;}if(c&&c.alpha>0){skip=true;break;}p=p.parentElement;}
     if(skip||!bg)continue;const l1=lum(fg.c),l2=lum(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);const size=parseFloat(s.fontSize),weight=Number(s.fontWeight),large=size>=24||(size>=18.66&&weight>=700);
     if(ratio<(large?3:4.5))result.push({text:text.slice(0,90),size,color:s.color,background:bg,ratio:Math.round(ratio*100)/100,selector:e.className||e.parentElement.className});
    }return result;
   });report.contrast.push({name,low});
  }
  await desktop.goto(base+'?audit=keyboard#home');await desktop.locator('button.home-find-guides').filter({hasText:'AI 여행 만들기'}).click();
  await desktop.locator('.ai-planner textarea').fill('부산 2박 3일 바다');
  const focused=[];for(let i=0;i<17;i++){await desktop.keyboard.press('Tab');focused.push(await desktop.evaluate(()=>({tag:document.activeElement.tagName,text:(document.activeElement.getAttribute('aria-label')||document.activeElement.textContent||'').trim().slice(0,60),inDialog:!!document.activeElement.closest('[role=dialog]')})));}
  report.keyboard.push({test:'AI dialog Tab remains inside',focused});
  await desktop.keyboard.press('Escape');await desktop.getByRole('dialog').waitFor({state:'hidden'});
  await desktop.locator('button.home-find-guides').filter({hasText:'AI 여행 만들기'}).click();report.keyboard.push({test:'Escape/reopen draft',prompt:await desktop.locator('.ai-planner textarea').inputValue()});
  for(const [name,hash] of [['ai-input',null],['guide','places-guide'],['journal','journey-jeju-west-slow']]){
   if(hash){await desktop.goto(base+'?audit=text-scale#'+hash);await desktop.locator('.app-shell').waitFor();if(name==='journal')await desktop.locator('.journal-lead').waitFor();}
   await desktop.evaluate(()=>{const values=[...document.querySelectorAll('body *')].filter(e=>e instanceof HTMLElement&&e.getClientRects().length&&!['SCRIPT','STYLE','SVG'].includes(e.tagName)).map(e=>{const s=getComputedStyle(e);return {e,font:parseFloat(s.fontSize),line:parseFloat(s.lineHeight)};});for(const {e,font,line} of values){e.style.fontSize=font*2+'px';if(Number.isFinite(line))e.style.lineHeight=line*2+'px';}});
   report.zoom.push({method:'Isolated DOM font and line-height at 200%, not physical browser OS text sizing',...await snapshot(desktop,390,name+'-text200',false)});
  }
  await context.close();write();console.log(JSON.stringify({touch:report.touch,shortHeight:report.shortHeight.map(s=>({name:s.name,overflow:s.overflow})),keyboard:report.keyboard,contrast:report.contrast.map(s=>({name:s.name,count:s.low.length,examples:s.low.slice(0,6)})),zoom:report.zoom.map(s=>({name:s.name,overflow:s.overflow,bodyOverflow:s.bodyOverflow})),errors:report.errors},null,2));
 }finally{await browser.close();write();}
})().catch(e=>{console.error(e);process.exitCode=1;});
