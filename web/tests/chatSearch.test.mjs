import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { createChatSearchMemory, createChatSearchRequest, emptyChatSearch, parseChatSearchAnswer, projectChatSearchRequest, requestChatSearchAnswer, selectChatSearchMessages } from '../src/together/chatSearch.ts';
import { MAX_CHAT_AI_MESSAGES, MAX_CHAT_AI_CHARACTERS } from '../src/together/chatAiSummary.ts';

const cutoff = Date.parse('2026-11-23T12:00:00Z');
const filters = { scope: 'all', kind: 'ALL' };
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'mom', name: '엄마' });
  state.groups.push({ id: 'family', name: '가족', kind: 'FAMILY', region: '부산', introduction: '전송할 수 없는 소개', cover: '', visibility: 'PRIVATE', ownerId: 'me', memberIds: ['me', 'mom'], managerIds: [], archived: false, promotionPublished: false });
  state.activities.push({ id: 'trip', groupId: 'family', title: '여행', date: '', endDate: '', meetingPoint: '사적인 집결지', description: '', status: 'PLANNED', leadId: 'me', editorIds: [], participants: { me: 'DECLINED' }, arrivedIds: [], revision: 1 });
  state.messages.push(
    { id: 'one', roomId: 'activity:trip', authorId: 'mom', body: '물을 챙길게요.', createdAt: '2026-11-22T23:00:00Z' },
    { id: 'two', roomId: 'activity:trip', authorId: 'me', body: '집결 시간은 11시로 바꿨어요.', createdAt: '2026-11-23T02:00:00Z' },
    { id: 'old', roomId: 'activity:trip', authorId: 'me', body: '지난 정보 https://example.invalid', createdAt: '2026-11-20T02:00:00Z' },
    { id: 'foreign', roomId: 'group:family', authorId: 'mom', body: '다른 방의 개인 정보', createdAt: '2026-11-23T01:00:00Z' },
    { id: 'sticker', roomId: 'activity:trip', authorId: 'mom', body: '', stickerId: 'bunny-hi', createdAt: '2026-11-23T03:00:00Z' },
  );
  return { state, userId: 'me', groupId: 'family', roomId: 'activity:trip' };
}
const requestFor = (context = fixture(), extra = {}) => createChatSearchRequest(context, '몇 시에 모여?', { ...filters, ...extra }, cutoff, 'search-one');
const answer = { answer: '집결 시간을 11시로 변경했어요.', unknown: false, sourceIds: ['two'] };
const response = (request, output = answer, extra = {}) => new Response(JSON.stringify({ schemaVersion: 1, requestId: request.requestId, scope: request.scope, output, ...extra }), { headers: { 'Content-Type': 'application/json' } });

test('literal search is current-room-only, supports author/name/content/date, and never filters or marks the history', () => {
  const context = fixture(), before = structuredClone(context.state);
  assert.deepEqual(selectChatSearchMessages(context, '엄마', filters, cutoff).map(row => row.id), ['sticker', 'one']);
  assert.deepEqual(selectChatSearchMessages(context, '', { ...filters, kind: 'LINK' }, cutoff).map(row => row.id), ['old']);
  assert.deepEqual(selectChatSearchMessages(context, '', { ...filters, authorId: 'mom', kind: 'TEXT' }, cutoff).map(row => row.id), ['one']);
  assert.deepEqual(selectChatSearchMessages(context, '', { ...filters, scope: 'date', from: '2026-11-23', to: '2026-11-23', kind: 'TEXT' }, cutoff).map(row => row.id), ['two', 'one']);
  assert.deepEqual(context.state, before);
  assert.throws(() => selectChatSearchMessages(context, '', { ...filters, scope: 'date', from: '2027-02-29', to: '2027-03-01' }, cutoff), /날짜/);
});

test('deleted, ambiguous duplicate IDs and inaccessible shared-card bodies are not searchable', () => {
  const context = fixture();
  context.state.messages.push({ ...context.state.messages[0], deleted: true, id: 'gone' }, { ...context.state.messages[0], id: 'one' }, { ...context.state.messages[1], id: 'card', entity: { type: 'POLL', id: 'missing' } });
  assert.deepEqual(selectChatSearchMessages(context, '', filters, cutoff).map(row => row.id), ['sticker', 'two', 'old']);
});

test('AI questions send selected original text, not keyword matches, names, group metadata or entity cards', () => {
  const context = fixture();
  context.state.messages.push({ ...context.state.messages[1], id: 'card', entity: { type: 'POLL', id: 'poll' } });
  const request = requestFor(context);
  assert.equal(request.feature, 'CHAT_SEARCH');
  assert.deepEqual(request.payload.sources.map(row => row.id), ['two', 'one', 'old']);
  assert.deepEqual(request.scope, { userId: 'me', groupId: 'family', roomId: 'activity:trip' });
  assert.equal(JSON.stringify(request).includes('전송할 수 없는 소개'), false);
  assert.equal(JSON.stringify(request).includes('사적인 집결지'), false);
  assert.equal(JSON.stringify(request).includes('다른 방의 개인 정보'), false);
  assert.equal(JSON.stringify(request).includes('엄마'), false);
});

test('AI does not silently truncate over-limit or empty evidence, and rejects absent questions and access', () => {
  const context = fixture();
  assert.throws(() => createChatSearchRequest(context, '', filters, cutoff), /궁금/);
  assert.throws(() => requestFor(context, { authorId: 'nobody' }), /원문|대화/);
  context.state.messages = Array.from({ length: MAX_CHAT_AI_MESSAGES + 1 }, (_, index) => ({ ...context.state.messages[0], id: `message-${index}` }));
  assert.throws(() => requestFor(context), /좁혀/);
  context.state.messages = [{ id: 'large', roomId: context.roomId, authorId: 'me', body: '한'.repeat(MAX_CHAT_AI_CHARACTERS + 1), createdAt: '2026-11-23T02:00:00Z' }];
  assert.throws(() => requestFor(context), /좁혀/);
  context.state.groups[0].blockedMemberIds = ['me'];
  assert.throws(() => requestFor(context), /권한/);
});

test('known answers require selected citations; unknown answers are explicit rather than inferred or fabricated', () => {
  const request = requestFor();
  assert.deepEqual(parseChatSearchAnswer(answer, request), answer);
  for (const output of [{ ...answer, sourceIds: [] }, { ...answer, sourceIds: ['foreign'] }, { ...answer, sourceIds: ['missing'] }, { ...answer, unknown: true }, { ...answer, answer: '' }]) assert.throws(() => parseChatSearchAnswer(output, request), /근거/);
  const unknown = parseChatSearchAnswer({ answer: '아마 3시에요', sourceIds: [], unknown: true }, request);
  assert.match(unknown.answer, /확인하지 못/); assert.equal(unknown.unknown, true); assert.deepEqual(unknown.sourceIds, []);
});

test('question/author/date changes, original edits and actor/room revocation invalidate captured answers', () => {
  const context = fixture(), request = requestFor(context);
  assert.equal(projectChatSearchRequest(context, request), true);
  assert.equal(projectChatSearchRequest(context, request, '다른 질문', filters), false);
  assert.equal(projectChatSearchRequest(context, request, request.payload.question, { ...filters, authorId: 'mom' }), false);
  assert.equal(projectChatSearchRequest({ ...context, userId: 'mom' }, request), false);
  assert.equal(projectChatSearchRequest({ ...context, roomId: 'group:family' }, request), false);
  context.state.messages.find(row => row.id === 'two').body = '시간이 바뀜';
  assert.equal(projectChatSearchRequest(context, request), false);
});

test('answers can name only cited selected speakers through IDs, never pseudonym prose or unrelated members', () => {
  const request = requestFor();
  assert.deepEqual(parseChatSearchAnswer({ ...answer, speakerIds: ['me'] }, request).speakerIds, ['me']);
  for (const output of [{ ...answer, speakerIds: ['mom'] }, { ...answer, speakerIds: ['other-room-person'] }, { ...answer, answer: 'p1이 챙기기로 했어요.' }, { answer: 'unknown', unknown: true, sourceIds: [], speakerIds: ['me'] }]) assert.throws(() => parseChatSearchAnswer(output, request), /근거/);
});

test('actual POST retains the scope envelope and response correlation; no endpoint/error is never keyword fallback', async () => {
  const context = fixture(), request = requestFor(context), calls = [];
  assert.deepEqual(await requestChatSearchAnswer('/api/chat-ai', request, new AbortController().signal, () => context, async (url, init) => { calls.push([url, init]); return response(request); }), answer);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], '/api/chat-ai'); assert.deepEqual(JSON.parse(calls[0][1].body), request);
  assert.equal(calls[0][1].credentials, 'same-origin'); assert.equal(calls[0][1].cache, 'no-store');
  let count = 0;
  await assert.rejects(requestChatSearchAnswer('', request, new AbortController().signal, () => context, async () => { count++; return response(request); }), /연결/);
  assert.equal(count, 0);
  await assert.rejects(requestChatSearchAnswer('/api/chat-ai', request, new AbortController().signal, () => context, async () => response(request, answer, { requestId: 'other' })), /다른 요청/);
  for (const status of [401, 403, 429, 500]) await assert.rejects(requestChatSearchAnswer('/api/chat-ai', request, new AbortController().signal, () => context, async () => new Response('', { status })));
});

test('late replies are rejected after source edits, membership removal or actor switch, and cancellation rejects promptly', async () => {
  for (const mutate of [context => { context.state.messages[1].body = '수정'; }, context => { context.state.groups[0].memberIds = ['mom']; }, context => { context.userId = 'mom'; }]) {
    const context = fixture(), request = requestFor(context); let release;
    const pending = requestChatSearchAnswer('/api/chat-ai', request, new AbortController().signal, () => context, () => new Promise(resolve => { release = resolve; }));
    await Promise.resolve(); mutate(context); release(response(request)); await assert.rejects(pending, /바뀌었/);
  }
  const context = fixture(), request = requestFor(context), abort = new AbortController();
  const pending = requestChatSearchAnswer('/api/chat-ai', request, abort.signal, () => context, () => new Promise(() => {}));
  abort.abort(); await assert.rejects(pending, error => error.name === 'AbortError');
});

test('access revoked before deferred dispatch prevents the network request entirely', async () => {
  const context = fixture(), request = requestFor(context); let calls = 0;
  const pending = requestChatSearchAnswer('/api/chat-ai', request, new AbortController().signal, () => context, async () => { calls++; return response(request); });
  context.state.groups[0].memberIds = ['mom'];
  await assert.rejects(pending, /바뀌었/); assert.equal(calls, 0);
});

test('parent memory preserves source-return queries, filters, scroll and selected row while remaining actor/room isolated', () => {
  const memory = createChatSearchMemory(), context = fixture(); memory.activate('me');
  const session = { ...emptyChatSearch(), query: '집결', filters: { scope: 'date', kind: 'TEXT', authorId: 'me', from: '2026-11-23', to: '2026-11-23' }, scrollTop: 320, selectedId: 'two', filtersOpen: true };
  assert.equal(memory.write(context, session), true); assert.deepEqual(memory.read(context), session);
  const read = memory.read(context); read.filters.authorId = 'mom'; assert.equal(memory.read(context).filters.authorId, 'me');
  assert.equal(memory.read({ ...context, roomId: 'group:family' }).query, '');
  memory.activate('mom'); assert.equal(memory.read({ ...context, userId: 'mom' }).query, ''); assert.equal(memory.write(context, session), false);
  memory.activate('me'); assert.equal(memory.read(context).query, '');
});

test('memory discards stale generated prose without losing search input and erases revoked room state', () => {
  const memory = createChatSearchMemory(), context = fixture(); memory.activate('me');
  const request = requestFor(context), session = { ...emptyChatSearch(), question: request.payload.question, query: '집결', ai: { request, output: answer } };
  memory.write(context, session); assert.equal(memory.read(context).ai.output.answer, answer.answer);
  context.state.messages[1].body = '변경'; memory.reconcile(context.state, 'me');
  assert.equal(memory.read(context).query, '집결'); assert.equal(memory.read(context).ai, undefined);
  context.state.groups[0].blockedMemberIds = ['me']; memory.reconcile(context.state, 'me');
  assert.equal(memory.read(context).query, '');
});
