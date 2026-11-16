import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { activityDayKey, applyActivityPlaceAction, resolveScopedPollPlace, selectActivityPlaces } from '../src/together/activityPlaces.ts';
import { applyActivityAssistantAction, selectAssistantPlaces } from '../src/together/activityAssistant.ts';
import { createRoomPoll, editRoomPoll, isTogetherPollFields, pollInputFrom } from '../src/together/polls.ts';

const at = new Date('2026-11-09T12:00:00+09:00');
const place = (id, kind = 'FOOD', extra = {}) => ({ id, kind, name: '같은 상호', area: '부산', address: `${id} 지점 주소`, lat: 35.1, lng: 129.1, image: '', description: '공개 장소 소개', note: '개인 비밀 메모', duration: '1시간', bookingFixed: true, time: '09:00', ...extra });
const places = [place('food'), place('cafe', 'CAFE'), place('hotel', 'STAY'), place('private', 'CAFE', { personal: true })];
const scope = { groupId: 'g', activityId: 'a' };
function fixture() {
  const state = createEmptyState('host', '모임장');
  state.members.push({ id: 'member', name: '모임원' }, { id: 'other', name: '다른 모임원' });
  state.groups.push({ id: 'g', name: '식사 모임', kind: 'FRIENDS', region: '부산', introduction: '', cover: '', ownerId: 'host', memberIds: ['host', 'member'], managerIds: [], archived: false, visibility: 'PRIVATE', promotionPublished: false, interestPlaceIds: ['hotel'] });
  state.groups.push({ ...structuredClone(state.groups[0]), id: 'foreign', memberIds: ['other'], ownerId: 'other' });
  state.activities.push({ id: 'a', groupId: 'g', kind: 'MEETUP', title: '음식점과 카페 약속', date: '2026-11-10', endDate: '2026-11-10', meetingPoint: '기존 장소', description: '', status: 'PLANNED', leadId: 'host', editorIds: [], participants: { member: 'MAYBE' }, arrivedIds: [], revision: 1 });
  state.activities.push({ ...structuredClone(state.activities[0]), id: 'sibling' });
  return state;
}
function apply(state, action, actor = 'host') { return applyActivityPlaceAction(state, actor, { ...scope, expectedRevision: state.activities[0].revision, ...action }, places, at); }
function reject(state, action, actor = 'host') { const before = structuredClone(state); assert.throws(() => apply(state, action, actor)); assert.deepEqual(state, before); }

test('food, cafe and hotel are addable without a landmark, scoped only to the chosen appointment', () => {
  const state = fixture(), source = structuredClone(places), sibling = structuredClone(state.activities[1]);
  state.groups[0].promotionActivityIds = ['a'];
  for (const id of ['food', 'cafe', 'hotel']) apply(state, { type: 'ADD_CANDIDATE', placeId: id }, 'member');
  assert.deepEqual(selectActivityPlaces(state, 'host', scope, places, at).candidates.map(item => item.id), ['food', 'cafe', 'hotel']);
  assert.deepEqual(state.activities[1], sibling); assert.deepEqual(state.groups[0].interestPlaceIds, ['hotel']); assert.deepEqual(places, source);
  assert.equal(state.activities[0].journey, undefined); assert.equal(state.activities[0].meetingPoint, '기존 장소');
  assert.deepEqual(state.groups[0].promotionActivityIds, ['a']);
  reject(state, { type: 'ADD_CANDIDATE', placeId: 'private' }); assert.equal(isTogetherState(state), true);
});

test('venue confirmation requires editor and fresh revision, preserving RSVP and reservations', () => {
  const state = fixture(), rsvp = structuredClone(state.activities[0].participants);
  reject(state, { type: 'SET_VENUE', placeId: 'cafe' }, 'member');
  reject(state, { type: 'SET_VENUE', placeId: 'cafe', expectedRevision: 9 });
  apply(state, { type: 'SET_VENUE', placeId: 'cafe' });
  assert.equal(state.activities[0].venuePlaceId, 'cafe'); assert.equal(state.activities[0].meetingPoint, '같은 상호 · cafe 지점 주소');
  assert.deepEqual(state.activities[0].participants, rsvp); assert.equal(state.activities[0].journey, undefined);
  assert.equal(state.activities[1].venuePlaceId, undefined);
});

test('confirmed route visits have new visit IDs and allowlisted venue data, and reorder by visit rather than duplicate place ID', () => {
  const state = fixture();
  for (const id of ['food', 'cafe', 'food']) apply(state, { type: 'ADD_STOP', placeId: id });
  const day = state.activities[0].journey.days[0], key = activityDayKey(day, 0), visits = day.places.map(item => item.visitId);
  assert.equal(new Set(visits).size, 3); assert.deepEqual(day.places.map(item => item.note), ['', '', '']);
  assert.ok(day.places.every(item => item.bookingFixed === undefined && item.time === undefined));
  apply(state, { type: 'MOVE_STOP', dayId: key, visitId: visits[2], direction: -1 });
  assert.deepEqual(day.places.map(item => item.visitId), [visits[0], visits[2], visits[1]]);
  assert.deepEqual(day.blocks.map(item => item.visitId), [visits[0], visits[2], visits[1]]);
  apply(state, { type: 'REMOVE_STOP', dayId: key, visitId: visits[2] });
  assert.deepEqual(day.places.map(item => item.visitId), [visits[0], visits[1]]);
  assert.equal(isTogetherState(state), true);
  day.places[0].bookingFixed = true;
  reject(state, { type: 'REMOVE_STOP', dayId: key, visitId: visits[0] });
  reject(state, { type: 'MOVE_STOP', dayId: key, visitId: visits[1], direction: -1 });
});

test('current membership, activity ownership, archive, status and past day are revalidated before every mutation', () => {
  for (const change of [s => s.groups[0].memberIds = ['host'], s => s.groups[0].blockedMemberIds = ['member'], s => s.groups[0].archived = true, s => s.activities[0].status = 'CANCELLED', s => s.activities[0].status = 'COMPLETED', s => s.activities[0].endDate = '2026-11-08', s => s.activities[0].groupId = 'foreign']) {
    const state = fixture(); change(state); reject(state, { type: 'ADD_CANDIDATE', placeId: 'food' }, 'member');
  }
  const state = fixture(); reject(state, { type: 'ADD_CANDIDATE', placeId: 'food' }, 'other');
  reject(state, { type: 'ADD_STOP', placeId: 'food', dayId: 'other-day' });
  assert.throws(() => selectActivityPlaces(state, 'host', { groupId: 'foreign', activityId: 'a' }, places, at));
});

test('the current appointment cannot read sibling private stops or auto-inherit group candidate IDs', () => {
  const state = fixture(); state.activities[1].journey = { days: [{ places: [place('sibling-private', 'STAY', { personal: true })] }] };
  assert.deepEqual(selectAssistantPlaces(state, 'member', scope, places), []);
  assert.deepEqual(selectAssistantPlaces(state, 'member', { groupId: 'g' }, places).map(item => item.id), ['hotel']);
  reject(state, { type: 'ADD_CANDIDATE', placeId: 'sibling-private' });
  apply(state, { type: 'ADD_CANDIDATE', placeId: 'cafe' });
  assert.deepEqual(selectAssistantPlaces(state, 'member', scope, places).map(item => item.id), ['cafe']);
});

test('place poll preserves exact branch IDs through creation, edit and roundtrip; detail never guesses a same-name branch', () => {
  const state = fixture(); state.activities[0].placeCandidateIds = ['food', 'cafe'];
  const poll = createRoomPoll(state, 'member', scope, { id: 'poll', question: '어디서 만날까요?', options: places.slice(0, 2).map(item => ({ label: `${item.name} · ${item.address}`, placeId: item.id })) }, at);
  assert.deepEqual(pollInputFrom(poll).options.map(item => item.placeId), ['food', 'cafe']);
  editRoomPoll(state, 'member', poll.id, { ...pollInputFrom(poll), question: '어디로 갈까요?' }, poll.revision, at);
  assert.equal(resolveScopedPollPlace(state, 'member', poll, poll.options[1].id, places).id, 'cafe');
  assert.equal(resolveScopedPollPlace(state, 'other', poll, poll.options[1].id, places), undefined);
  poll.options[1].placeId = 'withdrawn'; assert.equal(resolveScopedPollPlace(state, 'member', poll, poll.options[1].id, places), undefined);
  delete poll.options[1].placeId; assert.equal(resolveScopedPollPlace(state, 'member', poll, poll.options[1].id, places).id, 'cafe');
  poll.options[1].label = '같은 상호'; assert.equal(resolveScopedPollPlace(state, 'member', poll, poll.options[1].id, places), undefined);
  poll.options[1].placeId = ''; assert.equal(isTogetherPollFields(poll), false);
});

test('assistant-created place poll carries exact selected IDs and leaves appointment decisions separate', () => {
  const state = fixture(); state.activities[0].placeCandidateIds = ['food', 'cafe'];
  // This assistant path also shares a live chat card, whose current-day guard has no clock parameter.
  state.activities[0].date = state.activities[0].endDate = '2099-11-10';
  const before = structuredClone(state.activities);
  applyActivityAssistantAction(state, 'member', { ...scope, expectedRevision: 1, id: 'assistant-place', type: 'CREATE_POLL', question: '식사 후 어디로 갈까요?', placeIds: ['food', 'cafe'] }, places);
  assert.deepEqual(state.polls[0].options.map(item => item.placeId), ['food', 'cafe']);
  assert.deepEqual(state.activities, before); assert.equal(isTogetherState(state), true);
});
