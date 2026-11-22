import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { createChatAiSummaryRequest } from '../src/together/chatAiSummary.ts';
import { createChatSummaryNoticeDraft } from '../src/together/summaryNoticeDraft.ts';

function fixture() {
  const state = createEmptyState('me', '나'); state.members.push({ id: 'mom', name: '엄마' });
  state.groups.push({ id: 'family', name: '가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'me', memberIds: ['me', 'mom'], managerIds: [], archived: false, promotionPublished: false });
  state.messages.push({ id: 'one', roomId: 'group:family', authorId: 'mom', body: '제가 물을 챙길게요.', createdAt: '2026-11-19T01:00:00Z' });
  const context = { state, userId: 'me', groupId: 'family', roomId: 'group:family' };
  const request = createChatAiSummaryRequest(context, { scope: 'all' }, 'KEY_POINTS', Date.parse('2026-11-19T02:00:00Z'), 'notice');
  const snapshot = { request, output: { title: '준비', sections: [{ kind: 'PREPARATION', heading: '준비할 일', items: [{ text: '물 지참', sourceIds: ['one'], speakerId: 'mom', volunteered: true }] }] } };
  return { context, snapshot };
}

test('notice transfer is a source-labeled editable draft and does not publish or change room state', () => {
  const { context, snapshot } = fixture(), before = structuredClone(context.state);
  const draft = createChatSummaryNoticeDraft(context, snapshot, 0, { scope: 'all' });
  assert.equal(draft.title, '대화 정리 · 준비할 일');
  assert.match(draft.body, /물 지참/); assert.match(draft.body, /엄마/); assert.match(draft.body, /근거:/);
  assert.deepEqual(context.state, before);
});

test('source edits, access revocation and selection changes block a stale notice draft', () => {
  const { context, snapshot } = fixture(); context.state.messages[0].body = '변경';
  assert.throws(() => createChatSummaryNoticeDraft(context, snapshot, 0, { scope: 'all' }), /원문/);
  const second = fixture(); second.context.state.groups[0].blockedMemberIds = ['me'];
  assert.throws(() => createChatSummaryNoticeDraft(second.context, second.snapshot, 0, { scope: 'all' }), /원문/);
  const third = fixture();
  assert.throws(() => createChatSummaryNoticeDraft(third.context, third.snapshot, 0, { scope: 'today' }), /원문/);
});

test('a changed-time section cannot transfer hidden model time text or a generic warning into a notice', () => {
  const { context, snapshot } = fixture();
  snapshot.output.sections.unshift({ kind: 'TIME_PLACE', heading: '시간', items: [{ text: '이전 시각 12시', sourceIds: ['one'] }] });
  snapshot.output.sections.push({ kind: 'CHANGED', heading: '변경 확인', items: [{ text: '시각 변경 제안', sourceIds: ['one'] }] });
  assert.throws(() => createChatSummaryNoticeDraft(context, snapshot, 0, { scope: 'all' }), /현재 약속의 일정과 변경 원문/);
  const changeDraft = createChatSummaryNoticeDraft(context, snapshot, 2, { scope: 'all' });
  assert.match(changeDraft.body, /시각 변경 제안/);
  assert.equal(changeDraft.body.includes('이전 시각 12시'), false);
});
