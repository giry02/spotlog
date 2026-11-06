import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogVersion, defaultPlannerConditions, generatePlannerSample, validatePlannerResult } from '../src/aiPlanner.ts';
import { createPlanFromCreationDraft, isPlanCreationDraft, restorePlanCreationDraft } from '../src/planCreationDraft.ts';
import { createLocalRepository } from '../src/localRepository.ts';
import { interpretTravelPrompt } from '../src/aiTravelDraft.ts';
import { upsertPlannerBusiness, applyPlannerSelections } from '../src/aiPlannerSelections.ts';
import { isAiPlannerDraft } from '../src/aiPlannerDraft.ts';

const p=(id,kind)=>({id,kind,name:id,area:'부산 수영',address:'등록된 확인용 주소',lat:35.15,lng:129.11,image:'',description:'등록 설명',note:'외부 메모',duration:''});
const request=(savedPlaces,conditions={},catalog=savedPlaces)=>({requestId:'standalone',sourceVersion:catalogVersion(catalog),language:'ko',selectedPlaceIds:savedPlaces.map(place=>place.id),dayIds:[],lockedVisitIds:[],conditions:{...defaultPlannerConditions(),mode:'saved',region:'부산',dayCount:1,...conditions},catalog,savedPlaces,author:'나'});
const checked=req=>validatePlannerResult(req,generatePlannerSample(req));

test('saved food and café generate independent visits without any landmark or duplicate café',()=>{
  const saved=[p('식당','FOOD'),p('카페','CAFE')],before=structuredClone(saved),req=request(saved);
  const result=checked(req),visits=result.data.journey.days[0].places;
  assert.deepEqual(visits.map(place=>place.id),['식당','카페']);
  assert.deepEqual(visits.map(place=>place.planningSlot),['lunch','afternoon']);
  assert.ok(visits.every(place=>!place.anchorVisitId));
  assert.equal(result.data.journey.days[0].planningGaps.find(gap=>gap.slot==='dinner').kind,'FOOD');
  assert.deepEqual(saved,before);
});

test('all saved food/café choices are retained even when several occupy the same broad time slot',()=>{
  const saved=[p('식당1','FOOD'),p('식당2','FOOD'),p('식당3','FOOD'),p('카페1','CAFE'),p('카페2','CAFE')];
  const visits=checked(request(saved)).data.journey.days[0].places;
  assert.equal(visits.length,5);assert.equal(new Set(visits.map(place=>place.visitId)).size,5);
  assert.ok(saved.every(place=>visits.some(visit=>visit.id===place.id&&!visit.anchorVisitId)));
});

test('public café-only requests use real café catalog seeds while existing default still selects landmarks',()=>{
  const catalog=[p('관광지','LANDMARK'),p('카페1','CAFE'),p('카페2','CAFE'),p('식당','FOOD')];
  const result=checked(request([], {mode:'region',prompt:'부산 카페만'},catalog));
  assert.deepEqual(result.data.journey.days[0].places.map(place=>place.kind),['CAFE','CAFE']);
  assert.ok(checked(request([], {mode:'region'},catalog)).data.journey.days[0].places.some(place=>place.id==='관광지'));
});

test('LEISURE is understood, generated and persisted without converting into a landmark',()=>{
  const leisure=p('등록 레저 장소','LEISURE'),result=checked(request([leisure],{prompt:'부산 레저만'}));
  assert.deepEqual(result.data.journey.days[0].places.map(place=>place.kind),['LEISURE']);
  const conditions=interpretTravelPrompt({prompt:'부산 레저 체험'},[leisure]).conditions;
  assert.ok(conditions.interests.includes('레저'));
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  assert.equal(createLocalRepository(storage).setItem('spotlog.web.journeys.v4',JSON.stringify([result.data.journey])),true);
  assert.equal(JSON.parse(createLocalRepository(storage).getItem('spotlog.web.journeys.v4'))[0].days[0].places[0].kind,'LEISURE');
});

test('explicit exclusions and tampered saved-seed anchors are rejected instead of dropping selected places',()=>{
  const saved=[p('식당','FOOD'),p('카페','CAFE')];
  assert.throws(()=>generatePlannerSample(request(saved,{prompt:'카페 제외'})),/겹쳐/);
  const req=request(saved),result=checked(req),bad=structuredClone(result);
  bad.data.journey.days[0].places.find(place=>place.kind==='CAFE').anchorVisitId=bad.data.journey.days[0].places[0].visitId;
  assert.throws(()=>validatePlannerResult(req,bad));
});

test('hotel-only manual creation requires explicit nights and keeps accommodation identity independent',()=>{
  const hotel={...p('호텔','STAY'),bookingFixed:true,anchorVisitId:'borrowed',time:'old'},before=structuredClone(hotel);
  const draft={region:'부산',selectedIds:['호텔'],dayCount:3,title:'숙소부터 시작',startDate:'2026-11-03',stayAssignments:[{placeId:'호텔',startDay:1,nights:2}]};
  assert.equal(isPlanCreationDraft(draft),true);assert.deepEqual(restorePlanCreationDraft(draft,[hotel]),draft);
  const plan=createPlanFromCreationDraft(draft,[hotel],'나');
  assert.deepEqual(plan.days.map(day=>day.places.length),[1,1,0]);
  assert.ok(plan.days.slice(0,2).every(day=>day.places[0].kind==='STAY'&&day.places[0].planningSlot==='stay'&&!day.places[0].anchorVisitId&&!day.places[0].bookingFixed&&day.places[0].stayDayIds[0]===day.dayId));
  assert.notEqual(plan.days[0].places[0].visitId,plan.days[1].places[0].visitId);
  assert.equal(plan.days[0].date,'2026-11-03');assert.deepEqual(hotel,before);
  assert.throws(()=>createPlanFromCreationDraft({...draft,stayAssignments:undefined},[hotel],'나'),/숙박 시작 DAY/);
  assert.throws(()=>generatePlannerSample(request([hotel],{dayCount:3})),/숙박일/);
});

test('two hotels cannot silently replace each other on the same manually selected night',()=>{
  const hotels=[p('호텔1','STAY'),p('호텔2','STAY')];
  const draft={region:'부산',selectedIds:hotels.map(place=>place.id),dayCount:3,title:'숙박',startDate:'',stayAssignments:hotels.map(place=>({placeId:place.id,startDay:1,nights:1}))};
  assert.throws(()=>createPlanFromCreationDraft(draft,hotels,'나'),/겹쳐/);
  assert.throws(()=>createPlanFromCreationDraft({...draft,selectedIds:['호텔1'],dayCount:1},hotels,'나'),/숙박 시작 DAY/);
});

test('standalone base can receive a missing meal without removing itself and the saved preview remains recoverable',()=>{
  const cafe=p('카페','CAFE'),food=p('저녁 식당','FOOD'),req=request([cafe],{},[cafe]),result=checked(req),journey=result.data.journey,anchor=journey.days[0].places[0];
  const choices=upsertPlannerBusiness([],journey,{dayId:journey.days[0].dayId,anchorId:anchor.visitId,place:{...food,planningSlot:'dinner'},nights:1});
  const amended=applyPlannerSelections(journey,[],choices);
  assert.equal(amended.days[0].places[0].visitId,anchor.visitId);
  assert.equal(amended.days[0].places[1].anchorVisitId,anchor.visitId);
  assert.equal(isAiPlannerDraft({conditions:req.conditions,preview:result,selectedDay:1,excludedVisits:[],businesses:choices}),true);
  assert.throws(()=>upsertPlannerBusiness([],journey,{dayId:journey.days[0].dayId,anchorId:anchor.visitId,place:{...p('새 카페','CAFE'),planningSlot:'afternoon'},nights:1}),/직접 담은 방문/);
});
