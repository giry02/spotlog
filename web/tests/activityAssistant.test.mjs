import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, roomIdForActivity } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { applyActivityAssistantAction, assistantSourceVersion, compareAssistantConditions, compareAssistantTime, getAssistantContext, prepareAssistantRequest, selectAssistantMessages, selectAssistantPlaces, unconnectedAssistantResponse } from '../src/together/activityAssistant.ts';

const place = (id, extra = {}) => ({ id, name: '같은 상호', kind: 'CAFE', area: '부산', address: `${id} 지점 주소`, lat: 35, lng: 129, image: '', description: '', duration: '', note: '', ...extra });
const places = [place('a'), place('b'), place('private', { personal: true }), place('unshared')];
function fixture() {
  const state = createEmptyState('host', '모임장');
  state.members.push({ id: 'alice', name: '여행자' }, { id: 'outsider', name: '다른 모임원' });
  state.groups.push({ id: 'g', name: '가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', ownerId: 'host', memberIds: ['host', 'alice'], managerIds: [], archived: false, visibility: 'PRIVATE', promotionPublished: false, interestPlaceIds: ['a', 'b', 'private', 'withdrawn'] });
  state.activities.push({ id: 'one', groupId: 'g', title: '커피와 산책', date: '2026-11-07', startTime: '14:00', endDate: '', meetingPoint: '멤버 전용 위치', description: '', status: 'PLANNED', leadId: 'host', editorIds: [], participants: { alice: 'MAYBE' }, arrivedIds: [], revision: 2 });
  state.activities.push({ ...structuredClone(state.activities[0]), id: 'other', title: '다른 약속' });
  state.messages.push({ id: 'm', roomId: roomIdForActivity('one'), authorId: 'alice', body: '3시로 바꾸는 건 어때요?', createdAt: '2026-11-03T00:00:00Z' }, { id: 'foreign', roomId: roomIdForActivity('other'), authorId: 'alice', body: '다른 방의 원문', createdAt: '2026-11-03T00:01:00Z' });
  return state;
}
const base = (id = 'request') => ({ id, groupId: 'g', activityId: 'one', expectedRevision: 2 });
const task = (extra = {}) => ({ ...base(), type: 'CREATE_TASK', title: '운영 시간 직접 확인', sourceMessageIds: ['m'], sourceVersions: { m: assistantSourceVersion('3시로 바꾸는 건 어때요?') }, assignee: 'UNASSIGNED', ...extra });
const rejected = (state, action, actor = 'host') => { const before = structuredClone(state); assert.throws(() => applyActivityAssistantAction(state, actor, action, places)); assert.deepEqual(state, before); };

test('only members can read; public promotion and RSVP never grant the workspace', () => {
  const state = fixture(); state.groups[0].visibility = 'PUBLIC'; state.groups[0].promotionPublished = true;
  assert.throws(() => getAssistantContext(state, 'outsider', base()));
  state.activities[0].participants.outsider = 'JOINED';
  assert.throws(() => getAssistantContext(state, 'outsider', base()));
  assert.equal(getAssistantContext(state, 'alice', base()).activity.id, 'one');
  state.groups[0].blockedMemberIds = ['alice'];
  assert.throws(() => selectAssistantMessages(state, 'alice', base()));
});
test('shared IDs are intersected with current public catalog, excluding private/unshared/withdrawn items', () => {
  const state = fixture(), before = structuredClone(state);
  assert.deepEqual(selectAssistantPlaces(state, 'host', base(), places).map(item => item.id), ['a', 'b']);
  assert.deepEqual(state, before);
  assert.equal('note' in selectAssistantPlaces(state, 'host', base(), places)[0], false);
});
test('missing cost/walking evidence is UNKNOWN; zero and exact boundaries are legitimate', () => {
  assert.deepEqual(compareAssistantConditions({ budgetCap: 20000, walkingLimit: 10 }, { placeId: 'a' }), { budget: 'UNKNOWN', walking: 'UNKNOWN' });
  assert.deepEqual(compareAssistantConditions({ budgetCap: 20000, walkingLimit: 10 }, { placeId: 'a', costPerPerson: 0, walkingMinutes: 10 }), { budget: 'MATCH', walking: 'MATCH' });
  assert.deepEqual(compareAssistantConditions({ budgetCap: 20000, walkingLimit: 10 }, { placeId: 'a', costPerPerson: 20001, walkingMinutes: 11 }), { budget: 'CONFLICT', walking: 'CONFLICT' });
  assert.equal(compareAssistantConditions({ budgetCap: -1 }, { placeId: 'a', costPerPerson: 10 }).budget, 'UNKNOWN');
});
test('manual 15:00 proposal never changes current 14:00, voting or participation', () => {
  const state = fixture(), before = structuredClone(state);
  assert.deepEqual(compareAssistantTime(state, 'host', base(), '15:00'), { current: '14:00', proposed: '15:00', changed: true, date: '2026-11-07', revision: 2 });
  assert.deepEqual(state, before);
  assert.throws(() => compareAssistantTime(state, 'host', base(), '25:00'));
});
test('creating a place vote is explicit, branch names remain distinguishable, retry is idempotent', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T12:00:00+09:00').getTime() });
  const state = fixture(), oldActivity = structuredClone(state.activities);
  const action = { ...base(), type: 'CREATE_POLL', question: '어디서 만날까요?', placeIds: ['a', 'b'] };
  applyActivityAssistantAction(state, 'alice', action, places);
  applyActivityAssistantAction(state, 'alice', { ...action, id: 'another-request' }, places);
  assert.equal(state.polls.length, 1); assert.notEqual(state.polls[0].options[0].label, state.polls[0].options[1].label);
  assert.deepEqual(state.polls[0].options.map(item => item.voterIds), [[], []]); assert.deepEqual(state.activities, oldActivity);
  assert.equal(isTogetherState(state), true);
  rejected(state, { ...action, id: 'bad', placeIds: ['a', 'unshared'] });
});
test('preparation keeps only source IDs, never treats a question as an assigned task', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T12:00:00+09:00').getTime() });
  const state = fixture(), message = structuredClone(state.messages[0]);
  applyActivityAssistantAction(state, 'alice', task(), places);
  assert.equal(state.tasks[0].assigneeId, undefined); assert.deepEqual(state.tasks[0].sourceMessageIds, ['m']);
  assert.equal(state.tasks[0].completed, false); assert.deepEqual(state.messages[0], message);
  assert.equal(JSON.stringify(state.tasks[0]).includes(message.body), false);
  applyActivityAssistantAction(state, 'alice', task({ id: 'retry' }), places); assert.equal(state.tasks.length, 1);
  assert.equal(isTogetherState(state), true);
});
test('self acceptance may assign only actor; old body/deleted/cross-room sources are rejected atomically', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T12:00:00+09:00').getTime() });
  const state = fixture(); applyActivityAssistantAction(state, 'alice', task({ assignee: 'SELF' }), places);
  assert.equal(state.tasks[0].assigneeId, 'alice');
  rejected(state, task({ id: 'bad', assignee: 'host' }), 'alice');
  rejected(state, task({ id: 'bad', sourceMessageIds: ['foreign'], sourceVersions: { foreign: assistantSourceVersion('다른 방의 원문') } }));
  state.messages[0].body = '아니요, 시간을 그대로 두죠.'; rejected(state, task({ id: 'stale' }));
  state.messages[0].deleted = true; rejected(state, task({ id: 'deleted' }));
});
test('a revoked member, archived group, cancelled/finished activity or wrong revision cannot apply preparation', () => {
  for (const change of [state => state.groups[0].memberIds = ['alice'], state => state.groups[0].archived = true, state => state.activities[0].status = 'CANCELLED', state => state.activities[0].status = 'COMPLETED', state => state.activities[0].revision++]) {
    const state = fixture(); change(state); rejected(state, task());
  }
});
test('time changes require editing permission and fresh revision, and withdraw public snapshot without changing RSVP', () => {
  const state = fixture(), action = { ...base(), type: 'UPDATE_ACTIVITY_TIME', startTime: '15:00' };
  rejected(state, action, 'alice'); rejected(state, { ...action, expectedRevision: 1 });
  state.groups[0].promotionActivityIds = ['one']; state.groups[0].promotionActivitySnapshots = [{ id: 'one', groupId: 'g', title: '공개 제목', date: '2026-11-07', endDate: '', description: '', status: 'PLANNED', startTime: '14:00' }];
  applyActivityAssistantAction(state, 'host', action, places);
  assert.equal(state.activities[0].startTime, '15:00'); assert.equal(state.activities[0].revision, 3);
  assert.deepEqual(state.activities[0].participants, { alice: 'MAYBE' }); assert.deepEqual(state.groups[0].promotionActivityIds, []);
  assert.equal(state.activities[1].startTime, '14:00'); assert.equal(isTogetherState(state), true);
});
test('fixed bookings block assistant time application without touching the underlying itinerary', () => {
  const state = fixture(); state.activities[0].journey = { days: [{ places: [place('stay', { bookingFixed: true })] }] };
  rejected(state, { ...base(), type: 'UPDATE_ACTIVITY_TIME', startTime: '15:00' });
});
test('repeat starts a private unselected undated activity; no old booking/date/member RSVP or personal original is copied', () => {
  const state = fixture(); state.groups[0].spaceType = 'GROUP'; state.activities[0].status = 'COMPLETED'; const original = structuredClone(state.activities[0]);
  const action = { ...base('new-one'), type: 'CREATE_ACTIVITY_DRAFT', title: '다음 산책' };
  applyActivityAssistantAction(state, 'alice', action, places); applyActivityAssistantAction(state, 'alice', action, places);
  const next = state.activities.find(item => item.id === 'new-one');
  assert.equal(state.activities.length, 3); assert.deepEqual(state.activities[0], original);
  assert.equal(next.date, ''); assert.equal(next.meetingPoint, ''); assert.equal(next.journey, undefined); assert.deepEqual(next.participants, {}); assert.deepEqual(next.arrivedIds, []);
  assert.equal(state.groups.length, 1); assert.equal(next.groupId, 'g');
  assert.equal(state.groups[0].visibility, 'PRIVATE'); assert.equal(state.groups[0].promotionActivityIds, undefined); assert.equal(isTogetherState(state), true);
});
test('repeating a standalone appointment creates a new private one-activity space, excluding prior invitees and history', () => {
  const state = fixture(); state.activities = state.activities.filter(item => item.id === 'one'); state.groups[0].spaceType = 'ACTIVITY';
  state.activities[0].status = 'COMPLETED';
  const sourceGroup = structuredClone(state.groups[0]), sourceActivity = structuredClone(state.activities[0]), messages = structuredClone(state.messages);
  const action = { ...base('new-private'), type: 'CREATE_ACTIVITY_DRAFT', title: '다음 만남' };
  const id = applyActivityAssistantAction(state, 'alice', action, places);
  applyActivityAssistantAction(state, 'alice', action, places);
  const next = state.activities.find(item => item.id === id), target = state.groups.find(item => item.id === next.groupId);
  assert.equal(state.groups.length, 2); assert.equal(state.activities.length, 2); assert.notEqual(target.id, sourceGroup.id);
  assert.equal(target.spaceType, 'ACTIVITY'); assert.equal(target.visibility, 'PRIVATE'); assert.equal(target.promotionPublished, false);
  assert.deepEqual(target.memberIds, ['alice']); assert.deepEqual(target.managerIds, []); assert.equal(target.ownerId, 'alice'); assert.deepEqual(target.interestPlaceIds, []);
  assert.deepEqual(next.participants, {}); assert.deepEqual(next.arrivedIds, []); assert.equal(next.date, ''); assert.equal(next.endDate, ''); assert.equal(next.journey, undefined);
  assert.throws(() => getAssistantContext(state, 'host', { groupId: target.id, activityId: next.id }));
  assert.equal(getAssistantContext(state, 'alice', { groupId: target.id, activityId: next.id }).activity.id, next.id);
  assert.deepEqual(selectAssistantMessages(state, 'alice', { groupId: target.id, activityId: next.id }), []);
  assert.deepEqual(state.groups[0], sourceGroup); assert.deepEqual(state.activities[0], sourceActivity); assert.deepEqual(state.messages.slice(0, messages.length), messages);
  assert.equal(state.messages.length, messages.length + 1);
  assert.deepEqual(state.messages.at(-1).entity, { type: 'ACTIVITY', id: next.id });
  assert.equal(state.messages.at(-1).roomId, roomIdForActivity(next.id));
  assert.equal(isTogetherState(state), true);
});
test('a repeat collision cannot leave an empty private space behind', () => {
  for (const collideWithGroup of [true, false]) {
    const state = fixture(); state.activities = state.activities.filter(item => item.id === 'one'); state.groups[0].spaceType = 'ACTIVITY';
    const action = { ...base(collideWithGroup ? 'g' : 'used'), type: 'CREATE_ACTIVITY_DRAFT', title: '다음 만남' };
    if (!collideWithGroup) state.groups.push({ ...structuredClone(state.groups[0]), id: 'assistant-space-used' });
    rejected(state, action, 'alice');
  }
});
test('wire request is allowlisted and permission-bound; unconnected service never fabricates a translation', () => {
  const state = fixture(); const input = { groupId: 'g', activityId: 'one', activityRevision: 2, requestId: 'req', feature: 'language', roomId: roomIdForActivity('one'), sourceMessageIds: ['m'], sourceVersions: { m: assistantSourceVersion(state.messages[0].body), foreign: 'not-selected' }, placeIds: ['a'], locale: 'en', timeZone: 'Asia/Seoul', instruction: '토요일의 날짜 확인', privateNotes: 'must never send' };
  const request = prepareAssistantRequest(state, 'alice', input, places);
  assert.equal('privateNotes' in request, false); assert.equal('foreign' in request.sourceVersions, false); assert.equal(JSON.stringify(request).includes(state.messages[0].body), false);
  assert.equal(unconnectedAssistantResponse(request).status, 'UNCONNECTED'); assert.deepEqual(unconnectedAssistantResponse(request).sourceMessageIds, []);
  assert.throws(() => prepareAssistantRequest(state, 'outsider', input, places));
  assert.throws(() => prepareAssistantRequest(state, 'alice', { ...input, roomId: roomIdForActivity('other') }, places));
  assert.throws(() => prepareAssistantRequest(state, 'alice', { ...input, activityRevision: 1 }, places));
});
