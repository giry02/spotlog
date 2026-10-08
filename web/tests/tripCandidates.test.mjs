import test from 'node:test';
import assert from 'node:assert/strict';
import { addTripCandidate, candidateSelection, confirmTripCandidates, KEEP_CURRENT, removeTripCandidate, selectTripCandidate, SKIP_CANDIDATES } from '../src/tripCandidates.ts';
import { buildPersonalPlan, copyPersonalPlan, makeJournalFromPlan, normalizePlan, removePlanDay, removePlanVisit, setPlanStay, transferVisit, insertNearby } from '../src/tripPlan.ts';
import { createLocalRepository } from '../src/localRepository.ts';
import { hasStayCandidate } from '../src/tripCandidates.ts';

const place = (id, kind='LANDMARK') => ({id,kind,name:id,area:'부산 해운대',address:'부산',lat:35.16,lng:129.16,image:'',description:'',note:'',duration:''});
const setup = () => ({...buildPersonalPlan([place('a'),place('b')],3,'준비 중','나'),planStage:'DRAFT'});
const context = trip => ({dayId:trip.days[0].dayId,anchorVisitId:trip.days[0].places[0].visitId});
function shortlisted() { let trip=setup();const ctx=context(trip);for(const id of ['f1','f2'])trip=addTripCandidate(trip,place(id,'FOOD'),ctx);return trip; }
test('accommodation added state follows selected nights and booking intent instead of the landmark DAY',()=>{
  const base=setup(),ctx=context(base),stay=place('stay','STAY');
  const day2={...ctx,dayId:base.days[1].dayId,nights:1};
  const trip=addTripCandidate(base,stay,day2);
  assert.equal(hasStayCandidate(trip,stay.id,day2.dayId,1,false),true);
  assert.equal(hasStayCandidate(trip,stay.id,ctx.dayId,1,false),false);
  assert.equal(hasStayCandidate(trip,stay.id,ctx.dayId,2,false),false);
  assert.equal(hasStayCandidate(trip,stay.id,day2.dayId,1,true),false);
  assert.equal(hasStayCandidate(trip,stay.id,base.days[2].dayId,1,false),false);
});

test('multiple alternatives persist separately from visits, route blocks and booking assignments',()=>{
  const base=setup(),ctx=context(base);let trip=addTripCandidate(base,place('food1','FOOD'),ctx);
  trip=addTripCandidate(trip,place('food2','FOOD'),ctx);trip=addTripCandidate(trip,place('stay1','STAY'),{...ctx,nights:2});trip=addTripCandidate(trip,place('stay2','STAY'),{...ctx,nights:2});
  assert.deepEqual(trip.days,base.days);assert.equal(trip.businessCandidates.length,3);assert.deepEqual(trip.businessCandidates.map(g=>g.options.length),[2,2,2]);
  assert.equal(addTripCandidate(trip,place('food1','FOOD'),ctx).businessCandidates[0].options.length,2);assert.throws(()=>confirmTripCandidates(trip));
});
test('each landmark/type and each overnight has its own single final choice',()=>{
  let trip=shortlisted();const ctx=context(trip);
  for(const id of ['s1','s2'])trip=addTripCandidate(trip,place(id,'STAY'),{...ctx,nights:2});
  const groups=trip.businessCandidates;trip=selectTripCandidate(trip,groups[0].id,'f2');trip=selectTripCandidate(trip,groups[1].id,'s1');trip=selectTripCandidate(trip,groups[2].id,'s2');
  const result=confirmTripCandidates(trip);
  assert.equal(result.planStage,'READY');assert.deepEqual(result.businessCandidates,[]);
  assert.deepEqual(result.days[0].places.map(p=>p.id),['a','f2','s1']);assert.deepEqual(result.days[1].places.map(p=>p.id),['b','s2']);
  assert.equal(result.days[2].places.length,0);assert.equal(trip.days[0].places.length,1);
});
test('different landmarks and existing lunch/dinner remain independent',()=>{
  let trip={...buildPersonalPlan([place('a'),place('b')],2,'','나'),planStage:'READY'};const ctx=context(trip);
  trip=addTripCandidate(trip,place('lunch','FOOD'),{...ctx,slot:'lunch'});trip=addTripCandidate(trip,place('dinner','FOOD'),{...ctx,slot:'dinner'});
  trip=confirmTripCandidates(trip);
  assert.deepEqual(trip.days[0].places.filter(p=>p.kind==='FOOD').map(p=>p.planningSlot),['lunch','dinner']);
  trip=addTripCandidate(trip,place('alternative','FOOD'),{...ctx,slot:'lunch'});
  assert.equal(candidateSelection(trip,trip.businessCandidates[0]),KEEP_CURRENT);
  trip=selectTripCandidate(trip,trip.businessCandidates[0].id,'alternative');const result=confirmTripCandidates(trip);
  assert.deepEqual(result.days[0].places.filter(p=>p.kind==='FOOD').map(p=>p.id),['alternative','dinner']);
});
test('booked nights cannot be replaced by review; other nights can still choose alternatives',()=>{
  let trip=setup();const ctx=context(trip);trip=setPlanStay(trip,place('booked','STAY'),ctx.dayId,1,true);
  trip=addTripCandidate(trip,place('s2','STAY'),{...ctx,nights:2});const [locked,next]=trip.businessCandidates;
  assert.equal(candidateSelection(trip,locked),KEEP_CURRENT);assert.throws(()=>selectTripCandidate(trip,locked.id,'s2'));
  const tampered={...trip,businessCandidates:trip.businessCandidates.map(g=>g.id===locked.id?{...g,selectedId:'s2'}:g)};
  const result=confirmTripCandidates(tampered);assert.equal(result.days[0].places.at(-1).id,'booked');assert.equal(result.days[0].places.at(-1).bookingFixed,true);assert.equal(result.days[1].places.at(-1).id,'s2');assert.equal(candidateSelection(trip,next),'s2');
});
test('exclusion keeps the existing visit and removal never deletes visits',()=>{
  let trip=shortlisted();const ctx=context(trip);trip=insertNearby(trip,ctx.dayId,ctx.anchorVisitId,place('existing','FOOD'));
  trip=selectTripCandidate(trip,trip.businessCandidates[0].id,SKIP_CANDIDATES);assert.equal(confirmTripCandidates(trip).days[0].places[1].id,'existing');
  const removed=removeTripCandidate(trip,trip.businessCandidates[0].id,'f1');assert.equal(removed.businessCandidates[0].options.length,1);assert.deepEqual(removed.days,trip.days);
});
test('moving anchors follows DAY, removing anchors or overnight DAY prunes invalid candidates',()=>{
  let trip=shortlisted();const ctx=context(trip);
  let moved=normalizePlan(transferVisit(trip,ctx.dayId,ctx.anchorVisitId,trip.days[1].dayId,false,true));assert.equal(moved.businessCandidates[0].dayId,trip.days[1].dayId);
  assert.deepEqual(normalizePlan(removePlanVisit(trip,ctx.anchorVisitId,true)).businessCandidates,[]);
  trip=addTripCandidate(trip,place('hotel','STAY'),{...ctx,nights:2});const shorter=normalizePlan(removePlanDay(trip,trip.days[2].dayId));assert.equal(shorter.businessCandidates.filter(g=>g.kind==='STAY').length,1);
});
test('draft or pending alternatives cannot enter journals; confirmed snapshots exclude shortlist fields',()=>{
  let trip=shortlisted();assert.throws(()=>makeJournalFromPlan(trip,'나'));
  trip=selectTripCandidate(trip,trip.businessCandidates[0].id,'f1');const ready=confirmTripCandidates(trip);const journal=makeJournalFromPlan(ready,'나');
  assert.equal(journal.purpose,'JOURNAL');assert.equal(journal.sourceTripId,ready.id);assert.equal(journal.businessCandidates,undefined);assert.equal(journal.planStage,undefined);assert(!journal.days.flatMap(d=>d.places).some(p=>p.id==='f2'));
  assert.equal(ready.purpose,'PLAN');assert.notEqual(journal.id,ready.id);
});
test('copying a prepared trip remaps shortlist references and does not prematurely finalize it',()=>{
  const trip=shortlisted(),copy=copyPersonalPlan(trip,'다른 이름');
  assert.equal(copy.planStage,'DRAFT');assert.equal(copy.businessCandidates[0].dayId,copy.days[0].dayId);
  assert.equal(copy.businessCandidates[0].anchorVisitId,copy.days[0].places[0].visitId);
  assert.notEqual(copy.businessCandidates[0].id,trip.businessCandidates[0].id);assert.notEqual(copy.businessCandidates[0].anchorVisitId,trip.businessCandidates[0].anchorVisitId);
  assert.deepEqual(copy.businessCandidates[0].options,trip.businessCandidates[0].options);assert.throws(()=>makeJournalFromPlan(copy,'나'));
});
test('invalid selection/context is rejected before mutating the original',()=>{
  const trip=shortlisted();const snapshot=JSON.stringify(trip);
  assert.throws(()=>selectTripCandidate(trip,trip.businessCandidates[0].id,'missing'));
  assert.throws(()=>addTripCandidate(trip,place('h','STAY'),{...context(trip),nights:3}));
  assert.throws(()=>addTripCandidate({...trip,isMine:false},place('f','FOOD'),context(trip)));assert.equal(JSON.stringify(trip),snapshot);
});
test('shortlist and review choice survive validated local reload; public/journal payloads are rejected',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i],get length(){return map.size;}};
  const repo=createLocalRepository(storage);let trip=shortlisted();trip=selectTripCandidate(trip,trip.businessCandidates[0].id,'f2');
  assert.equal(repo.setItem('spotlog.web.journeys.v4',JSON.stringify([trip])),true);
  const read=JSON.parse(createLocalRepository(storage).getItem('spotlog.web.journeys.v4'))[0];assert.equal(candidateSelection(read,read.businessCandidates[0]),'f2');assert.equal(read.days[0].places.length,1);
  assert.equal(repo.setItem('spotlog.web.journeys.v4',JSON.stringify([{...trip,visibility:'PUBLIC'}])),false);
  assert.equal(repo.setItem('spotlog.web.journeys.v4',JSON.stringify([{...trip,purpose:'JOURNAL'}])),false);
  assert.equal(repo.setItem('spotlog.web.journeys.v4',JSON.stringify([{...trip,businessCandidates:[{...trip.businessCandidates[0],options:[{place:{id:'bad'},fixed:false}]}]}])),false);
});
