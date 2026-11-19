import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { acknowledgeDiscoveryMatches, discoveryPicksStorageKey, readDiscoveryPicks, removeDiscoveryCondition,
  saveDiscoveryCondition, selectConditionMatches, selectNewDiscoveryMatches, selectSavedPublicAppointments,
  toggleSavedPublicAppointment } from '../src/together/discoveryPicks.ts';

const at = new Date('2026-11-19T12:00:00+09:00');
const memory = () => {
  const rows = new Map();
  return { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value), rows };
};
const input = (extra = {}) => ({ name: '부산 주말 카페', region: '부산', district: '수영구', topic: 'CAFE', subtopic: '', query: '', weekday: 'WEEKEND', timeBand: 'MORNING', ...extra });
function stateFixture() {
  const state = createEmptyState('me', '나');
  state.groups.push({ id: 'g', name: '공개 카페 모임', kind: 'HOBBY', region: '부산', introduction: '공개 소개', cover: '', visibility: 'PUBLIC', promotionPublished: true,
    ownerId: 'host', memberIds: ['host'], managerIds: [], archived: false, promotionActivityIds: [], promotionActivitySnapshots: [],
    discovery: { topics: ['CAFE'], subtopics: ['CAFE_TALK'], district: '수영구', style: 'NEIGHBORHOOD', recruitment: 'OPEN', welcome: '함께 차 마셔요', joinGuide: '모임 안내', joinMode: 'DIRECT' } });
  return state;
}
function add(state, id, date = '2026-11-21', startTime = '10:00') {
  const activity = { id, groupId: 'g', title: `공개 ${id}`, description: '차를 마셔요', date, endDate: date, startTime, status: 'PLANNED',
    meetingPoint: 'private precise meeting point', leadId: 'host', editorIds: [], participants: {}, arrivedIds: [], revision: 1 };
  state.activities.push(activity);
  state.groups[0].promotionActivityIds.push(id);
  state.groups[0].promotionActivitySnapshots.push({ id, groupId: 'g', title: activity.title, description: activity.description, date, endDate: date, startTime, status: 'PLANNED' });
  return activity;
}

test('interested appointments save references only and never join, apply or RSVP', () => {
  const storage = memory(), state = stateFixture(); add(state, 'morning');
  const before = structuredClone(state);
  const saved = toggleSavedPublicAppointment(storage, 'me', state, { groupId: 'g', activityId: 'morning' }, true, at);
  assert.deepEqual(saved.appointments, [{ groupId: 'g', activityId: 'morning' }]);
  assert.deepEqual(state, before);
  assert.equal(JSON.stringify(saved).includes('private'), false);
  assert.equal(JSON.stringify(saved).includes('공개'), false);
  assert.equal(selectSavedPublicAppointments(state, 'me', saved.appointments, at)[0].event.activity.title, '공개 morning');
  assert.equal(readDiscoveryPicks(storage, '').state.appointments.length, 0);
  assert.equal(readDiscoveryPicks(storage, 'other').state.appointments.length, 0);
});

test('withdrawn, blocked, unapproved and canceled events cannot be saved and old rows remain removable without exposing facts', () => {
  const storage = memory(), state = stateFixture(); add(state, 'saved');
  toggleSavedPublicAppointment(storage, 'me', state, { groupId: 'g', activityId: 'saved' }, true, at);
  for (const apply of [s => { s.groups[0].visibility = 'PRIVATE'; }, s => { s.groups[0].blockedMemberIds = ['me']; }, s => { s.groups[0].promotionActivitySnapshots = []; }, s => { s.activities[0].status = 'CANCELLED'; }]) {
    const changed = structuredClone(state); apply(changed);
    assert.equal(selectSavedPublicAppointments(changed, 'me', [{ groupId: 'g', activityId: 'saved' }], at)[0].event, undefined);
    assert.throws(() => toggleSavedPublicAppointment(memory(), 'me', changed, { groupId: 'g', activityId: 'saved' }, true, at), /공개된 약속/);
  }
  state.groups[0].visibility = 'PRIVATE';
  assert.equal(toggleSavedPublicAppointment(storage, 'me', state, { groupId: 'g', activityId: 'saved' }, false, at).appointments.length, 0);
});

test('conditions match explicit KST weekdays, starting time, district and public text without guessing missing times', () => {
  const state = stateFixture(); add(state, 'sat'); add(state, 'sun', '2026-11-22', '18:00'); add(state, 'friday', '2026-11-20'); add(state, 'unknown', '2026-11-21', '');
  assert.deepEqual(selectConditionMatches(state, 'me', input(), at).map(item => item.activity.id), ['sat']);
  assert.deepEqual(selectConditionMatches(state, 'me', input({ weekday: 'WEEKDAY' }), at).map(item => item.activity.id), ['friday']);
  assert.deepEqual(selectConditionMatches(state, 'me', input({ weekday: '0', timeBand: 'EVENING' }), at).map(item => item.activity.id), ['sun']);
  assert.equal(selectConditionMatches(state, 'me', input({ district: '해운대구' }), at).length, 0);
  assert.equal(selectConditionMatches(state, 'me', input({ query: 'private' }), at).length, 0);
  assert.equal(selectConditionMatches(state, 'me', input({ timeBand: 'ALL' }), at).some(item => item.activity.id === 'unknown'), true);
});

test('new matches start after saving and include newly public or changed approved announcements', () => {
  const storage = memory(), state = stateFixture(); add(state, 'original');
  let saved = saveDiscoveryCondition(storage, 'me', state, input(), at), condition = saved.conditions[0];
  assert.equal(selectNewDiscoveryMatches(state, 'me', condition, at).length, 0);
  add(state, 'added');
  assert.deepEqual(selectNewDiscoveryMatches(state, 'me', condition, at).map(item => item.activity.id), ['added']);
  state.activities[0].title = 'private unpublished edit';
  assert.deepEqual(selectNewDiscoveryMatches(state, 'me', condition, at).map(item => item.activity.id), ['added']);
  state.groups[0].promotionActivitySnapshots[0].title = '공개 안내 변경';
  assert.deepEqual(selectNewDiscoveryMatches(state, 'me', condition, at).map(item => item.activity.id), ['original', 'added']);
  saved = acknowledgeDiscoveryMatches(storage, 'me', state, condition.id, at);
  assert.equal(selectNewDiscoveryMatches(state, 'me', saved.conditions[0], at).length, 0);
  assert.equal(JSON.stringify(saved).includes('공개 안내 변경'), false);
  assert.equal(removeDiscoveryCondition(storage, 'me', condition.id).conditions.length, 0);
});

test('a multi-day event matches remaining days only and never checks a past weekday', () => {
  const state = stateFixture(); add(state, 'trip', '2026-11-18', '10:00');
  state.activities[0].endDate = '2026-11-22'; state.groups[0].promotionActivitySnapshots[0].endDate = '2026-11-22';
  assert.equal(selectConditionMatches(state, 'me', input({ weekday: 'WEEKEND' }), at).length, 1);
  assert.equal(selectConditionMatches(state, 'me', input({ weekday: '3' }), at).length, 0);
});

test('conditions are bounded, child categories must belong to selected topic, corrupt or foreign records are preserved', () => {
  const storage = memory(), state = stateFixture();
  assert.throws(() => saveDiscoveryCondition(storage, 'me', state, input({ topic: 'CAFE', subtopic: 'SPORTS_RUN' }), at), /확인/);
  assert.throws(() => saveDiscoveryCondition(storage, 'me', state, input({ weekday: 6 }), at), /확인/);
  storage.setItem(discoveryPicksStorageKey('me'), 'CORRUPT');
  assert.equal(readDiscoveryPicks(storage, 'me').status, 'invalid');
  assert.throws(() => saveDiscoveryCondition(storage, 'me', state, input(), at), /읽지 못했/);
  assert.equal(storage.getItem(discoveryPicksStorageKey('me')), 'CORRUPT');
  storage.setItem(discoveryPicksStorageKey('me'), JSON.stringify({ schemaVersion: 1, owner: 'other', conditions: [], appointments: [] }));
  assert.equal(readDiscoveryPicks(storage, 'me').status, 'invalid');
  assert.equal(readDiscoveryPicks(storage, ' bad ').status, 'unavailable');
});

test('explicit remove/save intents reread latest state and a failed write preserves the last good record', () => {
  const storage = memory(), state = stateFixture(); add(state, 'one'); add(state, 'two');
  const ref = activityId => ({ groupId: 'g', activityId });
  toggleSavedPublicAppointment(storage, 'me', state, ref('one'), true, at);
  toggleSavedPublicAppointment(storage, 'me', state, ref('two'), true, at);
  assert.equal(toggleSavedPublicAppointment(storage, 'me', state, ref('one'), true, at).appointments.length, 2);
  const before = storage.getItem(discoveryPicksStorageKey('me'));
  const fail = { getItem: storage.getItem, setItem: () => { throw new Error('quota'); } };
  assert.throws(() => toggleSavedPublicAppointment(fail, 'me', state, ref('one'), false, at), /저장하지 못했/);
  assert.equal(storage.getItem(discoveryPicksStorageKey('me')), before);
  assert.deepEqual(toggleSavedPublicAppointment(storage, 'me', state, ref('one'), false, at).appointments, [ref('two')]);
});
