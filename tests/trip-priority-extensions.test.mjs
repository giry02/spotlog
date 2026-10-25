import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier)) return next(specifier+'.ts',context); return next(specifier,context); } });
const { createTripSession,currentTrip,appendTrip,foodResults,stayResults } = await import('../lib/trip-engine.ts');
const { parseTripAction,parseTripSession,parseModelReply,applyModelReply,validateActionContext,namedBusinessCollectionCandidates } = await import('../lib/chat-contract.ts');
const { trashExpiry } = await import('../lib/trip-extensions.ts');
const { restaurants,stays,places } = await import('../lib/trip-data.ts');
const { compactModelContext,buildModelInput } = await import('../lib/model-input.ts');
const step=(s,a)=>appendTrip(s,parseTripAction(a));
const demo=()=>{let s=createTripSession([],[],'demo');s=step(s,{type:'region',region:'제주'});s=step(s,{type:'configure',days:2});return step(s,{type:'build'});};
const request=(session,text)=>({protocolVersion:1,requestId:'priority-test',sessionId:'priority-test',baseRevision:session.turns.at(-1).id,session,action:{type:'message',text}});

test('new sessions show registered businesses, old sessions without mode still parse',()=>{
 let session=createTripSession();assert.equal(currentTrip(session).businessMode,'registered');session=step(session,{type:'region',region:'제주'});assert.equal(foodResults(currentTrip(session)).length,3);assert.equal(stayResults(currentTrip(session)).length,1);
 for(const turn of session.turns)delete turn.state.businessMode;assert.ok(parseTripSession(session));
});
test('metadata persists only on explicit save, invalid calendar dates and fields are rejected',()=>{
 let s=demo();s=step(s,{type:'trip-meta',title:'제주 가족여행',startDate:'2026-11-01'});s=step(s,{type:'save'});const id=s.library[0].id;
 s=step(s,{type:'trip-meta',title:'수정 초안'});assert.equal(s.library[0].title,'제주 가족여행');s=step(s,{type:'open',id});assert.equal(currentTrip(s).title,'제주 가족여행');assert.equal(currentTrip(s).startDate,'2026-11-01');
 for(const a of [{type:'trip-meta',startDate:'2026-02-30'},{type:'trip-meta',startDate:'not-date'},{type:'trip-meta',title:'x',endpoint:'http://x'},{type:'trip-meta',title:''}]) assert.throws(()=>parseTripAction(a));
});
test('visit note/time/duration are immutable snapshots and support clearing',()=>{
 let s=demo();const before=JSON.stringify(s),id=currentTrip(s).plan[0].id;
 s=step(s,{type:'visit-details',id,note:'천천히 산책',time:'10:30',durationMinutes:90});assert.equal(currentTrip(s).plan[0].note,'천천히 산책');assert.equal(JSON.stringify(s.turns.slice(0,-1)),JSON.stringify(JSON.parse(before).turns));
 s=step(s,{type:'visit-details',id,note:'',time:'',durationMinutes:0});assert.equal(currentTrip(s).plan[0].time,'');assert.ok(parseTripSession(s));
 assert.throws(()=>parseTripAction({type:'visit-details',id,time:'25:61'}));assert.throws(()=>parseTripAction({type:'visit-details',id,durationMinutes:1500}));
});
test('creation accepts seven days, manual DAY edits reach thirty without truncating visits',()=>{
 let s=step(createTripSession(),{type:'configure',days:7});assert.equal(currentTrip(s).days,7);assert.throws(()=>parseTripAction({type:'configure',days:8}));
 for(let i=7;i<30;i++)s=step(s,{type:'day-add'});assert.equal(currentTrip(s).days,30);assert.ok(parseTripSession(s));s=step(s,{type:'day-add'});assert.equal(currentTrip(s).days,30);assert.ok(currentTrip(s).notice.includes('30'));
});
test('DAY copy produces independent IDs, clears done status and deletion shifts only following days',()=>{
 let s=demo();const first=currentTrip(s).plan[0];s=step(s,{type:'progress',id:first.id,status:'done'});const original=structuredClone(currentTrip(s).plan.filter(v=>v.day===1));
 s=step(s,{type:'day-copy',day:1});const copied=currentTrip(s).plan.filter(v=>v.day===3);assert.equal(copied.length,original.filter(v=>v.kind!=='stay').length);assert.ok(copied.every(v=>!v.status&&!original.some(row=>row.id===v.id)));assert.equal(new Set(currentTrip(s).plan.map(v=>v.id)).size,currentTrip(s).plan.length);
 s=step(s,{type:'day-delete',day:2});assert.equal(currentTrip(s).days,2);assert.ok(currentTrip(s).plan.some(v=>v.day===2));assert.ok(parseTripSession(s));
});
test('locked reservations block DAY shifts, copies, metadata edits and placement atomically',()=>{
 let s=step(demo(),{type:'configure',booked:true});const locked=currentTrip(s).plan.find(v=>v.locked),before=JSON.stringify(currentTrip(s).plan);
 for(const a of [{type:'day-copy',day:locked.day},{type:'day-delete',day:locked.day},{type:'visit-details',id:locked.id,note:'변경'},{type:'visit-copy',id:locked.id},{type:'stay-placement',stayId:'stay-coast',startDay:1,nights:1}]){
  const next=step(s,a);assert.equal(JSON.stringify(currentTrip(next).plan),before);assert.throws(()=>validateActionContext(parseTripAction(a),s,true,request(s,'예약 숙소 수정')));
 }
 assert.throws(()=>applyModelReply(request(s,'DAY 1 삭제해줘'),{message:'삭제했어요',actions:[{type:'trip-meta',title:'changed'},{type:'day-delete',day:locked.day}]}));assert.equal(JSON.stringify(currentTrip(s).plan),before);
});
test('explicit stay placement covers just the requested nights and preserves other visits',()=>{
 let s=step(demo(),{type:'configure',days:4});const nonstays=currentTrip(s).plan.filter(v=>v.kind!=='stay');s=step(s,{type:'stay-placement',stayId:'stay-tea',startDay:2,nights:2});
 assert.deepEqual(currentTrip(s).plan.filter(v=>v.kind!=='stay'),nonstays);assert.deepEqual(currentTrip(s).plan.filter(v=>v.entityId==='stay-tea'&&v.day>=2).map(v=>v.day),[2,3]);assert.ok(parseTripSession(s));
 const before=JSON.stringify(currentTrip(s).plan);s=step(s,{type:'stay-placement',stayId:'stay-coast',startDay:3,nights:2});assert.equal(JSON.stringify(currentTrip(s).plan),before);
});
test('registered hotel selection only focuses the candidate until DAY and nights are explicitly applied',()=>{
 const landmark=places.find(p=>p.name==='해운대해수욕장');let base=step(createTripSession(),{type:'region',region:'부산'});base=step(base,{type:'configure',days:4});base=step(base,{type:'build',visits:[{day:1,placeId:landmark.id}]});
 const hotel=stayResults(currentTrip(base)).find(stay=>stay.registered);assert.ok(hotel);const original=structuredClone(currentTrip(base).plan);
 for(const type of ['stay','select-entity']){
  const selected=step(base,{type,id:hotel.id});assert.equal(currentTrip(selected).stayId,hotel.id);assert.equal(currentTrip(selected).days,4);assert.deepEqual(currentTrip(selected).plan,original);
  const rebuilt=step(selected,{type:'build',visits:[{day:1,placeId:landmark.id}]});assert.ok(!currentTrip(rebuilt).plan.some(visit=>visit.entityId===hotel.id));
  const applied=step(selected,{type:'stay-placement',stayId:hotel.id,startDay:2,nights:1});assert.deepEqual(currentTrip(applied).plan.filter(visit=>visit.entityId===hotel.id).map(visit=>visit.day),[2]);assert.equal(currentTrip(applied).days,4);assert.deepEqual(currentTrip(applied).plan.filter(visit=>visit.kind!=='stay'),original.filter(visit=>visit.kind!=='stay'));assert.ok(parseTripSession(applied));
 }
 let daytrip=step(createTripSession(),{type:'place',id:landmark.id});const selected=step(daytrip,{type:'stay',id:hotel.id});assert.equal(currentTrip(selected).days,1);assert.deepEqual(currentTrip(selected).plan,[]);assert.ok(parseTripSession(selected));
});
test('candidate proposals are DAY/anchor/slot groups, partial choice cannot commit and lunch is replaced once',()=>{
 let s=demo();const target=currentTrip(s).plan.find(v=>v.kind==='food');const options=restaurants.filter(item=>item.placeId===target.anchorId&&item.cuisine!=='카페').slice(0,2).map(item=>item.id);assert.equal(options.length,2);
 const before=structuredClone(currentTrip(s).plan);s=step(s,{type:'candidate-propose',ids:options,day:target.day,anchorId:target.anchorId,slot:'lunch'});assert.deepEqual(currentTrip(s).plan,before);let group=currentTrip(s).pendingCandidates[0];assert.equal(group.slot,'점심');
 assert.throws(()=>validateActionContext({type:'candidate-apply'},s,false));assert.throws(()=>validateActionContext({type:'candidate-apply',selections:[{groupId:group.id,id:'not-option'}]},s,false));assert.deepEqual(currentTrip(s).plan,before);
 s=step(s,{type:'candidate-apply',selections:[{groupId:group.id,id:options[1]}]});const matches=currentTrip(s).plan.filter(v=>v.day===target.day&&v.anchorId===target.anchorId&&v.kind==='food'&&v.label==='점심');assert.equal(matches.length,1);assert.equal(matches[0].entityId,options[1]);assert.deepEqual(currentTrip(s).pendingCandidates,[]);assert.ok(parseTripSession(s));
});
test('candidate apply validates the whole selection before changing any slot',()=>{
 let s=demo();const foods=currentTrip(s).plan.filter(v=>v.kind==='food');for(const target of [foods[0],foods.at(-1)]){const ids=restaurants.filter(r=>r.placeId===target.anchorId&&r.cuisine!=='카페').slice(0,2).map(r=>r.id);s=step(s,{type:'candidate-propose',ids,day:target.day,anchorId:target.anchorId,slot:target.label});}
 const before=JSON.stringify(currentTrip(s).plan);const groups=currentTrip(s).pendingCandidates;assert.ok(groups.length>=2);assert.throws(()=>applyModelReply(request(s,'선택한 후보 적용해줘'),{message:'적용',actions:[{type:'candidate-apply',selections:[{groupId:groups[0].id,id:groups[0].optionIds[0]}]}]}));assert.equal(JSON.stringify(currentTrip(s).plan),before);
 const all=groups.map(g=>({groupId:g.id,id:g.optionIds[0]}));assert.throws(()=>applyModelReply(request(s,'선택했지만 아직 적용하지 마'),{message:'적용',actions:[{type:'candidate-apply',selections:all}]}));assert.equal(JSON.stringify(currentTrip(s).plan),before);
});
test('registered lunch candidate replaces the empty slot in place and keeps the full route order',()=>{
 const morning=places.find(p=>p.name==='해운대해수욕장'),afternoon=places.find(p=>p.name==='동백섬');assert.ok(morning&&afternoon);
 let s=step(createTripSession(),{type:'region',region:'부산'});s=step(s,{type:'configure',days:2});s=step(s,{type:'build',visits:[{day:1,placeId:morning.id},{day:1,placeId:afternoon.id}]});
 const lunch=currentTrip(s).plan.find(v=>v.day===1&&v.kind==='food'&&v.label==='점심');assert.equal(lunch.entityId,null);
 s=step(s,{type:'visit-details',id:lunch.id,time:'12:00',durationMinutes:60,note:'오후 산책 전에 점심'});
 const before=structuredClone(currentTrip(s).plan),index=before.findIndex(v=>v.id===lunch.id);
 const eligible=foodResults({...currentTrip(s),anchorId:morning.id,foodKind:'식당'}),chosen=eligible.find(r=>r.name.includes('금수복국'));assert.ok(chosen);assert.ok(eligible.length>=2);
 const options=[chosen.id,eligible.find(r=>r.id!==chosen.id).id];s=step(s,{type:'candidate-propose',ids:options,day:1,anchorId:morning.id,slot:'lunch'});const group=currentTrip(s).pendingCandidates[0];
 s=step(s,{type:'candidate-apply',selections:[{groupId:group.id,id:chosen.id}]});const after=currentTrip(s).plan;
 assert.equal(after.length,before.length);assert.equal(after[index].id,lunch.id);assert.equal(after[index].entityId,chosen.id);assert.equal(after[index].time,'12:00');assert.equal(after[index].durationMinutes,60);
 assert.deepEqual(after.filter(v=>v.id!==lunch.id),before.filter(v=>v.id!==lunch.id));
 assert.deepEqual(after.filter(v=>v.day===1&&v.entityId).map(v=>v.entityId),[morning.id,chosen.id,afternoon.id]);assert.ok(parseTripSession(s));
 // A second comparison replaces the same slot; it does not append another lunch.
 s=step(s,{type:'candidate-propose',ids:options,day:1,anchorId:morning.id,slot:'lunch'});const nextGroup=currentTrip(s).pendingCandidates[0];s=step(s,{type:'candidate-apply',selections:[{groupId:nextGroup.id,id:options[1]}]});
 assert.equal(currentTrip(s).plan[index].id,lunch.id);assert.equal(currentTrip(s).plan[index].entityId,options[1]);assert.equal(currentTrip(s).plan.length,before.length);
});
test('trash retains the active trip, restore keeps metadata and permanent deletion requires a human confirmation',()=>{
 let s=step(step(demo(),{type:'trip-meta',title:'보관 여행',startDate:'2026-11-01'}),{type:'save'});const id=s.library[0].id,before=structuredClone(currentTrip(s).plan);s=step(s,{type:'trash',id});assert.ok(s.library[0].deletedAt);assert.ok(s.library[0].purgeAfter);assert.deepEqual(currentTrip(s).plan,before);assert.throws(()=>validateActionContext({type:'open',id},s,false));
 s=step(s,{type:'restore',id});assert.equal(s.library[0].deletedAt,undefined);assert.equal(s.library[0].startDate,'2026-11-01');s=step(s,{type:'trash',id});assert.throws(()=>parseTripAction({type:'delete-permanent',id}));assert.throws(()=>parseModelReply({message:'삭제',actions:[{type:'delete-permanent',id,confirmed:true}]}));s=step(s,{type:'delete-permanent',id,confirmed:true});assert.equal(s.library.length,0);assert.deepEqual(currentTrip(s).plan,before);
});
test('resaving active trip after trash creates a separate saved copy and leaves recoverable tombstone',()=>{
 let s=step(demo(),{type:'save'});const id=s.library[0].id;s=step(s,{type:'trash',id});s=step(s,{type:'save'});assert.equal(s.library.length,2);assert.ok(s.library.find(p=>p.id===id).deletedAt);assert.notEqual(currentTrip(s).savedPlanId,id);
});
test('retention uses six Korea calendar months and clamps month-end dates',()=>{
 assert.equal(trashExpiry(new Date('2026-08-31T03:00:00.000Z')),'2027-02-28T03:00:00.000Z');assert.equal(trashExpiry(new Date('2026-08-30T15:30:00.000Z')),'2027-02-27T15:30:00.000Z');
});
test('standalone registered cafe/restaurant/shop start needs no landmark visit and unknown prices never become zero',()=>{
 const item=restaurants.find(r=>r.registered&&r.cuisine==='카페');let s=step(createTripSession(),{type:'region',region:findRegion(item)});s=step(s,{type:'show',stage:'food',kind:'카페'});assert.ok(foodResults(currentTrip(s)).some(r=>r.id===item.id));
 s=step(s,{type:'collect-entity',id:item.id});const next=applyModelReply(request(s,'담은 카페로 일정 만들어줘'),{message:'담은 카페 일정',actions:[{type:'build'}]});assert.ok(currentTrip(next).plan.some(v=>v.entityId===item.id));assert.ok(currentTrip(next).plan.every(v=>v.kind!=='place'));assert.ok(parseTripSession(next));
 const context=compactModelContext(request(s,'카페 보여줘'));assert.equal(context.catalog.food.find(r=>r.id===item.id).price,null);assert.equal(context.catalog.food.find(r=>r.id===item.id).walk,null);
 s=step(s,{type:'configure',foodBudget:10000});assert.equal(foodResults(currentTrip(s)).length,0);
 function findRegion(item){return item.region;}
});
test('model can edit known metadata without tourism build, but cannot delete on explanation-only request',()=>{
 let s=demo();s=applyModelReply(request(s,'여행 이름을 주말 산책으로 바꿔줘'),{message:'이름을 바꿨어요',actions:[{type:'trip-meta',title:'주말 산책'}]});assert.equal(currentTrip(s).title,'주말 산책');assert.ok(buildModelInput(request(s,'메모를 바꿔줘')).question);
 assert.throws(()=>applyModelReply(request(s,'DAY 삭제 기능은 어떻게 써?'),{message:'삭제',actions:[{type:'day-delete',day:1}]}));
});
test('verified business itself can anchor standalone search and visits without a fabricated landmark',()=>{
 const item=restaurants.find(r=>r.registered&&r.cuisine==='카페');let s=step(createTripSession(),{type:'region',region:item.region});
 currentTrip(s).anchorId=item.id;currentTrip(s).foodKind='카페';assert.ok(parseTripSession(s));assert.ok(foodResults(currentTrip(s)).some(row=>row.id===item.id));
 s=step(s,{type:'add-entity',id:item.id});currentTrip(s).plan[0].anchorId=item.id;assert.ok(parseTripSession(s));assert.ok(currentTrip(s).plan.every(v=>v.kind!=='place'));
});
test('explicitly collected business survives a grounded build even when its nearest landmark is not selected',()=>{
 let s=createTripSession([],[],'demo');s=step(s,{type:'region',region:'제주'});s=step(s,{type:'collect-entity',id:'of-cafe'});
 const evidence={dataMode:'curated-travel-data',indexVersion:'idx:priority',embeddingModel:'test',results:[{evidenceId:'ev:priority',placeId:'hyeopjae',documentId:'doc:priority',chunkId:'chunk:priority',sourceVersion:'sv:priority',text:'공식 관광 요약',sourceKind:'curated-official-summary'}]};
 s=applyModelReply(request(s,'협재를 넣고 담은 카페도 유지해서 일정 만들어줘'),{message:'선택 유지',actions:[{type:'build',visits:[{day:1,placeId:'hyeopjae'}]}]},'flowise',evidence);
 assert.ok(currentTrip(s).plan.some(v=>v.entityId==='of-cafe'));assert.ok(!currentTrip(s).plan.some(v=>v.kind==='place'&&v.entityId==='osulloc'));assert.ok(parseTripSession(s));
});
test('both registered Busan markets can be selected and collected as shops without invented shop actions',()=>{
 const markets=restaurants.filter(item=>item.registered&&item.cuisine==='상점');assert.equal(markets.length,2);const inputText='부산 국제시장과 자갈치시장 두 곳을 여행 후보에 담아줘';
 let session=step(createTripSession(),{type:'region',region:'부산'});const input=request(session,inputText),candidates=namedBusinessCollectionCandidates(input,currentTrip(session));assert.equal(candidates.length,2);assert.ok(candidates.every(item=>item.kind==='shop'&&item.eligible));
 const reply=parseModelReply({message:'등록된 두 시장을 여행 후보에 담았어요.',actions:markets.map(item=>({type:'collect-entity',id:item.id}))});session=applyModelReply(input,reply);assert.deepEqual(new Set(currentTrip(session).collectedIds),new Set(markets.map(item=>item.id)));assert.equal(currentTrip(session).foodKind,'상점');assert.ok(parseTripSession(session));
 const selected=applyModelReply(request(session,'첫 번째 상점을 선택해줘'),{message:'후보 선택',actions:[{type:'select-entity',id:markets[0].id}]});assert.equal(currentTrip(selected).foodId,markets[0].id);assert.equal(currentTrip(selected).foodKind,'상점');assert.ok(parseTripSession(selected));
 const built=applyModelReply(request(session,'담은 시장 두 곳만 당일 일정으로 만들어줘'),{message:'담은 시장 일정',actions:[{type:'build'}]});assert.equal(currentTrip(built).plan.length,2);assert.ok(currentTrip(built).plan.every(visit=>visit.kind==='shop'));assert.deepEqual(new Set(currentTrip(built).plan.map(visit=>visit.entityId)),new Set(markets.map(item=>item.id)));assert.ok(parseTripSession(built));
});
test('named shop collection respects each positive/negative scope and explicit fresh-session region',()=>{
 const text='부산 여행 후보에 실제 등록된 상점 국제시장과 자갈치시장 두 곳만 이 순서대로 담아줘. 아직 일정은 만들지 마. 식당·카페·숙소·다른 관광지는 담지 마.';
 const markets=restaurants.filter(r=>r.cuisine==='상점'),gukje=markets.find(r=>r.name==='국제시장'),jagalchi=markets.find(r=>r.name==='자갈치시장');
 const fresh=request(createTripSession(),text),built=buildModelInput(fresh);assert.equal(built.question.context.requestedRegion,'부산');assert.deepEqual(built.question.context.namedBusinessCollectionCandidates.map(c=>c.id),[gukje.id,jagalchi.id]);assert.ok(built.question.context.namedBusinessCollectionCandidates.every(c=>c.eligible));
 const reply=parseModelReply({message:'두 시장을 요청한 순서대로 담았어요.',actions:[{type:'region',region:'부산'},{type:'collect-entity',id:gukje.id},{type:'collect-entity',id:jagalchi.id}]});const result=applyModelReply(fresh,reply);assert.deepEqual(currentTrip(result).collectedIds,[gukje.id,jagalchi.id]);assert.equal(currentTrip(result).plan.length,0);assert.ok(parseTripSession(result));
 for(const sentence of ['국제시장과 자갈치시장 담아줘, 다른 관광지는 담지 마','국제시장과 자갈치시장 담아줘. 식당은 담지 마']) assert.deepEqual(namedBusinessCollectionCandidates(request(result,sentence),currentTrip(result)).map(c=>c.id),[gukje.id,jagalchi.id]);
 for(const sentence of ['국제시장은 담지 말고 자갈치시장만 담아줘','국제시장 말고 자갈치시장을 담아줘']) assert.deepEqual(namedBusinessCollectionCandidates(request(result,sentence),currentTrip(result)).map(c=>c.id),[jagalchi.id]);
 for(const sentence of ['국제시장과 자갈치시장을 담지 마','국제시장과 자갈치시장을 담아도 돼?','국제시장과 자갈치시장 담아줘. 아니 담지 마','국제시장과 자갈치시장 담아줘, 상점은 담지 마']) { assert.deepEqual(namedBusinessCollectionCandidates(request(result,sentence),currentTrip(result)),[]); assert.throws(()=>applyModelReply(request(result,sentence),{message:'담기',actions:[{type:'collect-entity',id:gukje.id}]})); }
 assert.ok(compactModelContext(request(result,'상점 보여줘')).candidates.shops.some(c=>c.id===gukje.id));
});
