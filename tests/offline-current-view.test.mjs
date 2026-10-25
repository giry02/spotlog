import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(context.parentURL?.includes('/lib/')&&specifier.startsWith('./')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);}});
const {createTripSession,appendTrip,currentTrip}=await import('../lib/trip-engine.ts');
const {currentTripOfflineSaveIssue}=await import('../lib/trip-local-features.ts');
const {applyOfflineTripClientAction}=await import('../lib/offline-trip-client.ts');
const {parseTripSession}=await import('../lib/chat-contract.ts');
function ready(){let session=createTripSession();for(const action of [{type:'region',region:'제주'},{type:'configure',meals:false,cafes:false,lodging:false,days:2},{type:'build',visits:[{day:1,placeId:'hyeopjae'},{day:2,placeId:'osulloc'}]},{type:'trip-meta',title:'이전 완료본'}])session=appendTrip(session,action);session=appendTrip(session,{type:'visit-details',id:currentTrip(session).plan[0].id,note:'기존 개인 메모',time:'10:30',durationMinutes:90});return appendTrip(appendTrip(session,{type:'save'}),{type:'plan-status',status:'READY'});}
function changedSaved(){let session=ready();const oldTurn=session.turns.at(-1).id;session=applyOfflineTripClientAction(session,{type:'offline-save'});session=appendTrip(session,{type:'trip-meta',title:'새로 확정한 저장본'});session=appendTrip(session,{type:'visit-details',id:currentTrip(session).plan[0].id,note:'새 저장본의 메모'});session=appendTrip(session,{type:'plan-status',status:'READY'});return {session,oldTurn};}
for(const restore of ['undo','resume'])test(restore+' of a completed version blocks current-view offline save until explicit completion',()=>{
 let {session,oldTurn}=changedSaved();
 if(restore==='undo'){session=appendTrip(session,{type:'undo'});session=appendTrip(session,{type:'undo'});}else session=appendTrip(session,{type:'resume',id:oldTurn});
 const state=currentTrip(session),saved=session.library.find(plan=>plan.id===state.savedPlanId);
 assert.equal(state.title,'이전 완료본');assert.equal(state.planStatus,'READY');assert.equal(saved.title,'새로 확정한 저장본');assert.match(currentTripOfflineSaveIssue(state,saved),/현재 화면과 완료 저장본/);
 const before=structuredClone(session),refused=applyOfflineTripClientAction(session,{type:'offline-save'});
 assert.match(currentTrip(refused).notice,/현재 화면과 완료 저장본/);assert.deepEqual(refused.offlineTrips,before.offlineTrips);assert.deepEqual(refused.library,before.library);assert.deepEqual(currentTrip(refused).plan,state.plan);assert.deepEqual(session,before);
 const completed=appendTrip(refused,{type:'plan-status',status:'READY'});assert.equal(currentTripOfflineSaveIssue(currentTrip(completed),completed.library[0]),undefined);assert.equal(completed.library[0].title,'이전 완료본');
 const copied=applyOfflineTripClientAction(completed,{type:'offline-save'});assert.equal(copied.offlineTrips.length,1);assert.equal(copied.offlineTrips[0].title,'이전 완료본');assert.equal(copied.offlineTrips[0].visits[0].note,'기존 개인 메모');assert.equal(copied.offlineTrips[0].visits[0].time,'10:30');assert.equal(copied.offlineTrips[0].visits[0].durationMinutes,90);assert.ok(parseTripSession(copied));
});
test('explicit completed saved-plan refresh remains independent of a different restored view',()=>{
 let {session,oldTurn}=changedSaved();session=appendTrip(session,{type:'resume',id:oldTurn});const state=structuredClone(currentTrip(session)),savedBefore=structuredClone(session.library);
 const copied=applyOfflineTripClientAction(session,{type:'offline-save',id:session.library[0].id});assert.equal(copied.offlineTrips[0].title,'새로 확정한 저장본');assert.equal(copied.offlineTrips[0].visits[0].note,'새 저장본의 메모');assert.deepEqual(currentTrip(copied).plan,state.plan);assert.equal(currentTrip(copied).title,state.title);assert.deepEqual(copied.library,savedBefore);assert.ok(parseTripSession(copied));
});
