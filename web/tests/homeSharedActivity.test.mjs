import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectPersonalRoutes, savePersonalRoute } from '../src/together/personalRoutes.ts';
import { selectHomeSharedActivity } from '../src/community/homeSharedActivity.ts';

const at = new Date('2026-11-16T03:00:00Z');
const place = (id, extra = {}) => ({ id, visitId: `visit-${id}`, kind: 'FOOD', name: `${id} 식당`, area: '부산', address: `${id} 공개 주소`, image: '/food.jpg', description: '', note: '개인 메모', duration: '1시간', ...extra });
const places = [place('one'), place('two'), place('three')];
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'other', name: '다른 멤버' });
  state.groups.push({ id: 'g', name: '비공개 가족 모임', kind: 'FAMILY', region: '부산', introduction: '비공개 소개', cover: '/private-cover.jpg', visibility: 'PRIVATE', ownerId: 'me', memberIds: ['me', 'other'], managerIds: [], archived: false, promotionPublished: false });
  state.activities.push(activity('next', '2026-11-20'));
  return state;
}
function activity(id, date, extra = {}) {
  return { id, groupId: 'g', title: `내 약속 ${id}`, date, endDate: '', startTime: '12:00', meetingPoint: '비공개 집합 안내', description: '비공개 설명', status: 'PLANNED', leadId: 'me', editorIds: [], participants: { me: 'JOINED', other: 'MAYBE' }, arrivedIds: [], revision: 1,
    journey: { id: `journey-${id}`, title: '공동 동선', region: '부산', dateRange: '', duration: '', cover: '', summary: '', story: '비공개 이야기', tags: [], author: '나', visibility: 'PRIVATE', status: 'PLANNING', saves: 0, purpose: 'PLAN', days: [{ dayId: `day-${id}`, day: 1, date, title: '함께할 날', story: '', places: structuredClone(places), blocks: [] }] }, ...extra };
}
function save(state, actorId = 'me', activityId = 'next') {
  const scope = { groupId: 'g', activityId }, selected = selectPersonalRoutes(state, actorId, scope, places, at);
  savePersonalRoute(state, actorId, scope, { startKey: selected.route.stops[0].key, endKey: selected.route.stops[1].key, expectedRevision: selected.own?.revision || 0, routeVersion: selected.route.version }, places, at);
}

test('Home picks the next accessible dated shared route and returns a small destination without private details or RSVP mutation', () => {
  const state = fixture(); state.activities.push(activity('earlier', '2026-11-18'), activity('later', '2026-11-25'));
  const before = structuredClone(state), selected = selectHomeSharedActivity(state, 'me', places, at);
  assert.deepEqual(selected, { activityId: 'earlier', title: '내 약속 earlier', date: '2026-11-18', stopCount: 3, ownStopCount: 0, needsReview: false });
  for (const value of ['비공개 집합 안내', '비공개 설명', '비공개 이야기', '개인 메모', 'memberIds', 'participants', 'originPlaceId']) assert.equal(JSON.stringify(selected).includes(value), false, value);
  assert.deepEqual(state, before);
});

test('same-day shared routes prefer the earlier start time, rather than activity ID order', () => {
  const state = fixture();
  state.activities = [activity('a-late', '2026-11-20', { startTime: '19:00' }), activity('z-early', '2026-11-20', { startTime: '09:00' })];
  assert.equal(selectHomeSharedActivity(state, 'me', places, at).activityId, 'z-early');
});

test('no-route activities are skipped and an undated route remains available after dated routes', () => {
  const state = fixture();
  state.activities.push(activity('no-route', '2026-11-17', { journey: undefined }), activity('undated', ''));
  assert.equal(selectHomeSharedActivity(state, 'me', places, at).activityId, 'next');
  state.activities = state.activities.filter(item => item.id !== 'next');
  assert.equal(selectHomeSharedActivity(state, 'me', places, at).activityId, 'undated');
  state.activities = [activity('venue', '2026-11-20', { journey: undefined, venuePlaceId: 'two' })];
  assert.equal(selectHomeSharedActivity(state, 'me', places, at).stopCount, 1, 'a current public meeting venue is a canonical one-stop route');
  assert.equal(selectHomeSharedActivity(state, 'me', [], at), null, 'a missing public venue cannot become a route');
});

test('guest, unknown, removed, blocked and nonmember actors cannot receive a private Home route', () => {
  assert.equal(selectHomeSharedActivity(fixture(), '', places, at), null);
  assert.equal(selectHomeSharedActivity(fixture(), 'unknown', places, at), null);
  for (const change of [state => state.groups[0].memberIds = ['other'], state => state.groups[0].blockedMemberIds = ['me'], state => state.members = state.members.filter(item => item.id !== 'me'), state => state.activities[0].groupId = 'missing']) {
    const state = fixture(); change(state); const before = structuredClone(state);
    assert.equal(selectHomeSharedActivity(state, 'me', places, at), null); assert.deepEqual(state, before);
  }
});

test('cancelled, completed, past, archived, expired and trashed spaces cannot become the next actionable Home route', () => {
  for (const change of [state => state.activities[0].status = 'CANCELLED', state => state.activities[0].status = 'COMPLETED',
    state => { state.activities[0].date = '2026-11-15'; state.activities[0].journey.days[0].date = '2026-11-15'; },
    state => state.groups[0].archived = true,
    state => state.groups[0].temporaryRoom = { purpose: 'DINNER', expiresAt: at.toISOString() },
    state => state.groups[0].temporaryRoom = { purpose: 'DINNER', closedAt: '2026-11-16T01:00:00.000Z', closedBy: 'me', closeReason: 'MANUAL', disposition: 'TRASH', trashedAt: '2026-11-16T01:00:00.000Z' }]) {
    const state = fixture(); change(state); const before = structuredClone(state);
    assert.equal(selectHomeSharedActivity(state, 'me', places, at), null); assert.deepEqual(state, before);
  }
});

test('a trashed or invalid shared journey is not offered as an actionable Home route', () => {
  for (const change of [state => state.activities[0].journey.trash = { trashedAt: at.toISOString(), expiresAt: '2027-05-16T03:00:00.000Z' }, state => delete state.activities[0].journey.days[0].dayId]) {
    const state = fixture(); change(state);
    assert.equal(selectHomeSharedActivity(state, 'me', places, at), null);
  }
});

test('review status applies only to the actor saved segment, never merely to another member response', () => {
  const state = fixture(); save(state, 'other');
  state.activities[0].startTime = '13:00';
  let selected = selectHomeSharedActivity(state, 'me', places, at);
  assert.equal(selected.ownStopCount, 0); assert.equal(selected.needsReview, false);
  save(state);
  selected = selectHomeSharedActivity(state, 'me', places, at);
  assert.equal(selected.ownStopCount, 2); assert.equal(selected.needsReview, false);
  state.activities[0].startTime = '14:00';
  selected = selectHomeSharedActivity(state, 'me', places, at);
  assert.equal(selected.ownStopCount, 2); assert.equal(selected.needsReview, true);
  assert.equal(state.activities[0].participants.me, 'JOINED');
  delete state.personalRoutes.find(item => item.userId === 'me').joinTime;
  assert.equal(selectHomeSharedActivity(state, 'me', places, at).needsReview, true, 'no inferred join time clears the review');
});
