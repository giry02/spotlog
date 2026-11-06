import test from 'node:test';
import assert from 'node:assert/strict';
import { appendPlanPlace, buildPersonalPlan, addPlanDay, setPlanStay, transferVisit, reorderPlanVisit } from '../src/tripPlan.ts';
import { addTripCandidate, confirmTripCandidates, candidateSelection } from '../src/tripCandidates.ts';
import { plannerTimeline, plannerVisitContext } from '../src/plannerTimeline.ts';
import { createLocalRepository } from '../src/localRepository.ts';

const spot=(id,kind='FOOD')=>({id,kind,name:id,area:'부산 수영',address:'확인용 주소',lat:35.15,lng:129.11,image:'',description:'등록 소개',note:'외부 자료 메모',duration:''});
const setup=()=>({...buildPersonalPlan([],2,'부산 먹고 쉬는 여행','나'),planStage:'DRAFT'});

test('an empty DAY accepts food then cafe independently and preserves each explicit visit order',()=>{
  let plan=setup();const before=structuredClone(plan);
  plan=appendPlanPlace(plan,plan.days[0].dayId,spot('meal'),'lunch');
  plan=appendPlanPlace(plan,plan.days[0].dayId,spot('coffee','CAFE'),'afternoon');
  assert.equal(plan.planStage,'READY');assert.deepEqual(plan.days[0].places.map(place=>place.id),['meal','coffee']);
  assert.ok(plan.days[0].places.every(place=>!place.anchorVisitId));assert.deepEqual(before.days[0].places,[]);
  const rows=plannerTimeline(plan.days[0]);assert.equal(plannerVisitContext(plan.days[0],rows[0]),'coffee 방문 전');assert.equal(plannerVisitContext(plan.days[0],rows[1]),'meal 방문 후');
});

test('the same restaurant can be visited for lunch and dinner, with duplicate selections idempotent',()=>{
  let plan=setup();const dayId=plan.days[0].dayId;
  plan=appendPlanPlace(plan,dayId,spot('meal'),'lunch');assert.equal(appendPlanPlace(plan,dayId,spot('meal'),'lunch'),plan);
  plan=appendPlanPlace(plan,dayId,spot('meal'),'dinner');
  assert.equal(plan.days[0].places.length,2);assert.notEqual(plan.days[0].places[0].visitId,plan.days[0].places[1].visitId);
  assert.deepEqual(plan.days[0].places.map(place=>place.planningSlot),['lunch','dinner']);
});

test('standalone additions clean borrowed visit/reservation identifiers and keep existing locked stays last',()=>{
  let plan=setup();plan=setPlanStay(plan,spot('hotel','STAY'),plan.days[0].dayId,1,true);
  const locked=structuredClone(plan.days[0].places[0]);
  const source={...spot('meal'),visitId:'borrowed',anchorVisitId:'unrelated',bookingFixed:true,stayDayIds:['wrong'],time:'12:00',move:'old route'};
  const before=structuredClone(source);plan=appendPlanPlace(plan,plan.days[0].dayId,source,'lunch');
  const inserted=plan.days[0].places[0];assert.equal(inserted.note,'');
  for(const field of ['anchorVisitId','bookingFixed','stayDayIds','time','move'])assert.equal(inserted[field],undefined);
  assert.deepEqual(plan.days[0].places.at(-1),locked);assert.deepEqual(source,before);
});

test('food-only visits can anchor cafe alternatives, and their candidates follow DAY transfers',()=>{
  let plan=setup();plan=appendPlanPlace(plan,plan.days[0].dayId,spot('meal'),'lunch');const anchor=plan.days[0].places[0];
  plan=addTripCandidate(plan,spot('coffee','CAFE'),{dayId:plan.days[0].dayId,anchorVisitId:anchor.visitId,slot:'afternoon'});
  assert.equal(plan.businessCandidates.length,1);assert.equal(candidateSelection(plan,plan.businessCandidates[0]),'coffee');
  plan=transferVisit(plan,plan.days[0].dayId,anchor.visitId,plan.days[1].dayId,false);
  plan=confirmTripCandidates(plan);assert.deepEqual(plan.days[1].places.map(place=>place.id),['meal','coffee']);
  assert.equal(plan.days[1].places[1].anchorVisitId,plan.days[1].places[0].visitId);
});

test('public records, removed DAY, a wrong meal slot and standalone accommodation are refused unchanged',()=>{
  const plan=setup(),before=structuredClone(plan);
  for(const [target,dayId,place,slot] of [[{...plan,visibility:'PUBLIC'},plan.days[0].dayId,spot('meal'),'lunch'],[plan,'missing',spot('meal'),'lunch'],[plan,plan.days[0].dayId,spot('meal'),'afternoon'],[plan,plan.days[0].dayId,spot('hotel','STAY'),undefined]])assert.throws(()=>appendPlanPlace(target,dayId,place,slot));
  assert.deepEqual(plan,before);
});

test('independent visits and meal slots survive storage and reorder without changing another DAY',()=>{
  let plan=setup();const dayId=plan.days[0].dayId;
  plan=appendPlanPlace(plan,dayId,spot('meal'),'lunch');plan=appendPlanPlace(plan,dayId,spot('coffee','CAFE'),'afternoon');
  const other=structuredClone(plan.days[1]);plan=reorderPlanVisit(plan,dayId,plan.days[0].places[1].visitId,-1);
  assert.deepEqual(plan.days[0].places.map(place=>place.id),['coffee','meal']);assert.deepEqual(plan.days[1],other);
  const entries=new Map(),storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)},repository=createLocalRepository(storage);
  assert.equal(repository.setItem('spotlog.web.journeys.v4',JSON.stringify([plan])),true);
  assert.deepEqual(JSON.parse(createLocalRepository(storage).getItem('spotlog.web.journeys.v4')), [plan]);
});
