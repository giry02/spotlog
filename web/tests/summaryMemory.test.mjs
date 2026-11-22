import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { createChatDigest } from '../src/together/chatDigest.ts';
import { createChatAiSummaryRequest } from '../src/together/chatAiSummary.ts';
import { createChatSummaryMemory } from '../src/together/summaryMemory.ts';

const cutoff = Date.parse('2026-11-19T03:00:00Z');
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'other', name: '다른 멤버' });
  state.groups.push({ id: 'family', name: '가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'me', memberIds: ['me', 'other'], managerIds: [], archived: false, promotionPublished: false });
  state.activities.push({ id: 'meeting', groupId: 'family', title: '약속', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'me', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.messages.push({ id: 'one', roomId: 'activity:meeting', authorId: 'other', body: '각자 물을 챙겨 주세요.', createdAt: '2026-11-19T01:00:00Z' });
  const context = { state, userId: 'me', groupId: 'family', roomId: 'activity:meeting' };
  const request = createChatAiSummaryRequest(context, { scope: 'all' }, 'KEY_POINTS', cutoff, 'summary');
  const view = { mode: 'ai', purpose: 'KEY_POINTS', filters: { scope: 'all' },
    originals: createChatDigest(context, { scope: 'all' }, cutoff),
    ai: { request, output: { title: '준비', sections: [{ kind: 'PREPARATION', heading: '준비할 일', items: [{ text: '물 챙기기', sourceIds: ['one'] }] }] } },
    taskDraft: { section: 0, item: 0, title: '내 물병', assignSelf: true }, savedTaskItems: ['summary:0:0'], limit: 24, conditionsOpen: false, scrollTop: 340 };
  return { context, view };
}

test('parent-owned page memory restores generated prose, filters, original scroll, and task draft across unmounts', () => {
  const { context, view } = fixture(), memory = createChatSummaryMemory();
  memory.activate('me');
  assert.equal(memory.write(context, view), true);
  assert.deepEqual(memory.read(context), view);
  assert.equal(memory.has(context), true);
  const copy = memory.read(context); copy.ai.output.title = '외부 수정'; copy.taskDraft.title = '다른 제목';
  assert.equal(memory.read(context).ai.output.title, '준비');
  assert.equal(memory.read(context).taskDraft.title, '내 물병');
  view.ai.output.title = '호출자 수정';
  assert.equal(memory.read(context).ai.output.title, '준비');
});

test('switching actors or logging out clears all private room results; an old cleanup cannot write to the new actor', () => {
  const { context, view } = fixture(), memory = createChatSummaryMemory();
  memory.activate('me'); memory.write(context, view);
  memory.activate('other');
  assert.equal(memory.has({ ...context, userId: 'other' }), false);
  assert.equal(memory.read(context), undefined);
  assert.equal(memory.write(context, view), false);
  memory.activate('me');
  assert.equal(memory.has(context), false);
  memory.write(context, view); memory.activate(''); memory.activate('me');
  assert.equal(memory.has(context), false);
});

test('source edits, deletion, duplicate IDs, moved messages, or scope changes invalidate both prose and action drafts on restore', () => {
  for (const mutate of [
    state => { state.messages[0].body = '준비 변경'; },
    state => { state.messages[0].deleted = true; },
    state => { state.messages.push({ ...state.messages[0] }); },
    state => { state.messages[0].roomId = 'group:family'; },
    state => { state.activities[0].groupId = 'foreign'; },
  ]) {
    const { context, view } = fixture(), memory = createChatSummaryMemory();
    memory.activate('me'); memory.write(context, view); mutate(context.state);
    const restored = memory.read(context);
    assert.equal(restored?.ai ?? null, null);
    assert.equal(restored?.originals ?? null, null);
    assert.equal(restored?.taskDraft ?? null, null);
    assert.equal(memory.has(context), false);
  }
});

test('access loss is reconciled before a shortcut is offered, and regaining membership does not restore old private results', () => {
  for (const mutate of [state => { state.groups[0].blockedMemberIds = ['me']; }, state => { state.groups[0].memberIds = ['other']; }]) {
    const { context, view } = fixture(), memory = createChatSummaryMemory();
    memory.activate('me'); memory.write(context, view); mutate(context.state);
    memory.reconcile(context.state, 'me');
    assert.equal(memory.read(context), undefined);
    context.state.groups[0].blockedMemberIds = []; context.state.groups[0].memberIds.push('me');
    assert.equal(memory.has(context), false);
  }
});

test('filters, purpose and captured unread pointer are revalidated rather than reusing a different selection', () => {
  for (const mutate of [view => { view.filters = { scope: 'today' }; }, view => { view.purpose = 'PREPARATION'; }]) {
    const { context, view } = fixture(), memory = createChatSummaryMemory(); memory.activate('me'); mutate(view);
    memory.write(context, view); assert.equal(memory.read(context).ai, null);
  }
  const { context, view } = fixture(), memory = createChatSummaryMemory();
  context.unreadAfter = '2026-11-19T00:00:00Z';
  view.filters = { scope: 'unread' };
  view.ai.request = createChatAiSummaryRequest(context, view.filters, 'KEY_POINTS', cutoff, 'summary');
  view.originals = createChatDigest(context, view.filters, cutoff);
  memory.activate('me'); memory.write(context, view);
  assert.equal(memory.has(context), true);
  assert.equal(memory.has({ ...context, unreadAfter: '2026-11-19T02:00:00Z' }), false);
});

test('late stale-actor reads cannot erase the active actor cache and separate room keys never share results', () => {
  const { context, view } = fixture(), memory = createChatSummaryMemory(); memory.activate('me'); memory.write(context, view);
  assert.equal(memory.read({ ...context, userId: 'other' }), undefined);
  assert.equal(memory.has(context), true);
  assert.equal(memory.read({ ...context, roomId: 'group:family' }), undefined);
  memory.clear(context);
  assert.equal(memory.has(context), false);
});

test('new messages keep existing result with explicit regeneration count, but corrupted citations never restore', () => {
  const { context, view } = fixture(), memory = createChatSummaryMemory(); memory.activate('me'); memory.write(context, view);
  context.state.messages.push({ ...context.state.messages[0], id: 'new', createdAt: '2026-11-19T04:00:00Z' });
  assert.equal(memory.read(context).ai.output.title, '준비');
  view.ai.output.sections[0].items[0].sourceIds = ['foreign'];
  memory.write(context, view);
  assert.equal(memory.read(context).ai, null);
  assert.equal(memory.read(context).taskDraft, null);
});

test('passive room-read reconciliation keeps the captured unread result while still removing an edited original', () => {
  const { context, view } = fixture(), memory = createChatSummaryMemory();
  context.unreadAfter = '2026-11-19T00:00:00Z'; view.filters = { scope: 'unread' };
  view.ai.request = createChatAiSummaryRequest(context, view.filters, 'KEY_POINTS', cutoff, 'summary');
  view.originals = createChatDigest(context, view.filters, cutoff);
  memory.activate('me'); memory.write(context, view);
  context.state.readCursors[context.roomId] = '2026-11-19T02:00:00Z';
  memory.reconcile(context.state, 'me');
  assert.equal(memory.has(context), true);
  context.state.messages[0].body = '수정됨'; memory.reconcile(context.state, 'me');
  assert.equal(memory.has(context), false);
});
