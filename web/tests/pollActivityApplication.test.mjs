import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { confirmRoomPoll, createRoomPoll } from '../src/together/polls.ts';
import { applyPollActivityApplication, previewPollActivityApplication } from '../src/together/pollActivityApplication.ts';

const at = new Date('2026-11-10T03:00:00Z');
const scope = { groupId: 'group', activityId: 'activity' };
const place = { id: 'cafe', name: '약속 카페', kind: 'CAFE', area: '부산', address: '부산 검수로 1', lat: 35, lng: 129, image: '', description: '', duration: 30, note: '' };
function fixture() {
  const state = createEmptyState('owner', '운영자');
  state.members.push({ id: 'editor', name: '일정 담당자' }, { id: 'member', name: '일반 멤버' });
  state.groups.push({ id: 'group', name: '우리 모임', kind: 'FRIENDS', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'owner', memberIds: ['owner', 'editor', 'member'], managerIds: [], archived: false, promotionPublished: true, promotionActivityIds: ['activity', 'other'], promotionActivitySnapshots: [{ id: 'activity' }, { id: 'other' }] });
  state.activities.push({ id: 'activity', groupId: 'group', title: '카페에서 만나기', date: '2026-11-20', endDate: '', startTime: '13:00', meetingPoint: '기존에 정한 곳', description: '', status: 'PLANNED', leadId: 'editor', editorIds: [], participants: { member: 'JOINED', editor: 'MAYBE' }, arrivedIds: ['member'], revision: 4 });
  state.messages.push({ id: 'message', roomId: 'activity:activity', authorId: 'member', body: '남길 대화', createdAt: at.toISOString() });
  state.tasks.push({ id: 'task', groupId: 'group', activityId: 'activity', title: '준비', completed: true });
  return state;
}
function confirmed(state, kind = 'DATE') {
  const poll = createRoomPoll(state, 'member', scope, { id: 'poll', question: '언제 어디서 만날까요?', kind, options: kind === 'DATE' ? [{ date: '2026-11-21', time: '14:30' }, { date: '2026-11-22' }] : [{ label: place.name, placeId: place.id }, { label: '다른 곳' }] }, at);
  confirmRoomPoll(state, 'owner', poll.id, poll.options[0].id, at);
  return poll;
}
function review(state, places = [place]) { return previewPollActivityApplication(state, 'editor', { ...scope, pollId: 'poll' }, places, at); }
function journey(days = 3) { return { id: 'route', purpose: 'PLAN', title: '모임 여행', region: '부산', duration: '2박3일', dateRange: '2026-11-20 ~ 2026-11-22', startDate: '2026-11-20', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: '', story: '', tags: [], saves: 0, author: '담당자', isMine: false, days: Array.from({ length: days }, (_, index) => ({ dayId: `day-${index}`, day: index + 1, date: `2026-11-${20 + index}`, title: '', story: '', places: index ? [] : [{ ...place, visitId: 'visit' }], blocks: index ? [] : [{ id: 'block', type: 'PLACE', placeId: place.id, visitId: 'visit' }] })) }; }

test('confirmed typed date is compared explicitly; applying preserves participation, chats and preparation', () => {
  const state = fixture(), poll = confirmed(state), before = structuredClone(state), preview = review(state);
  assert.deepEqual(state, before, 'preview is read only');
  assert.equal(preview.kind, 'DATE'); assert.match(preview.beforeLabel, /2026-11-20.*13:00/); assert.match(preview.afterLabel, /2026-11-21.*14:30/);
  applyPollActivityApplication(state, 'editor', preview, [place], at);
  assert.equal(state.activities[0].date, '2026-11-21'); assert.equal(state.activities[0].startTime, '14:30'); assert.equal(state.activities[0].revision, 5);
  assert.deepEqual(state.activities[0].participants, before.activities[0].participants); assert.deepEqual(state.activities[0].arrivedIds, before.activities[0].arrivedIds);
  assert.deepEqual(state.messages, before.messages); assert.deepEqual(state.tasks, before.tasks); assert.deepEqual(state.polls, before.polls); assert.equal(poll.confirmedOptionId, preview.optionId);
  assert.deepEqual(state.groups[0].promotionActivityIds, ['other']); assert.deepEqual(state.groups[0].promotionActivitySnapshots, [{ id: 'other' }]);
});

test('DATE with no time explicitly clears old time and can initialize an undated appointment', () => {
  const state = fixture(); state.activities[0].date = ''; const poll = confirmed(state); poll.confirmedOptionId = poll.options[1].id;
  const preview = review(state); assert.equal(preview.after.startTime, ''); assert.match(preview.notes.join(''), /時刻|시각/);
  applyPollActivityApplication(state, 'editor', preview, [], at);
  assert.equal(state.activities[0].date, '2026-11-22'); assert.equal(state.activities[0].startTime, undefined);
});

test('multi-DAY date application moves only DAY dates and keeps route identity, stops, blocks and duration', () => {
  const state = fixture(); state.activities[0].journey = journey(); state.activities[0].endDate = '2026-11-22'; confirmed(state);
  const before = structuredClone(state.activities[0].journey), preview = review(state);
  assert.equal(preview.after.endDate, '2026-11-23'); assert.match(preview.notes.join(''), /3일/);
  applyPollActivityApplication(state, 'editor', preview, [], at);
  const route = state.activities[0].journey;
  assert.equal(route.id, before.id); assert.equal(route.startDate, '2026-11-21'); assert.deepEqual(route.days.map(day => day.date), ['2026-11-21', '2026-11-22', '2026-11-23']);
  assert.deepEqual(route.days.map(day => day.dayId), before.days.map(day => day.dayId)); assert.deepEqual(route.days.map(day => day.places), before.days.map(day => day.places)); assert.deepEqual(route.days.map(day => day.blocks), before.days.map(day => day.blocks));
});

test('a multi-day appointment without a route retains the existing date span', () => {
  const state = fixture(); state.activities[0].endDate = '2026-11-24'; confirmed(state);
  const preview = review(state); assert.equal(preview.after.endDate, '2026-11-25');
  applyPollActivityApplication(state, 'editor', preview, [], at); assert.equal(state.activities[0].endDate, '2026-11-25');
});

test('fixed reservations block a day shift and inconsistent booked DAY dates even when activity date is unchanged', () => {
  for (const currentDate of ['2026-11-20', '2026-11-21']) {
    const state = fixture(); state.activities[0].journey = journey(); state.activities[0].journey.days[0].places[0].bookingFixed = true; state.activities[0].date = currentDate; confirmed(state);
    const before = structuredClone(state); assert.throws(() => review(state), /예약 고정/); assert.deepEqual(state, before);
  }
});

test('confirmed typed place changes only meeting venue, leaving route, candidates and RSVP untouched', () => {
  const state = fixture(); state.activities[0].journey = journey(); state.activities[0].placeCandidateIds = ['cafe']; confirmed(state, 'TEXT'); const before = structuredClone(state), preview = review(state);
  assert.equal(preview.kind, 'PLACE'); assert.equal(preview.afterLabel, '약속 카페 · 부산 검수로 1');
  applyPollActivityApplication(state, 'editor', preview, [place], at);
  assert.equal(state.activities[0].venuePlaceId, 'cafe'); assert.equal(state.activities[0].meetingPoint, preview.afterLabel);
  for (const field of ['date', 'endDate', 'startTime', 'journey', 'placeCandidateIds', 'participants', 'arrivedIds']) assert.deepEqual(state.activities[0][field], before.activities[0][field]);
});

test('confirmed generic text, guessed place labels, unconfirmed polls and malformed typed options never apply', () => {
  for (const change of [
    poll => { poll.confirmedOptionId = undefined; },
    poll => { poll.closed = false; },
    poll => { poll.kind = 'TEXT'; },
    poll => { poll.options[0].date = '2026-02-30'; },
    poll => { poll.options[0].time = '25:00'; },
    poll => { poll.options[0].placeId = 'cafe'; },
    poll => { poll.options[1].id = poll.options[0].id; },
    poll => { poll.options[0].label = ''; },
    poll => { poll.options[0].voterIds = null; },
  ]) {
    const state = fixture(), poll = confirmed(state); change(poll); const before = structuredClone(state);
    assert.throws(() => review(state)); assert.deepEqual(state, before);
  }
  const state = fixture(), poll = confirmed(state, 'TEXT'); delete poll.options[0].placeId; poll.options[0].label = `${place.name} · ${place.address}`;
  assert.throws(() => review(state), /텍스트 후보/);
});

test('the current exact room and appointment must match; group-wide poll is not assigned implicitly', () => {
  for (const change of [
    state => { state.polls[0].activityId = undefined; },
    state => { state.polls[0].groupId = 'other'; },
    state => { state.activities[0].groupId = 'other'; },
    state => { state.polls = []; },
    state => { state.activities = []; },
  ]) { const state = fixture(); confirmed(state); change(state); assert.throws(() => review(state)); }
});

test('ordinary poll creator cannot edit schedule; revoked, blocked and missing identities fail fresh', () => {
  const state = fixture(); confirmed(state);
  assert.throws(() => previewPollActivityApplication(state, 'member', { ...scope, pollId: 'poll' }, [place], at), /담당자/);
  for (const change of [
    state => { state.activities[0].leadId = 'owner'; },
    state => { state.groups[0].memberIds = ['owner', 'member']; },
    state => { state.groups[0].blockedMemberIds = ['editor']; },
    state => { state.members = state.members.filter(member => member.id !== 'editor'); },
    state => { state.groups[0].archived = true; },
  ]) {
    const fresh = fixture(); confirmed(fresh); const preview = review(fresh); change(fresh); const before = structuredClone(fresh);
    assert.throws(() => applyPollActivityApplication(fresh, 'editor', preview, [place], at)); assert.deepEqual(fresh, before);
  }
});

test('past, completed, cancelled and newly-expired winning dates are read only', () => {
  for (const change of [
    state => { state.activities[0].status = 'COMPLETED'; },
    state => { state.activities[0].status = 'CANCELLED'; },
    state => { state.activities[0].date = '2026-11-01'; state.activities[0].endDate = '2026-11-03'; },
    state => { state.polls[0].options[0].date = '2026-11-09'; },
  ]) { const state = fixture(); confirmed(state); change(state); assert.throws(() => review(state)); }
  const state = fixture(); state.activities[0].date = ''; confirmed(state); const preview = review(state);
  assert.throws(() => applyPollActivityApplication(state, 'editor', preview, [place], new Date('2026-11-21T15:00:00Z')), /오늘 이후/);
});

test('poll/activity revisions and same-revision canonical content changes invalidate the reviewed comparison', () => {
  for (const change of [
    state => { state.polls[0].revision++; },
    state => { state.activities[0].revision++; },
    state => { state.polls[0].question += ' 변경'; },
    state => { state.polls[0].options[0].date = '2026-11-23'; },
    state => { state.polls[0].confirmedOptionId = state.polls[0].options[1].id; },
    state => { state.activities[0].meetingPoint = '새로 정한 곳'; },
  ]) {
    const state = fixture(); confirmed(state); const preview = review(state); change(state); const before = structuredClone(state);
    assert.throws(() => applyPollActivityApplication(state, 'editor', preview, [place], at), /변경/); assert.deepEqual(state, before);
  }
});

test('withdrawn or changed catalogue places require a new review; another activity private snapshot cannot resolve them', () => {
  const state = fixture(); confirmed(state, 'TEXT'); const preview = review(state), before = structuredClone(state);
  assert.throws(() => applyPollActivityApplication(state, 'editor', preview, [], at), /장소 정보/);
  assert.throws(() => applyPollActivityApplication(state, 'editor', preview, [{ ...place, address: '변경된 주소' }], at), /변경/);
  state.activities.push({ ...structuredClone(state.activities[0]), id: 'other', journey: journey() });
  assert.throws(() => review(state, []), /장소 정보/); state.activities.pop(); assert.deepEqual(state, before);
});

test('tampered preview values, actor, option or revision cannot become a write', () => {
  for (const tamper of [
    preview => { preview.after.date = '2027-01-01'; },
    preview => { preview.actorId = 'owner'; },
    preview => { preview.optionId = 'different'; },
    preview => { preview.activityRevision = '4'; },
    preview => { preview.pollRevision = NaN; },
  ]) {
    const state = fixture(); confirmed(state); const preview = review(state); tamper(preview); const before = structuredClone(state);
    assert.throws(() => applyPollActivityApplication(state, 'editor', preview, [place], at)); assert.deepEqual(state, before);
  }
});

test('applying twice cannot increment a revision or re-apply a previous public projection', () => {
  const state = fixture(); confirmed(state); const preview = review(state);
  applyPollActivityApplication(state, 'editor', preview, [place], at); const applied = structuredClone(state);
  assert.throws(() => applyPollActivityApplication(state, 'editor', preview, [place], at)); assert.deepEqual(state, applied);
  assert.throws(() => review(state), /이미 일정/);
});

test('an already-applied single DAY with omitted same-day end does not show a meaningless identical comparison', () => {
  const state = fixture(); confirmed(state); state.activities[0].date = '2026-11-21'; state.activities[0].startTime = '14:30';
  state.activities[0].journey = journey(1); state.activities[0].journey.days[0].date = '2026-11-21';
  const before = structuredClone(state); assert.throws(() => review(state), /이미 일정/); assert.deepEqual(state, before);
});
