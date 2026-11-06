const {chromium}=require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
async function main(){
 const dist=path.resolve(__dirname,'../../web/dist'),errors=[],assetFailures=[],results=[];
 const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');let rel=decodeURIComponent(u.pathname).replace(/^\/spotlog\//,'');if(!rel)rel='index.html';let file=path.resolve(dist,rel),status=200;if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){file=path.join(dist,'404.html');status=404;}res.writeHead(status,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,base=origin+'/spotlog/';
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.url().startsWith(origin+'/spotlog/assets/')&&r.status()>=400)assetFailures.push(r.url());});
 try{
  for(const type of ['validation','session','conditions','forbidden','missing','server','unavailable']){const response=await page.goto(base+'error.html?type='+type+'&lang=ko');assert.equal(response.status(),200);await page.locator('.error-page').waitFor();assert.ok(!/\b(?:400|401|402|403|404|500|503)\b/.test(await page.locator('.error-page').innerText()));results.push(type);}
  const missing=await page.goto(base+'does-not-exist/nested?type=server');assert.equal(missing.status(),404);await page.getByRole('heading',{name:'페이지를 찾을 수 없어요',exact:true}).waitFor();await page.screenshot({path:path.join(__dirname,'production-404.png')});await page.getByRole('button',{name:'홈으로 가기',exact:true}).click();await page.waitForURL(base+'#home');await page.locator('.tabbar').waitFor();results.push('host-404-nested-base-return');
  await page.goto(base+'#%E0%A4%A');await page.getByRole('heading',{name:'요청을 확인해 주세요',exact:true}).waitFor();results.push('malformed-hash');
  await page.goto(base+'#errors');await page.getByRole('heading',{name:'페이지를 찾을 수 없어요',exact:true}).waitFor();assert.equal(await page.locator('.error-review-list').count(),0);results.push('dev-catalog-disabled');
  assert.deepEqual(errors,[]);assert.deepEqual(assetFailures,[]);fs.writeFileSync(path.join(__dirname,'production-results.json'),JSON.stringify({passed:true,states:results.length,results,errors,assetFailures},null,2));process.stdout.write('Passed '+results.length+' production error-page states\n');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{fs.writeFileSync(path.join(__dirname,'production-failure.txt'),String(e.stack));process.stderr.write(String(e.stack));process.exit(1);});
