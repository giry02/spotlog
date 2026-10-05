import test from 'node:test';
import assert from 'node:assert/strict';
import {readPlannerIntent} from '../src/plannerIntent.ts';
import {catalogVersion,defaultPlannerConditions,generatePlannerSample,validatePlannerResult,revisePlannerSample,applyRevision,journeyVersion} from '../src/aiPlanner.ts';
import {readQuickPlannerPrompt} from '../src/aiPlannerQuickStart.ts';
const p=(id,patch={})=>({id,name:id,kind:'LANDMARK',area:'제주 한림',address:'제주 한림',lat:33.4,lng:126.25,image:'',description:'등록된 설명',note:'',duration:'1시간',...patch});
const landmarks=[p('해변'),p('수목원',{lng:126.26}),p('오름',{lng:126.28}),p('전시관',{lng:126.29})];
const businesses=[p('점심 식당',{kind:'FOOD',lng:126.255}),p('저녁 식당',{kind:'FOOD',lng:126.285}),p('찻집',{kind:'CAFE',lng:126.265}),p('숙소',{kind:'STAY',lng:126.275})];
const catalog=[...landmarks,...businesses];
const req=(conditions={},extra={})=>({requestId:'complete',sourceVersion:catalogVersion(catalog),language:'ko',selectedPlaceIds:[],dayIds:[],lockedVisitIds:[],conditions:{...defaultPlannerConditions(),region:'제주',...conditions},catalog,savedPlaces:landmarks,author:'나',...extra});
const checked=(r)=>validatePlannerResult(r,generatePlannerSample(r));

test('request rules distinguish defaults, explicit inclusions, exclusions and booked accommodation',()=>{
 const usual=readPlannerIntent('제주 2박 3일',3);assert.equal(usual.food,'include');assert.equal(usual.cafe,'exclude');assert.equal(usual.stay,'include');
 for(const text of ['관광지만','랜드마크만 보고 싶어요','only sightseeing']) {const i=readPlannerIntent(text,3);assert.equal(i.food,'exclude');assert.equal(i.cafe,'exclude');assert.equal(i.stay,'exclude');}
 const food=readPlannerIntent('맛집 포함하고 카페는 빼고 숙소는 예약 완료',3);assert.equal(food.food,'include');assert.equal(food.cafe,'exclude');assert.equal(food.stay,'booked');
 for(const text of ['식사는 알아서 할게','밥은 따로','맛집 빼고','no restaurants'])assert.equal(readPlannerIntent(text,2).food,'exclude');
 assert.equal(readPlannerIntent('숙소 예약 안했어',2).stay,'include');assert.equal(readPlannerIntent('hotel already booked, without coffee',2).stay,'booked');
 assert.equal(readPlannerIntent('카페도 가고 싶어',1).cafe,'include');assert.equal(readPlannerIntent('당일 맛집',1).stay,'exclude');
 const lunchOnly=readPlannerIntent('저녁은 빼고 맛집 포함',2);assert.equal(lunchOnly.lunch,true);assert.equal(lunchOnly.dinner,false);
 const joined=readPlannerIntent('카페랑 숙소는 빼고 맛집 포함',2);assert.equal(joined.cafe,'exclude');assert.equal(joined.stay,'exclude');assert.equal(joined.food,'include');
 assert.equal(readPlannerIntent('식당은 넣지마',2).food,'exclude');assert.equal(readPlannerIntent('식당은 빼지 마',2).food,'include');assert.equal(readPlannerIntent('카페는 제외하지 마',2).cafe,'include');
});
test('quick input updates business preferences from its latest request rather than stale switches',()=>{
 let c=readQuickPlannerPrompt('제주 2박3일 맛집과 카페',defaultPlannerConditions(),catalog);assert.equal(c.suggestFood,true);assert.equal(c.suggestStay,true);
 c=readQuickPlannerPrompt('제주 관광지만',c,catalog);assert.equal(c.suggestFood,false);assert.equal(c.suggestStay,false);
});
test('common Korean reservation and exclusion phrases do not add unwanted businesses',()=>{
 for(const text of ['숙소 이미 예약','숙소 이미 예약.','제주 1박 2일, 맛집도 넣어줘. 숙소 이미 예약.','숙소는 이미 예약, 맛집 포함','호텔 이미 예약했어','숙소 예약은 했어'])assert.equal(readPlannerIntent(text,2).stay,'booked',text);
 for(const text of ['숙소 예약은 안 했어','숙소 예약 아직 안 했어','숙소 이미 예약 취소했어','숙소는 예약할 예정'])assert.equal(readPlannerIntent(text,2).stay,'include',text);
 assert.equal(readPlannerIntent('식당 넣지 마',2).food,'exclude');assert.equal(readPlannerIntent('카페 추천하지 마',2).cafe,'exclude');assert.equal(readPlannerIntent('숙소 추천 안 해도 돼',2).stay,'exclude');
 const result=checked(req({prompt:'숙소 이미 예약, 식당 넣지 마, 카페 추천하지 마'}));assert.ok(result.data.journey.days.flatMap(d=>d.places).every(p=>p.kind==='LANDMARK'));assert.deepEqual(result.data.journey.days[0].planningGaps.map(g=>[g.kind,g.reason]),[['STAY','booked']]);
});
test('a complete draft places meals between visits and lodging after sightseeing, without asserted times',()=>{
 const result=checked(req({dayCount:1,prompt:'맛집과 카페 포함'}));const day=result.data.journey.days[0];
 assert.deepEqual(day.places.map(p=>p.planningSlot),['morning','morning','lunch','afternoon','afternoon','dinner']);
 const lunch=day.places.find(p=>p.kind==='FOOD'&&p.planningSlot==='lunch'),dinner=day.places.find(p=>p.kind==='FOOD'&&p.planningSlot==='dinner');
 assert.ok(lunch&&dinner);assert.notEqual(lunch.id,dinner.id);assert.equal(day.places.find(p=>p.visitId===lunch.anchorVisitId).kind,'LANDMARK');
 assert.ok(day.places.every(p=>p.time===undefined&&p.move===undefined));assert.equal(result.mock,true);assert.equal(result.sources[0].checkedAt,null);
});
test('exclusions produce sightseeing only, with no hidden business or empty required selection step',()=>{
 const day=checked(req({prompt:'관광지만',dayCount:1})).data.journey.days[0];assert.ok(day.places.every(p=>p.kind==='LANDMARK'));assert.deepEqual(day.planningGaps,[]);
 const result=checked(req({prompt:'식사는 알아서, 카페 빼고, 숙소 제외'}));assert.ok(result.data.journey.days.every(d=>d.places.every(p=>p.kind==='LANDMARK')&&!d.planningGaps.length));
});
test('missing nearby data creates contextual gaps rather than fabricated places or coordinates',()=>{
 const result=checked(req({dayCount:2},{catalog:landmarks}));const day=result.data.journey.days[0];
 assert.ok(day.places.every(p=>p.kind==='LANDMARK'));assert.deepEqual(day.planningGaps.map(g=>g.slot),['lunch','dinner','stay']);
 assert.equal(day.planningGaps[0].afterVisitId,day.places[0].visitId);assert.equal(day.planningGaps[0].beforeVisitId,day.places[1].visitId);
 assert.ok(result.warnings.some(w=>w.includes('업체 미정')));
});
test('a known booked hotel is preserved and locked; unidentified booking stays a gap',()=>{
 const booked=p('예약호텔',{kind:'STAY',bookingFixed:true,note:'사용자 예약 메모'});
 const result=checked(req({prompt:'숙소 예약 완료'},{savedPlaces:[...landmarks,booked],catalog:[...catalog,booked]}));
 assert.deepEqual(result.data.journey.days.flatMap(d=>d.places).filter(p=>p.kind==='STAY').map(p=>p.id),['예약호텔']);assert.equal(result.data.journey.days[0].places.at(-1).bookingFixed,true);assert.equal(result.data.journey.days[0].places.at(-1).note,'사용자 예약 메모');
 const unknown=checked(req({prompt:'숙소 예약 완료'})).data.journey;assert.ok(unknown.days.flatMap(d=>d.places).every(p=>p.kind!=='STAY'));assert.ok(unknown.days[0].planningGaps.some(g=>g.kind==='STAY'&&g.reason==='booked'));
});
test('a fixed accommodation requested by ID survives as a booking',()=>{
 const result=checked(req({fixedIds:['숙소']}));assert.equal(result.data.journey.days[0].places.find(p=>p.id==='숙소').bookingFixed,true);
});
test('saved Jeju, Gangneung and Seoul cannot silently enter a single DAY',()=>{
 const saved=[landmarks[0],p('안목해변',{area:'강원 강릉',lat:37.77,lng:128.94}),p('서울숲',{area:'서울 성동',lat:37.54,lng:127.04})];
 for(const region of ['', '전체'])assert.throws(()=>generatePlannerSample(req({mode:'saved',region,dayCount:1},{savedPlaces:saved})),/여행할 지역/);
 const result=checked(req({mode:'saved',region:'제주',dayCount:1},{savedPlaces:saved}));assert.ok(result.data.journey.days[0].places.every(p=>p.area.startsWith('제주')));assert.deepEqual(result.unplaced.map(p=>p.placeId),['안목해변','서울숲']);
});
test('nearest grouping keeps an interleaved catalog in nearby DAY groups',()=>{
 const items=[p('west1',{lng:126.1}),p('east1',{lng:126.9}),p('west2',{lng:126.11}),p('east2',{lng:126.91})];
 const result=checked(req({mode:'saved',prompt:'관광지만'},{savedPlaces:items,catalog:items}));assert.deepEqual(result.data.journey.days.map(d=>d.places.map(p=>p.id)),[['west1','west2'],['east1','east2']]);
});
test('arrival and departure bound meal slots without fabricating a route or opening hours',()=>{
 const result=checked(req({arrival:'16:00',departure:'10:00'}));assert.ok(result.data.journey.days[0].places.every(p=>p.planningSlot!=='morning'&&p.planningSlot!=='lunch'));assert.ok(result.data.journey.days[1].places.every(p=>p.planningSlot==='morning'));assert.deepEqual(result.data.journey.days[1].planningGaps,[]);
});
test('response validation rejects invented business facts, another region, invalid slots and dangling anchors',()=>{
 const request=req(),result=checked(request);
 for(const mutate of [r=>{r.data.journey.days[0].places.find(p=>p.kind==='FOOD').name='만든 업체';},r=>{r.data.journey.days[0].places.find(p=>p.kind==='FOOD').area='서울';},r=>{r.data.journey.days[0].places.find(p=>p.kind==='FOOD').planningSlot='morning';},r=>{r.data.journey.days[0].places.find(p=>p.kind==='FOOD').time='12:00';},r=>{r.data.journey.days[0].places.find(p=>p.kind==='FOOD').anchorVisitId='other-day';},r=>{r.data.intent.food='exclude';}]){const bad=structuredClone(result);mutate(bad);assert.throws(()=>validatePlannerResult(request,bad));}
});
test('a planned restaurant cannot be smuggled into an explicitly excluded result',()=>{
 const request=req({prompt:'식당 제외'}),result=checked(request),bad=structuredClone(result),day=bad.data.journey.days[0];const food={...businesses[0],visitId:'extra',anchorVisitId:day.places[0].visitId,planningSlot:'lunch'};day.places.push(food);day.blocks.push({id:'extra-block',type:'PLACE',placeId:food.id,visitId:food.visitId});assert.throws(()=>validatePlannerResult(request,bad));
});
test('afternoon revision uses planned slots and repairs missing-meal references while keeping morning',()=>{
 const original=checked(req({dayCount:1,pace:'full'},{catalog:landmarks})).data.journey;
 const afternoon=original.days[0].places.find(p=>p.planningSlot==='afternoon');
 const request={requestId:'revision-slots',sourceVersion:journeyVersion(original),language:'ko',selectedPlaceIds:[],dayIds:[],lockedVisitIds:[],journey:original,dayId:original.days[0].dayId,scope:'afternoon',lessWalking:false,excludedVisitIds:[afternoon.visitId]};
 const revised=applyRevision(original,revisePlannerSample(request),request);assert.ok(revised.days[0].places.every(p=>p.visitId!==afternoon.visitId));assert.equal(revised.days[0].places[0].visitId,original.days[0].places[0].visitId);
 assert.ok(revised.days[0].planningGaps.every(g=>g.beforeVisitId!==afternoon.visitId&&g.afterVisitId!==afternoon.visitId));
});
test('unknown coordinates and distant or personal catalog businesses remain unfilled',()=>{
 const far=p('far',{kind:'FOOD',lat:37}),personal=p('private',{kind:'FOOD',personal:true}),unknown=p('unknown',{kind:'STAY',lat:null,lng:null});
 const result=checked(req({}, {catalog:[...landmarks,far,personal,unknown]}));assert.ok(result.data.journey.days.flatMap(d=>d.places).every(p=>p.kind==='LANDMARK'));assert.ok(result.data.journey.days[0].planningGaps.some(g=>g.kind==='STAY'));
});
