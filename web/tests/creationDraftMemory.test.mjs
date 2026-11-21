import test from 'node:test';
import assert from 'node:assert/strict';
import { createCreationDraftMemory } from '../src/together/creationDraftMemory.ts';
import { prepareQuickCreation } from '../src/together/quickCreation.ts';

const value = (prompt='부산 가족 여행') => {
  const result = prepareQuickCreation({ purpose:'TRIP', prompt },[]);
  return { draft:{...result,phase:'DRAFT',prompt}, requestId:'same-creation-request', target:'PERSONAL' };
};

test('closing and reopening the same scope restores editable input and the same retry ID without confirmation state', () => {
  const cache = createCreationDraftMemory(); cache.activate('a');
  const original = value(); original.draft.checked = true; original.draft.modelPending = true;
  assert.equal(cache.write('a','trip',original),true);
  const read = cache.read('a','trip');
  assert.equal(read.requestId,original.requestId); assert.equal(read.target,'PERSONAL');
  assert.equal(read.draft.prompt,original.draft.prompt);
  assert.equal(read.draft.checked,undefined); assert.equal(read.draft.modelPending,undefined);
  original.draft.brief.notes='changed source'; read.draft.plan.title='changed read';
  assert.notEqual(cache.read('a','trip').draft.brief.notes,'changed source');
  assert.notEqual(cache.read('a','trip').draft.plan.title,'changed read');
});

test('account and guest boundaries clear existing drafts and late previous-account callbacks cannot reactivate them', () => {
  const cache = createCreationDraftMemory(); cache.activate(''); cache.write('','trip',value());
  cache.activate('a'); assert.equal(cache.read('','trip'),undefined); assert.equal(cache.read('a','trip'),undefined);
  assert.equal(cache.write('','trip',value()),false);
  cache.write('a','trip',value('a input')); cache.activate('b');
  assert.equal(cache.read('a','trip'),undefined); assert.equal(cache.write('a','trip',value()),false);
  cache.write('b','trip',value('b input')); assert.equal(cache.remove('a','trip'),false);
  assert.equal(cache.read('b','trip').draft.prompt,'b input');
  cache.activate('a'); assert.equal(cache.read('a','trip'),undefined);
});

test('different group and purpose scopes stay independent, successful saves remove only their own scope', () => {
  const cache = createCreationDraftMemory(); cache.activate('a');
  cache.write('a','group-1:MEETUP',value('first')); cache.write('a','group-2:MEETUP',value('second'));
  cache.write('a','personal:TRIP',value('personal'));
  assert.equal(cache.remove('a','group-1:MEETUP'),true);
  assert.equal(cache.read('a','group-1:MEETUP'),undefined);
  assert.equal(cache.read('a','group-2:MEETUP').draft.prompt,'second');
  assert.equal(cache.read('a','personal:TRIP').draft.prompt,'personal');
});

test('page-memory retention is bounded and recently read scopes outlive unused old scopes', () => {
  const cache = createCreationDraftMemory(2); cache.activate('a');
  cache.write('a','first',value()); cache.write('a','second',value()); cache.read('a','first');
  cache.write('a','third',value());
  assert.equal(cache.read('a','second'),undefined); assert.ok(cache.read('a','first')); assert.ok(cache.read('a','third'));
});

test('invalid or oversized callbacks cannot replace an existing draft, and complete user notes are retained', () => {
  const cache = createCreationDraftMemory(); cache.activate('a');
  const entry = value(); entry.draft.brief.notes='가'.repeat(2000); entry.draft.brief.people=-1;
  cache.write('a','trip',entry);
  assert.equal(cache.read('a','trip').draft.brief.notes.length,2000);
  assert.equal(cache.read('a','trip').draft.brief.people,-1);
  assert.equal(cache.write('a','trip',{...value(),requestId:''}),false);
  assert.equal(cache.write('a','trip',{...value(),draft:{...value().draft,prompt:'x'.repeat(1001)}}),false);
  assert.equal(cache.read('a','trip').draft.brief.notes.length,2000);
});
