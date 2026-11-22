import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { createChatAiSummaryRequest, MAX_CHAT_AI_MESSAGES, MAX_CHAT_AI_CHARACTERS, normalizeAiEndpoint,
  parseChatAiSummaryOutput, postScopedAiJson, projectChatAiRequest, requestChatAiSummary } from '../src/together/chatAiSummary.ts';
import { normalizeChatSummaryRequest } from '../server/chatSummaryModel.mjs';

const cutoff = Date.parse('2026-11-09T03:00:00Z');
const scope = { userId: 'me', groupId: 'family', roomId: 'activity:trip' };
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'mom', name: '엄마' });
  state.groups.push({ id: 'family', name: '가족', kind: 'FAMILY', region: '부산', introduction: '공유하지 않는 소개', cover: '', visibility: 'PRIVATE', ownerId: 'me', memberIds: ['me', 'mom'], managerIds: [], archived: false, promotionPublished: false });
  state.activities.push({ id: 'trip', groupId: 'family', title: '여행', date: '', endDate: '', meetingPoint: '요청에서 제외할 장소', description: '', status: 'PLANNED', leadId: 'me', editorIds: [], participants: { me: 'DECLINED' }, arrivedIds: [], revision: 1 });
  state.messages.push(
    { id: 'one', roomId: 'activity:trip', authorId: 'mom', body: '물을 챙겨 주세요.', createdAt: '2026-11-09T01:00:00Z' },
    { id: 'two', roomId: 'activity:trip', authorId: 'me', body: '점심 예약 여부는 확인이 필요해요.', createdAt: '2026-11-09T02:00:00Z' },
  );
  return { state, ...scope };
}
const requestFor = (context = fixture(), filters = { scope: 'all' }, purpose = 'KEY_POINTS') => createChatAiSummaryRequest(context, filters, purpose, cutoff, 'request-one');
const outputFor = (sourceIds = ['one']) => ({ title: '여행 준비와 확인', sections: [{ heading: '준비', items: [{ text: '물을 챙기자는 발언이 있어요.', sourceIds }] }] });
const responseFor = (request, output = outputFor()) => ({ schemaVersion: 1, requestId: request.requestId, scope: { ...request.scope }, output });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const signal = () => new AbortController().signal;

test('request includes only the selected exact-room human originals and never mutates chat, reading or participation', () => {
  const context = fixture();
  context.state.messages.push(
    { ...context.state.messages[0], id: 'group', roomId: 'group:family' },
    { ...context.state.messages[0], id: 'foreign', roomId: 'activity:other' },
    { ...context.state.messages[0], id: 'entity', entity: { type: 'POLL', id: 'private-poll' } },
    { ...context.state.messages[0], id: 'sticker', body: '', stickerId: 'bunny-hi' },
    { ...context.state.messages[0], id: 'deleted', deleted: true },
  );
  const before = structuredClone(context.state), request = requestFor(context);
  assert.deepEqual(request.scope, scope);
  assert.deepEqual(request.payload.sources.map(item => item.id), ['two', 'one']);
  assert.deepEqual(Object.keys(request.payload.sources[0]).sort(), ['authorId', 'body', 'createdAt', 'id', 'roomId']);
  assert.equal(JSON.stringify(request).includes('공유하지 않는 소개'), false);
  assert.equal(JSON.stringify(request).includes('요청에서 제외할 장소'), false);
  assert.deepEqual(context.state, before);
  context.state.messages[0].body = '수정됨';
  assert.equal(request.payload.sources.find(item => item.id === 'one').body, '물을 챙겨 주세요.');
});

test('person purpose and existing date/unread filters narrow the actual transmitted originals', () => {
  const context = fixture();
  assert.throws(() => requestFor(context, { scope: 'all' }, 'PERSON'), /참여자/);
  assert.deepEqual(requestFor(context, { scope: 'date', from: '2026-11-09', to: '2026-11-09', authorId: 'mom' }, 'PERSON').payload.sources.map(item => item.id), ['one']);
  assert.deepEqual(requestFor({ ...context, unreadAfter: '2026-11-09T01:30:00Z' }, { scope: 'unread' }).payload.sources.map(item => item.id), ['two']);
  assert.throws(() => requestFor(context, { scope: 'date', from: '2026-11-10', to: '2026-11-09' }), /종료/);
});

test('empty, over-limit and revoked selections are rejected rather than truncated or replaced by sample summaries', () => {
  const context = fixture();
  assert.throws(() => requestFor(context, { scope: 'all', authorId: 'nobody' }), /원문/);
  const excess = fixture();
  excess.state.messages = Array.from({ length: MAX_CHAT_AI_MESSAGES + 1 }, (_, index) => ({ ...excess.state.messages[0], id: `source-${index}` }));
  assert.throws(() => requestFor(excess), /좁혀/);
  excess.state.messages = [{ ...context.state.messages[0], body: '문'.repeat(MAX_CHAT_AI_CHARACTERS + 1) }];
  assert.throws(() => requestFor(excess), /좁혀/);
  context.state.groups[0].blockedMemberIds = ['me'];
  assert.throws(() => requestFor(context), /권한/);
});

test('valid HTTP POST preserves the scoped request and accepts only a structured cited response', async () => {
  const request = requestFor(), calls = [];
  const result = await requestChatAiSummary('/api/ai', request, signal(), async (url, options) => {
    calls.push({ url, options }); return json(responseFor(request));
  });
  assert.deepEqual(result, outputFor()); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/ai'); assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'same-origin'); assert.equal(calls[0].options.cache, 'no-store');
  assert.deepEqual(JSON.parse(calls[0].options.body), request);
  assert.equal('Authorization' in calls[0].options.headers, false);
});

test('missing or unsafe endpoint never invokes a fetch and never produces fallback output', async () => {
  let calls = 0;
  for (const endpoint of ['', '//other.invalid/ai', 'javascript:alert(1)', 'http://remote.invalid/ai', 'https://key:secret@remote.invalid/ai']) {
    await assert.rejects(requestChatAiSummary(endpoint, requestFor(), signal(), async () => { calls++; return json({}); }));
  }
  assert.equal(calls, 0);
  assert.equal(normalizeAiEndpoint('/api/ai'), '/api/ai');
  assert.equal(normalizeAiEndpoint('http://127.0.0.1:8000/ai'), 'http://127.0.0.1:8000/ai');
  assert.equal(normalizeAiEndpoint('https://example.invalid/ai'), 'https://example.invalid/ai');
});

test('every statement needs selected source citations; unknown, empty or uncited responses fail validation', () => {
  const request = requestFor();
  for (const output of [null, { title: '텍스트만 있는 응답', sections: [] }, outputFor([]), outputFor(['group']), outputFor(['unknown']), { ...outputFor(), sections: [{ heading: '제목', items: [{ text: '근거 없음' }] }] }]) {
    assert.throws(() => parseChatAiSummaryOutput(output, request), /근거/);
  }
  assert.deepEqual(parseChatAiSummaryOutput(outputFor(['one', 'one']), request), outputFor(['one']));
});

test('a different request, account, group or room response is rejected even when its prose and citations look valid', async () => {
  const request = requestFor();
  for (const mutate of [body => { body.schemaVersion = 2; }, body => { body.requestId = 'late-request'; }, body => { body.scope.userId = 'other'; }, body => { body.scope.groupId = 'other'; }, body => { body.scope.roomId = 'group:family'; }]) {
    const body = responseFor(request); mutate(body);
    await assert.rejects(requestChatAiSummary('/api/ai', request, signal(), async () => json(body)), /다른 요청/);
  }
});

test('HTTP failures and malformed JSON remain errors without retry or sample fallback', async () => {
  const request = requestFor(); let calls = 0;
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(requestChatAiSummary('/api/ai', request, signal(), async () => { calls++; return json({}, status); }));
  }
  assert.equal(calls, 4);
  await assert.rejects(requestChatAiSummary('/api/ai', request, signal(), async () => new Response('not json')), /응답 형식/);
  await assert.rejects(requestChatAiSummary('/api/ai', request, signal(), async () => { throw new Error('offline'); }), /연결하지 못했/);
});

test('pre-aborted operations never send and a fetch that ignores cancellation cannot apply a late result', async () => {
  const request = requestFor(), before = new AbortController(); before.abort(); let calls = 0;
  await assert.rejects(requestChatAiSummary('/api/ai', request, before.signal, async () => { calls++; return json(responseFor(request)); }), { name: 'AbortError' });
  assert.equal(calls, 0);
  const during = new AbortController(); let finish, innerSignal;
  const operation = requestChatAiSummary('/api/ai', request, during.signal, async (_url, options) => { innerSignal = options.signal; return new Promise(resolve => { finish = resolve; }); });
  await Promise.resolve(); during.abort();
  await assert.rejects(operation, { name: 'AbortError' }); assert.equal(innerSignal.aborted, true);
  finish(json(responseFor(request))); await Promise.resolve();
});

test('current-scope projection hides summaries after condition, purpose, account or room changes', () => {
  const context = fixture(), request = requestFor(context);
  assert.equal(projectChatAiRequest(context, request).available, true);
  assert.equal(projectChatAiRequest(context, request, { scope: 'today' }).reason, 'selection');
  assert.equal(projectChatAiRequest(context, request, { scope: 'all' }, 'PREPARATION').reason, 'selection');
  assert.equal(projectChatAiRequest({ ...context, userId: 'mom' }, request).reason, 'access');
  assert.equal(projectChatAiRequest({ ...context, roomId: 'group:family' }, request).reason, 'access');
  assert.equal(projectChatAiRequest({ ...context, groupId: 'foreign' }, request).reason, 'access');
});

test('edits, deletion, duplicate IDs, source reparenting and membership loss invalidate captured AI prose', () => {
  for (const mutate of [context => { context.state.messages[0].body = '다른 원문'; }, context => { context.state.messages[0].deleted = true; }, context => { context.state.messages.push({ ...context.state.messages[0] }); }, context => { context.state.messages[0].roomId = 'group:family'; }, context => { context.state.groups[0].memberIds = ['mom']; }, context => { context.state.groups[0].blockedMemberIds = ['me']; }]) {
    const context = fixture(), request = requestFor(context); mutate(context);
    assert.equal(projectChatAiRequest(context, request).available, false);
  }
});

test('new messages remain outside the captured result and are counted for an explicit regeneration', () => {
  const context = fixture(), request = requestFor(context);
  context.state.messages.push({ ...context.state.messages[0], id: 'new', createdAt: new Date(cutoff + 1000).toISOString() });
  assert.deepEqual(projectChatAiRequest(context, request), { available: true, reason: null, newMessageCount: 1 });
  assert.deepEqual(request.payload.sources.map(item => item.id), ['two', 'one']);
});

test('the shared HTTP envelope also supports an explicit review draft adapter without adding chat originals', async () => {
  const request = { schemaVersion: 1, requestId: 'review-one', feature: 'REVIEW_DRAFT', scope, payload: { activities: [], ownReviews: [] } };
  const output = await postScopedAiJson('/api/ai', request, signal(), value => {
    assert.equal(typeof value.title, 'string'); assert.equal(typeof value.body, 'string'); return value;
  }, async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body).payload, request.payload);
    return json(responseFor(request, { title: '검토할 후기', body: '수정할 초안' }));
  });
  assert.equal(output.title, '검토할 후기');
});

test('81 originals fail before transport; an explicit latest window sends the newest 80 within the same server limit', () => {
  const context = fixture();
  context.state.messages = Array.from({ length: 81 }, (_, index) => ({ ...context.state.messages[0], id: 'many-' + index,
    createdAt: new Date(cutoff - (81 - index) * 1000).toISOString() }));
  assert.throws(() => requestFor(context), /좁혀/);
  const request = requestFor(context, { scope: 'latest' });
  assert.equal(MAX_CHAT_AI_MESSAGES, 80); assert.equal(MAX_CHAT_AI_CHARACTERS, 12000);
  assert.equal(request.payload.sources.length, 80);
  assert.equal(request.payload.sources[0].id, 'many-80');
  assert.equal(request.payload.sources.at(-1).id, 'many-1');
  assert.equal(request.payload.filters.scope, 'latest');
  assert.equal(normalizeChatSummaryRequest(request).sources.length, 80);
});

test('the explicit latest window respects character capacity without skipping newer messages to fit older ones', () => {
  const context = fixture();
  context.state.messages = Array.from({ length: 5 }, (_, index) => ({ ...context.state.messages[0], id: 'long-' + index,
    body: '가'.repeat(index === 0 ? 30 : 4000), createdAt: new Date(cutoff - (5 - index) * 1000).toISOString() }));
  assert.throws(() => requestFor(context), /좁혀/);
  const request = requestFor(context, { scope: 'latest' });
  assert.deepEqual(request.payload.sources.map(source => source.id), ['long-4', 'long-3', 'long-2']);
  assert.equal(normalizeChatSummaryRequest(request).sources.length, 3);
});

test('attribution requires a real author in the cited originals and volunteer metadata cannot appoint another person', () => {
  const context = fixture(); context.state.messages[0].body = '제가 물을 챙길게요.';
  const request = requestFor(context), output = outputFor();
  output.sections[0].items[0].speakerId = 'mom'; output.sections[0].items[0].volunteered = true;
  assert.equal(parseChatAiSummaryOutput(output, request).sections[0].items[0].speakerId, 'mom');
  output.sections[0].items[0].speakerId = 'me';
  assert.throws(() => parseChatAiSummaryOutput(output, request), /근거/);
  output.sections[0].items[0].speakerId = 'invented';
  assert.throws(() => parseChatAiSummaryOutput(output, request), /근거/);
  output.sections[0].items[0].speakerId = 'mom';
  const requestWithoutVolunteering = requestFor();
  assert.throws(() => parseChatAiSummaryOutput(output, requestWithoutVolunteering), /근거/);
  for (const body of ['제가 물을 챙길까요?', '제가 물은 못 챙길 것 같아요.']) {
    context.state.messages[0].body = body;
    assert.throws(() => parseChatAiSummaryOutput(output, requestFor(context)), /근거/);
  }
});
