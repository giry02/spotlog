import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(context.parentURL?.includes('/lib/')&&specifier.startsWith('./')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);}});
const {createTripSession,appendTrip,currentTrip}=await import('../lib/trip-engine.ts');
const {favoriteReferences}=await import('../lib/trip-local-features.ts');
const {openSavedTripReferenceDay}=await import('../lib/saved-trip-day-client.ts');
const {parseTripAction,parseTripSession}=await import('../lib/chat-contract.ts');
function ready(){let session=createTripSession(['osulloc']);for(const action of [{type:'region',region:'제주'},{type:'configure',meals:false,cafes:false,lodging:false,days:3},{type:'build',visits:[{day:1,placeId:'hyeopjae'},{day:2,placeId:'osulloc'},{day:3,placeId:'osulloc'}]}])session=appendTrip(session,action);session=appendTrip(session,{type:'visit-details',id:currentTrip(session).plan.find(visit=>visit.day===2).id,note:'DAY 2 개인 메모',time:'13:00',durationMinutes:45});session=appendTrip(session,{type:'save'});return appendTrip(session,{type:'plan-status',status:'READY'});}
test('a favorite opens each referenced saved DAY, preserving the source and local copies in one read-only turn',()=>{
 let session=ready();session=appendTrip(session,{type:'offline-save'});const ref=favoriteReferences(session,'osulloc')[0];assert.deepEqual(ref.days,[2,3]);assert.equal(ref.status,'READY');
 const before=structuredClone(session);for(const day of ref.days){const opened=openSavedTripReferenceDay(session,ref.planId,day,'osulloc');assert.equal(currentTrip(opened).activeDay,day);assert.equal(currentTrip(opened).savedPlanId,ref.planId);assert.equal(currentTrip(opened).planStatus,'READY');assert.deepEqual(currentTrip(opened).plan,before.library[0].visits);assert.deepEqual(opened.library,before.library);assert.deepEqual(opened.offlineTrips,before.offlineTrips);assert.deepEqual(opened.turns.slice(0,-1),before.turns);assert.equal(opened.turns.length,before.turns.length+1);assert.equal(opened.turns.at(-1).id,before.nextId);assert.equal(opened.nextId,before.nextId+1);assert.equal(opened.turns.at(-1).source,'local-action');assert.match(currentTrip(opened).question,new RegExp('DAY '+day));assert.equal(opened.recentPlanIds[0],ref.planId);assert.ok(parseTripSession(opened));}
 assert.deepEqual(session,before);const ordinary=appendTrip(session,{type:'open',id:ref.planId});assert.equal(currentTrip(ordinary).activeDay,1);
});
test('reference navigation validates the active source, exact place and DAY before any state change',()=>{
 const session=ready(),id=session.library[0].id,before=structuredClone(session);for(const [planId,day,place] of [[id,1,'osulloc'],[id,0,'osulloc'],[id,4,'osulloc'],[id,2.5,'osulloc'],[id,2,'hyeopjae'],['missing',2,'osulloc']])assert.throws(()=>openSavedTripReferenceDay(session,planId,day,place));assert.deepEqual(session,before);
 const trash=appendTrip(session,{type:'trash',id});assert.throws(()=>openSavedTripReferenceDay(trash,id,2,'osulloc'));assert.deepEqual(favoriteReferences(trash,'osulloc'),[]);
 const draft=appendTrip(session,{type:'plan-status',status:'DRAFT'});assert.equal(favoriteReferences(draft,'osulloc')[0].status,'DRAFT');assert.equal(currentTrip(openSavedTripReferenceDay(draft,id,2,'osulloc')).planStatus,'DRAFT');
});
test('favorite DAY navigation is local and does not extend or bypass model action fields',()=>{
 const session=ready(),id=session.library[0].id;assert.deepEqual(parseTripAction({type:'open',id}),{type:'open',id});assert.throws(()=>parseTripAction({type:'open',id,day:2}));
 const original=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('NO_NETWORK');};try{assert.equal(currentTrip(openSavedTripReferenceDay(session,id,2,'osulloc')).activeDay,2);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
