import test from 'node:test';
import assert from 'node:assert/strict';
import {readQuickPlannerPrompt,normalizeQuickPlannerConditions,dayBusinessSuggestions} from '../src/aiPlannerQuickStart.ts';
import {catalogVersion,defaultPlannerConditions,generatePlannerSample,validatePlannerConditions,validatePlannerResult} from '../src/aiPlanner.ts';
const place=(id,patch={})=>({id,name:id,kind:'LANDMARK',area:'제주 한림',lat:33.4,lng:126.25,address:'제주',description:'',image:'',note:'',duration:'',...patch});
const catalog=[place('a'),place('b',{area:'부산 해운대'}),place('c',{area:'강원 강릉'})];
test('simplified creation clears removed draft fields while keeping visible manual choices and recommendation mode',()=>{
 for(const mode of ['region','saved']) {
  const old={...defaultPlannerConditions(),mode,prompt:'제주 1박 2일 천천히 도보 여행',region:'부산',dayCount:4,pace:'full',transport:'car',startDate:'2026-02-30',arrival:'23:00',departure:'01:00',walking:'less',companions:'가족',meals:'식당 빼고',accessibility:'계단 제외',requiredIds:['a'],excludedIds:['a'],fixedIds:['a']};
  const snapshot=structuredClone(old),c=normalizeQuickPlannerConditions(old);
  for(const key of ['mode','prompt','region','dayCount','pace','transport']) assert.equal(c[key],old[key]);
  for(const key of ['startDate','arrival','departure','companions','meals','accessibility']) assert.equal(c[key],'');
  for(const key of ['requiredIds','excludedIds','fixedIds']) assert.deepEqual(c[key],[]);
  assert.equal(c.walking,'normal');assert.equal(c.suggestFood,true);assert.equal(c.suggestStay,true);
  assert.deepEqual(old,snapshot);
 }
});
test('fresh prose keeps less-walking and exclusion intent without reviving removed meal inputs',()=>{
 const old={...defaultPlannerConditions(),region:'제주',dayCount:2,meals:'식당 빼고',walking:'less'};
 const c=readQuickPlannerPrompt('제주 2박 3일 덜 걷고 맛집 포함',normalizeQuickPlannerConditions(old),catalog);
 assert.equal(c.pace,'slow');assert.equal(c.suggestFood,true);assert.equal(c.meals,'');
 const sights=normalizeQuickPlannerConditions({...c,prompt:'관광지만'});
 assert.equal(sights.suggestFood,false);assert.equal(sights.suggestStay,false);
 const booked=normalizeQuickPlannerConditions({...c,prompt:'숙소 이미 예약, 맛집 포함'});
 assert.equal(booked.suggestStay,false);assert.equal(booked.suggestFood,true);
});
test('regeneration ignores hidden dates and locks while preserving a known booked hotel',()=>{
 const landmark=place('해변'),hotel=place('예약호텔',{kind:'STAY',bookingFixed:true,note:'예약 메모'}),places=[landmark,hotel];
 const conditions=normalizeQuickPlannerConditions({...defaultPlannerConditions(),mode:'saved',region:'제주',prompt:'숙소 이미 예약',startDate:'2026-02-30',arrival:'22:00',departure:'06:00',requiredIds:['removed-place'],excludedIds:[landmark.id],fixedIds:['removed-place'],meals:'식당 빼고'});
 const request={requestId:'simplified',sourceVersion:catalogVersion(places),language:'ko',selectedPlaceIds:[landmark.id],dayIds:[],lockedVisitIds:[],conditions,catalog:places,savedPlaces:places,author:'나'};
 const result=validatePlannerResult(request,generatePlannerSample(request)),journey=result.data.journey;
 assert.equal(journey.startDate,undefined);assert.deepEqual(journey.days.map(day=>day.date),['DAY 1','DAY 2']);
 assert.ok(journey.days.flatMap(day=>day.places).some(p=>p.id===landmark.id));
 const booked=journey.days.flatMap(day=>day.places).find(p=>p.id===hotel.id);
 assert.equal(booked.bookingFixed,true);assert.equal(booked.note,'예약 메모');
 assert.ok(journey.days.some(day=>day.planningGaps.some(gap=>gap.kind==='FOOD')));
});
test('a single Korean request supplies region, length and pace without opening settings',()=>{
 const c=readQuickPlannerPrompt('제주 2박 3일 바다를 보며 천천히',defaultPlannerConditions(),catalog);
 assert.equal(c.region,'제주');assert.equal(c.dayCount,3);assert.equal(c.pace,'slow');assert.deepEqual(validatePlannerConditions(c,catalog),[]);
});
test('English duration and destination are parsed, including day trips',()=>{
 assert.equal(readQuickPlannerPrompt('Jeju 2 nights and 3 days',defaultPlannerConditions(),catalog).dayCount,3);
 assert.equal(readQuickPlannerPrompt('Busan day trip',defaultPlannerConditions(),catalog).dayCount,1);
 assert.equal(readQuickPlannerPrompt('Busan 3 nights',defaultPlannerConditions(),catalog).dayCount,4);
});
test('calendar date does not accidentally replace the selected trip length',()=>{
 for(const text of ['제주 9월 20일 출발','제주 2026-09-20 출발']) assert.equal(readQuickPlannerPrompt(text,{...defaultPlannerConditions(),dayCount:4},catalog).dayCount,4);
});
test('manual settings survive prose without another explicit destination or length',()=>{
 const c=readQuickPlannerPrompt('바다를 보고 싶어요',{...defaultPlannerConditions(),region:'제주',dayCount:5,requiredIds:['a']},catalog);
 assert.equal(c.region,'제주');assert.equal(c.dayCount,5);assert.deepEqual(c.requiredIds,['a']);
});
test('ambiguous destinations ask for clarification; new region clears incompatible locks but saved mode keeps them',()=>{
 assert.equal(readQuickPlannerPrompt('제주 부산 2박3일',{...defaultPlannerConditions(),region:'제주'},catalog).region,'');
 assert.deepEqual(readQuickPlannerPrompt('부산',{...defaultPlannerConditions(),region:'제주',requiredIds:['a']},catalog).requiredIds,[]);
 assert.deepEqual(readQuickPlannerPrompt('부산',{...defaultPlannerConditions(),mode:'saved',region:'제주',requiredIds:['a']},catalog).requiredIds,['a']);
});
test('out of range requests remain invalid instead of silently shortening a trip',()=>{
 const c=readQuickPlannerPrompt('제주 8박9일',defaultPlannerConditions(),catalog);
 assert.equal(c.dayCount,9);assert.ok(validatePlannerConditions(c,catalog).length);
});
test('food near a later landmark appears even when nothing is near the first; duplicates have one nearest anchor',()=>{
 const far=place('far',{lng:127.8}),near=place('near',{visitId:'visit-near'}),food=place('food',{kind:'FOOD',lng:126.251});
 const result=dayBusinessSuggestions([far,near],[food,food], 'FOOD');
 assert.equal(result.length,1);assert.equal(result[0].anchor.visitId,'visit-near');assert.ok(result[0].km<1);
 assert.equal(dayBusinessSuggestions([far],[food],'FOOD').length,0);
});
test('unknown coordinates, excluded anchors and distant places never fabricate nearby candidates',()=>{
 const food=place('food',{kind:'FOOD'});
 assert.equal(dayBusinessSuggestions([], [food], 'FOOD').length,0);
 assert.equal(dayBusinessSuggestions([place('unknown',{lat:null,lng:null})], [food], 'FOOD').length,0);
 assert.equal(dayBusinessSuggestions([place('a')], [place('food',{kind:'FOOD',lat:null,lng:null})], 'FOOD').length,0);
});
test('saved and search filters operate on the same nearby scope',()=>{
 const food=place('food',{kind:'FOOD',name:'Test Restaurant'}),stay=place('stay',{kind:'STAY'});
 assert.equal(dayBusinessSuggestions([place('a')],[food,stay],'FOOD',new Set()).length,0);
 assert.equal(dayBusinessSuggestions([place('a')],[food,stay],'FOOD',undefined,'  RESTAURANT ').length,1);
 assert.equal(dayBusinessSuggestions([place('a')],[food,stay],'STAY').length,1);
});
test('editing suggestions respect the anchor region even across a nearby administrative boundary',()=>{
 const anchor=place('서울 기준',{area:'서울 송파',lat:37.48,lng:127.14});
 const same=place('서울 식당',{kind:'FOOD',area:'서울 송파',lat:37.481,lng:127.14});
 const across=place('경기 식당',{kind:'FOOD',area:'경기 성남',lat:37.4801,lng:127.14});
 assert.deepEqual(dayBusinessSuggestions([anchor],[across,same],'FOOD').map(p=>p.place.id),['서울 식당']);
 assert.equal(dayBusinessSuggestions([anchor],[across],'FOOD',new Set([across.id]),'식당').length,0);
});
