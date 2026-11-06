import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, roomIdForActivity, roomIdForGroup } from '../src/together/model.ts';
import { createChatDraftMemory, emptyChatDraft } from '../src/together/chatDrafts.ts';
import { postTogetherMessage } from '../src/together/chatActions.ts';

function fixture() {
  const state = createEmptyState('a', '가');
  state.members.push({ id: 'b', name: '나' });
  const group = { id: 'one', name: '첫 모임', kind: 'HOBBY', region: '부산', introduction: '', cover: '', ownerId: 'a', memberIds: ['a', 'b'], managerIds: [], archived: false, visibility: 'PRIVATE', promotionPublished: false };
  state.groups.push(group, { ...structuredClone(group), id: 'two', name: '다른 모임' });
  state.activities.push({ id: 'outing', groupId: 'one', title: '정모', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'a', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.messages.push({ id: 'original', roomId: roomIdForGroup('one'), authorId: 'b', body: '인용 원문은 별도로 존재', createdAt: '2026-10-29T00:00:00Z' });
  state.readCursors[roomIdForGroup('one')] = '2026-10-29T00:00:00Z';
  const memory = createChatDraftMemory(); memory.activate('a');
  return { state, memory, context: (groupId = 'one', roomId = roomIdForGroup(groupId), userId = 'a') => ({ state, userId, groupId, roomId }) };
}
const draft = (body = '  보내기 전 문장  ') => ({ body, stickerId: 'cat-hi', replyToMessageId: 'original' });

test('room navigation restores exact composer text, sticker and quote ID without changing messages/read/attendance', () => {
  const { state, memory, context } = fixture(), before = structuredClone(state);
  assert.equal(memory.write(context(), draft()), true);
  assert.deepEqual(memory.read(context('one', roomIdForActivity('outing'))), emptyChatDraft());
  memory.write(context('one', roomIdForActivity('outing')), draft('정모방 입력'));
  assert.deepEqual(memory.read(context()), draft());
  assert.equal(memory.read(context('one', roomIdForActivity('outing'))).body, '정모방 입력');
  assert.deepEqual(state, before);
});

test('an explicit successful-send clear removes only that room; another group and activity retain their drafts', () => {
  const { state, memory, context } = fixture();
  for (const item of [context(), context('two'), context('one', roomIdForActivity('outing'))]) memory.write(item, draft(item.roomId));
  postTogetherMessage(state, 'a', roomIdForGroup('one'), '실제 보내는 문장', 'cat-hi', 'original');
  memory.clear(context());
  assert.deepEqual(memory.read(context()), emptyChatDraft());
  assert.equal(memory.read(context('two')).body, roomIdForGroup('two'));
  assert.equal(memory.read(context('one', roomIdForActivity('outing'))).body, roomIdForActivity('outing'));
});

test('account activation clears prior account data and rejects stale previous-account reads and writes', () => {
  const { memory, context } = fixture(); memory.write(context(), draft('가의 비공개 문장'));
  memory.activate('b');
  assert.deepEqual(memory.read(context()), emptyChatDraft());
  assert.equal(memory.write(context(), draft('늦게 실행된 가의 입력')), false);
  assert.deepEqual(memory.read(context('one', roomIdForGroup('one'), 'b')), emptyChatDraft());
  memory.write(context('one', roomIdForGroup('one'), 'b'), draft('나의 문장'));
  memory.activate('a');
  assert.deepEqual(memory.read(context()), emptyChatDraft());
  assert.deepEqual(memory.read(context('one', roomIdForGroup('one'), 'b')), emptyChatDraft());
});

test('membership loss and blocking remove only revoked group drafts, including that group activity', () => {
  for (const revoke of [
    state => { state.groups[0].memberIds = ['b']; },
    state => { state.groups[0].blockedMemberIds = ['a']; },
  ]) {
    const { state, memory, context } = fixture();
    for (const item of [context(), context('two'), context('one', roomIdForActivity('outing'))]) memory.write(item, draft());
    revoke(state); memory.reconcile(state, 'a');
    assert.deepEqual(memory.read(context()), emptyChatDraft());
    assert.deepEqual(memory.read(context('one', roomIdForActivity('outing'))), emptyChatDraft());
    assert.deepEqual(memory.read(context('two')), draft());
    state.groups[0].memberIds = ['a', 'b']; state.groups[0].blockedMemberIds = [];
    assert.deepEqual(memory.read(context()), emptyChatDraft(), 'rejoining never restores revoked private drafts');
  }
});

test('canonical room/group checks prevent cross-group restoration, and removed or reparented activities lose only their own draft', () => {
  const { state, memory, context } = fixture();
  memory.write(context(), draft('전체방')); memory.write(context('one', roomIdForActivity('outing')), draft('정모방'));
  for (const invalid of [context('two', roomIdForActivity('outing')), context('one', 'group:one:extra'), context('missing')]) {
    assert.deepEqual(memory.read(invalid), emptyChatDraft()); assert.equal(memory.write(invalid, draft()), false);
  }
  state.activities[0].groupId = 'two'; memory.reconcile(state, 'a');
  assert.deepEqual(memory.read(context('one', roomIdForActivity('outing'))), emptyChatDraft());
  assert.deepEqual(memory.read(context('two', roomIdForActivity('outing'))), emptyChatDraft());
  assert.equal(memory.read(context()).body, '전체방');
  memory.write(context('two', roomIdForActivity('outing')), draft('이동 후 새 입력'));
  state.activities = []; memory.reconcile(state, 'a');
  assert.deepEqual(memory.read(context('two', roomIdForActivity('outing'))), emptyChatDraft());
});

test('source deletion retains the unsent text and quote ID for explicit cancellation, without copying its original body', () => {
  const { state, memory, context } = fixture(); memory.write(context(), draft());
  state.messages[0].deleted = true; memory.reconcile(state, 'a');
  const recovered = memory.read(context());
  assert.deepEqual(recovered, draft());
  assert.equal(JSON.stringify(recovered).includes(state.messages[0].body), false);
  assert.throws(() => postTogetherMessage(state, 'a', roomIdForGroup('one'), recovered.body, recovered.stickerId, recovered.replyToMessageId));
  assert.deepEqual(memory.read(context()), draft(), 'failed send must not clear the draft');
});

test('archiving keeps a members-only composer draft readable while actual message sending stays blocked', () => {
  const { state, memory, context } = fixture(); memory.write(context(), draft());
  state.groups[0].archived = true; memory.reconcile(state, 'a');
  assert.deepEqual(memory.read(context()), draft());
  assert.throws(() => postTogetherMessage(state, 'a', roomIdForGroup('one'), '보관 상태 전송'));
  assert.deepEqual(memory.read(context()), draft());
});

test('draft snapshots have no mutable aliases and invalid updates cannot replace previous input', () => {
  const { memory, context } = fixture(), incoming = draft(); memory.write(context(), incoming);
  incoming.body = '외부에서 바꿈';
  const recovered = memory.read(context()); recovered.body = '반환값에서 바꿈';
  assert.deepEqual(memory.read(context()), draft());
  for (const patch of [{ body: 'a'.repeat(4001) }, { stickerId: 'https://example.invalid/sticker' }, { replyToMessageId: null }]) {
    assert.equal(memory.write(context(), { ...draft(), ...patch }), false);
    assert.deepEqual(memory.read(context()), draft());
  }
  memory.write(context(), emptyChatDraft()); assert.deepEqual(memory.read(context()), emptyChatDraft());
});

test('composer memory is page-only and never accesses customer/admin/browser storage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, get() { throw new Error('browser storage must not be accessed'); } });
  try {
    const { state, memory, context } = fixture(); memory.write(context(), draft()); memory.reconcile(state, 'a');
    assert.deepEqual(memory.read(context()), draft());
    const freshPage = createChatDraftMemory(); freshPage.activate('a');
    assert.deepEqual(freshPage.read(context()), emptyChatDraft());
  } finally { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete globalThis.window; }
});
