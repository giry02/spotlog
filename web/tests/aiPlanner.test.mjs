import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRevision, validatePlannerResult, validateRevisionResult, catalogVersion, createAiPlannerSampleAdapter, defaultPlannerConditions, generatePlannerSample, journeyVersion, plannerBusinessCandidates, revisePlannerSample, revisionScopeVisits, validatePlannerConditions } from '../src/aiPlanner.ts';
import { buildPersonalPlan, insertNearby, makeJournalFromPlan } from '../src/tripPlan.ts';

const place=(id,extra={})=>({id,kind:'LANDMARK',name:id,area:'서울 성동',address:'서울',lat:37.54,lng:127.04,image:'',description:'산책과 자연',note:'',duration:'1시간',...extra});
const catalog=Array.from({length:10},(_,i)=>place(`p${i}`));
const request=(patch={},condition={})=>({requestId:'request-1',sourceVersion:catalogVersion(catalog),language:'ko',selectedPlaceIds:[],dayIds:[],lockedVisitIds:[],conditions:{...defaultPlannerConditions(),region:'서울',...condition},catalog,savedPlaces:catalog,author:'나',...patch});
const revision=(journey,patch={})=>({requestId:'rev-1',sourceVersion:journeyVersion(journey),language:'ko',selectedPlaceIds:[],dayIds:[],lockedVisitIds:[],journey,dayId:journey.days[0].dayId,scope:'day',lessWalking:true,excludedVisitIds:[],...patch});

test('generation builds exact dates and private PLAN only with request-private saved selections',()=>{
  const result=generatePlannerSample(request({}, {mode:'saved',dayCount:7,startDate:'2026-12-29'}));
  assert.equal(result.mock,true);assert.equal(result.data.journey.days.length,7);assert.equal(result.data.journey.days[6].date,'2027-01-04');
  assert.equal(result.data.journey.visibility,'PRIVATE');assert.equal(result.data.journey.purpose,'PLAN');assert.equal(result.data.journey.days.flatMap(d=>d.places).length,10);
  assert.equal(catalog[0].visitId,undefined);assert.equal(result.sources[0].checkedAt,null);
});
test('accepted trip keeps private conditions; journal conversion never exports them',()=>{
  const plan=generatePlannerSample(request({}, {companions:'가족',accessibility:'개인 요청',meals:'식사 요청'})).data.journey;
  assert.equal(plan.planningPreferences.accessibility,'개인 요청');
  const journal=makeJournalFromPlan(plan,'나');assert.equal(journal.planningPreferences,undefined);assert.equal(plan.planningPreferences.companions,'가족');
  assert.equal(JSON.stringify(journal).includes('개인 요청'),false);
});
test('region recommendation excludes personal records but personal saved requests may use them',()=>{
  const privatePlace=place('personal',{personal:true});
  assert.throws(()=>generatePlannerSample(request({catalog:[privatePlace]})),/없어요/);
  assert.equal(generatePlannerSample(request({savedPlaces:[privatePlace]},{mode:'saved'})).data.journey.days.flatMap(d=>d.places)[0].id,'personal');
});
test('required and fixed places are not lost to slow capacity; excluded places stay excluded',()=>{
  const result=generatePlannerSample(request({}, {dayCount:1,pace:'slow',requiredIds:['p4','p5','p6'],fixedIds:['p8'],excludedIds:['p0']}));
  const visits=result.data.journey.days.flatMap(d=>d.places);
  assert.deepEqual(new Set(visits.map(p=>p.id)),new Set(['p4','p5','p6','p8']));assert.equal(visits.find(p=>p.id==='p8').bookingFixed,true);
  assert.ok(result.warnings.some(w=>w.includes('방문 수가 많아')));
});
test('invalid dates, duration, conflicts and outside-region required places fail before generation',()=>{
  for(const c of [{dayCount:0},{dayCount:8},{dayCount:2.5},{startDate:'2026-02-30'},{requiredIds:['p0'],excludedIds:['p0']},{fixedIds:['p0'],excludedIds:['p0']},{requiredIds:['missing']},{dayCount:1,arrival:'18:00',departure:'09:00'},{arrival:'26:00'}]) assert.ok(validatePlannerConditions({...defaultPlannerConditions(),region:'서울',...c},catalog).length);
  assert.throws(()=>generatePlannerSample(request({catalog:[place('jeju',{area:'제주 한림'})]},{requiredIds:['jeju']})),/지역/);
});
test('saved request over 30 is blocked, not silently truncated',()=>{
  const saved=Array.from({length:31},(_,i)=>place(`large${i}`));
  assert.throws(()=>generatePlannerSample(request({savedPlaces:saved},{mode:'saved'})),/30/);
  assert.equal(generatePlannerSample(request({savedPlaces:saved},{mode:'saved',excludedIds:['large30']})).data.journey.days.flatMap(d=>d.places).length,30);
});
test('missing coordinates are retained; saved places in other regions are explicitly unplaced',()=>{
  const result=generatePlannerSample(request({savedPlaces:[place('missing',{lat:NaN}),place('jeju',{area:'제주'})]},{mode:'saved',dayCount:4}));
  assert.equal(result.data.journey.days.length,4);assert.equal(result.data.journey.days.flatMap(d=>d.places).length,1);
  assert.ok(result.warnings.some(w=>w.includes('좌표')));assert.ok(result.unplaced.some(p=>p.placeId==='jeju'&&p.reason.includes('지역')));
  assert.equal(result.data.journey.days[0].places[0].move,undefined);
});
test('complete drafts include nearby businesses while deliberate editing keeps geographic scope',()=>{
  const anchor=place('anchor'),food=place('food',{kind:'FOOD'}),far=place('far',{kind:'FOOD',lat:33}),stay=place('stay',{kind:'STAY'});
  const result=generatePlannerSample(request({catalog:[anchor,food,stay]},{suggestFood:true,suggestStay:true}));
  assert.deepEqual(result.data.journey.days.flatMap(d=>d.places).map(p=>p.id),['anchor','food','stay']);
  assert.deepEqual(plannerBusinessCandidates(anchor,[food,far,stay],'FOOD').map(p=>p.id),['food']);
  assert.equal(plannerBusinessCandidates(anchor,[food],'FOOD',new Set()).length,0);
});
test('revision retains fixed visits, lodging, untouched DAY, text/photo and card identities',()=>{
  let trip=buildPersonalPlan(catalog.slice(0,8),2,'여행','나');
  trip.days[0].places[3].bookingFixed=true;
  trip.days[0].blocks.unshift({id:'text',type:'TEXT',body:'직접 쓴 글'},{id:'image',type:'IMAGE',image:'my-photo'});
  const snapshot=structuredClone(trip),result=revisePlannerSample(revision(trip));
  const updated=applyRevision(trip,result,revision(trip));
  assert.deepEqual(trip,snapshot);assert.equal(updated.days[1],trip.days[1]);
  assert.ok(updated.days[0].places.some(p=>p.visitId===trip.days[0].places[3].visitId));
  assert.deepEqual(updated.days[0].blocks.filter(b=>b.type!=='PLACE'),trip.days[0].blocks.filter(b=>b.type!=='PLACE'));
  updated.days[0].blocks.filter(b=>b.type==='PLACE').forEach(b=>assert.ok(trip.days[0].blocks.some(old=>old.id===b.id)));
});
test('afternoon scope never guesses times and preserves untimed or morning visits',()=>{
  const trip=buildPersonalPlan(catalog.slice(0,5),1,'','나');
  trip.days[0].places[0].time='09:00';trip.days[0].places[1].time='13:00';trip.days[0].places[2].time='15:00';trip.days[0].places[3].time='17:00';
  const req=revision(trip,{scope:'afternoon'}),ids=revisionScopeVisits(req);
  assert.equal(ids.size,3);assert.equal(ids.has(trip.days[0].places[4].visitId),false);
  const next=applyRevision(trip,revisePlannerSample(req),req);assert.ok(next.days[0].places.some(p=>p.id==='p4'));assert.ok(next.days[0].places.some(p=>p.id==='p0'));
  assert.throws(()=>revisePlannerSample(revision(buildPersonalPlan(catalog,2,'','나'),{scope:'afternoon'})),/오후 시간이/);
});
test('remaining scope starts at exact visit and never alters earlier days or visits',()=>{
  const trip=buildPersonalPlan(catalog,2,'','나');
  const req=revision(trip,{dayId:trip.days[1].dayId,scope:'remaining',fromVisitId:trip.days[1].places[1].visitId});
  const next=applyRevision(trip,revisePlannerSample(req),req);assert.equal(next.days[0],trip.days[0]);assert.deepEqual(next.days[1].places[0],trip.days[1].places[0]);
  assert.throws(()=>revisePlannerSample({...req,fromVisitId:'deleted'}),/시작할 장소/);
});
test('reserved businesses protect their landmark; excluded out-of-scope visits are rejected',()=>{
  let trip=buildPersonalPlan(catalog.slice(0,4),1,'','나');const anchor=trip.days[0].places[3].visitId;
  trip=insertNearby(trip,trip.days[0].dayId,anchor,place('food',{kind:'FOOD'}));trip.days[0].places.find(p=>p.id==='food').bookingFixed=true;
  assert.throws(()=>revisePlannerSample(revision(trip,{excludedVisitIds:[anchor]})),/고정/);
  trip.days[0].places[0].time='09:00';trip.days[0].places[1].time='15:00';
  assert.throws(()=>revisePlannerSample(revision(trip,{scope:'afternoon',excludedVisitIds:[trip.days[0].places[0].visitId]})),/범위 밖/);
});
test('stale and duplicate approvals never overwrite later edits',()=>{
  const trip=buildPersonalPlan(catalog.slice(0,4),1,'','나'),result=revisePlannerSample(revision(trip));
  assert.throws(()=>applyRevision({...trip,title:'수정한 제목'},result,revision(trip)),/바뀌었어요/);
  const next=applyRevision(trip,result,revision(trip));assert.throws(()=>applyRevision(next,result,revision(trip)),/바뀌었어요/);
});
test('unauthorized and trashed plans cannot be revised',()=>{
  const trip=buildPersonalPlan(catalog.slice(0,4),1,'','나');
  for(const changed of [{...trip,isMine:false},{...trip,purpose:'JOURNAL'},{...trip,trash:{deletedAt:'2026-09-19'}}]) assert.throws(()=>revisePlannerSample(revision(changed)),/개인 일정/);
});
test('approval rejects a malformed result that changes authored text or a fixed visit',()=>{
  const trip=buildPersonalPlan(catalog.slice(0,5),1,'','나');trip.days[0].blocks.push({id:'text',type:'TEXT',body:'원문'});trip.days[0].places[0].bookingFixed=true;
  const result=revisePlannerSample(revision(trip));
  const changed=structuredClone(result);changed.data.journey.days[0].blocks.find(b=>b.id==='text').body='변경';assert.throws(()=>applyRevision(trip,changed,revision(trip)),/글·사진/);
  const changedLock=structuredClone(result);changedLock.data.journey.days[0].places[0].name='수정';assert.throws(()=>applyRevision(trip,changedLock,revision(trip)),/고정|요청하지/);
});
test('adapter abort rejects pending work; independent request identifiers are returned unchanged',async()=>{
  const controller=new AbortController(),adapter=createAiPlannerSampleAdapter({delayMs:100});
  const pending=adapter.generate(request(),controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});
  const result=await createAiPlannerSampleAdapter({delayMs:0}).generate(request({requestId:'later'}));assert.equal(result.requestId,'later');
});
test('all server error fixtures are explicit and preserve the input request',async()=>{
  for(const failure of ['401','403','429','500','timeout','empty']){const req=request(),snapshot=structuredClone(req);await assert.rejects(createAiPlannerSampleAdapter({delayMs:0,failure}).generate(req),error=>error.code===failure);assert.deepEqual(req,snapshot);}
});
test('required places remain protected during later less-walking revisions',()=>{
  const plan=generatePlannerSample(request({}, {dayCount:1,pace:'slow',requiredIds:['p0','p1','p2','p3']})).data.journey;
  const result=revisePlannerSample(revision(plan));assert.equal(result.data.removedVisitIds.length,0);assert.equal(result.data.journey.days[0].places.length,4);
  assert.throws(()=>revisePlannerSample(revision(plan,{excludedVisitIds:[plan.days[0].places[2].visitId]})),/고정/);
});
test('generation rejects malformed responses, missing required stops, wrong days and unknown places before preview',()=>{
  const req=request({}, {requiredIds:['p0'],dayCount:2}),good=generatePlannerSample(req);
  assert.equal(validatePlannerResult(req,good).data.journey.days.length,2);
  for(const mutate of [r=>{r.data.journey.days={};},r=>{r.data.journey.days.pop();},r=>{r.data.journey.days[0].places=r.data.journey.days[0].places.filter(p=>p.id!=='p0');},r=>{r.data.journey.days[0].places[0].id='external-unapproved';},r=>{r.data.journey.days[0].places[0].photos={};},r=>{r.data.journey.days[0].date='wrong';}]){const bad=structuredClone(good);mutate(bad);assert.throws(()=>validatePlannerResult(req,bad));}
});
test('missing coordinates restored as JSON null are preserved through response validation',()=>{
  const req=request({savedPlaces:[place('no-coordinates',{lat:null,lng:null})]},{mode:'saved'}),result=generatePlannerSample(req);
  const checked=validatePlannerResult(req,result);assert.equal(checked.data.journey.days[0].places[0].id,'no-coordinates');assert.equal(checked.data.journey.days[0].places[0].lat,null);assert.ok(checked.warnings.some(w=>w.includes('좌표')));
});
test('revision approval uses the client scope, never server-supplied scope or lock lists',()=>{
  const trip=buildPersonalPlan(catalog.slice(0,5),1,'','나');trip.days[0].places.forEach((p,i)=>{p.time=i===0?'09:00':`${12+i}:00`;});
  const req=revision(trip,{scope:'afternoon'}),result=revisePlannerSample(req),morning=trip.days[0].places[0];
  const bad=structuredClone(result);bad.data.journey.days[0].places=bad.data.journey.days[0].places.filter(p=>p.visitId!==morning.visitId);bad.data.journey.days[0].blocks=bad.data.journey.days[0].blocks.filter(b=>b.visitId!==morning.visitId);bad.data.removedVisitIds.push(morning.visitId);bad.data.retainedLocks=[];
  assert.throws(()=>validateRevisionResult(req,bad),/범위 밖/);assert.throws(()=>applyRevision(trip,bad,req),/범위 밖/);
  assert.equal(applyRevision(trip,result,req).days[0].places[0].visitId,morning.visitId);
});
