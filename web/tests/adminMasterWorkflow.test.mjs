import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { emptyContent, catalogMaster } from '../src/admin/content.ts';
import { migrateAdminMasters, MASTER_MIGRATION, CATALOG_ADDITIONS_MIGRATION, BUSAN_CATALOG_ADDITIONS_MIGRATION } from '../src/admin/migration.ts';
import { contentInRegion, inferRegionId, makeRegionSeed, regionDescendantIds } from '../src/admin/regions.ts';
import { matchesPlaceFilters, publicationIssues } from '../src/admin/selectors.ts';
import { executeAdminCommand } from '../src/admin/domain.ts';
import { matchesAdminDto } from '../src/admin/contractGuard.ts';
import { previewImport } from '../src/admin/csv.ts';
import { makeAiSeed } from '../src/admin/aiSeed.ts';
import { makeOpsSeed } from '../src/admin/opsSeed.ts';
import { curatedIssues } from '../src/admin/editorialDraft.ts';

// Node supplies deterministic asset URLs to exercise the real shared catalog,
// while Vite remains responsible for serving the actual files in the browser.
const hooks = registerHooks({
  resolve(specifier,context,next) {
    try { return next(specifier,context); } catch(error) {
      if (specifier.startsWith('.')) for (const suffix of ['.ts','.tsx']) {
        const url = new URL(specifier+suffix,context.parentURL);
        if (fs.existsSync(url)) return next(url.href,context);
      }
      throw error;
    }
  },
  load(url,context,next) {
    if (/\.(jpg|jpeg|webp|png|svg)$/.test(url)) return {format:'module',source:'export default '+JSON.stringify('/test-assets/'+fileURLToPath(url).split(/[\\/]/).pop()),shortCircuit:true};
    return next(url,context);
  },
});
const { makeAdminSeed } = await import('../src/admin/seed.ts');
const { placeCatalog, discoveryLandmarks } = await import('../src/data.ts');
const { photoSources } = await import('../src/photoSources.ts');
const { homeTripTemplates, previewTemplateJourney } = await import('../src/consumerPublicSeed.ts');
hooks.deregister();
const actor = {operatorId:'review-operator',name:'검수 운영자',role:'OPERATOR'}, now='2026-10-05T01:00:00.000Z';
const run = (state,input) => executeAdminCommand(state,{...input,expectedRevision:state.revision,idempotencyKey:crypto.randomUUID()},actor,now).state;
function basicContent(name='새 지점') {
  const content=emptyContent(); Object.assign(content,{name,area:'부산 해운대',regionId:'kr-busan-haeundae',address:name+' 주소',description:'검수 설명',provider:'직접 제공자',sourceUrl:'https://example.org/source',checkedAt:'2026-10-05'});
  content.location={lat:35.16,lng:129.16,verified:true,reference:'확인한 대표 지점',sourceUrl:content.sourceUrl,checkedAt:content.checkedAt};
  content.rights={display:true,store:true,modify:false,ai:false}; return content;
}
function workflowState() {return {schemaVersion:1,revision:1,regions:makeRegionSeed(),places:[],nearbyOverrides:[],ai:makeAiSeed(),ops:makeOpsSeed(),audit:[],processedCommands:[]};}

test('catalog masters preserve every shared ID and source asset without approving usage',()=>{
  const state=makeAdminSeed(), originals=state.places.filter(place=>place.draft.provenance?.origin==='CATALOG');
  assert.equal(matchesAdminDto('AdminState',state),true);
  assert.equal(originals.length,placeCatalog.length);
  assert.deepEqual(new Set(originals.map(place=>place.placeId)),new Set(placeCatalog.map(place=>place.id)));
  for (const place of originals) {
    const original=placeCatalog.find(item=>item.id===place.placeId);
    assert.equal(place.state,'DRAFT'); assert.equal(place.published,undefined);
    assert.equal(place.draft.name,original.name); assert.equal(place.draft.description,original.description); assert.equal(place.draft.visitDuration,original.duration);
    assert.equal(place.draft.provenance.note,original.note); assert.ok(place.draft.regionId);
    assert.equal(place.meta.reviewStatus,'NEEDS_CHECK'); assert.equal(place.draft.ai.allowed,false);
    assert.deepEqual(place.draft.rights,{display:false,store:false,modify:false,ai:false});
    for (const media of place.draft.media) assert.deepEqual(media.rights,{display:false,store:false,modify:false,ai:false});
  }
  const media=originals.flatMap(place=>place.draft.media);
  assert.equal(media.filter(item=>item.type==='VIDEO').length,placeCatalog.filter(place=>place.video??discoveryLandmarks.find(item=>item.id===place.id)?.video).length);
  assert.equal(media.filter(item=>item.type==='MOTION').length,placeCatalog.reduce((total,place)=>total+(place.motionImages??discoveryLandmarks.find(item=>item.id===place.id)?.motionImages??[]).length,0));
  assert.equal(new Set(media.map(item=>item.provenance.sourceId).filter(Boolean)).size,new Set(photoSources.map(source=>source.id)).size);
  for (const source of photoSources) {
    const item=media.find(value=>value.provenance.sourceId===source.id);
    assert.ok(item,source.id); assert.equal(item.author,source.author); assert.equal(item.license,source.license);
    assert.equal(item.sourceUrl,source.sourceUrl); assert.equal(item.provenance.imageSourceUrl,source.imageSourceUrl);
    assert.equal(item.provenance.changes,source.changes); assert.equal(item.provenance.reuseNote,source.reuseNote);
  }
  assert.equal(state.places.filter(place=>place.draft.provenance?.origin==='SYNTHETIC').length,6);
});

test('all seven home examples retain stable private drafts and source DAY order without rights approval',()=>{
  const state=makeAdminSeed(), drafts=state.ops.curatedTrips.filter(trip=>trip.sourceKind==='PUBLIC_SAMPLE');
  assert.equal(drafts.length,7); assert.equal(new Set(drafts.map(trip=>trip.curatedTripId)).size,7);
  for (const template of homeTripTemplates) {
    const draft=drafts.find(trip=>trip.sourceTemplateId===template.id), preview=previewTemplateJourney(template);
    assert.ok(draft); assert.equal(draft.curatedTripId,`source-home:${template.id}`); assert.equal(draft.visibility,'PRIVATE');
    assert.equal(draft.title,template.title); assert.equal(draft.introduction,template.summary); assert.equal(draft.dayCount,template.dayCount);
    assert.deepEqual(draft.days.map(day=>day.visits.map(visit=>visit.placeId)),preview.days.map(day=>day.places.map(place=>place.id)));
    assert.equal(new Set(draft.days.flatMap(day=>day.visits.map(visit=>visit.visitId))).size,draft.days.flatMap(day=>day.visits).length);
    assert.ok(curatedIssues(state,draft).includes('공개 가능한 등록 장소를 사용하세요.'));
    assert.ok(draft.placeIds.every(id=>state.places.find(place=>place.placeId===id)?.state==='DRAFT'));
  }
  assert.equal(drafts.find(trip=>trip.sourceTemplateId==='curation-southern-road').regionId,'kr');
  assert.equal(state.ops.journals.filter(journal=>journal.sourceKind==='PUBLIC_SAMPLE').length,12);
});

test('catalog gallery retains media identity, caption, withdrawal and motion source conditions',()=>{
  const original={id:'test',kind:'LANDMARK',name:'원본',area:'부산 해운대',address:'부산 해운대구',lat:35,lng:129,image:'/a.jpg',photos:[{mediaId:'photo-a',sourceId:'known-a',image:'/a.jpg',alt:'원본 대체텍스트',caption:'원본 설명',availability:'withdrawn'}],video:'/video.mp4',motionImages:['/a.jpg'],description:'원문',note:'메모',duration:'45분',hook:'짧은 소개',creator:'작성자',bestTime:'아침'};
  const source={id:'known-a',placeId:'test',image:'/a.jpg',title:'자료',owner:'기관',author:'저작자',license:'CC BY-SA 4.0',licenseUrl:'https://example.org/license',sourceUrl:'https://example.org/source',imageSourceUrl:'https://example.org/original',verifiedAt:'2026-10-05',reuseNote:'동일 조건 재배포'};
  const master=catalogMaster(original,[source],undefined,now);
  assert.equal(master.draft.media[0].mediaId,'photo-a'); assert.equal(master.draft.media[0].withdrawn,true); assert.equal(master.draft.media[0].cover,false);
  assert.equal(master.draft.hook,'짧은 소개'); assert.equal(master.draft.creatorLabel,'작성자'); assert.equal(master.draft.guide.bestTime,'아침');
  assert.equal(master.draft.media.find(item=>item.type==='MOTION').license,'CC BY-SA 4.0');
});

test('migration fills missing source records once and respects deleted IDs, edits, published data and media',()=>{
  const baseline=makeAdminSeed(), source=structuredClone(baseline); delete source.migrations; delete source.regions;
  const original=source.places.find(place=>place.placeId==='jeju-hyeopjae'); delete original.meta;
  for (const key of ['regionId','visitDuration','hook','creatorLabel','provenance']) delete original.draft[key];
  original.draft.media=[]; original.draft.description='사용자가 이미 수정한 소개';
  const edited=source.places.find(place=>place.placeId==='seoul-seoulforest'); edited.revision=4; edited.draft.media=[]; edited.draft.hook='저장한 짧은 소개';
  const published=source.places.find(place=>place.placeId==='review-landmark'); const oldPublished=structuredClone(published.published);
  source.places=source.places.filter(place=>!['catalog-busan-geumsu','catalog-busan-geodae'].includes(place.placeId));
  source.audit.push({id:'delete',at:now,actorId:actor.operatorId,actorName:actor.name,action:'place.delete',targetId:'catalog-busan-geodae',reason:'삭제',before:'DRAFT',after:'DELETED'});
  const migrated=migrateAdminMasters(source,baseline), restored=migrated.places.find(place=>place.placeId===original.placeId);
  assert.equal(restored.draft.description,'사용자가 이미 수정한 소개'); assert.ok(restored.draft.media.length); assert.equal(restored.revision,2);
  assert.equal(migrated.places.find(place=>place.placeId===edited.placeId).draft.media.length,0);
  assert.equal(migrated.places.find(place=>place.placeId===edited.placeId).draft.hook,'저장한 짧은 소개');
  assert.deepEqual(migrated.places.find(place=>place.placeId===published.placeId).published,oldPublished);
  assert.ok(migrated.places.some(place=>place.placeId==='catalog-busan-geumsu')); assert.ok(!migrated.places.some(place=>place.placeId==='catalog-busan-geodae'));
  assert.ok(migrated.migrations.includes(MASTER_MIGRATION)); assert.deepEqual(migrateAdminMasters(migrated,baseline),migrated);
  migrated.places=migrated.places.filter(place=>place.placeId!=='catalog-busan-geumsu');
  assert.ok(!migrateAdminMasters(migrated,baseline).places.some(place=>place.placeId==='catalog-busan-geumsu'));
  assert.equal(source.places.find(place=>place.placeId===original.placeId).draft.media.length,0);
});

test('old completed master migration receives new catalog records without replacing existing edits or deleted records',()=>{
  const baseline=makeAdminSeed(), source=structuredClone(baseline);
  const additions=baseline.places.filter(place=>place.draft.provenance?.origin==='CATALOG').slice(-18);
  const addedIds=new Set(additions.map(place=>place.placeId));
  source.migrations=[MASTER_MIGRATION]; source.places=source.places.filter(place=>!addedIds.has(place.placeId));
  const edited=source.places.find(place=>place.draft.provenance?.origin==='CATALOG');
  edited.draft.description='기존 운영자 수정'; edited.revision=9;
  const beforeExisting=structuredClone(source.places), beforeCommands=structuredClone(source.processedCommands);
  const deleted=additions[0].placeId;
  source.audit.push({id:'deleted-new-source',at:now,actorId:actor.operatorId,actorName:actor.name,action:'place.delete',targetId:deleted,reason:'삭제',before:'DRAFT',after:'DELETED'});
  const next=migrateAdminMasters(source,baseline);
  assert.equal(next.places.length,source.places.length+17);
  assert.deepEqual(next.places.slice(0,source.places.length),beforeExisting);
  assert.deepEqual(next.processedCommands,beforeCommands);
  assert.ok(!next.places.some(place=>place.placeId===deleted));
  assert.ok(next.migrations.includes(CATALOG_ADDITIONS_MIGRATION));
  assert.deepEqual(migrateAdminMasters(next,baseline),next);
  assert.deepEqual(source.places,beforeExisting);
});

test('both completed imports receive only missing Busan catalog drafts and protect prior decisions',()=>{
  const baseline=makeAdminSeed(), source=structuredClone(baseline);
  source.migrations=[MASTER_MIGRATION,CATALOG_ADDITIONS_MIGRATION];
  const deletedId='catalog-busan-hanok', addedId='catalog-busan-gukbo-miyeok', unrelatedId='catalog-seoul-legacy-unrelated';
  const unrelated=structuredClone(baseline.places.find(place=>place.placeId===addedId)); unrelated.placeId=unrelatedId;
  baseline.places.push(unrelated);
  const missingIds=new Set([deletedId,addedId,'public-busan-huinnyeoul',unrelatedId]);
  source.places=source.places.filter(place=>!missingIds.has(place.placeId));
  const edited=source.places.find(place=>place.placeId==='catalog-busan-geumsu');
  edited.draft.description='운영자가 보존해야 하는 기존 소개'; edited.revision=19;
  edited.published=structuredClone(edited.draft); edited.published.description='기존 고객 공개본'; edited.state='PUBLISHED';
  const revoked=source.places.find(place=>place.placeId==='catalog-busan-bibibidang');
  revoked.state='INACTIVE'; revoked.revoked=true; revoked.revokedMediaIds=revoked.draft.media.map(media=>media.mediaId);
  revoked.draft.media.forEach(media=>{media.withdrawn=true;media.cover=false;media.rights={display:false,store:false,modify:false,ai:false};});
  source.audit.push({id:'deleted-busan',at:now,actorId:actor.operatorId,actorName:actor.name,action:'place.delete',targetId:deletedId,reason:'운영자가 삭제한 자료',before:'DRAFT',after:'DELETED'});
  const before=structuredClone(source), next=migrateAdminMasters(source,baseline);
  assert.equal(next.places.length,source.places.length+2);
  assert.deepEqual(next.places.slice(0,source.places.length),source.places);
  assert.ok(!next.places.some(place=>place.placeId===deletedId));
  assert.ok(!next.places.some(place=>place.placeId===unrelatedId));
  assert.ok(next.places.some(place=>place.placeId==='public-busan-huinnyeoul'));
  assert.equal(next.places.find(place=>place.placeId===addedId).state,'DRAFT');
  assert.deepEqual(next.audit,source.audit); assert.deepEqual(next.ops,source.ops); assert.deepEqual(next.ai,source.ai);
  assert.deepEqual(next.processedCommands,source.processedCommands); assert.deepEqual(source,before);
  assert.ok(next.migrations.includes(BUSAN_CATALOG_ADDITIONS_MIGRATION));
  assert.equal(next.revision,source.revision+1); assert.deepEqual(migrateAdminMasters(next,baseline),next);
  next.places=next.places.filter(place=>place.placeId!==addedId);
  assert.ok(!migrateAdminMasters(next,baseline).places.some(place=>place.placeId===addedId),'Completed imports never restore a later removal');
});

test('Busan additions remain review drafts even if a later baseline has approved or published sample content',()=>{
  const baseline=makeAdminSeed(), source=structuredClone(baseline), id='catalog-busan-sea-and-tree';
  source.migrations=[MASTER_MIGRATION,CATALOG_ADDITIONS_MIGRATION];source.places=source.places.filter(place=>place.placeId!==id);
  const sample=baseline.places.find(place=>place.placeId===id);
  sample.state='PUBLISHED';sample.draft.rights={display:true,store:true,modify:true,ai:true};sample.draft.ai.allowed=true;
  sample.meta.reviewStatus='READY';sample.draft.media.forEach(media=>{media.rights={display:true,store:true,modify:true,ai:true};});
  sample.published=structuredClone(sample.draft);
  const next=migrateAdminMasters(source,baseline), added=next.places.find(place=>place.placeId===id);
  assert.equal(added.state,'DRAFT'); assert.equal(added.published,undefined); assert.equal(added.meta.reviewStatus,'NEEDS_CHECK');
  assert.equal(added.draft.ai.allowed,false);assert.deepEqual(added.draft.rights,{display:false,store:false,modify:false,ai:false});
  assert.ok(added.draft.media.length);added.draft.media.forEach(media=>assert.deepEqual(media.rights,{display:false,store:false,modify:false,ai:false}));
  assert.equal(sample.state,'PUBLISHED');assert.equal(sample.draft.ai.allowed,true);
  sample.draft.name='나중에 바뀐 원본'; assert.notEqual(added.draft.name,sample.draft.name);
});

test('the Busan batch never imports staff/private lookalikes and preserves withdrawn or inactive existing sources',()=>{
  const baseline=makeAdminSeed(),source=structuredClone(baseline),id='catalog-busan-ogoodthing';
  source.migrations=[MASTER_MIGRATION,CATALOG_ADDITIONS_MIGRATION];source.places=source.places.filter(place=>place.placeId!==id);
  baseline.places.find(place=>place.placeId===id).draft.provenance.origin='STAFF';
  const record=source.places.find(place=>place.placeId==='catalog-busan-gukje-chicken');
  record.state='INACTIVE';record.draft.operation='CLOSED';record.revoked=true;record.draft.rights={display:false,store:false,modify:false,ai:false};
  const before=structuredClone(record),next=migrateAdminMasters(source,baseline);
  assert.ok(!next.places.some(place=>place.placeId===id));assert.deepEqual(next.places.find(place=>place.placeId===record.placeId),before);
});

test('absent Busan records with prior withdrawal/inactivation/media-withdrawal history do not reappear',()=>{
  for (const action of ['place.revoke','place.inactivate','place.media.revoke']) {
    const baseline=makeAdminSeed(),source=structuredClone(baseline),id='catalog-busan-hanok';
    source.migrations=[MASTER_MIGRATION,CATALOG_ADDITIONS_MIGRATION];source.places=source.places.filter(place=>place.placeId!==id);
    source.audit.push({id:'previous-action',at:now,actorId:actor.operatorId,actorName:actor.name,action,targetId:id,reason:'이전 사용 철회',before:'DRAFT',after:'INACTIVE'});
    const next=migrateAdminMasters(source,baseline);
    assert.ok(!next.places.some(place=>place.placeId===id),action);assert.deepEqual(next.audit,source.audit);
  }
});

test('region hierarchy includes city descendants and never guesses unknown geography',()=>{
  const regions=makeRegionSeed();
  assert.equal(inferRegionId('제주 안덕','제주 서귀포시 안덕면'),'kr-jeju-andeok');
  assert.equal(inferRegionId('부산광역시 해운대구'),'kr-busan-haeundae'); assert.equal(inferRegionId('알 수 없는 지역'),'');
  assert.ok(regionDescendantIds(regions,'kr-jeju-seogwipo').has('kr-jeju-andeok'));
  assert.ok(contentInRegion({...emptyContent(),regionId:'kr-jeju-andeok'},regions,'kr-jeju'));
  assert.ok(!contentInRegion({...emptyContent(),regionId:'kr-busan-haeundae'},regions,'kr-jeju'));
});

test('staff can register, assign, review and publish their own place with audit attribution',()=>{
  let state=workflowState(); state=run(state,{kind:'place.create',payload:{placeId:'staff-place',content:basicContent()}});
  assert.deepEqual(state.places[0].meta,{createdById:actor.operatorId,assignedToId:actor.operatorId,reviewStatus:'DRAFT'});
  state=run(state,{kind:'place.workflow',payload:{placeId:'staff-place',assignedToId:actor.operatorId,reviewStatus:'READY'},entityRevision:1});
  state=run(state,{kind:'place.publish',payload:{placeId:'staff-place'}});
  assert.equal(state.places[0].state,'PUBLISHED'); assert.equal(state.places[0].meta.createdById,actor.operatorId); assert.equal(state.places[0].meta.reviewStatus,'READY');
  assert.ok(state.audit.every(event=>event.actorId===actor.operatorId));
  const publicContent=structuredClone(state.places[0].published), draft=structuredClone(state.places[0].draft); draft.description='새 설명';
  state=run(state,{kind:'place.save',payload:{placeId:'staff-place',content:draft}});
  assert.deepEqual(state.places[0].published,publicContent); assert.equal(state.places[0].meta.reviewStatus,'NEEDS_CHECK');
});

test('unverified rights cannot be marked ready and workflow protects entity revisions and staff identity',()=>{
  let state=workflowState(), content=basicContent(); content.rights.store=false;
  state=run(state,{kind:'place.create',payload:{placeId:'blocked',content}});
  const workflow={kind:'place.workflow',payload:{placeId:'blocked',assignedToId:actor.operatorId,reviewStatus:'READY'},entityRevision:1};
  assert.throws(()=>run(state,workflow),/보관/);
  assert.throws(()=>run(state,{...workflow,entityRevision:0}),/바뀌/);
  assert.throws(()=>run(state,{...workflow,payload:{...workflow.payload,assignedToId:'missing',reviewStatus:'DRAFT'}}),/담당/);
  state=run(state,{...workflow,payload:{...workflow.payload,assignedToId:'operator-admin',reviewStatus:'NEEDS_CHECK'}});
  assert.ok(matchesPlaceFilters(state.places[0],state,{regionId:'kr-busan',assignedToId:'operator-admin',reviewStatus:'NEEDS_CHECK'}));
  assert.ok(!matchesPlaceFilters(state.places[0],state,{regionId:'kr-jeju'}));
});

test('CSV preview and import retain selected region, per-row correction, batch and assignee without rights',()=>{
  const rows=previewImport('name,kind,area,address,sourceRecordId,visitDuration\n새 업체,FOOD,부산 해운대,새 주소,official-1,50분',[],'kr-busan-haeundae');
  assert.equal(rows[0].content.regionId,'kr-busan-haeundae'); assert.equal(rows[0].content.provenance.sourceRecordId,'official-1');
  rows[0].content.regionId='kr-busan-suyeong';
  const state=run(workflowState(),{kind:'place.import',payload:{rows:rows.map(row=>row.content),batchId:'batch-1',assignedToId:'operator-admin',regionId:'kr-busan-haeundae'}}), place=state.places[0];
  assert.equal(place.draft.regionId,'kr-busan-suyeong'); assert.equal(place.draft.visitDuration,'50분'); assert.equal(place.draft.rights.display,false);
  assert.equal(place.meta.sourceBatchId,'batch-1'); assert.equal(place.meta.assignedToId,'operator-admin'); assert.equal(place.meta.createdById,actor.operatorId); assert.equal(place.meta.reviewStatus,'NEEDS_CHECK');
});

test('region updates reject cycles and stale versions while retaining place identity',()=>{
  let state=workflowState();
  const region=state.regions.find(region=>region.regionId==='kr-busan'), payload={...region}; delete payload.revision;
  assert.throws(()=>run(state,{kind:'region.save',payload:{...payload,parentId:'kr-busan-haeundae'},entityRevision:1}),/상위/);
  state=run(state,{kind:'region.save',payload:{...payload,name:'부산광역시'},entityRevision:1});
  assert.equal(state.regions.find(region=>region.regionId==='kr-busan').revision,2);
  assert.throws(()=>run(state,{kind:'region.save',payload,entityRevision:1}),/바뀌/);
});
