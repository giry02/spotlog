import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { isTogetherPlaceFeedback, upsertPlaceFeedback, withdrawPlaceFeedback } from '../src/together/businessAssessments.ts';
import { resolveGroupTasteSource, selectGroupTasteMemory } from '../src/together/groupTasteMemory.ts';

const at = new Date('2026-11-11T04:00:00Z');
const place = { id: 'food', kind: 'FOOD', name: '조용한 식당', area: '부산', address: '부산 1번지', lat: 35, lng: 129, image: '', description: '', note: '', duration: '' };
const catalog = [place, { ...place, id: 'branch', address: '부산 2번지' }, { ...place, id: 'cafe', kind: 'CAFE', name: '카페' }, { ...place, id: 'stay', kind: 'STAY', name: '숙소' }];
const feedback = { rating: 4, note: '조용하고 주차하기 편했어요.', recommended: true, purposes: ['FAMILY'] };
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push(...['member', 'second', 'former', 'blocked', 'other'].map(id => ({ id, name: id })));
  const group = { id: 'group', name: '우리 가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'me', memberIds: ['me', 'member', 'second', 'former', 'blocked'], managerIds: [], archived: false, promotionPublished: false };
  state.groups.push(group, { ...structuredClone(group), id: 'foreign', name: '다른 모임', memberIds: ['me', 'other'] });
  const activity = { id: 'past', groupId: group.id, title: '지난 회식', date: '2026-11-10', endDate: '2026-11-10', meetingPoint: '', description: '', status: 'COMPLETED', leadId: 'me', editorIds: [], participants: {}, arrivedIds: [], revision: 1 };
  state.activities.push(activity,
    { ...structuredClone(activity), id: 'future', title: '다음 약속', date: '2026-11-12', endDate: '2026-11-12', status: 'PLANNED' },
    { ...structuredClone(activity), id: 'cancelled', status: 'CANCELLED' },
    { ...structuredClone(activity), id: 'planned-past', status: 'PLANNED' },
    { ...structuredClone(activity), id: 'foreign-activity', groupId: 'foreign' });
  return state;
}
const add = (state, author = 'me', options = {}, input = {}) => upsertPlaceFeedback(state, author, { groupId: 'group', placeId: 'food', ...options }, { ...feedback, ...input }, catalog, at);

test('legacy feedback receives no inferred experience tags from its name, text, rating or purposes', () => {
  const state = fixture(); add(state);
  assert.equal(state.placeFeedback[0].experienceTags, undefined); assert.equal(isTogetherState(state), true);
  const memory = selectGroupTasteMemory(state, 'me', 'group', catalog, {}, at);
  assert.equal(memory.items.length, 1); assert.deepEqual(memory.items[0].tagCounts, []);
  assert.deepEqual(memory.items[0].records[0].experienceTags, []);
  assert.equal(selectGroupTasteMemory(state, 'me', 'group', catalog, { experienceTag: 'QUIET' }, at).items.length, 0);
});

test('explicit tags are copied, old clients preserve them, and an explicit empty array clears them', () => {
  const state = fixture(), tags = ['QUIET', 'RETURN_VISIT']; add(state, 'me', {}, { experienceTags: tags });
  tags.push('PARKING'); assert.deepEqual(state.placeFeedback[0].experienceTags, ['QUIET', 'RETURN_VISIT']);
  add(state, 'me', {}, { expectedRevision: 1, note: '수정', experienceTags: undefined });
  assert.deepEqual(state.placeFeedback[0].experienceTags, ['QUIET', 'RETURN_VISIT']);
  add(state, 'me', {}, { expectedRevision: 2, experienceTags: [] });
  assert.deepEqual(state.placeFeedback[0].experienceTags, []); assert.equal(isTogetherState(state), true);
});

test('invalid, duplicate or non-array experience tags fail before any mutation or persisted validation', () => {
  for (const tags of [['SECRET'], ['QUIET', 'QUIET'], null, 'QUIET', [null], [1]]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => add(state, 'me', {}, { experienceTags: tags })); assert.deepEqual(state, before);
    add(state); state.placeFeedback[0].experienceTags = tags;
    assert.equal(isTogetherPlaceFeedback(state.placeFeedback[0]), false); assert.equal(isTogetherState(state), false);
  }
});

test('only current group root and past noncancelled appointment feedback enter its memory', () => {
  const state = fixture(); add(state); add(state, 'member', { activityId: 'past' }); add(state, 'second', { activityId: 'planned-past' });
  add(state, 'me', { activityId: 'future' });
  // Previously submitted history can remain after cancellation; it is not promoted into taste memory.
  state.activities.find(row => row.id === 'cancelled').status = 'PLANNED'; add(state, 'me', { activityId: 'cancelled' }); state.activities.find(row => row.id === 'cancelled').status = 'CANCELLED';
  add(state, 'me', { groupId: 'foreign', activityId: 'foreign-activity' });
  const before = structuredClone(state), memory = selectGroupTasteMemory(state, 'me', 'group', catalog, {}, at);
  assert.equal(memory.totalRecordCount, 3); assert.equal(memory.items[0].reviewCount, 3); assert.equal(memory.items[0].memberCount, 3);
  assert.deepEqual(memory.items[0].records.map(row => row.activityId).sort(), [undefined, 'past', 'planned-past'].sort());
  assert.equal(memory.activities.some(row => row.id === 'foreign-activity' || row.id === 'future' || row.id === 'cancelled'), false);
  assert.deepEqual(state, before); assert.deepEqual(state.activities[0].participants, {}, 'group access never implies attendance');
});

test('actor identity, exact membership, blocking and room Trash are rechecked before private records are read', () => {
  for (const mutate of [
    state => { state.groups[0].memberIds = ['member']; }, state => { state.groups[0].blockedMemberIds = ['me']; },
    state => { state.members = state.members.filter(row => row.id !== 'me'); }, state => { state.groups[0].temporaryRoom = { disposition: 'TRASH' }; },
  ]) {
    const state = fixture(); add(state); mutate(state); const before = structuredClone(state);
    assert.throws(() => selectGroupTasteMemory(state, 'me', 'group', catalog, {}, at)); assert.deepEqual(state, before);
  }
  for (const actor of ['', 'unknown', 'other']) assert.throws(() => selectGroupTasteMemory(fixture(), actor, 'group', catalog, {}, at));
  assert.throws(() => selectGroupTasteMemory(fixture(), 'me', 'missing', catalog, {}, at));
});

test('withdrawn, departed, blocked and unregistered author records do not inflate the group map', () => {
  const state = fixture(); add(state); add(state, 'member'); add(state, 'former'); add(state, 'blocked'); add(state, 'second');
  withdrawPlaceFeedback(state, 'member', { groupId: 'group', placeId: 'food' }, 1, at);
  state.groups[0].memberIds = state.groups[0].memberIds.filter(id => id !== 'former'); state.groups[0].blockedMemberIds = ['blocked']; state.members = state.members.filter(row => row.id !== 'second');
  const memory = selectGroupTasteMemory(state, 'me', 'group', catalog, {}, at);
  assert.equal(memory.totalRecordCount, 1); assert.equal(memory.items[0].reviewCount, 1); assert.deepEqual(memory.items[0].records.map(row => row.authorId), ['me']);
});

test('kind, explicit experience, purpose and recommendation filters require the same matching record', () => {
  const state = fixture();
  add(state, 'me', {}, { experienceTags: ['QUIET'], purposes: ['FAMILY'], recommended: false });
  add(state, 'member', {}, { experienceTags: ['PARKING'], purposes: ['TEAM_DINNER'], recommended: true });
  add(state, 'me', { placeId: 'stay' }, { experienceTags: ['QUIET', 'RETURN_VISIT'], purposes: ['FAMILY'], recommended: true });
  const results = filters => selectGroupTasteMemory(state, 'me', 'group', catalog, filters, at);
  assert.equal(results({ experienceTag: 'QUIET', purpose: 'TEAM_DINNER' }).items.length, 0);
  assert.deepEqual(results({ kind: 'STAY', experienceTag: 'QUIET', purpose: 'FAMILY', recommendedOnly: true }).items.map(item => item.place.id), ['stay']);
  assert.equal(results({ experienceTag: 'QUIET', recommendedOnly: true }).matchedRecordCount, 1);
  assert.equal(results({ experienceTag: 'PARKING' }).items[0].reviewCount, 1, 'visible counts describe matched explicit records, not hidden unrelated records');
});

test('source filters never fall back to other rooms when a selected appointment is foreign, future or missing', () => {
  const state = fixture(); add(state); add(state, 'member', { activityId: 'past' });
  const root = selectGroupTasteMemory(state, 'me', 'group', catalog, { source: { kind: 'GROUP' } }, at);
  const child = selectGroupTasteMemory(state, 'me', 'group', catalog, { source: { kind: 'ACTIVITY', activityId: 'past' } }, at);
  assert.equal(root.matchedRecordCount, 1); assert.equal(root.items[0].records[0].activityId, undefined);
  assert.equal(child.matchedRecordCount, 1); assert.equal(child.items[0].records[0].sourceTitle, '지난 회식');
  for (const id of ['foreign-activity', 'future', 'missing']) assert.equal(selectGroupTasteMemory(state, 'me', 'group', catalog, { source: { kind: 'ACTIVITY', activityId: id } }, at).matchedRecordCount, 0);
});

test('only current exact catalogue IDs enter memory; same-name branches, personal snapshots and withdrawn catalogue entries never merge', () => {
  const state = fixture(); add(state); add(state, 'member', { placeId: 'branch' });
  assert.equal(selectGroupTasteMemory(state, 'me', 'group', catalog, {}, at).items.length, 2);
  const remaining = catalog.filter(row => row.id !== 'food');
  assert.deepEqual(selectGroupTasteMemory(state, 'me', 'group', remaining, {}, at).items.map(row => row.place.id), ['branch']);
  const privateOnly = catalog.map(row => ({ ...row, personal: true }));
  assert.equal(selectGroupTasteMemory(state, 'me', 'group', privateOnly, {}, at).totalRecordCount, 0);
  assert.equal(selectGroupTasteMemory(state, 'me', 'group', [], {}, at).totalRecordCount, 0);
});

test('record source resolution keeps the exact original group and activity and closes stale withdrawn sources', () => {
  const state = fixture(), id = add(state, 'member', { activityId: 'past' }, { experienceTags: ['RETURN_VISIT'] });
  const resolved = resolveGroupTasteSource(state, 'me', 'group', id, catalog, at);
  assert.equal(resolved.place.id, 'food'); assert.equal(resolved.record.activityId, 'past'); assert.equal(resolved.record.authorId, 'member');
  assert.equal(resolveGroupTasteSource(state, 'me', 'foreign', id, catalog, at), null);
  withdrawPlaceFeedback(state, 'member', { groupId: 'group', activityId: 'past', placeId: 'food' }, 1, at);
  assert.equal(resolveGroupTasteSource(state, 'me', 'group', id, catalog, at), null);
});

test('archived retained groups remain readable, activity-only backing spaces never gain a synthetic root scope', () => {
  const state = fixture(); add(state); add(state, 'member', { activityId: 'past' }); state.groups[0].archived = true;
  assert.equal(selectGroupTasteMemory(state, 'me', 'group', catalog, {}, at).totalRecordCount, 2);
  state.groups[0].spaceType = 'ACTIVITY';
  const memory = selectGroupTasteMemory(state, 'me', 'group', catalog, {}, at);
  assert.equal(memory.hasGroupScope, false); assert.equal(memory.totalRecordCount, 1); assert.equal(memory.items[0].records[0].activityId, 'past');
});

test('selectors are read-only and detached, and malformed filters or tags cannot widen results', () => {
  const state = fixture(); add(state, 'me', {}, { experienceTags: ['QUIET'] });
  const before = structuredClone(state), memory = selectGroupTasteMemory(state, 'me', 'group', catalog, {}, at);
  memory.items[0].place.name = '외부 변경'; memory.items[0].records[0].experienceTags.push('PARKING'); memory.items[0].records[0].purposes.push('SOLO');
  assert.deepEqual(state, before); assert.equal(catalog[0].name, '조용한 식당');
  for (const filters of [{ kind: 'SECRET' }, { experienceTag: 'SECRET' }, { purpose: 'SECRET' }, { source: { kind: 'PRIVATE' } }, { source: { kind: 'ACTIVITY', activityId: '' } }, { recommendedOnly: 'yes' }]) assert.throws(() => selectGroupTasteMemory(state, 'me', 'group', catalog, filters, at));
  assert.throws(() => selectGroupTasteMemory(state, 'me', 'group', catalog, {}, new Date('invalid')));
  state.placeFeedback[0].experienceTags = ['SECRET']; assert.equal(selectGroupTasteMemory(state, 'me', 'group', catalog, {}, at).totalRecordCount, 0);
});
