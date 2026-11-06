import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalAdminAdapter, ADMIN_STORAGE_KEY, assertAdminState, listAdminResource } from '../src/admin/repository.ts';
import { makeAiSeed } from '../src/admin/aiSeed.ts';
import { makeOpsSeed } from '../src/admin/opsSeed.ts';
import { emptyContent } from '../src/admin/content.ts';
import { makeRegionSeed } from '../src/admin/regions.ts';
import { MASTER_MIGRATION } from '../src/admin/migration.ts';
import { REVIEW_SERVICE_KEY, receiveLocalReviewReport, readReviewServiceState, syncReviewPublicProjection, overlayPublicPlaces, emptyReviewServiceState, recordPublicCardReaction, recordPublicCheer } from '../src/reviewServiceBridge.ts';

const actor = {operatorId:'operator-admin',name:'검수 관리자',role:'ADMIN'};
const now = '2026-10-05T00:00:00.000Z';
const memory = () => {const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
const seed = () => ({schemaVersion:1,revision:1,migrations:[MASTER_MIGRATION],regions:makeRegionSeed(),places:[],nearbyOverrides:[],ai:makeAiSeed(),ops:makeOpsSeed(),audit:[],processedCommands:[]});
const journey = {id:'public-source',purpose:'JOURNAL',status:'PUBLISHED',visibility:'PUBLIC',title:'공개 여행기',author:'공개 여행자',cover:'/admin-review.svg',region:'부산',summary:'공개 소개',story:'공개 본문',tags:['바다'],days:[{dayId:'public-day',day:1,date:'',title:'첫날',story:'공개 하루 글',places:[],blocks:[{id:'public-text',type:'TEXT',body:'공개 단락'}]}],privateNote:'PRIVATE_SENTINEL',booking:{guest:'PRIVATE_BOOKING'},plannerPreferences:{request:'PRIVATE_AI_REQUEST'}};
const cmd = (state,input) => ({...input,expectedRevision:state.revision,idempotencyKey:crypto.randomUUID()});

test('customer report reaches administrator with public reading context, no private preferences and stable receipt',async()=>{
  const storage=memory();storage.values.set('spotlog-customer-private','PRIVATE_SENTINEL');
  const target={type:'JOURNAL',id:journey.id,label:journey.title,journey};
  const receipt=receiveLocalReviewReport(target,'INFORMATION','내용 확인 요청','local-self',storage);
  assert.equal(receiveLocalReviewReport(target,'INFORMATION','중복 요청','local-self',storage).duplicate,true);
  const adapter=createLocalAdminAdapter(storage,seed),state=await adapter.load();
  assert.equal(state.ops.reports.filter(r=>r.reportId===receipt.report.reportId).length,1);
  assert.equal(state.ops.journals.find(j=>j.journalId===journey.id).days[0].blocks[0].body,'공개 단락');
  assert.ok(state.ops.members.some(member=>member.memberId==='public-author:공개 여행자'));
  assert.equal(JSON.stringify(state).includes('PRIVATE_SENTINEL'),false);
  assert.equal(JSON.stringify(state).includes('PRIVATE_BOOKING'),false);
  assert.equal(JSON.stringify(state).includes('PRIVATE_AI_REQUEST'),false);
  assert.equal(storage.values.get('spotlog-customer-private'),'PRIVATE_SENTINEL');
});

test('moderator receipt and hidden content propagate once; repeated loads cannot undo decisions or cause events',async()=>{
  const storage=memory(),target={type:'JOURNAL',id:journey.id,label:journey.title,journey};
  const receipt=receiveLocalReviewReport(target,'ABUSE','공개 대상 신고','local-self',storage),adapter=createLocalAdminAdapter(storage,seed);
  let state=await adapter.load();
  state=(await adapter.execute(cmd(state,{kind:'ops.content.moderate',targetType:'JOURNAL',targetId:journey.id,action:'HIDE',reason:'공개 내용 검수',entityRevision:1}),actor)).state;
  state=(await adapter.execute(cmd(state,{kind:'ops.report.resolve',reportId:receipt.report.reportId,status:'RESOLVED',reason:'숨김 처리 검수',entityRevision:1}),actor)).state;
  const projected=readReviewServiceState(storage);
  assert.equal(projected.reports.find(r=>r.reportId===receipt.report.reportId).status,'RESOLVED');
  assert.equal(projected.journalModeration.find(j=>j.id===journey.id).state,'HIDDEN');
  const raw=storage.values.get(REVIEW_SERVICE_KEY),revision=state.revision;
  assert.equal((await adapter.load()).revision,revision);
  assert.equal((await adapter.load()).ops.journals.find(j=>j.journalId===journey.id).moderation,'HIDDEN');
  assert.equal(storage.values.get(REVIEW_SERVICE_KEY),raw);
});

test('draft places stay absent, published records overlay the same ID and rights withdrawal blocks the original',()=>{
  const storage=memory(),state=seed(),content=emptyContent('FOOD');
  Object.assign(content,{name:'등록 식당',area:'부산',regionId:'kr-busan',address:'공개 주소',description:'등록 소개',provenance:{origin:'STAFF'},provider:'검수',sourceUrl:'https://example.org/source',checkedAt:'2026-10-05'});
  content.location={lat:35.16,lng:129.16,verified:true,reference:'직접 검수',sourceUrl:'https://example.org/source',checkedAt:'2026-10-05'};
  content.rights={display:true,store:true,modify:false,ai:false};
  const place={placeId:'shared-food',revision:1,state:'DRAFT',draft:content,revoked:false,updatedAt:now};state.places.push(place);
  syncReviewPublicProjection(state,storage);assert.equal(readReviewServiceState(storage).publishedPlaces.length,0);
  place.state='PUBLISHED';place.published=structuredClone(content);syncReviewPublicProjection(state,storage);
  const baseline=[{id:'shared-food',kind:'FOOD',name:'원래 소개',area:'부산',address:'주소',image:'',description:'기존소개',note:'',duration:'',lat:35.16,lng:129.16}];
  assert.equal(overlayPublicPlaces(baseline,readReviewServiceState(storage))[0].name,'등록 식당');
  place.revoked=true;syncReviewPublicProjection(state,storage);
  assert.equal(overlayPublicPlaces(baseline,readReviewServiceState(storage)).length,0);
});

test('private-rich response and malformed report context are rejected before saved admin data is overwritten',async()=>{
  const storage=memory(),state=seed();
  state.ops.journals[1].days=[{day:1,date:'',title:'개인 DAY',story:'PRIVATE',places:[],blocks:[]}];
  assert.throws(()=>assertAdminState(state));
  const valid=seed();storage.values.set(ADMIN_STORAGE_KEY,JSON.stringify(valid));
  const incoming=emptyReviewServiceState();incoming.publicJournals.push({journalId:'bad',ownerVisibility:'PUBLIC'});storage.values.set(REVIEW_SERVICE_KEY,JSON.stringify(incoming));
  await assert.rejects(createLocalAdminAdapter(storage,seed).load());
  assert.equal(storage.values.get(ADMIN_STORAGE_KEY),JSON.stringify(valid));
});

test('region descendants and assigned staff filter the same server-shaped paginated place query',()=>{
  const state=seed(),content=emptyContent();content.regionId='kr-busan';
  state.places.push({placeId:'assigned',revision:1,state:'DRAFT',draft:content,revoked:false,updatedAt:now,meta:{createdById:actor.operatorId,assignedToId:'worker',reviewStatus:'NEEDS_CHECK'}});
  assert.equal(listAdminResource(state,{resource:'places',filters:{regionId:'kr',assignedToId:'worker',reviewStatus:'NEEDS_CHECK'}}).total,1);
  assert.equal(listAdminResource(state,{resource:'places',filters:{regionId:'kr-seoul'}}).total,0);
  assert.ok(listAdminResource(state,{resource:'regions'}).total>0);
});
test('explicit public reactions reach admin aggregate fields and cannot overwrite reviewed text or moderation',async()=>{
  const storage=memory(),withCard={...journey,days:[{day:1,date:'',title:'첫날',story:'공개 DAY',places:[{id:'public-place',kind:'LANDMARK',name:'공개 장소',area:'부산',address:'주소',image:'/admin-review.svg',description:'공개 장소',note:'',duration:'1시간'}],blocks:[{id:'public-card',type:'PLACE',placeId:'public-place'}]}]};
  receiveLocalReviewReport({type:'JOURNAL',id:withCard.id,label:withCard.title,journey:withCard},'OTHER','공개 대상','local-self',storage);
  const adapter=createLocalAdminAdapter(storage,seed);await adapter.load();
  recordPublicCardReaction(withCard,'public-card',{id:'local-self',name:'공개 사용자'},true,storage);
  recordPublicCheer(withCard,'local-self','HELPFUL',true,storage);
  const state=await adapter.load(),journal=state.ops.journals.find(j=>j.journalId===withCard.id);
  assert.equal(journal.reactionBreakdown.HELPFUL,1);assert.equal(journal.cards[0].likes,1);assert.equal(journal.cards[0].likeUsers[0].name,'공개 사용자');
  assert.equal(journal.original,'공개 본문');assert.equal(journal.moderation,'VISIBLE');
  assert.equal((await adapter.load()).revision,state.revision);
});
