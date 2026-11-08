import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { createPlanningPoll } from '../src/together/creationCommit.ts';
import { voteRoomPoll } from '../src/together/polls.ts';

const at = new Date('2026-11-08T03:00:00Z');
beforeEach(t => { t.mock.timers.enable({ apis: ['Date'], now: at.getTime() }); });
const dates = [{ date: '2026-11-09', time: '19:00' }, { date: '2026-11-10' }];
const labels = rows => rows.map(row => `${row.date}${row.time ? ` ${row.time}` : ' · 시각 미정'} (한국 시각)`);
const request = patch => ({ id: 'date-poll-request', groupId: 'group', activityId: 'activity', expectedRevision: 4, question: '함께할 날', options: labels(dates), dates: structuredClone(dates), ...patch });
function fixture() {
  const state = createEmptyState('host', '모임장');
  state.members.push({ id: 'member', name: '모임원' }, { id: 'outside', name: '외부인' });
  state.groups.push({ id: 'group', name: '우리 모임', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'host', memberIds: ['host', 'member'], managerIds: [], archived: false, promotionPublished: false });
  state.groups.push({ ...structuredClone(state.groups[0]), id: 'other-group', ownerId: 'outside', memberIds: ['outside'] });
  state.activities.push({ id: 'activity', groupId: 'group', title: '기존 약속', date: '2026-11-11', endDate: '2026-11-11', startTime: '15:00', meetingPoint: '기존 집합 장소', description: '', status: 'PLANNED', leadId: 'host', editorIds: [], participants: { member: 'MAYBE' }, arrivedIds: [], revision: 4 });
  state.messages.push({ id: 'human-original', roomId: 'activity:activity', authorId: 'member', body: '먼저 이야기한 원문', createdAt: '2026-11-08T01:00:00Z' });
  return state;
}
function unchangedOnReject(state, callback) { const before = structuredClone(state); assert.throws(callback); assert.deepEqual(state, before); }

test('planning date handoff persists typed dates, multiple responses, creator and the exact activity-room reference', () => {
  const state = fixture(), activities = structuredClone(state.activities), original = structuredClone(state.messages[0]);
  const input = request(), inputSnapshot = structuredClone(input);
  assert.equal(createPlanningPoll(state, 'member', input), input.id);
  const poll = state.polls[0];
  assert.equal(poll.kind, 'DATE'); assert.equal(poll.multiple, true); assert.equal(poll.creatorId, 'member');
  assert.equal(poll.createdAt, at.toISOString()); assert.equal(poll.revision, 1);
  assert.equal(poll.groupId, 'group'); assert.equal(poll.activityId, 'activity');
  assert.deepEqual(poll.options.map(({ label, date, time, voterIds }) => ({ label, date, time, voterIds })), [
    { label: labels(dates)[0], date: dates[0].date, time: '19:00', voterIds: [] },
    { label: labels(dates)[1], date: dates[1].date, time: undefined, voterIds: [] },
  ]);
  assert.deepEqual(state.messages.filter(item => item.entity).map(item => ({ roomId: item.roomId, entity: item.entity })), [{ roomId: 'activity:activity', entity: { type: 'POLL', id: input.id } }]);
  assert.deepEqual(state.activities, activities); assert.deepEqual(state.messages[0], original); assert.deepEqual(input, inputSnapshot);
  assert.equal(isTogetherState(state), true);
});

test('same request ID retries preserve option identities and one reference, while changed contents or actor cannot reuse it', () => {
  const state = fixture(), input = request(); createPlanningPoll(state, 'member', input);
  const before = structuredClone(state);
  assert.equal(createPlanningPoll(state, 'member', input), input.id); assert.deepEqual(state, before);
  unchangedOnReject(state, () => createPlanningPoll(state, 'host', input));
  unchangedOnReject(state, () => createPlanningPoll(state, 'member', { ...input, question: '다른 질문' }));
  unchangedOnReject(state, () => createPlanningPoll(state, 'member', { ...input, dates: [...dates].reverse(), options: labels([...dates].reverse()) }));
  assert.equal(state.polls.length, 1); assert.equal(state.messages.filter(item => item.entity).length, 1);
});

test('group-wide and activity scopes stay independent; outsiders, blocked, stale and unavailable scopes reject atomically', () => {
  const state = fixture(); createPlanningPoll(state, 'member', request({ id: 'group-dates', activityId: undefined, expectedRevision: undefined }));
  assert.equal(state.polls[0].activityId, undefined); assert.equal(state.messages.at(-1).roomId, 'group:group');
  unchangedOnReject(state, () => createPlanningPoll(state, 'outside', request()));
  unchangedOnReject(state, () => createPlanningPoll(state, 'outside', request({ groupId: 'other-group' })));
  unchangedOnReject(state, () => createPlanningPoll(state, 'member', request({ activityId: 'missing' })));
  unchangedOnReject(state, () => createPlanningPoll(state, 'member', request({ expectedRevision: 3 })));
  state.groups[0].blockedMemberIds = ['member']; unchangedOnReject(state, () => createPlanningPoll(state, 'member', request()));
  state.groups[0].blockedMemberIds = []; state.groups[0].archived = true; unchangedOnReject(state, () => createPlanningPoll(state, 'member', request()));
  state.groups[0].archived = false; state.activities[0].status = 'CANCELLED'; unchangedOnReject(state, () => createPlanningPoll(state, 'member', request()));
});

test('mismatched labels, dates, times, duplicate dates and past/impossible dates fail before any poll or message changes', () => {
  const invalidRows = [
    [{ date: '2026-02-30' }, { date: '2026-11-10' }],
    [{ date: '2026-11-07' }, { date: '2026-11-10' }],
    [{ date: '2026-11-09', time: '25:00' }, { date: '2026-11-10' }],
    [{ date: '2026-11-09' }, { date: '2026-11-09' }],
  ];
  for (const rows of invalidRows) { const state = fixture(); unchangedOnReject(state, () => createPlanningPoll(state, 'member', request({ dates: rows, options: labels(rows) }))); }
  for (const patch of [{ options: ['다른 날짜 안내', labels(dates)[1]] }, { dates: dates.slice(0, 1) }, { dates: [] }, { options: labels(dates).reverse() }]) {
    const state = fixture(); unchangedOnReject(state, () => createPlanningPoll(state, 'member', request(patch)));
  }
});

test('date responses can select multiple candidates and cancel without changing an activity, RSVP, other votes or human originals', () => {
  const state = fixture(), activities = structuredClone(state.activities), original = structuredClone(state.messages[0]);
  createPlanningPoll(state, 'member', request()); const poll = state.polls[0];
  voteRoomPoll(state, 'host', poll.id, poll.options[0].id, at);
  for (const option of poll.options) voteRoomPoll(state, 'member', poll.id, option.id, at);
  assert.deepEqual(poll.options.map(item => item.voterIds), [['host', 'member'], ['member']]);
  voteRoomPoll(state, 'member', poll.id, null, at); assert.deepEqual(poll.options.map(item => item.voterIds), [['host'], []]);
  assert.deepEqual(state.activities, activities); assert.deepEqual(state.messages[0], original); assert.equal(isTogetherState(state), true);
});

test('legacy string-only polls remain valid single-choice records and plain retries never infer or backfill typed dates', () => {
  const state = fixture(), input = request({ dates: undefined });
  state.polls.push({ id: input.id, groupId: 'group', activityId: 'activity', question: input.question,
    options: input.options.map((label, index) => ({ id: `legacy-${index}`, label, voterIds: [] })), closed: false });
  const original = structuredClone(state.polls[0]); assert.equal(isTogetherState(state), true);
  createPlanningPoll(state, 'member', input); assert.deepEqual(state.polls[0], original);
  assert.equal(state.polls[0].kind, undefined); assert.equal(state.polls[0].multiple, undefined); assert.equal(state.polls[0].creatorId, undefined);
  unchangedOnReject(state, () => createPlanningPoll(state, 'member', request()));
  voteRoomPoll(state, 'member', input.id, 'legacy-0', at); voteRoomPoll(state, 'member', input.id, 'legacy-1', at);
  assert.deepEqual(state.polls[0].options.map(option => option.voterIds), [[], ['member']]);
  assert.equal(state.polls[0].options[0].date, undefined); assert.equal(isTogetherState(state), true);
});
