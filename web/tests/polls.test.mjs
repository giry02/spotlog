import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { canManagePoll, canVotePoll, closeRoomPoll, confirmRoomPoll, createRoomPoll, editRoomPoll, isPollClosed, isTogetherPollFields, pollInputFrom, voteRoomPoll } from '../src/together/polls.ts';

const at = new Date('2026-11-08T03:00:00Z');
const scope = { groupId: 'group' };
const input = patch => ({ id: 'poll-request', question: '어디서 만날까요?', options: [{ label: '카페 A' }, { label: '카페 B' }], ...patch });
function fixture() {
  const state = createEmptyState('host', '운영자');
  state.members.push({ id: 'member', name: '모임원' }, { id: 'other', name: '다른 모임원' }, { id: 'outside', name: '외부' });
  state.groups.push({ id: 'group', name: '모임', kind: 'HOBBY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'host', memberIds: ['host', 'member', 'other'], managerIds: [], archived: false, promotionPublished: false });
  state.groups.push({ ...structuredClone(state.groups[0]), id: 'elsewhere', memberIds: ['outside'], ownerId: 'outside' });
  state.activities.push({ id: 'activity', groupId: 'group', kind: 'MEETUP', title: '일정', date: '2026-11-09', endDate: '2026-11-09', meetingPoint: '직접 확인한 곳', description: '', status: 'PLANNED', leadId: 'host', editorIds: ['other'], participants: {}, arrivedIds: [], revision: 1 });
  return state;
}
const create = (state, patch = {}, actor = 'member', room = scope) => createRoomPoll(state, actor, room, input(patch), at);
test('any current member can create an exact-room poll without changing itinerary, attendance or source IDs', () => {
  const state = fixture(), before = structuredClone(state.activities);
  const poll = create(state, {}, 'member', { ...scope, activityId: 'activity' });
  assert.equal(poll.creatorId, 'member'); assert.equal(poll.revision, 1); assert.equal(poll.kind, 'TEXT');
  assert.equal(poll.multiple, false); assert.equal(poll.activityId, 'activity'); assert.equal(isTogetherPollFields(poll), true);
  assert.deepEqual(state.activities, before); assert.equal(state.messages.length, 0);
});
test('single-choice replaces only this member selection, repeated same selection is stable, and cancellation clears only their votes', () => {
  const state = fixture(), poll = create(state), [a, b] = poll.options;
  voteRoomPoll(state, 'other', poll.id, b.id, at);
  voteRoomPoll(state, 'member', poll.id, a.id, at); const revision = poll.revision;
  voteRoomPoll(state, 'member', poll.id, a.id, at); assert.equal(poll.revision, revision);
  voteRoomPoll(state, 'member', poll.id, b.id, at);
  assert.deepEqual(a.voterIds, []); assert.deepEqual(b.voterIds, ['other', 'member']);
  voteRoomPoll(state, 'member', poll.id, null, at); assert.deepEqual(b.voterIds, ['other']);
});
test('multiple-choice toggles each option independently and explicit cancellation removes all this actor responses', () => {
  const state = fixture(), poll = create(state, { multiple: true, anonymous: true }), [a, b] = poll.options;
  voteRoomPoll(state, 'member', poll.id, a.id, at); voteRoomPoll(state, 'member', poll.id, b.id, at);
  assert.deepEqual(a.voterIds, ['member']); assert.deepEqual(b.voterIds, ['member']);
  voteRoomPoll(state, 'member', poll.id, a.id, at); assert.deepEqual(a.voterIds, []); assert.deepEqual(b.voterIds, ['member']);
  voteRoomPoll(state, 'member', poll.id, null, at); assert.deepEqual(b.voterIds, []);
  assert.equal(poll.anonymous, true);
});
test('date polls persist typed dates and optional times while invalid or duplicate candidates fail without mutation', () => {
  const state = fixture();
  const poll = create(state, { kind: 'DATE', options: [{ date: '2026-11-09', time: '19:00' }, { date: '2026-11-10' }] });
  assert.equal(poll.options[0].date, '2026-11-09'); assert.equal(poll.options[0].time, '19:00');
  assert.equal(poll.options[1].time, undefined); assert.match(poll.options[0].label, /한국 시각/);
  for (const options of [[{ date: '2026-02-30' }, { date: '2026-11-09' }], [{ date: '2026-11-07' }, { date: '2026-11-09' }], [{ date: '2026-11-09', time: '25:00' }, { date: '2026-11-10' }], [{ date: '2026-11-09' }, { date: '2026-11-09' }]]) {
    const before = structuredClone(state); assert.throws(() => create(state, { id: 'bad', kind: 'DATE', options })); assert.deepEqual(state, before);
  }
});
test('automatic deadline is inclusive and checked again for casting and cancelling even when closed flag was not persisted', () => {
  const state = fixture(), poll = create(state, { closesAt: '2026-11-08T12:01:00+09:00' });
  voteRoomPoll(state, 'member', poll.id, poll.options[0].id, at);
  const deadline = new Date('2026-11-08T03:01:00Z'), before = structuredClone(state);
  assert.equal(poll.closed, false); assert.equal(isPollClosed(poll, deadline), true);
  assert.equal(canVotePoll(state, 'member', poll, deadline), false);
  for (const choice of [poll.options[1].id, null]) assert.throws(() => voteRoomPoll(state, 'member', poll.id, choice, deadline));
  assert.deepEqual(state, before);
});
test('guest, stale member, blocked member and cross-group activity are rejected before changing data', () => {
  for (const actor of ['', 'outside', 'unknown']) { const state = fixture(), before = structuredClone(state); assert.throws(() => create(state, {}, actor)); assert.deepEqual(state, before); }
  const state = fixture(), poll = create(state);
  state.groups[0].blockedMemberIds = ['member']; const blocked = structuredClone(state);
  assert.throws(() => voteRoomPoll(state, 'member', poll.id, poll.options[0].id, at)); assert.deepEqual(state, blocked);
  assert.equal(canManagePoll(state, 'member', poll, at), false);
  assert.throws(() => create(state, { id: 'cross' }, 'outside', { groupId: 'elsewhere', activityId: 'activity' }));
  state.groups[0].blockedMemberIds = []; state.members = state.members.filter(item => item.id !== 'member');
  assert.throws(() => voteRoomPoll(state, 'member', poll.id, poll.options[0].id, at));
});
test('archived, cancelled and past activity scopes become read-only for votes and manager actions', () => {
  for (const mutate of [state => { state.groups[0].archived = true; }, state => { state.activities[0].status = 'CANCELLED'; }, state => { state.activities[0].date = '2026-11-01'; state.activities[0].endDate = '2026-11-02'; }]) {
    const state = fixture(), poll = create(state, {}, 'member', { ...scope, activityId: 'activity' }); mutate(state);
    const before = structuredClone(state); assert.equal(canVotePoll(state, 'member', poll, at), false); assert.equal(canManagePoll(state, 'host', poll, at), false);
    assert.throws(() => voteRoomPoll(state, 'member', poll.id, poll.options[0].id, at));
    assert.throws(() => closeRoomPoll(state, 'host', poll.id, at)); assert.throws(() => confirmRoomPoll(state, 'host', poll.id, poll.options[0].id, at));
    assert.deepEqual(state, before);
  }
});
test('creator and scope managers can manage while ordinary members cannot; old polls do not acquire an invented creator', () => {
  const state = fixture(), poll = create(state, {}, 'member', { ...scope, activityId: 'activity' });
  assert.equal(canManagePoll(state, 'member', poll, at), true); assert.equal(canManagePoll(state, 'host', poll, at), true); assert.equal(canManagePoll(state, 'other', poll, at), true);
  delete poll.creatorId; delete poll.revision; delete poll.kind; delete poll.multiple;
  assert.equal(isTogetherPollFields(poll), true); assert.equal(canManagePoll(state, 'member', poll, at), false);
  assert.equal(canManagePoll(state, 'host', poll, at), true);
  assert.throws(() => closeRoomPoll(state, 'member', poll.id, at));
  closeRoomPoll(state, 'host', poll.id, at); assert.equal(poll.closed, true);
});
test('editing needs current revision and no responses, and cannot replace votes already submitted', () => {
  const state = fixture(), poll = create(state); const edit = input({ question: '언제 만날까요?', multiple: true });
  const before = structuredClone(state); assert.throws(() => editRoomPoll(state, 'member', poll.id, edit, 0, at)); assert.deepEqual(state, before);
  editRoomPoll(state, 'member', poll.id, edit, 1, at); assert.equal(poll.question, '언제 만날까요?'); assert.equal(poll.revision, 2);
  voteRoomPoll(state, 'other', poll.id, poll.options[0].id, at); const voted = structuredClone(state);
  assert.throws(() => editRoomPoll(state, 'member', poll.id, input({}), poll.revision, at)); assert.deepEqual(state, voted);
});
test('result confirmation is explicit, can follow closure, is idempotent and never rewrites a previous confirmed result or the activity', () => {
  const state = fixture(), poll = create(state, {}, 'member', { ...scope, activityId: 'activity' }), before = structuredClone(state.activities);
  closeRoomPoll(state, 'member', poll.id, at); confirmRoomPoll(state, 'member', poll.id, poll.options[0].id, at);
  const revision = poll.revision; confirmRoomPoll(state, 'member', poll.id, poll.options[0].id, at); assert.equal(poll.revision, revision);
  assert.throws(() => confirmRoomPoll(state, 'member', poll.id, poll.options[1].id, at));
  assert.deepEqual(state.activities, before); assert.deepEqual(state.activities[0].participants, {});
});
test('new creation request replays only the exact contents, source actor and room', () => {
  const state = fixture(), poll = create(state); assert.equal(create(state), poll); assert.equal(state.polls.length, 1);
  const before = structuredClone(state);
  assert.throws(() => create(state, { question: '다른 내용' })); assert.throws(() => create(state, {}, 'other'));
  assert.throws(() => create(state, {}, 'member', { ...scope, activityId: 'activity' })); assert.deepEqual(state, before);
});
test('malformed optional fields are rejected without invalidating plain legacy poll records', () => {
  const state = fixture(), poll = create(state);
  const legacy = { id: 'old', groupId: 'group', question: '예전', options: [{ id: 'a', label: 'A', voterIds: [] }, { id: 'b', label: 'B', voterIds: [] }], closed: false };
  assert.equal(isTogetherPollFields(legacy), true);
  for (const patch of [{ kind: 'OTHER' }, { multiple: 'yes' }, { anonymous: 1 }, { closesAt: 'not a date' }, { closesAt: '2026-02-30T12:00:00Z' }, { creatorId: '' }, { revision: -1 }, { kind: 'DATE' }]) assert.equal(isTogetherPollFields({ ...legacy, ...patch }), false);
  assert.deepEqual(pollInputFrom(poll).options, [{ label: '카페 A' }, { label: '카페 B' }]);
});
