import test from 'node:test';
import assert from 'node:assert/strict';
import { isSavedTripDraft, SAVED_TRIP_DRAFT_KEY } from '../src/savedTripDraft.ts';
import { registerHooks } from 'node:module';
import { createLocalRepository } from '../src/localRepository.ts';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
  if(context.parentURL?.endsWith('/savedTripBuilder.ts')&&['./aiTravelDraft','./journeyCreation'].includes(specifier))return nextResolve(`${specifier}.ts`,context);
  return nextResolve(specifier,context);
}});
const {newSavedTripDraft,resizeSavedTrip}=await import('../src/savedTripBuilder.ts');
hooks.deregister();
const store = () => { const map = new Map(); return { getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key),key:index=>[...map.keys()][index],get length(){return map.size;} }; };
test('unfinished manual period, active DAY and cross-region choices survive a new repository instance',()=>{
  const storage=store(),repo=createLocalRepository(storage);
  const draft={...newSavedTripDraft(),active:true,mode:'manual',dayCount:3,activeDay:2,title:'내 여행 준비',startDate:'2026-10-20',assignments:[{placeId:'busan-place',day:1},{placeId:'gangneung-place',day:2}]};
  assert.equal(repo.setItem('spotlog.web.saved.v3','["busan-place","gangneung-place"]'),true);
  assert.equal(repo.setItem(SAVED_TRIP_DRAFT_KEY,JSON.stringify(draft)),true);
  const reopened=createLocalRepository(storage);
  assert.deepEqual(JSON.parse(reopened.getItem(SAVED_TRIP_DRAFT_KEY)),draft);
  assert.equal(reopened.getItem('spotlog.web.saved.v3'),'["busan-place","gangneung-place"]');
});
test('unplaced choices remain recoverable after shortening the trip; reset is separate from bookmarks',()=>{
  const repo=createLocalRepository(store());
  const draft={...newSavedTripDraft(),active:true,mode:'manual',dayCount:3,activeDay:3,assignments:[{placeId:'late-place',day:3}]};
  const shortened=resizeSavedTrip(draft,2);assert.equal(isSavedTripDraft(shortened),true);
  assert.equal(repo.setItem('spotlog.web.saved.v3','["late-place"]'),true);
  assert.equal(repo.setItem(SAVED_TRIP_DRAFT_KEY,JSON.stringify(shortened)),true);
  assert.deepEqual(JSON.parse(repo.getItem(SAVED_TRIP_DRAFT_KEY)).assignments,[{placeId:'late-place',day:null}]);
  assert.equal(repo.setItem(SAVED_TRIP_DRAFT_KEY,JSON.stringify(newSavedTripDraft())),true);
  assert.equal(repo.getItem('spotlog.web.saved.v3'),'["late-place"]');
});
test('malformed and duplicate DAY choices cannot overwrite a valid saved draft',()=>{
  const repo=createLocalRepository(store()),draft=newSavedTripDraft();
  assert.equal(repo.setItem(SAVED_TRIP_DRAFT_KEY,JSON.stringify(draft)),true);
  for(const patch of [{activeDay:3},{dayCount:0},{mode:'other'},{automaticIds:['p','p']},{assignments:[{placeId:'p',day:3}]},{assignments:[{placeId:'p',day:1},{placeId:'p',day:2}]},{assignments:[null]},{title:null}]){
    assert.equal(isSavedTripDraft({...draft,...patch}),false);
    assert.equal(repo.setItem(SAVED_TRIP_DRAFT_KEY,JSON.stringify({...draft,...patch})),false);
    assert.deepEqual(JSON.parse(repo.getItem(SAVED_TRIP_DRAFT_KEY)),draft);
  }
});
