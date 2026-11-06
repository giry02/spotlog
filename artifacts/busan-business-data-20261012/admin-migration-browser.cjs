const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('C:/Users/Giry/.codex/worktrees/a125/Spotlog/node_modules/@playwright/test');
const root = 'C:/Users/Giry/Documents/Spotlog/artifacts/busan-business-data-20261012';
const key = 'spotlog.admin.review.v1';
const marker = 'shared-catalog-busan-20261012';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1380,height:1000}});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5210/admin.html');
    await page.getByRole('heading',{name:'운영 현황',exact:true}).waitFor();
    const before=await page.evaluate(async({key})=>{
      const {makeAdminSeed}=await import('/src/admin/seed.ts');
      const state=makeAdminSeed();state.migrations=['shared-catalog-masters-v2','shared-catalog-businesses-20261006'];
      state.places=state.places.filter(place=>!['catalog-busan-hanok','catalog-busan-gukbo-miyeok','public-busan-huinnyeoul'].includes(place.placeId));
      state.audit.push({id:'qa-delete-busan',at:'2026-10-12T01:00:00.000Z',actorId:'operator-admin',actorName:'내부 관리자',action:'place.delete',targetId:'catalog-busan-hanok',reason:'삭제 보호 검사',before:'DRAFT',after:'DELETED'});
      const edited=state.places.find(place=>place.placeId==='catalog-busan-geumsu');
      edited.revision=17;edited.draft.description='운영자 수정 소개 유지';edited.state='PUBLISHED';
      edited.published=structuredClone(edited.draft);edited.published.description='기존 공개 소개 유지';
      const withdrawn=state.places.find(place=>place.placeId==='catalog-busan-bibibidang');
      withdrawn.state='INACTIVE';withdrawn.revoked=true;withdrawn.revokedMediaIds=withdrawn.draft.media.map(media=>media.mediaId);
      withdrawn.draft.media.forEach(media=>{media.withdrawn=true;media.cover=false;media.rights={display:false,store:false,modify:false,ai:false};});
      localStorage.setItem('qa-private-draft-sentinel','private-original');localStorage.setItem(key,JSON.stringify(state));
      return JSON.parse(JSON.stringify(state));
    },{key});
    await page.reload();await page.waitForFunction(({key,marker})=>JSON.parse(localStorage.getItem(key)).migrations.includes(marker),{key,marker});
    const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(after.places.length,before.places.length+2);
    assert.deepEqual(after.places.slice(0,before.places.length),before.places);
    assert.ok(!after.places.some(place=>place.placeId==='catalog-busan-hanok'));
    for (const id of ['catalog-busan-gukbo-miyeok','public-busan-huinnyeoul']) {
      const added=after.places.find(place=>place.placeId===id);
      assert.equal(added.state,'DRAFT');assert.equal(added.published,undefined);
      assert.deepEqual(added.draft.rights,{display:false,store:false,modify:false,ai:false});assert.equal(added.draft.ai.allowed,false);
    }
    assert.equal(await page.evaluate(()=>localStorage.getItem('qa-private-draft-sentinel')),'private-original');
    await page.reload();await page.getByRole('heading',{name:'운영 현황',exact:true}).waitFor();
    const second=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.deepEqual(second,after);assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(root,'admin-completed-import-preserved.png'),fullPage:true});
    const result={passed:true,states:2,checks:9,addedDrafts:2,deletedSkipped:1,existingPlacesPreserved:before.places.length,pageErrors:errors};
    fs.writeFileSync(path.join(root,'admin-migration-browser-results.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } finally {await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
