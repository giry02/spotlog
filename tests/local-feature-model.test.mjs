import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(context.parentURL?.includes('/lib/')&&specifier.startsWith('./')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);}});
const {createTripSession,appendTrip,currentTrip}=await import('../lib/trip-engine.ts');
const {places}=await import('../lib/trip-data.ts');
const {buildModelInput,usesItineraryPlanner,usesKnownTripEditor}=await import('../lib/model-input.ts');
const {modelContext}=await import('../lib/model-context.ts');
const {needsTravelRetrieval}=await import('../lib/chat-resources.ts');
const {localFeatureTask}=await import('../lib/local-feature-intent.ts');
function ready(){let s=createTripSession();s=appendTrip(s,{type:'region',region:'부산'});s=appendTrip(s,{type:'configure',days:2,meals:false,cafes:false,lodging:false});for(const p of places.filter(p=>p.region==='부산').slice(0,2))s=appendTrip(s,{type:'collect-entity',id:p.id});s=appendTrip(s,{type:'build'});s=appendTrip(s,{type:'save'});s=appendTrip(s,{type:'plan-status',status:'READY'});return appendTrip(s,{type:'offline-save'});}
const request=(text,session=createTripSession())=>({protocolVersion:1,requestId:'medium-input',sessionId:'medium-input',baseRevision:session.turns.at(-1).id,session,action:{type:'message',text}});
test('local feature queries get real-model tool context without unrelated tourism RAG or planner',()=>{
 for(const [text,feature] of [['공개 코스에서 부산 AI 추천 당일 코스 보여줘','community'],['제주 관광지 사진 피드 보여줘','media'],['작성 완료한 여행 오프라인 저장해줘','local-trip'],['여행기 미리보기로 열어줘, 게시하지 마','app']]){
  const r=request(text);assert.equal(localFeatureTask(r),feature);assert.equal(needsTravelRetrieval(r),false);assert.equal(usesItineraryPlanner(r),false);
  const input=buildModelInput(r);assert.equal(input.question.context.task,'local-feature-navigator');assert.equal(input.question.userMessage,text);assert.ok(input.messages[0].content.includes('actions'));assert.equal(input.question.context.catalog,undefined);
  assert.equal('publicCourses' in input.question.context,feature==='community');assert.equal('media' in input.question.context,feature==='media');assert.equal('offlineTrips' in input.question.context,feature==='local-trip');assert.equal('savedTrips' in input.question.context,feature==='local-trip');
  if(feature==='app')assert.deepEqual(input.question.context.allowedToolTypes,['open_spotlog']);
  assert.ok(!input.question.context.allowedToolTypes.includes('build'));
 }
});
test('new tourism generation and current weather still use their existing fact-check paths',()=>{
 for(const text of ['부산 1박2일 바다와 숲 일정 새로 만들어줘','제주 사진 장소의 현재 영업시간과 날씨 알려줘']){const r=request(text);assert.equal(localFeatureTask(r),null);assert.equal(needsTravelRetrieval(r),true);}
});

test('public-source draft copy intent precedes draft status without stealing normal title, DAY or status edits',()=>{
 let session=appendTrip(ready(),{type:'community-filter',region:'제주',days:2});
 const text='서쪽 바다와 차밭 1박 2일 코스를 내 여행으로 가져와. 공개 원본은 그대로 두고 내 여행 초안으로 복사해줘.';
 const input=request(text,session);
 assert.equal(localFeatureTask(input),'community');assert.equal(needsTravelRetrieval(input),false);
 assert.equal(buildModelInput(input).question.userMessage,text);
 assert.equal(buildModelInput(input).question.context.requestedFeature,'community');
 for(const message of ['서쪽 바다와 차밭 1박 2일 여행의 출발일을 2026-11-03으로 바꿔줘.','DAY 1을 마지막에 새 DAY로 복사해줘.'])assert.equal(localFeatureTask(request(message,session)),null);
 assert.equal(localFeatureTask(request('이 여행을 초안으로 되돌려줘.',session)),'local-trip');
});
test('copying only a public-course title keeps the current trip metadata editor',()=>{
 const session=appendTrip(ready(),{type:'community-filter',region:'제주',days:2});
 for(const text of [
  '서쪽 바다와 차밭 1박 2일 코스의 제목만 내 여행 이름에 복사해줘.',
  '공개 코스 서쪽 바다와 차밭 1박 2일의 제목만 내 여행 이름에 복사해줘.',
  '내 여행 제목에 서쪽 바다와 차밭 1박 2일 코스의 이름만 복사해줘.',
 ]){
  const input=request(text,session);
  assert.equal(localFeatureTask(input),null,text);assert.equal(usesKnownTripEditor(input),true,text);
  const built=buildModelInput(input);
  assert.equal(built.question.context.task,'known-trip-editor');
  assert.ok(built.question.context.allowedToolTypes.includes('trip-meta'));
  assert.ok(!built.question.context.allowedToolTypes.includes('copy-community'));
  assert.equal(built.question.userMessage,text);
 }
 for(const text of ['서쪽 바다와 차밭 1박 2일 코스의 제목만 내 여행 이름에 복사하지 마.','서쪽 바다와 차밭 1박 2일 코스의 제목만 내 여행 이름에 복사해 주지 마.']){
  assert.equal(usesKnownTripEditor(request(text,session)),false,text);
 }
});
test('an explicit catalog addition gets only its named ID and DAY without stealing metadata or DAY copies',async()=>{
 const {namedItineraryAdditionScope}=await import('../lib/chat-contract.ts');
 let session=appendTrip(ready(),{type:'community-filter',region:'제주',days:2});
 session=appendTrip(session,{type:'copy-community',id:'community-jeju-west-sea'});
 const text='새별오름을 DAY 2 일정에 추가해줘. 기존 방문과 식당·숙소는 그대로 유지해줘.';
 const input=request(text,session),scope=namedItineraryAdditionScope(input),built=buildModelInput(input);
 assert.equal(scope.candidate.id,'saebyeol');assert.equal(scope.day,2);assert.equal(scope.candidate.eligible,true);
 assert.equal(usesKnownTripEditor(input),false);assert.equal(usesItineraryPlanner(input),false);
 assert.equal(built.question.context.task,'named-itinerary-addition');
 assert.deepEqual(built.question.context.allowedToolTypes,['add-entity']);
 assert.equal(built.question.context.candidate.id,'saebyeol');assert.equal(built.question.context.requestedDay,2);
 assert.equal(built.question.context.catalog,undefined);assert.equal(built.question.context.candidates,undefined);
 assert.equal(built.question.userMessage,text);
 for(const text of ['새별오름을 DAY 3 일정에 추가해줘.','새별오름과 한라산을 DAY 2 일정에 추가해줘.','새별오름을 DAY 2 일정에 추가하지 마.','새별오름을 DAY 1과 DAY 2 일정에 추가해줘.','새별오름 메모에 DAY 2 방문이라고 추가해줘.','DAY 1 전체를 마지막에 새 DAY로 복사해줘.','DAY 1 다음에 빈 DAY를 추가해줘.'])
  assert.equal(namedItineraryAdditionScope(request(text,session)),undefined,text);
 assert.equal(usesKnownTripEditor(request('DAY 1 전체를 마지막에 새 DAY로 복사해줘.',session)),true);
 assert.equal(usesKnownTripEditor(request('여행 이름을 제주 검수로 바꿔줘.',session)),true);
});
test('explicit nearby food browsing names only one landmark already in the current plan',async()=>{
 const {namedNearbyFoodAnchor}=await import('../lib/chat-contract.ts');
 let session=appendTrip(ready(),{type:'community-filter',region:'제주',days:2});
 session=appendTrip(session,{type:'copy-community',id:'community-jeju-west-sea'});
 session=appendTrip(session,{type:'add-entity',id:'saebyeol',day:2});
 const text='새별오름 주변 식당 후보를 보여줘. 지금 만든 일정은 바꾸지 마.';
 const input=request(text,session),built=buildModelInput(input);
 assert.deepEqual(namedNearbyFoodAnchor(input),{id:'saebyeol',name:'새별오름',kind:'식당'});
 assert.deepEqual(built.question.context.nearbyAnchorRequest,{id:'saebyeol',name:'새별오름',kind:'식당'});
 assert.equal(built.question.context.task,'named-nearby-food-browse');
 assert.deepEqual(built.question.context.allowedToolTypes,['place','show']);
 assert.deepEqual(built.question.context.foodCandidates,[{id:'catalog-jeju-bongseong',name:'봉성식당',region:'제주',registered:true,fictional:false,price:null}]);
 for(const key of ['catalog','candidates','retrieval','publicCourses','savedTrips'])assert.equal(built.question.context[key],undefined);
 assert.equal(built.question.recentConversation,undefined);
 assert.equal(built.question.userMessage,text);
 assert.match(built.question.serverExecutionHints,/새별오름\(id:saebyeol\)/);
 assert.match(built.question.serverExecutionHints,/editingId/);
 for(const text of ['새별오름 주변 식당 후보를 보여주지 마.','새별오름 주변 식당을 보는 방법을 설명해줘.','새별오름과 한라산 주변 식당 후보를 보여줘.','한라산 주변 식당 후보를 보여줘.','여기 주변 식당 후보를 보여줘.','새별오름 주변 식당과 카페 후보를 보여줘.'])
  assert.equal(namedNearbyFoodAnchor(request(text,session)),undefined,text);
});
test('the slim nearby input contains exactly the canonical food panel candidates for the current mode and filters',()=>{
 let session=appendTrip(ready(),{type:'community-filter',region:'제주',days:2});
 session=appendTrip(session,{type:'copy-community',id:'community-jeju-west-sea'});
 session=appendTrip(session,{type:'add-entity',id:'saebyeol',day:2});
 session=appendTrip(session,{type:'configure',businessMode:'demo'});
 session=appendTrip(session,{type:'cuisine',value:'한식'});
 const text='새별오름 주변 식당 후보를 보여줘. 지금 만든 일정은 바꾸지 마.';
 const before=structuredClone(session),built=buildModelInput(request(text,session),{retrievalStatus:'available',retrieval:{results:[{text:'부산 타지역 식당 추천',placeId:'public-busan-haeundae'}]}});
 assert.deepEqual(built.question.context.foodCandidates.map(item=>item.id),['catalog-jeju-bongseong','sb-rice','sb-pasta']);
 assert.ok(built.question.context.foodCandidates.every(item=>item.region==='제주'));
 assert.equal(built.question.context.foodCandidates[0].registered,true);assert.equal(built.question.context.foodCandidates[0].fictional,false);assert.equal(built.question.context.foodCandidates[0].price,null);
 assert.ok(built.question.context.foodCandidates.slice(1).every(item=>item.fictional));
 assert.ok(!JSON.stringify(built.question).includes('부산'));
 assert.deepEqual(session,before);
 const limited=appendTrip(appendTrip(session,{type:'configure',foodBudget:15000}),{type:'walk',value:4});
 assert.deepEqual(buildModelInput(request(text,limited)).question.context.foodCandidates.map(item=>item.id),['sb-rice']);
});
test('a named visit removal gets only remove with the exact visit ID and keeps whole-DAY tools separate',async()=>{
 const {namedVisitRemovalScope}=await import('../lib/chat-contract.ts');
 let session=appendTrip(ready(),{type:'community-filter',region:'제주',days:2});
 session=appendTrip(session,{type:'copy-community',id:'community-jeju-west-sea'});
 const text='DAY 1 바다곁 스테이를 일정에서 빼줘. 다른 방문은 그대로 유지해줘.';
 const input=request(text,session),scope=namedVisitRemovalScope(input),built=buildModelInput(input);
 const stay=currentTrip(session).plan.find(visit=>visit.kind==='stay'&&visit.day===1);
 assert.equal(scope.targets.length,1);assert.equal(scope.targets[0].id,stay.id);assert.equal(scope.targets[0].day,1);
 assert.equal(usesKnownTripEditor(input),true);assert.equal(built.question.context.task,'known-trip-editor');
 assert.deepEqual(built.question.context.allowedToolTypes,['remove']);
 assert.match(built.question.serverExecutionHints,/day-delete는 DAY 전체 삭제/);
 for(const text of ['DAY 1 바다곁 스테이를 삭제하지 마.','DAY 1 바다곁 스테이를 제거하는 방법을 설명해줘.','DAY 1 전체를 삭제해줘.','DAY 1 전체를 마지막에 새 DAY로 복사해줘.'])
  assert.equal(namedVisitRemovalScope(request(text,session)),undefined,text);
 const blocked=structuredClone(session);currentTrip(blocked).plan.find(visit=>visit.id===stay.id).locked=true;
 assert.deepEqual(buildModelInput(request(text,blocked)).question.context.allowedToolTypes,[]);
 const missingDay=buildModelInput(request('바다곁 스테이를 일정에서 빼줘.',session));
 assert.deepEqual(missingDay.question.context.allowedToolTypes,[]);
});
test('local offline input binds the current saved ID and exact READY eligibility',()=>{
 const session=ready(),text='현재 여행의 오프라인 사본을 이 기기에 저장해줘.';
 let built=buildModelInput(request(text,session));
 assert.equal(built.question.context.state.savedPlanId,currentTrip(session).savedPlanId);
 assert.equal(built.question.context.currentSavedTrip.id,currentTrip(session).savedPlanId);
 assert.equal(built.question.context.currentSavedTrip.status,'READY');
 assert.equal(built.question.context.currentSavedTrip.matchesCurrent,true);
 assert.equal(built.question.context.currentSavedTrip.offlineSaveAllowed,true);
 assert.equal(built.question.context.currentSavedTrip.offlineSaveIssue,null);
 const draft=appendTrip(session,{type:'plan-status',status:'DRAFT'});
 built=buildModelInput(request(text,draft));
 assert.equal(built.question.context.currentSavedTrip.status,'DRAFT');
 assert.equal(built.question.context.currentSavedTrip.offlineSaveAllowed,false);
 assert.match(built.question.context.currentSavedTrip.offlineSaveIssue,/작성 완료/);
 assert.match(built.messages[0].content,/다른 READY 여행이나 recentTrip의 ID를 대신 고르지 않는다/);
});
test('feature context exposes offline metadata, never cached note bodies or coordinates',()=>{
 const session=ready();assert.equal(session.offlineTrips.length,1);
 session.offlineTrips[0].visits[0].note='PRIVATE_OFFLINE_CACHE_NOTE';currentTrip(session).plan[0].note='CURRENT_PLAN_PRIVATE_NOTE';
 const input=buildModelInput(request('오프라인 사본 목록 보여줘',session));
 const json=JSON.stringify(input.question);assert.ok(!json.includes('PRIVATE_OFFLINE_CACHE_NOTE'));assert.ok(!json.includes('CURRENT_PLAN_PRIVATE_NOTE'));
 assert.ok(!json.includes('latitude'));assert.ok(!json.includes('longitude'));assert.ok(!json.includes('sourceTitle'));
 assert.equal(input.question.context.offlineTrips[0].id,session.offlineTrips[0].id);assert.equal(input.question.context.savedTrips[0].status,'READY');
});
test('public course and photo catalogs are compact metadata, not original stories or media payloads',()=>{
 const context=modelContext(request('공개 코스 보여줘'));
 assert.equal(context.publicCourses.catalog.length,11);assert.equal(context.media.photos,81);
 for(const trip of context.publicCourses.catalog){assert.ok(!('dayStories'in trip));assert.ok(!('story'in trip));assert.ok(!('blocks'in trip));}
 assert.ok(context.media.catalog.every(item=>!('photos'in item)&&item.photoCount>0));
});

test('explicit journal drafts outrank itinerary status words without stealing offline or status requests',()=>{
 for(const text of ['여행기 초안으로 이어서 작성하는 화면을 열어줘. 게시하지 마.','앱에서 여행기 초안 화면을 열어줘. 게시하지 마.']){
  const r=request(text);assert.equal(localFeatureTask(r),'app');assert.equal(needsTravelRetrieval(r),false);
  assert.deepEqual(buildModelInput(r).question.context.allowedToolTypes,['open_spotlog']);
  assert.equal(buildModelInput(r).question.userMessage,text);
 }
 for(const text of ['이 저장 여행을 초안으로 되돌려줘.','이 여행을 오프라인 사본으로 저장해줘. 사진을 업로드하지 마.']){
  const r=request(text);assert.equal(localFeatureTask(r),'local-trip');assert.ok(!buildModelInput(r).question.context.allowedToolTypes.includes('open_spotlog'));
 }
});
test('an unrelated negative traffic lookup clause does not erase photo intent or alter the original message',()=>{
 for(const text of ['부산 관광지 사진을 보여줘. 교통은 조회하지 마.','부산 관광지 사진을 보여줘. 교통은 조회하지 말아줘.','교통은 확인하지 말고 부산 관광지 사진을 보여줘.']){
  const r=request(text);assert.equal(localFeatureTask(r),'media');assert.equal(needsTravelRetrieval(r),false);assert.equal(usesItineraryPlanner(r),false);
  assert.equal(buildModelInput(r).question.userMessage,text);
 }
 for(const text of ['부산 관광지 사진과 교통을 알려줘.','부산 관광지 사진을 보여줘. 교통은 조회하지 마. 날씨는 알려줘.','부산 관광지 사진의 현재 영업시간을 알려줘.']){
  const r=request(text);assert.equal(localFeatureTask(r),null);assert.equal(needsTravelRetrieval(r),true);
 }
});
