import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_CREATION_KEY, isPlanCreationDraft, restorePlanCreationDraft } from '../src/planCreationDraft.ts';
import { createLocalRepository } from '../src/localRepository.ts';
const places=[{id:'busan-a',area:'부산 해운대'},{id:'seoul-a',area:'서울 성동'},{id:'busan-b',area:'부산 해운대'}];
const draft={region:'부산',selectedIds:['busan-b'],dayCount:3,title:'가족 여행',startDate:'2026-10-20'};
test('new travel input persists across a repository reopening without changing journeys or saved places',()=>{
  const records=new Map(); const storage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),get length(){return records.size;},key:index=>[...records.keys()][index]??null};
  const repo=createLocalRepository(storage); repo.setItem('spotlog.web.saved.v3','["busan-a"]');
  assert.equal(repo.setItem(PLAN_CREATION_KEY,JSON.stringify(draft)),true);
  const reopened=createLocalRepository(storage);
  assert.deepEqual(JSON.parse(reopened.getItem(PLAN_CREATION_KEY)),draft);
  assert.equal(reopened.getItem('spotlog.web.saved.v3'),'["busan-a"]');
  assert.equal(reopened.setItem(PLAN_CREATION_KEY,JSON.stringify({...draft,dayCount:99})),false);
  assert.deepEqual(JSON.parse(reopened.getItem(PLAN_CREATION_KEY)),draft);
});
test('recovering removed places preserves text and duration and never auto-selects after explicit deselection',()=>{
  assert.deepEqual(restorePlanCreationDraft({...draft,selectedIds:['busan-b','removed','seoul-a']},places),draft);
  assert.deepEqual(restorePlanCreationDraft({...draft,selectedIds:[]},places).selectedIds,[]);
  assert.equal(isPlanCreationDraft({...draft,selectedIds:[12]}),false);
});
