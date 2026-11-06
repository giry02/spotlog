import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, roomIdForActivity, roomIdForGroup } from '../src/together/model.ts';
import { readChatEntity, shareChatEntity, toggleChatTask, voteChatPoll } from '../src/together/chatEntities.ts';
import { applyActivityAssistantAction, selectAssistantMessages } from '../src/together/activityAssistant.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';

const groupRoom = roomIdForGroup('g'), activityRoom = roomIdForActivity('a');
function fixture() {
  const state = createEmptyState('owner', '모임장');
  state.discoveryCatalogVersion = 3;
  state.members.push({ id: 'me', name: '나' }, { id: 'member', name: '멤버' }, { id: 'out', name: '외부인' });
  state.groups.push({ id: 'g', name: '가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', ownerId: 'owner', memberIds: ['owner', 'me', 'member'], managerIds: [], archived: false, visibility: 'PRIVATE', promotionPublished: false, interestPlaceIds: ['p1', 'p2'] });
  state.groups.push({ ...structuredClone(state.groups[0]), id: 'other', ownerId: 'out', memberIds: ['out'] });
  state.activities.push({ id: 'a', groupId: 'g', title: '함께 만나요', date: '2999-11-07', endDate: '', startTime: '14:00', meetingPoint: '역 앞', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: { me: 'MAYBE' }, arrivedIds: [], revision: 1 });
  state.activities.push({ ...structuredClone(state.activities[0]), id: 'another' });
  state.polls.push({ id: 'p', groupId: 'g', question: '어디에서?', options: [{ id: 'x', label: 'A', voterIds: ['owner'] }, { id: 'y', label: 'B', voterIds: [] }], closed: false });
  state.tasks.push({ id: 't', groupId: 'g', activityId: 'a', title: '예약 확인', assigneeId: 'me', completed: false });
  state.notices.push({ id: 'n', groupId: 'g', title: '안내', body: '함께 확인해요.', createdAt: '2026-11-04T00:00:00Z' });
  state.messages.push({ id: 'legacy', roomId: groupRoom, authorId: 'me', body: '기존 원문', createdAt: '2026-11-04T00:00:00Z' });
  return state;
}
function unchangedOnReject(state, callback) { const before = structuredClone(state); assert.throws(callback); assert.deepEqual(state, before); }

test('explicit shares create one scoped reference, preserve legacy records and never backfill merely by reading', () => {
  const state = fixture(), before = structuredClone(state), legacy = structuredClone(state.messages[0]);
  assert.equal(readChatEntity(state, 'me', groupRoom, state.messages[0]), null); assert.deepEqual(state, before);
  const card = shareChatEntity(state, 'me', { type: 'POLL', id: 'p' });
  const after = structuredClone(state);
  assert.equal(card.roomId, groupRoom); assert.deepEqual(card.entity, { type: 'POLL', id: 'p' }); assert.equal(card.body, '');
  assert.equal(shareChatEntity(state, 'owner', { type: 'POLL', id: 'p' }), card); assert.deepEqual(state, after);
  assert.deepEqual(state.messages[0], legacy); assert.equal(state.messages.length, 2);
  assert.equal(isTogetherState(state), true); assert.deepEqual(selectAssistantMessages(state, 'me', { groupId: 'g' }).map(item => item.id), ['legacy']);
});

test('group and activity scopes cannot leak polls, tasks or notices into each other or another group', () => {
  const state = fixture();
  const groupCard = shareChatEntity(state, 'me', { type: 'POLL', id: 'p' });
  const taskCard = shareChatEntity(state, 'me', { type: 'TASK', id: 't' });
  const noticeCard = shareChatEntity(state, 'owner', { type: 'NOTICE', id: 'n' });
  assert.equal(taskCard.roomId, activityRoom); assert.equal(noticeCard.roomId, groupRoom);
  for (const room of [activityRoom, roomIdForActivity('another'), roomIdForGroup('other')]) {
    assert.equal(readChatEntity(state, 'me', room, { ...groupCard, roomId: room }), null);
    unchangedOnReject(state, () => shareChatEntity(state, 'me', { type: 'POLL', id: 'p' }, { roomId: room }));
  }
  assert.equal(readChatEntity(state, 'me', groupRoom, { ...taskCard, roomId: groupRoom }), null);
  assert.equal(readChatEntity(state, 'out', groupRoom, groupCard), null);
  state.groups[0].blockedMemberIds = ['me'];
  assert.equal(readChatEntity(state, 'me', groupRoom, groupCard), null);
  unchangedOnReject(state, () => shareChatEntity(state, 'me', { type: 'NOTICE', id: 'n' }));
});

test('activity links belong to their persistent group or own activity, while private one-offs never expose their former group', () => {
  const state = fixture();
  const card = shareChatEntity(state, 'me', { type: 'ACTIVITY', id: 'a' }); assert.equal(card.roomId, groupRoom);
  assert.equal(readChatEntity(state, 'me', groupRoom, card).value, state.activities[0]);
  assert.equal(readChatEntity(state, 'me', roomIdForActivity('another'), { ...card, roomId: roomIdForActivity('another') }), null);
  state.groups[0].spaceType = 'ACTIVITY'; state.activities = state.activities.filter(item => item.id === 'a');
  const privateCard = shareChatEntity(state, 'me', { type: 'ACTIVITY', id: 'a' }); assert.equal(privateCard.roomId, activityRoom);
  assert.equal(readChatEntity(state, 'me', groupRoom, card), null);
});

test('chat voting uses the same poll object, retains others choices and never changes schedule or RSVP', () => {
  const state = fixture(), activity = structuredClone(state.activities);
  const card = shareChatEntity(state, 'me', { type: 'POLL', id: 'p' });
  voteChatPoll(state, 'me', groupRoom, 'p', 'x'); voteChatPoll(state, 'me', groupRoom, 'p', 'y');
  assert.deepEqual(state.polls[0].options.map(option => option.voterIds), [['owner'], ['me']]);
  assert.equal(readChatEntity(state, 'owner', groupRoom, card).value, state.polls[0]); assert.deepEqual(state.activities, activity);
  unchangedOnReject(state, () => voteChatPoll(state, 'me', activityRoom, 'p', 'y'));
  unchangedOnReject(state, () => voteChatPoll(state, 'me', groupRoom, 'p', 'missing'));
  unchangedOnReject(state, () => voteChatPoll(state, 'out', groupRoom, 'p', 'y'));
  state.polls[0].closed = true;
  assert.equal(readChatEntity(state, 'me', groupRoom, card).canInteract, false);
  unchangedOnReject(state, () => voteChatPoll(state, 'me', groupRoom, 'p', 'x'));
});

test('only the assigned member or exact-scope editor can toggle a task; the card reflects current shared state', () => {
  const state = fixture(), card = shareChatEntity(state, 'owner', { type: 'TASK', id: 't' });
  assert.equal(readChatEntity(state, 'member', activityRoom, card).canInteract, false);
  unchangedOnReject(state, () => toggleChatTask(state, 'member', activityRoom, 't'));
  assert.equal(toggleChatTask(state, 'me', activityRoom, 't').completed, true);
  assert.equal(readChatEntity(state, 'owner', activityRoom, card).value.completed, true);
  assert.equal(toggleChatTask(state, 'owner', activityRoom, 't').completed, false);
  state.tasks.push({ id: 'group-t', groupId: 'g', title: '공동 준비', completed: false }); shareChatEntity(state, 'me', { type: 'TASK', id: 'group-t' });
  unchangedOnReject(state, () => toggleChatTask(state, 'me', groupRoom, 'group-t'));
  assert.equal(toggleChatTask(state, 'owner', groupRoom, 'group-t').completed, true);
  unchangedOnReject(state, () => toggleChatTask(state, 'owner', groupRoom, 't'));
});

test('archive, cancellation, completion, passed dates, revocation and deletion immediately disable stale chat controls', () => {
  const changes = [state => state.groups[0].archived = true, state => state.activities[0].status = 'CANCELLED', state => state.activities[0].status = 'COMPLETED', state => state.activities[0].date = '2000-01-01'];
  for (const change of changes) {
    const state = fixture(); state.polls[0].activityId = 'a';
    const poll = shareChatEntity(state, 'me', { type: 'POLL', id: 'p' }); const task = shareChatEntity(state, 'me', { type: 'TASK', id: 't' });
    change(state);
    assert.equal(readChatEntity(state, 'me', activityRoom, poll).canInteract, false); assert.equal(readChatEntity(state, 'me', activityRoom, task).canInteract, false);
    unchangedOnReject(state, () => voteChatPoll(state, 'me', activityRoom, 'p', 'x'));
    unchangedOnReject(state, () => toggleChatTask(state, 'me', activityRoom, 't'));
  }
  const state = fixture(), card = shareChatEntity(state, 'me', { type: 'POLL', id: 'p' });
  state.groups[0].memberIds = ['owner']; assert.equal(readChatEntity(state, 'me', groupRoom, card), null);
  unchangedOnReject(state, () => voteChatPoll(state, 'me', groupRoom, 'p', 'x'));
  state.polls = []; assert.equal(readChatEntity(state, 'owner', groupRoom, card), null);
  unchangedOnReject(state, () => voteChatPoll(state, 'owner', groupRoom, 'p', 'x'));
});

test('stable event IDs support distinct time changes without duplicate cards or unrelated-action collisions', () => {
  const state = fixture();
  const first = shareChatEntity(state, 'owner', { type: 'ACTIVITY', id: 'a' }, { roomId: activityRoom, eventId: 'change-1', body: '시간 변경' });
  assert.equal(shareChatEntity(state, 'owner', { type: 'ACTIVITY', id: 'a' }, { roomId: activityRoom, eventId: 'change-1', body: '시간 변경' }), first);
  shareChatEntity(state, 'owner', { type: 'ACTIVITY', id: 'a' }, { roomId: activityRoom, eventId: 'change-2', body: '시간 변경' });
  assert.equal(state.messages.filter(item => item.entity).length, 2);
  unchangedOnReject(state, () => shareChatEntity(state, 'owner', { type: 'ACTIVITY', id: 'a' }, { roomId: activityRoom, eventId: 'change-1', body: '다른 설명' }));
  unchangedOnReject(state, () => shareChatEntity(state, 'owner', { type: 'ACTIVITY', id: 'another' }, { roomId: groupRoom, eventId: '', body: '다른 항목' }));
});

test('assistant group-wide places and tasks now produce actionable exact-room cards without chat-original duplication', () => {
  const state = fixture(), catalog = ['p1', 'p2'].map(id => ({ id, name: id, kind: 'CAFE', area: '부산', address: id, lat: 35, lng: 129, image: '', description: '', note: '', duration: '' }));
  const action = { id: 'created', groupId: 'g', type: 'CREATE_POLL', question: '함께 고를까요?', placeIds: ['p1', 'p2'] };
  applyActivityAssistantAction(state, 'me', action, catalog); applyActivityAssistantAction(state, 'me', { ...action, id: 'retry' }, catalog);
  const card = state.messages.find(item => item.entity?.id === 'created');
  assert.equal(card.roomId, groupRoom); assert.equal(state.messages.filter(item => item.entity?.id === 'created').length, 1);
  voteChatPoll(state, 'member', groupRoom, 'created', state.polls.find(item => item.id === 'created').options[0].id);
  assert.equal(state.polls.find(item => item.id === 'created').options[0].voterIds[0], 'member');
  assert.equal(selectAssistantMessages(state, 'me', { groupId: 'g' }).some(item => item.id === card.id), false);
});

test('reference fields are optional for schema-v1 records, malformed references fail validation and failed transactions preserve original storage', () => {
  const state = fixture(); assert.equal(isTogetherState(state), true);
  shareChatEntity(state, 'me', { type: 'POLL', id: 'p' }); assert.equal(isTogetherState(state), true);
  const invalids = [{ type: 'POLL', id: '' }, { type: 'WRONG', id: 'p' }, { type: 'POLL', id: 'p', body: 'copied' }, null, 'p'];
  for (const entity of invalids) { const copy = structuredClone(state); copy.messages[0].entity = entity; assert.equal(isTogetherState(copy), false); }
  const values = new Map([[togetherStorageKey('me'), JSON.stringify(state)]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const repository = createTogetherRepository('me', '나', [], storage); const old = values.get(togetherStorageKey('me'));
  assert.equal(repository.update(draft => { draft.polls[0].closed = true; voteChatPoll(draft, 'me', groupRoom, 'p', 'x'); }), false);
  assert.equal(values.get(togetherStorageKey('me')), old); assert.equal(repository.getSnapshot().polls[0].closed, false);
});
