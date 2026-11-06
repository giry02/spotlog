/* Audit comparison QA in a fresh context; no existing browser or consumer storage is accessed. */
const {chromium,expect}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../../..'),audit=path.join(root,'docs/execution/admin-feature-audit-20261005');
const data=JSON.parse(fs.readFileSync(path.join(audit,'features.json'),'utf8'));
const results={checks:[],errors:[],screenshots:[]};
const record=(name,evidence)=>{results.checks.push({name,evidence});console.log('PASS',name,JSON.stringify(evidence));};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',error=>results.errors.push(error.message));
 await page.goto(pathToFileURL(path.join(audit,'index.html')).href);
 await expect(page.locator('#audit-rows tr')).toHaveCount(65);await expect(page.locator('#audit-rows tr:not([hidden])')).toHaveCount(65);
 const rows=await page.locator('#audit-rows tr').evaluateAll(rows=>rows.map(row=>({id:row.dataset.id,oldStatus:row.dataset.beforeStatus,currentStatus:row.dataset.status,cells:[...row.children].map(cell=>cell.textContent.trim())})));
 for(const row of data.rows){const rendered=rows.find(r=>r.id===row.id);assert.deepEqual(rendered.cells.slice(1,5),[row.customer,row.admin,row.gap,row.status]);assert.deepEqual(rendered.cells.slice(5,8),[row.after,row.remaining,row.currentStatus]);assert.equal(rendered.oldStatus,row.status);assert.equal(rendered.currentStatus,row.currentStatus);}
 record('all 65 historical findings and separate current results preserved',{rows:rows.length,columns:rows[0].cells.length});
 const counts=Object.fromEntries([...new Set(data.rows.map(r=>r.currentStatus))].map(status=>[status,data.rows.filter(r=>r.currentStatus===status).length]));
 for(const [status,count]of Object.entries(counts)){await page.getByRole('button',{name:new RegExp('^'+status)}).click();await expect(page.locator('#audit-rows tr:not([hidden])')).toHaveCount(count);}
 record('current status filters reflect documented scope',counts);
 await page.getByRole('button',{name:'필터 초기화',exact:true}).click();await page.locator('#before-filter').selectOption('관리자 보완');await expect(page.locator('#audit-rows tr:not([hidden])')).toHaveCount(data.rows.filter(r=>r.status==='관리자 보완').length);
 await page.getByRole('button',{name:/^일부 보완/}).click();const intersection=data.rows.filter(r=>r.status==='관리자 보완'&&r.currentStatus==='일부 보완').length;await expect(page.locator('#audit-rows tr:not([hidden])')).toHaveCount(intersection);
 record('historical status and current status combine independently',{intersection});
 await page.getByRole('button',{name:'필터 초기화',exact:true}).click();await page.locator('#search').fill('자동 모션 제작');await expect(page.locator('#audit-rows tr:not([hidden])')).toHaveCount(1);await expect(page.locator('#audit-rows tr:not([hidden])')).toHaveAttribute('data-id','C05');
 await page.locator('#search').fill('not-a-real-audit-term-123');await expect(page.locator('#empty')).toBeVisible();
 await page.locator('[data-jump="C36"]').click();await expect(page.locator('#audit-rows tr:not([hidden])')).toHaveCount(65);await expect(page.locator('tr[data-id="C36"]')).toHaveClass(/flash/);
 record('search includes current remaining work and fact jump clears filters',{remainingRow:'C05',jumpRow:'C36'});
 await page.locator('.history-note').first().locator('summary').click();await expect(page.locator('.history-note').first()).toContainText('19/83');await expect(page.locator('.history-note').first()).toContainText('83/83');await expect(page.locator('.history-note').first()).toContainText('77개');await page.locator('.history-note').first().locator('summary').click();
 record('historical and current headline counts remain distinct',data.afterCounts);
 for(const width of [1440,800,390]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));
  const measured=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,tableWidth:document.querySelector('table').clientWidth,wrapWidth:document.querySelector('.table-wrap').clientWidth,controls:[...document.querySelectorAll('input,select')].map(e=>parseFloat(getComputedStyle(e).fontSize))}));
  assert.ok(measured.scroll<=measured.width+1,JSON.stringify(measured));assert.ok(measured.controls.every(size=>size>=16));
  const file=`audit-browser-${width}.png`;await page.screenshot({path:path.join(__dirname,file)});results.screenshots.push(file);record(`responsive audit ${width}px: contained table and readable controls`,measured);
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('#audit-title').evaluate(element=>element.scrollIntoView({block:'start'}));await page.locator('.table-wrap').evaluate(element=>element.scrollLeft=element.scrollWidth-element.clientWidth);
 const file='audit-browser-current-columns.png';await page.screenshot({path:path.join(__dirname,file)});results.screenshots.push(file);
 assert.deepEqual(results.errors,[]);record('isolated page completed without runtime errors',{errors:results.errors.length,context:'fresh browser context, local audit file'});
 await context.close();
}finally{await browser.close();fs.writeFileSync(path.join(__dirname,'audit-browser-results.json'),JSON.stringify(results,null,2)+'\n');}})().catch(error=>{console.error(error);process.exitCode=1});
