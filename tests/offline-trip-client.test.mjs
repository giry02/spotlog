import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(context.parentURL?.includes('/lib/')&&specifier.startsWith('./')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);return next(specifier,context);}});
const {createTripSession,appendTrip,currentTrip}=await import('../lib/trip-engine.ts');
const {places}=await import('../lib/trip-data.ts');
const {applyOfflineTripClientAction}=await import('../lib/offline-trip-client.ts');
function ready(){let s=createTripSession();s=appendTrip(s,{type:'region',region:'부산'});s=appendTrip(s,{type:'configure',days:1,meals:false,cafes:false,lodging:false});s=appendTrip(s,{type:'collect-entity',id:places.find(p=>p.region==='부산').id});s=appendTrip(s,{type:'build'});s=appendTrip(s,{type:'save'});return appendTrip(s,{type:'plan-status',status:'READY'});}
test('offline save, list, open and removal work with every HTTP call disabled',()=>{
 const originalFetch=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('NO_NETWORK');};
 try{let session=ready();const original=JSON.stringify(session),plan=structuredClone(currentTrip(session).plan),saved=structuredClone(session.library);
  session=applyOfflineTripClientAction(session,{type:'offline-save'});assert.equal(session.offlineTrips.length,1);const id=session.offlineTrips[0].id;
  session=applyOfflineTripClientAction(session,{type:'offline-library'});assert.equal(currentTrip(session).offlinePackageId,null);
  session=applyOfflineTripClientAction(session,{type:'offline-open',id});assert.equal(currentTrip(session).offlinePackageId,id);assert.equal(session.turns.at(-1).source,'local-action');
  session=applyOfflineTripClientAction(session,{type:'offline-remove',id});assert.equal(session.offlineTrips.length,0);assert.deepEqual(currentTrip(session).plan,plan);assert.deepEqual(session.library,saved);assert.ok(original.length>0);assert.equal(calls,0);
 }finally{globalThis.fetch=originalFetch;}
});
test('offline client never intercepts model messages or accepts extra command payloads',()=>{
 const session=ready(),before=JSON.stringify(session);assert.equal(applyOfflineTripClientAction(session,{type:'message',text:'오프라인 저장해줘'}),undefined);
 assert.throws(()=>applyOfflineTripClientAction(session,{type:'offline-library',endpoint:'https://example.test'}));assert.equal(JSON.stringify(session),before);
});
