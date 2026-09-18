import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const hooks = registerHooks({resolve(specifier,context,nextResolve) {
  if(context.parentURL?.endsWith('/savedTripBuilder.ts') && ['./aiTravelDraft','./journeyCreation'].includes(specifier)) return nextResolve(`${specifier}.ts`,context);
  return nextResolve(specifier,context);
}});
const {newSavedTripDraft,resizeSavedTrip,pickSavedTripPlace,forgetSavedTripPlace,reorderSavedTripPlace,buildSavedTrip,validTripDate,savedTripDate} = await import('../src/savedTripBuilder.ts');
hooks.deregister();
const place = id => ({id,kind:'LANDMARK',name:id,area:'강원 강릉',address:'강릉',lat:37.7,lng:128.9,image:'/sample.jpg',description:'장소',note:'',duration:'1시간',visitId:'old-visit',time:'09:00'});
const catalog=['A','B','C'].map(place);
const manual = patch => ({...newSavedTripDraft(),active:true,mode:'manual',...patch});

test('manual creation preserves exact DAY/order and empty days across year boundary',()=>{
  const draft=manual({dayCount:3,startDate:'2026-12-31',assignments:[{placeId:'B',day:2},{placeId:'A',day:2},{placeId:'C',day:3}]});
  const before=structuredClone({draft,catalog});
  const result=buildSavedTrip(draft,catalog);
  assert.deepEqual(result.days.map(d=>d.date),['2026-12-31','2027-01-01','2027-01-02']);
  assert.deepEqual(result.days.map(d=>d.places.map(p=>p.id)),[[],['B','A'],['C']]);
  assert.equal(result.duration,'2박 3일'); assert.equal(result.visibility,'PRIVATE'); assert.equal(result.recommendationKind,undefined);
  for(const day of result.days) for(const p of day.places){assert.notEqual(p.visitId,'old-visit');assert.equal(p.time,undefined);assert.ok(day.blocks.some(b=>b.visitId===p.visitId&&b.placeId===p.id));}
  assert.deepEqual({draft,catalog},before);
});
test('automatic placement uses only selected places and preserves requested empty DAYs',()=>{
  const result=buildSavedTrip({...newSavedTripDraft(),dayCount:4,automaticIds:['B','A'],startDate:'2026-10-31'},catalog);
  assert.equal(result.days.length,4); assert.deepEqual(result.days.flatMap(d=>d.places.map(p=>p.id)).sort(),['A','B']);
  assert.equal(result.days[3].date,'2026-11-03'); assert.equal(result.days[3].places.length,0);
});
test('reducing duration keeps displaced places pending and blocks generation until placed',()=>{
  const original=manual({dayCount:4,activeDay:4,assignments:[{placeId:'A',day:1},{placeId:'B',day:4}]});
  let resized=resizeSavedTrip(original,2);
  assert.equal(resized.activeDay,2);assert.deepEqual(resized.assignments,[{placeId:'A',day:1},{placeId:'B',day:null}]);
  assert.throws(()=>buildSavedTrip(resized,catalog),/DAY/);
  resized=pickSavedTripPlace(resized,'B');
  assert.deepEqual(buildSavedTrip(resized,catalog).days.map(d=>d.places.map(p=>p.id)),[['A'],['B']]);
  assert.equal(original.assignments[1].day,4);
});
test('manual move and toggle do not duplicate a place or touch automatic choices',()=>{
  let draft=manual({automaticIds:['C']});
  draft=pickSavedTripPlace(draft,'A');draft=pickSavedTripPlace({...draft,activeDay:2},'A');
  assert.deepEqual(draft.assignments,[{placeId:'A',day:2}]);assert.deepEqual(draft.automaticIds,['C']);
  assert.deepEqual(pickSavedTripPlace(draft,'A').assignments,[]);
});
test('reordering operates only inside chosen DAY',()=>{
  const draft=manual({assignments:[{placeId:'A',day:1},{placeId:'C',day:2},{placeId:'B',day:1}]});
  const result=buildSavedTrip(reorderSavedTripPlace(draft,'B',-1),catalog);
  assert.deepEqual(result.days.map(d=>d.places.map(p=>p.id)),[['B','A'],['C']]);
});
test('automatic creation keeps all saved places even with missing coordinates and does not claim AI',()=>{
  const places=[catalog[0],{...catalog[1],lat:NaN,lng:NaN},{...catalog[2],area:'제주 한림',lat:33.4,lng:126.2}];
  const result=buildSavedTrip({...newSavedTripDraft(),dayCount:1,automaticIds:['A','B','C']},places);
  assert.deepEqual(result.days.flatMap(d=>d.places.map(p=>p.id)).sort(),['A','B','C']);
  assert.equal(result.days.length,1);assert.equal(result.recommendationKind,undefined);
});
test('invalid dates, period, unknown places, and duplicate choices fail without dropping data',()=>{
  const draft={...newSavedTripDraft(),automaticIds:['A']};
  for(const dayCount of [0,8,1.5,NaN]) assert.throws(()=>buildSavedTrip({...draft,dayCount},catalog));
  assert.throws(()=>buildSavedTrip({...draft,startDate:'2027-02-29'},catalog),/날짜/);
  assert.throws(()=>buildSavedTrip({...draft,automaticIds:['A','missing']},catalog),/저장 목록/);
  assert.throws(()=>buildSavedTrip({...draft,automaticIds:['A','A']},catalog),/중복/);
  assert.throws(()=>buildSavedTrip(newSavedTripDraft(),catalog),/한 곳/);
});
test('undated manual creation and leap dates keep correct calendar semantics',()=>{
  assert.equal(validTripDate('2028-02-29'),true);assert.equal(validTripDate('2027-02-29'),false);
  assert.equal(savedTripDate('2028-02-28',3),'2028-03-01');assert.equal(savedTripDate('',2),'');
  const result=buildSavedTrip(manual({assignments:[{placeId:'A',day:2}]}),catalog);
  assert.deepEqual(result.days.map(d=>d.date),['DAY 1','DAY 2']);assert.equal(result.dateRange,'날짜 미정');
});
test('unsaving a place clears it from both modes',()=>{
  const draft=manual({automaticIds:['A','B'],assignments:[{placeId:'A',day:1},{placeId:'C',day:2}]});
  const next=forgetSavedTripPlace(draft,'A');assert.deepEqual(next.automaticIds,['B']);assert.deepEqual(next.assignments,[{placeId:'C',day:2}]);
});
