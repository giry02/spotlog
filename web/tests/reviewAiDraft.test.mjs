import test from 'node:test';
import assert from 'node:assert/strict';
import { captureReviewDraft, generateScopedReviewDraft, isReviewDraftCurrent } from '../src/together/reviewAiDraft.ts';
import { createEmptyState } from '../src/together/model.ts';

const facts = { scope: { groupId: 'g', activityId: 'a', name: '카페 약속' }, activities: [{ id: 'a', title: '카페 약속', date: '2026-11-09', endDate: '', status: 'COMPLETED' }], ownReviews: [{ id: 'own', title: '지난 후기', body: '직접 작성한 후기' }] };
const signal = () => new AbortController().signal;
const response = (request, output, patch = {}) => new Response(JSON.stringify({ schemaVersion: 1, requestId: request.requestId, scope: request.scope, output, ...patch }), { headers: { 'Content-Type': 'application/json' } });

test('review draft uses the exact room echo contract and sends only the previewed facts', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (_url, options) => { sent = JSON.parse(options.body); return response(sent, { title: ' 함께한 카페 약속 ', body: ' 직접 확인해서 다듬을 후기 초안 ' }); });
  const before = structuredClone(facts);
  const result = await generateScopedReviewDraft('/ai', 'me', facts, signal());
  assert.deepEqual(sent.scope, { userId: 'me', groupId: 'g', roomId: 'activity:a' });
  assert.equal(sent.feature, 'REVIEW_DRAFT'); assert.deepEqual(sent.payload, { facts });
  assert.deepEqual(result, { title: '함께한 카페 약속', body: '직접 확인해서 다듬을 후기 초안' }); assert.deepEqual(facts, before);
});

test('missing endpoint, wrong room echo and malformed generated text are rejected without a fallback draft', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => { calls++; const sent = JSON.parse(options.body); return response(sent, { title: '다른 방', body: '노출되면 안 돼요' }, { scope: { ...sent.scope, roomId: 'activity:other' } }); });
  await assert.rejects(generateScopedReviewDraft('', 'me', facts, signal()), /연결되지/); assert.equal(calls, 0);
  await assert.rejects(generateScopedReviewDraft('/ai', 'me', facts, signal()), /다른 요청이나 대화방/);
  for (const output of [{ title: '', body: '본문' }, { title: '제목', body: 'x'.repeat(12001) }, { title: '제목', body: '본문', chat: '선택하지 않은 정보' }]) {
    globalThis.fetch.mock.mockImplementation(async (_url, options) => response(JSON.parse(options.body), output));
    await assert.rejects(generateScopedReviewDraft('/ai', 'me', facts, signal()), /후기 초안/);
  }
});

function context() {
  const state = createEmptyState('me', '나');
  state.groups.push({ id: 'g', name: '가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'me', memberIds: ['me'], managerIds: [], archived: false, promotionPublished: false });
  state.activities.push({ id: 'a', groupId: 'g', title: '카페 약속', date: '', endDate: '', meetingPoint: '', description: '', status: 'COMPLETED', leadId: 'me', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.posts.push({ id: 'own', groupId: 'g', activityId: 'a', authorId: 'me', title: '지난 후기', body: '직접 작성한 후기', category: 'REVIEW', createdAt: '2026-11-09T01:00:00Z', likes: [], comments: [] });
  return { state, viewerId: 'me', groupId: 'g', activityId: 'a', category: 'REVIEW' };
}

test('captured review suggestions are bound to the exact writable author/group/activity and review category', () => {
  const current = context(), before = structuredClone(current.state), capture = captureReviewDraft(current);
  assert.equal(isReviewDraftCurrent(current, capture), true);
  for (const changed of [{ category: 'FREE' }, { category: 'QUESTION' }, { category: 'NOTICE' }, { viewerId: 'other' }, { groupId: 'other' }, { activityId: undefined }]) {
    assert.equal(isReviewDraftCurrent({ ...current, ...changed }, capture), false);
  }
  assert.throws(() => captureReviewDraft({ ...current, category: 'FREE' }), /후기/);
  assert.deepEqual(current.state, before);
});

test('previously displayed or pending suggestions cannot be applied after source review edits, deletion, or changed activity facts', () => {
  for (const mutate of [current => { current.state.posts[0].body = '수정한 후기'; }, current => { current.state.posts = []; }, current => { current.state.activities[0].title = '다른 약속 이름'; }]) {
    const current = context(), capture = captureReviewDraft(current); mutate(current);
    assert.equal(isReviewDraftCurrent(current, capture), false);
    assert.equal(capture.facts.ownReviews[0].body, '직접 작성한 후기', 'capture does not alias live source records');
  }
});

test('membership loss, blocking, archival, cancellation and a removed author invalidate a suggestion before display or apply', () => {
  for (const mutate of [current => { current.state.groups[0].memberIds = []; }, current => { current.state.groups[0].blockedMemberIds = ['me']; }, current => { current.state.groups[0].archived = true; }, current => { current.state.activities[0].status = 'CANCELLED'; }, current => { current.state.members = []; }]) {
    const current = context(), capture = captureReviewDraft(current); mutate(current);
    assert.equal(isReviewDraftCurrent(current, capture), false);
    assert.throws(() => captureReviewDraft(current));
  }
});
