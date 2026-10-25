import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(/\/lib\/[^/]+\.ts$/.test(context.parentURL??'')&&specifier.startsWith('./')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);}});
const {createTripSession,currentTrip,appendTrip,isTripSession}=await import('../lib/trip-engine.ts');
const {parseTripAction,parseTripSession,validateActionContext,applyModelReply,parseModelReply}=await import('../lib/chat-contract.ts');
const {favoriteReferences,savedFavoritePlaces,recentActiveTrip,libraryPlansForView,packageForSavedPlan,offlineCoordinateLayout,applyLocalTripAction,MAX_OFFLINE_PACKAGES}=await import('../lib/trip-local-features.ts');
const step=(session,action)=>appendTrip(session,parseTripAction(action));
function draft(){let s=step(createTripSession(['hyeopjae','seoulforest']),{type:'region',region:'제주'});s=step(s,{type:'configure',meals:false,cafes:false,lodging:false,days:2});return step(s,{type:'build',visits:[{day:1,placeId:'hyeopjae'},{day:2,placeId:'osulloc'}]});}
const save=(s)=>step(s,{type:'save'}),ready=()=>step(save(draft()),{type:'plan-status',status:'READY'});
const request=(session,text)=>({protocolVersion:1,requestId:'local-features',sessionId:'local-features',baseRevision:session.turns.at(-1).id,session,action:{type:'message',text}});

test('favorites filter changes only its own region and references active saved DAYs',()=>{
 let s=save(draft());const saved=s.library[0];s.library.push({...structuredClone(saved),id:'trash-reference',deletedAt:'2026-10-19T00:00:00Z',purgeAfter:'2027-04-19T00:00:00Z'});
 const privateBefore={plan:structuredClone(currentTrip(s).plan),region:currentTrip(s).region,days:currentTrip(s).days,booked:currentTrip(s).booked};
 s=step(s,{type:'saved-filter',region:'서울'});assert.deepEqual(savedFavoritePlaces(currentTrip(s)).map(p=>p.id),['seoulforest']);assert.deepEqual({plan:currentTrip(s).plan,region:currentTrip(s).region,days:currentTrip(s).days,booked:currentTrip(s).booked},privateBefore);
 assert.deepEqual(favoriteReferences(s,'hyeopjae').map(ref=>({id:ref.planId,days:ref.days})),[{id:saved.id,days:[1]}]);assert.ok(parseTripSession(s));
 s=step(s,{type:'saved-filter',region:null});assert.equal(savedFavoritePlaces(currentTrip(s)).length,2);
});
test('READY requires an explicitly saved nonempty trip without unresolved visits or proposals',()=>{
 let s=draft();assert.throws(()=>validateActionContext({type:'plan-status',status:'READY'},s,false));s=save(s);const id=s.library[0].id;
 s=step(s,{type:'plan-status',status:'READY'});assert.equal(currentTrip(s).planStatus,'READY');assert.equal(s.library[0].status,'READY');assert.equal(s.library[0].id,id);
 const missing=structuredClone(s);currentTrip(missing).plan[0].entityId=null;assert.throws(()=>validateActionContext({type:'plan-status',status:'READY'},missing,false));
 const pending=structuredClone(s);currentTrip(pending).pendingCandidates=[{id:'pending',day:1,anchorId:'hyeopjae',kind:'food',slot:'점심',optionIds:['hj-rice','hj-pasta']}];assert.throws(()=>validateActionContext({type:'plan-status',status:'READY'},pending,false));
 const empty=structuredClone(s);currentTrip(empty).plan=[];assert.throws(()=>validateActionContext({type:'plan-status',status:'READY'},empty,false));assert.ok(parseTripSession(s));
});
test('editing ready data demotes just the working draft; explicit save or completion updates the saved version',()=>{
 let s=ready();const before=structuredClone(s.library[0]);s=step(s,{type:'visit-details',id:currentTrip(s).plan[0].id,note:'개인 메모',time:'10:30',durationMinutes:90});assert.equal(currentTrip(s).planStatus,'DRAFT');assert.deepEqual(s.library[0],before);
 s=step(s,{type:'trip-meta',title:'새 이름'});assert.equal(s.library[0].title,before.title);s=step(s,{type:'plan-status',status:'READY'});assert.equal(s.library[0].title,'새 이름');assert.equal(s.library[0].visits[0].note,'개인 메모');
 s=step(s,{type:'plan-status',status:'DRAFT'});assert.equal(s.library[0].status,'DRAFT');s=step(s,{type:'save'});assert.equal(s.library[0].status,'DRAFT');assert.ok(parseTripSession(s));
});
test('visit progress does not turn an unchanged ready itinerary into a new draft',()=>{
 let s=ready();s=step(s,{type:'progress',id:currentTrip(s).plan[0].id,status:'done'});assert.equal(currentTrip(s).planStatus,'READY');s=step(s,{type:'save'});assert.equal(s.library[0].status,'READY');assert.equal(s.library[0].visits[0].status,'done');
});
test('library current view uses current statuses while an earlier conversation retains its historical snapshot',()=>{
 let s=ready();s=step(s,{type:'library'});const past=currentTrip(s);assert.equal(past.librarySnapshot[0].status,'READY');s=step(s,{type:'plan-status',status:'DRAFT'});
 assert.equal(libraryPlansForView(s,currentTrip(s))[0].status,'DRAFT');assert.equal(libraryPlansForView(s,past)[0].status,'READY');assert.ok(parseTripSession(s));
});
test('recent continuation tracks actual opens, skips trash or removed IDs and retains the stored DAY/progress',()=>{
 let s=ready();const a=s.library[0].id;s=step(s,{type:'build',visits:[{day:1,placeId:'hyeopjae'},{day:2,placeId:'osulloc'}]});s=save(s);const b=s.library.find(plan=>plan.id!==a).id;
 s=step(s,{type:'open',id:a});assert.equal(recentActiveTrip(s).id,a);s=step(s,{type:'progress',id:currentTrip(s).plan[0].id,status:'done'});s=save(s);s=step(s,{type:'continue-trip'});assert.equal(currentTrip(s).savedPlanId,a);assert.equal(currentTrip(s).activeDay,2);
 s=step(s,{type:'trash',id:a});assert.equal(recentActiveTrip(s).id,b);s=step(s,{type:'continue-trip'});assert.equal(currentTrip(s).savedPlanId,b);assert.ok(parseTripSession(s));
 s=step(s,{type:'trash',id:b});assert.equal(recentActiveTrip(s),undefined);const before=structuredClone(currentTrip(s).plan);s=step(s,{type:'continue-trip'});assert.deepEqual(currentTrip(s).plan,before);
});
test('offline saves are immutable ready snapshots with private notes and verified coordinates, no fetched maps',()=>{
 let s=ready();s=step(s,{type:'visit-details',id:currentTrip(s).plan[0].id,note:'기기 안에만 보관할 메모'});s=step(s,{type:'plan-status',status:'READY'});const before=structuredClone(currentTrip(s).plan);
 s=step(s,{type:'offline-save'});assert.equal(s.offlineTrips.length,1);const pack=s.offlineTrips[0];assert.equal(pack.visits[0].note,'기기 안에만 보관할 메모');assert.equal(pack.points.length,2);assert.deepEqual(pack.points.map(p=>p.sequence),[1,2]);assert.ok(!JSON.stringify(pack).includes('image'));assert.ok(!JSON.stringify(pack).includes('https://'));
 s=step(s,{type:'offline-open',id:pack.id});assert.deepEqual(currentTrip(s).plan,before);s=step(s,{type:'visit-details',id:currentTrip(s).plan[0].id,note:'변경 후 메모'});assert.equal(s.offlineTrips[0].visits[0].note,'기기 안에만 보관할 메모');
 assert.throws(()=>validateActionContext({type:'offline-save'},s,false));s=step(s,{type:'offline-save',id:pack.sourcePlanId});assert.equal(s.offlineTrips[0].visits[0].note,'기기 안에만 보관할 메모');
 s=step(s,{type:'plan-status',status:'READY'});s=step(s,{type:'offline-save'});assert.equal(s.offlineTrips.length,1);assert.equal(s.offlineTrips[0].id,pack.id);assert.equal(s.offlineTrips[0].visits[0].note,'변경 후 메모');assert.ok(parseTripSession(s));
});
test('offline copies remain separate when the source is trashed, and deleting a copy never deletes a trip',()=>{
 let s=step(ready(),{type:'offline-save'});const pack=s.offlineTrips[0],plan=structuredClone(currentTrip(s).plan);s=step(s,{type:'trash',id:pack.sourcePlanId});assert.equal(s.offlineTrips.length,1);assert.equal(recentActiveTrip(s),undefined);s=step(s,{type:'offline-open',id:pack.id});assert.deepEqual(currentTrip(s).plan,plan);
 s=step(s,{type:'offline-remove',id:pack.id});assert.equal(s.offlineTrips.length,0);assert.equal(s.library.length,1);assert.ok(s.library[0].deletedAt);assert.deepEqual(currentTrip(s).plan,plan);assert.ok(parseTripSession(s));
});
test('conversation reset preserves offline packages and recency; old sessions need no new fields',()=>{
 let s=step(ready(),{type:'offline-save'});const offline=structuredClone(s.offlineTrips),recent=[...s.recentPlanIds];s=step(s,{type:'reset'});assert.equal(s.turns.length,1);assert.deepEqual(s.offlineTrips,offline);assert.deepEqual(s.recentPlanIds,recent);assert.ok(parseTripSession(s));assert.ok(isTripSession(s));
 delete s.offlineTrips;delete s.recentPlanIds;for(const turn of s.turns)delete turn.state.planStatus;for(const plan of s.library){delete plan.status;delete plan.activeDay;}assert.ok(parseTripSession(s));
});
test('offline limits reject overflow atomically and never truncate the original private trip',()=>{
 let s=ready(),template=structuredClone(s.library[0]);s.library=Array.from({length:MAX_OFFLINE_PACKAGES+1},(_,i)=>({...structuredClone(template),id:`trip-cap-${i}`}));
 for(let i=0;i<MAX_OFFLINE_PACKAGES;i++)s=step(s,{type:'offline-save',id:`trip-cap-${i}`});const before=structuredClone(s.offlineTrips);assert.throws(()=>validateActionContext({type:'offline-save',id:'trip-cap-5'},s,false));s=step(s,{type:'offline-save',id:'trip-cap-5'});assert.deepEqual(s.offlineTrips,before);assert.equal(s.library.length,6);
 const large=ready();large.library[0].visits=Array.from({length:180},(_,i)=>({...structuredClone(template.visits[0]),id:`visit-large-${i}`,note:'큰'.repeat(1000)}));const original=structuredClone(large.library[0]);assert.throws(()=>validateActionContext({type:'offline-save',id:large.library[0].id},large,false));const result=step(large,{type:'offline-save',id:large.library[0].id});assert.equal(result.offlineTrips,undefined);assert.deepEqual(result.library[0],original);
});
test('offline session parser validates closed fields, coordinate bounds, references and stored sizes',()=>{
 const good=step(ready(),{type:'offline-save'});assert.deepEqual(parseTripSession(structuredClone(good)),good);
 for(const mutate of [s=>s.offlineTrips[0].points[0].latitude=100,s=>s.offlineTrips[0].points[0].sequence=2,s=>s.offlineTrips[0].points[0].visitId='unknown',s=>s.offlineTrips[0].fetchUrl='https://example.com',s=>s.recentPlanIds=['duplicate','duplicate'],s=>s.offlineTrips[0].startDate='2026-02-30',s=>s.library[0].status='PUBLIC']){const invalid=structuredClone(good);mutate(invalid);assert.throws(()=>parseTripSession(invalid));}
 for(const action of [{type:'offline-open',id:'missing',endpoint:'x'},{type:'plan-status',status:'PUBLIC'},{type:'saved-filter',region:'도쿄'},{type:'offline-save',visits:[]}])assert.throws(()=>parseTripAction(action));
});
test('numbered offline coordinate layout works with fetch unavailable and single or missing points',()=>{
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('network disabled');};try{const pack=packageForSavedPlan(ready().library[0]);const points=offlineCoordinateLayout(pack.points);assert.equal(points.length,2);assert.ok(points.every(p=>p.x>=31&&p.x<=449&&p.y>=31&&p.y<=269));const one=offlineCoordinateLayout([pack.points[0]]);assert.equal(one[0].x,240);assert.equal(one[0].y,150);assert.deepEqual(offlineCoordinateLayout([]),[]);}finally{globalThis.fetch=originalFetch;}
});
test('a real-model action batch retains offline and recent metadata in one collapsed response',()=>{
 const s=draft(),before=structuredClone(s);const reply=parseModelReply({message:'저장 후 작성 완료하고 오프라인 사본을 보관했어요.',actions:[{type:'save'},{type:'plan-status',status:'READY'},{type:'offline-save'}]});const next=applyModelReply(request(s,'이 여행을 저장하고 작성 완료한 다음 오프라인 사본으로 저장해줘'),reply,'ollama');
 assert.equal(next.turns.length,s.turns.length+1);assert.equal(next.library[0].status,'READY');assert.equal(next.offlineTrips.length,1);assert.deepEqual(next.recentPlanIds,[next.library[0].id]);assert.deepEqual(s,before);assert.ok(parseTripSession(next));
});
test('local tool mutation distinguishes unrelated publishing exclusions from its own explicit negation',()=>{
 const base=ready(),save={type:'offline-save'};
 for(const text of ['오프라인 사본으로 저장해줘. 공개 게시하지 마.','오프라인 저장해줘, 게시하지 마','오프라인 저장해줘. 사진 업로드는 하지 마.']){const next=applyModelReply(request(base,text),{message:'오프라인 사본 저장',actions:[save]},'ollama');assert.equal(next.offlineTrips.length,1);}
 for(const text of ['오프라인 저장하지 마.','오프라인 저장은 아직 하지 마.','오프라인 사본 저장해주지 마.','오프라인 저장 방법 설명해줘','오프라인 저장할 수 있는지 알려줘'])assert.throws(()=>applyModelReply(request(base,text),{message:'저장',actions:[save]},'ollama'));
 const copy=step(base,save),remove={type:'offline-remove',id:copy.offlineTrips[0].id};assert.equal(applyModelReply(request(copy,'오프라인 사본 삭제해줘. 여행 원본은 삭제하지 마.'),{message:'사본만 삭제',actions:[remove]},'ollama').offlineTrips.length,0);
 for(const text of ['오프라인 사본 삭제하지 마','사본 지우지 마','오프라인 사본 삭제 방법 설명해줘'])assert.throws(()=>applyModelReply(request(copy,text),{message:'삭제',actions:[remove]},'ollama'));
 const pending=saveDraft();for(const text of ['이 여행 작성 완료하지 마','작성 완료로 바꾸지 마','작성 완료 방법 설명해줘'])assert.throws(()=>applyModelReply(request(pending,text),{message:'완료',actions:[{type:'plan-status',status:'READY'}]},'ollama'));
 function saveDraft(){return saveSession(draft());}function saveSession(s){return step(s,{type:'save'});}
});
test('an older ready snapshot restored by undo cannot implicitly replace a different saved version in offline storage',()=>{
 let s=ready();s=step(s,{type:'trip-meta',title:'새로 확정한 여행명'});s=step(s,{type:'plan-status',status:'READY'});s=step(s,{type:'undo'});assert.equal(currentTrip(s).planStatus,'READY');assert.notEqual(currentTrip(s).title,s.library[0].title);
 assert.throws(()=>validateActionContext({type:'offline-save'},s,false));const refused=step(s,{type:'offline-save'});assert.equal(refused.offlineTrips,undefined);
 const explicit=step(s,{type:'offline-save',id:s.library[0].id});assert.equal(explicit.offlineTrips[0].title,s.library[0].title);assert.ok(parseTripSession(explicit));
});
test('new community/media fields round-trip through history without changing private region, DAYs or plan',()=>{
 let s=draft(),before=structuredClone(currentTrip(s).plan);s=step(s,{type:'community-filter',region:'서울',query:'산책',contentType:'ai',days:2,authorId:null});assert.equal(currentTrip(s).communityRegion,'서울');assert.equal(currentTrip(s).communityDays,2);assert.equal(currentTrip(s).region,'제주');assert.deepEqual(currentTrip(s).plan,before);
 s=step(s,{type:'media',mode:'photos',region:'부산',kind:'CAFE'});assert.equal(currentTrip(s).mediaRegion,'부산');assert.equal(currentTrip(s).mediaKind,'CAFE');assert.deepEqual(currentTrip(s).plan,before);s=step(s,{type:'history'});assert.ok(parseTripSession(s));
 assert.throws(()=>parseTripAction({type:'community-filter',authorId:'unknown-author'}));assert.throws(()=>parseTripAction({type:'media',mode:'live-camera'}));
});
