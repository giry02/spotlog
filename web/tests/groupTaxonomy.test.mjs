import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSubtopics, groupSubtopicsFor, getGroupSubtopic, normalizeGroupSubtopics, validGroupSubtopics, MAX_GROUP_SUBTOPICS } from '../src/together/groupTaxonomy.ts';
import { topicOptions, discoveryProfile, filterDiscoveryGroups } from '../src/together/discovery.ts';
import { selectGroupDiscovery } from '../src/together/groupDiscoveryModel.ts';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState, createTogetherRepository, togetherStorageKey } from '../src/together/repository.ts';

const at = new Date('2026-11-08T12:00:00+09:00');
const group = (id, profile = {}, extra = {}) => ({ id, name: id, kind: 'HOBBY', region: '부산', introduction: '', cover: '', ownerId: 'host', memberIds: ['host'], managerIds: [], archived: false, visibility: 'PUBLIC', promotionPublished: true,
  discovery: { topics: ['SPORTS'], district: '수영구', style: 'NEIGHBORHOOD', recruitment: 'OPEN', welcome: '', joinGuide: '', ...profile }, ...extra });
const ids = result => result.map(item => item.id);
function storage() { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) }; }

test('all sixteen existing parent topics have stable unique child IDs and immutable labels', () => {
  assert.equal(topicOptions.length, 16);
  assert.equal(new Set(groupSubtopics.map(item => item.id)).size, groupSubtopics.length);
  for (const parent of topicOptions) {
    const children = groupSubtopicsFor(parent.id);
    assert.ok(children.length >= 4, parent.id);
    assert.ok(children.every(item => item.parent === parent.id && item.id.startsWith(`${parent.id}_`) && item.label && item.emoji));
    assert.equal(validGroupSubtopics([parent.id], children.map(item => item.id)), true);
  }
  assert.equal(getGroupSubtopic('SPORTS_RUNNING').label, '러닝');
  assert.ok(getGroupSubtopic('SPORTS_RACKET').keywords.includes('테니스'));
  assert.equal(getGroupSubtopic('made-up'), undefined);
  assert.equal(groupSubtopicsFor('ALL').length, groupSubtopics.length);
  assert.equal(Object.isFrozen(groupSubtopics), true);
  assert.equal(Object.isFrozen(getGroupSubtopic('SPORTS_RUNNING')), true);
});

test('validation admits legacy absence and explicit parent children, rejecting stale, duplicate and excessive child IDs', () => {
  assert.equal(validGroupSubtopics(['SPORTS'], undefined), true);
  assert.equal(validGroupSubtopics(['SPORTS'], []), true);
  assert.equal(validGroupSubtopics(['SPORTS','TRAVEL'], ['SPORTS_RUNNING','TRAVEL_FAMILY']), true);
  for (const bad of [null, 'SPORTS_RUNNING', ['UNKNOWN'], ['FOOD_KOREAN'], ['SPORTS_RUNNING','SPORTS_RUNNING'], [3]]) assert.equal(validGroupSubtopics(['SPORTS'], bad), false);
  assert.equal(validGroupSubtopics(topicOptions.map(item => item.id), groupSubtopics.slice(0, MAX_GROUP_SUBTOPICS + 1).map(item => item.id)), false);
});

test('normalization never guesses child tags from names or assigns broad legacy groups to a child', () => {
  const legacy = group('러닝 테니스 모임'); const before = structuredClone(legacy);
  assert.equal('subtopics' in discoveryProfile(legacy), false);
  assert.deepEqual(normalizeGroupSubtopics(['SPORTS'], ['SPORTS_RUNNING','FOOD_KOREAN','UNKNOWN','SPORTS_RUNNING']), ['SPORTS_RUNNING']);
  assert.deepEqual(discoveryProfile(group('x', { subtopics: ['FOOD_KOREAN','SPORTS_RACKET'] })).subtopics, ['SPORTS_RACKET']);
  assert.deepEqual(legacy, before);
  const state = createEmptyState('me','나'); state.groups.push(legacy);
  assert.deepEqual(filterDiscoveryGroups(state, { subtopic:'SPORTS_RUNNING' }, at), []);
});

test('district parent child and style intersect rather than replacing one another', () => {
  const state = createEmptyState('me','나');
  state.groups.push(group('match',{subtopics:['SPORTS_RUNNING']}), group('broad'), group('racket',{subtopics:['SPORTS_RACKET']}),
    group('other-region',{subtopics:['SPORTS_RUNNING']},{region:'서울'}), group('other-district',{subtopics:['SPORTS_RUNNING'],district:'해운대구'}), group('destination',{subtopics:['SPORTS_RUNNING'],style:'DESTINATION'}));
  const before = structuredClone(state), filters = {region:'부산',district:'수영구',topic:'SPORTS',subtopic:'SPORTS_RUNNING',style:'NEIGHBORHOOD'};
  assert.deepEqual(ids(filterDiscoveryGroups(state,filters,at)), ['match']);
  assert.deepEqual(ids(selectGroupDiscovery(state,filters,'',at).groups), ['match']);
  assert.deepEqual(ids(selectGroupDiscovery(state,{...filters,style:'DESTINATION'},'',at).groups), ['destination']);
  assert.deepEqual(filterDiscoveryGroups(state,{...filters,topic:'FOOD'},at), []);
  assert.deepEqual(filterDiscoveryGroups(state,{...filters,subtopic:'UNKNOWN'},at), []);
  assert.deepEqual(ids(filterDiscoveryGroups(state,{...filters,subtopic:'ALL'},at)), ['match','broad','racket']);
  assert.deepEqual(state,before);
});

test('search child keywords apply only to explicitly tagged matching parent groups', () => {
  const state = createEmptyState('me','나'); state.groups.push(group('tagged',{subtopics:['SPORTS_RACKET']}),group('broad'),group('wrong',{topics:['FOOD'],subtopics:['SPORTS_RACKET']}));
  assert.deepEqual(ids(filterDiscoveryGroups(state,{query:'테니스'},at)), ['tagged']);
  const card = selectGroupDiscovery(state,{},'',at).groups.find(item => item.id === 'tagged');
  assert.deepEqual(card.subtopics,['SPORTS_RACKET']);
  assert.equal('subtopics' in selectGroupDiscovery(state,{},'',at).groups.find(item => item.id === 'broad'), false);
});

test('NEWEST keeps valid known creation first and stable unknown rows, preserving editorial source order', () => {
  const state = createEmptyState('me','나');
  state.groups.push(group('unknown'),group('older',{}, {createdAt:'2026-09-01T00:00:00Z'}),group('future',{}, {createdAt:'2027-01-01T00:00:00Z'}),group('invalid',{}, {createdAt:'not-a-date'}),group('newer',{}, {createdAt:'2026-11-07T00:00:00Z'}),group('same-time',{}, {createdAt:'2026-11-07T00:00:00Z'}),group('plain-date',{}, {createdAt:'2026-11-08'}));
  const original = ids(state.groups), expected = ['newer','same-time','older','unknown','future','invalid','plain-date'];
  assert.deepEqual(ids(filterDiscoveryGroups(state,{sort:'NEWEST'},at)),expected);
  assert.deepEqual(ids(selectGroupDiscovery(state,{sort:'NEWEST'},'',at).groups),expected);
  assert.deepEqual(ids(selectGroupDiscovery(state,{sort:'NEWEST'},'',at).recommended),expected);
  assert.deepEqual(ids(filterDiscoveryGroups(state,{sort:'EDITORIAL'},at)),original);
  assert.deepEqual(ids(state.groups),original);
});

test('repository accepts optional validated children and rejects mismatched child updates atomically', () => {
  const disk=storage(), repository=createTogetherRepository('taxonomy-user','나',[],disk);
  assert.equal(repository.update(state => { state.groups.push(group('owned')); }),true);
  assert.equal(repository.update(state => { state.groups.find(item=>item.id==='owned').discovery.subtopics=['SPORTS_RUNNING']; }),true);
  const before=structuredClone(repository.getSnapshot()), bytes=disk.getItem(togetherStorageKey('taxonomy-user'));
  assert.equal(isTogetherState(before),true);
  for (const tags of [['FOOD_KOREAN'],['UNKNOWN'],['SPORTS_RUNNING','SPORTS_RUNNING']]) {
    assert.equal(repository.update(state => { state.groups.find(item=>item.id==='owned').discovery.subtopics=tags; }),false);
    assert.deepEqual(repository.getSnapshot(),before);
    assert.equal(disk.getItem(togetherStorageKey('taxonomy-user')),bytes);
  }
});
