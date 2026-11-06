import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, roomIdForActivity, roomIdForGroup } from '../src/together/model.ts';
import { ALLOWED_MESSAGE_REACTIONS, postTogetherMessage, toggleMessageReaction } from '../src/together/chatActions.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';

const groupRoom = roomIdForGroup('one');
const activityRoom = roomIdForActivity('outing');
function fixture() {
  const state = createEmptyState('alice', '가');
  state.discoveryCatalogVersion = 3;
  state.members.push({ id: 'bob', name: '나' }, { id: 'host', name: '모임장' }, { id: 'outsider', name: '다른 모임원' });
  const group = { id: 'one', name: '내 모임', kind: 'HOBBY', region: '부산', introduction: '', cover: '', ownerId: 'host', memberIds: ['alice', 'bob', 'host'], managerIds: [], archived: false, visibility: 'PRIVATE', promotionPublished: false };
  state.groups.push(group, { ...structuredClone(group), id: 'other', name: '다른 모임', ownerId: 'outsider', memberIds: ['outsider'] });
  state.activities.push({ id: 'outing', groupId: 'one', title: '정모', date: '', endDate: '', meetingPoint: '멤버 전용 장소', description: '', status: 'PLANNED', leadId: 'host', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.messages.push(
    { id: 'source', roomId: groupRoom, authorId: 'bob', body: '모임원끼리 확인할 원문', createdAt: '2026-10-29T00:00:00.000Z' },
    { id: 'activity-source', roomId: activityRoom, authorId: 'bob', body: '정모방 원문', createdAt: '2026-10-29T00:01:00.000Z' },
    { id: 'other-source', roomId: roomIdForGroup('other'), authorId: 'outsider', body: '다른 모임 원문', createdAt: '2026-10-29T00:02:00.000Z' },
  );
  state.readCursors[groupRoom] = '2026-10-29T00:00:00.000Z';
  state.mutedRooms.push(activityRoom);
  return state;
}
const withoutMessages = state => ({ ...structuredClone(state), messages: [] });
function assertRejectedWithoutChange(state, action) {
  const before = structuredClone(state);
  assert.throws(action);
  assert.deepEqual(state, before);
}
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

test('a quoted reply stores only the source ID and preserves its original and all non-chat state', () => {
  const state = fixture(), original = structuredClone(state.messages[0]), untouched = withoutMessages(state);
  const before = Date.now();
  const reply = postTogetherMessage(state, 'alice', groupRoom, '  알겠어요  ', 'cat-hi', 'source');
  assert.equal(state.messages.at(-1), reply);
  assert.equal(reply.body, '알겠어요'); assert.equal(reply.authorId, 'alice'); assert.equal(reply.roomId, groupRoom);
  assert.equal(reply.replyToMessageId, 'source'); assert.equal(reply.stickerId, 'cat-hi');
  assert.match(reply.id, /^message-/);
  assert.ok(Date.parse(reply.createdAt) >= before && Date.parse(reply.createdAt) <= Date.now());
  assert.deepEqual(Object.keys(reply).sort(), ['authorId', 'body', 'createdAt', 'id', 'replyToMessageId', 'roomId', 'stickerId'].sort());
  assert.deepEqual(state.messages[0], original);
  assert.equal(JSON.stringify(reply).includes(original.body), false);
  assert.deepEqual(withoutMessages(state), untouched);
  assert.equal(isTogetherState(state), true);
});

test('membership grants both room scopes without RSVP; completed activity history remains conversational', () => {
  const state = fixture(), before = withoutMessages(state);
  assert.deepEqual(state.activities[0].participants, {});
  postTogetherMessage(state, 'alice', activityRoom, '정모방 답장', undefined, 'activity-source');
  assert.deepEqual(withoutMessages(state), before);
  state.activities[0].status = 'COMPLETED';
  const afterCompletion = withoutMessages(state);
  postTogetherMessage(state, 'alice', activityRoom, '', 'bunny-thanks');
  toggleMessageReaction(state, 'alice', activityRoom, 'activity-source', '✅');
  assert.deepEqual(withoutMessages(state), afterCompletion);
});

test('missing, cross-room and deleted originals cannot be quoted or reacted to', () => {
  const state = fixture();
  for (const id of ['other-source', 'activity-source', 'missing']) {
    assertRejectedWithoutChange(state, () => postTogetherMessage(state, 'alice', groupRoom, '답장', undefined, id));
    assertRejectedWithoutChange(state, () => toggleMessageReaction(state, 'alice', groupRoom, id, '👍'));
  }
  state.messages[0].deleted = true;
  assertRejectedWithoutChange(state, () => postTogetherMessage(state, 'alice', groupRoom, '답장', undefined, 'source'));
  assertRejectedWithoutChange(state, () => toggleMessageReaction(state, 'alice', groupRoom, 'source', '👍'));
});

test('canonical room, latest membership, blocked status and archived status are checked for every action', () => {
  for (const roomId of ['group:missing', 'activity:missing', 'one', 'group-one', 'group:one:extra', ' group:one']) {
    const state = fixture();
    assertRejectedWithoutChange(state, () => postTogetherMessage(state, 'alice', roomId, '보내기'));
    assertRejectedWithoutChange(state, () => toggleMessageReaction(state, 'alice', roomId, 'source', '👍'));
  }
  for (const alter of [
    state => { state.groups[0].memberIds = state.groups[0].memberIds.filter(id => id !== 'alice'); },
    state => { state.groups[0].blockedMemberIds = ['alice']; },
    state => { state.groups[0].archived = true; },
  ]) for (const roomId of [groupRoom, activityRoom]) {
    const state = fixture(); alter(state);
    assertRejectedWithoutChange(state, () => postTogetherMessage(state, 'alice', roomId, '보내기'));
    assertRejectedWithoutChange(state, () => toggleMessageReaction(state, 'alice', roomId, roomId === groupRoom ? 'source' : 'activity-source', '👍'));
  }
  const state = fixture();
  for (const actor of ['', 'outsider']) assertRejectedWithoutChange(state, () => postTogetherMessage(state, actor, groupRoom, '권한 없음'));
});

test('text/sticker limits reject invalid input before mutation; 4000 trimmed characters and sticker-only posts work', () => {
  const state = fixture();
  for (const [body, sticker, reply] of [
    ['', undefined, undefined], ['   ', undefined, undefined], ['a'.repeat(4001), undefined, undefined],
    ['안녕', 'https://example.invalid/sticker.svg', undefined], ['안녕', 'unknown', undefined],
    ['안녕', undefined, ''], ['안녕', undefined, '  '], [null, undefined, undefined],
  ]) assertRejectedWithoutChange(state, () => postTogetherMessage(state, 'alice', groupRoom, body, sticker, reply));
  assert.equal(postTogetherMessage(state, 'alice', groupRoom, ` ${'a'.repeat(4000)} `).body.length, 4000);
  assert.equal(postTogetherMessage(state, 'alice', groupRoom, ' ', 'duck-hi').body, '');
});

test('reaction toggles keep one actor per emoji, preserve others, and remove empty entries', () => {
  const state = fixture(), before = withoutMessages(state), source = state.messages[0];
  assert.deepEqual(ALLOWED_MESSAGE_REACTIONS, ['👍', '❤️', '😂', '✅', '❓']);
  assert.equal(Object.isFrozen(ALLOWED_MESSAGE_REACTIONS), true);
  assert.equal(toggleMessageReaction(state, 'alice', groupRoom, 'source', '👍'), source);
  toggleMessageReaction(state, 'bob', groupRoom, 'source', '👍');
  toggleMessageReaction(state, 'alice', groupRoom, 'source', '❤️');
  assert.deepEqual(source.reactions, { '👍': ['alice', 'bob'], '❤️': ['alice'] });
  toggleMessageReaction(state, 'alice', groupRoom, 'source', '👍');
  assert.deepEqual(source.reactions['👍'], ['bob']);
  toggleMessageReaction(state, 'bob', groupRoom, 'source', '👍');
  assert.equal(Object.hasOwn(source.reactions, '👍'), false);
  toggleMessageReaction(state, 'alice', groupRoom, 'source', '❤️');
  assert.equal(Object.hasOwn(source, 'reactions'), false);
  assert.equal(source.body, '모임원끼리 확인할 원문');
  assert.deepEqual(withoutMessages(state), before);
  assertRejectedWithoutChange(state, () => toggleMessageReaction(state, 'alice', groupRoom, 'source', '🚀'));
});

test('schema version 1 legacy messages remain readable; optional reply/reaction shapes are strictly validated', () => {
  const legacy = fixture();
  assert.equal(isTogetherState(legacy), true);
  for (const patch of [
    { replyToMessageId: null }, { replyToMessageId: 1 }, { replyToMessageId: '' }, { replyToMessageId: '  ' },
    { reactions: [] }, { reactions: null }, { reactions: { '🚀': ['alice'] } },
    { reactions: { '👍': 'alice' } }, { reactions: { '👍': [] } }, { reactions: { '👍': [''] } },
    { reactions: { '👍': ['alice', 'alice'] } }, { reactions: { '👍': ['alice', 7] } },
  ]) {
    const state = structuredClone(legacy); Object.assign(state.messages[0], patch);
    assert.equal(isTogetherState(state), false, JSON.stringify(patch));
  }
  const reply = postTogetherMessage(legacy, 'alice', groupRoom, '인용 답장', undefined, 'source');
  toggleMessageReaction(legacy, 'alice', groupRoom, reply.id, '😂');
  legacy.messages[0].deleted = true;
  assert.equal(isTogetherState(legacy), true, 'later source deletion must not invalidate previously saved replies');
});

test('reply/reactions persist only in the existing per-account together namespace without resetting other stores', () => {
  const state = fixture(), key = togetherStorageKey('alice');
  const disk = memoryStorage({ [key]: JSON.stringify(state), 'spotlog.web.journeys.v4': 'private-original', 'spotlog.admin.store': 'admin-original' });
  const repo = createTogetherRepository('alice', '가', [], disk);
  let replyId;
  assert.equal(repo.update(draft => { replyId = postTogetherMessage(draft, 'alice', groupRoom, '영속 인용', undefined, 'source').id; }), true);
  assert.equal(repo.update(draft => { toggleMessageReaction(draft, 'alice', groupRoom, replyId, '👍'); }), true);
  const loaded = createTogetherRepository('alice', '가', [], disk).getSnapshot().messages.find(item => item.id === replyId);
  assert.equal(loaded.replyToMessageId, 'source'); assert.deepEqual(loaded.reactions, { '👍': ['alice'] });
  assert.equal(disk.getItem('spotlog.web.journeys.v4'), 'private-original'); assert.equal(disk.getItem('spotlog.admin.store'), 'admin-original');
  assert.equal(disk.values.size, 3);
  assert.equal(createTogetherRepository('other-account', '다', [], disk).getSnapshot().messages.length, 0);
});

test('a failed write preserves the previous message state and a revoked actor cannot post through a stale UI', () => {
  const state = fixture(), key = togetherStorageKey('alice'), disk = memoryStorage({ [key]: JSON.stringify(state) });
  const repo = createTogetherRepository('alice', '가', [], disk);
  assert.equal(repo.update(draft => { draft.groups[0].memberIds = draft.groups[0].memberIds.filter(id => id !== 'alice'); }), true);
  const revoked = repo.getSnapshot(), bytes = disk.getItem(key);
  assert.equal(repo.update(draft => { postTogetherMessage(draft, 'alice', groupRoom, '늦은 전송'); }), false);
  assert.equal(repo.getSnapshot(), revoked); assert.equal(disk.getItem(key), bytes);
  disk.setItem = () => { throw new Error('quota'); };
  assert.equal(repo.update(draft => { toggleMessageReaction(draft, 'bob', groupRoom, 'source', '👍'); }), false);
  assert.equal(repo.getSnapshot(), revoked); assert.equal(disk.getItem(key), bytes);
});
