import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChatSearchRequest, chatSearchModelInput, validateChatSearchResult } from '../server/chatSearchModel.mjs';
const body = () => ({ schemaVersion: 1, feature: 'CHAT_SEARCH', requestId: 'question-1', scope: { userId: 'me', groupId: 'family', roomId: 'activity:trip' }, payload: {
  question: '몇 시에 모여?', cutoff: '2026-11-23T04:00:00Z', filters: { scope: 'all' }, sources: [
    { id: 'new', roomId: 'activity:trip', authorId: 'mom', body: '집결은 11시로 바꿨어요.', createdAt: '2026-11-23T02:00:00Z' },
    { id: 'old', roomId: 'activity:trip', authorId: 'me', body: '10시에 모여요.', createdAt: '2026-11-23T01:00:00Z' },
  ],
} });

test('server accepts only one scoped bounded evidence set and strips unrelated request metadata', () => {
  const request = body(); request.payload.privateProfile = 'never send';
  const input = normalizeChatSearchRequest(request);
  assert.deepEqual(input.sources.map(source => source.id), ['old', 'new']);
  const model = chatSearchModelInput(input);
  assert.deepEqual(model.data.sources.map(source => source.ref), [1, 2]);
  assert.deepEqual(model.data.sources.map(source => source.speaker), ['p1', 'p2']);
  assert.deepEqual(model.data.sources.map(source => source.writtenAt), input.sources.map(source => source.createdAt));
  assert.equal('cutoff' in model.data, false);
  assert.equal('at' in model.data.sources[0], false);
  assert.equal(JSON.stringify(model).includes('never send'), false);
  assert.equal(model.schema.properties.refs.items.maximum, 2);
  assert.match(model.instruction, /최신|정정/); assert.match(model.instruction, /불충분|unknown/);
});

test('server rejects mismatched rooms, duplicate sources, wrong author filters, future text and oversized ranges', () => {
  const cases = [request => { request.payload.sources[0].roomId = 'group:family'; }, request => { request.payload.sources[0].id = 'old'; }, request => { request.payload.filters.authorId = 'nobody'; }, request => { request.payload.sources[0].createdAt = '2026-11-24T00:00:00Z'; }, request => { request.payload.question = ''; }, request => { request.scope.roomId = 'group:other'; }];
  for (const mutate of cases) { const request = body(); mutate(request); assert.throws(() => normalizeChatSearchRequest(request), /INVALID_CHAT_SEARCH_REQUEST/); }
  const excess = body(); excess.payload.sources = Array.from({ length: 81 }, (_, index) => ({ ...excess.payload.sources[0], id: `message-${index}` })); assert.throws(() => normalizeChatSearchRequest(excess), /CHAT_RANGE_TOO_LARGE/);
  const chars = body(); chars.payload.sources.push({ ...chars.payload.sources[0], id: 'extra' }); for (const source of chars.payload.sources) source.body = '문'.repeat(5000); assert.throws(() => normalizeChatSearchRequest(chars), /CHAT_RANGE_TOO_LARGE/);
});

test('model validation maps refs to exact original IDs and never invents a known answer from absent evidence', () => {
  const input = normalizeChatSearchRequest(body());
  assert.deepEqual(validateChatSearchResult(input, { answer: '11시로 변경되었어요.', unknown: false, refs: [2] }), { answer: '11시로 변경되었어요.', unknown: false, sourceIds: ['new'] });
  for (const output of [{ answer: 'known', unknown: false, refs: [] }, { answer: 'known', unknown: false, refs: [3] }, { answer: 'known', unknown: false, refs: [0] }, { answer: 'unknown', unknown: true, refs: [1] }, { answer: '', unknown: true, refs: [] }]) assert.throws(() => validateChatSearchResult(input, output), /INVALID_MODEL_RESULT/);
  assert.deepEqual(validateChatSearchResult(input, { answer: '아마 오후일 거예요', unknown: true, refs: [] }), { answer: '선택한 대화에서는 확인하지 못했어요.', unknown: true, sourceIds: [] });
});

test('who answers carry grounded speaker IDs for the client to resolve using current room nicknames', () => {
  const input = normalizeChatSearchRequest(body());
  assert.deepEqual(validateChatSearchResult(input, { answer: '시간을 변경했다고 했어요.', unknown: false, refs: [2], speakers: ['p2'] }), { answer: '시간을 변경했다고 했어요.', unknown: false, sourceIds: ['new'], speakerIds: ['mom'] });
  for (const output of [{ answer: 'known', unknown: false, refs: [2], speakers: ['p1'] }, { answer: 'known', unknown: false, refs: [2], speakers: ['p9'] }, { answer: 'p2가 가져와요.', unknown: false, refs: [2], speakers: [] }, { answer: 'p9가 가져와요.', unknown: false, refs: [2], speakers: ['p2'] }]) assert.throws(() => validateChatSearchResult(input, output), /INVALID_MODEL_RESULT/);
});

test('valid cited model speaker tokens become a neutral label while current room identity remains structured', () => {
  const input = normalizeChatSearchRequest(body());
  for (const [text, expected] of [['p2가 가져오기로 했어요.', '해당 발언자가 가져오기로 했어요.'], ['p2이 준비해요.', '해당 발언자가 준비해요.'], ['p2은 준비해요.', '해당 발언자는 준비해요.']]) {
    assert.deepEqual(validateChatSearchResult(input, { answer: text, unknown: false, refs: [2], speakers: ['p2'] }), { answer: expected, unknown: false, sourceIds: ['new'], speakerIds: ['mom'] });
  }
  assert.throws(() => validateChatSearchResult(input, { answer: 'p1이 가져와요.', unknown: false, refs: [2], speakers: ['p2'] }), /INVALID_MODEL_RESULT/);
});

test('date selections are real Korean calendar windows and cannot smuggle out-of-window originals', () => {
  const invalid = body(); invalid.payload.filters = { scope: 'date', from: '2027-02-29', to: '2027-03-01' }; assert.throws(() => normalizeChatSearchRequest(invalid), /INVALID_CHAT_SEARCH_REQUEST/);
  const outside = body(); outside.payload.filters = { scope: 'date', from: '2026-11-22', to: '2026-11-22' }; assert.throws(() => normalizeChatSearchRequest(outside), /INVALID_CHAT_SEARCH_REQUEST/);
});

test('one concise answer uses at most three direct sources and keeps an explicitly undecided role separate from other topics', () => {
  const request = body(); request.payload.question = '예약 담당자는 정해졌어?';
  request.payload.sources.push({ id: 'role', roomId: 'activity:trip', authorId: 'mom', body: '예약 담당은 아직 정하지 않았어요.', createdAt: '2026-11-23T03:00:00Z' }, { id: 'tripod', roomId: 'activity:trip', authorId: 'me', body: '삼각대는 제가 챙길게요.', createdAt: '2026-11-23T03:30:00Z' });
  const input = normalizeChatSearchRequest(request);
  assert.deepEqual(validateChatSearchResult(input, { answer: '예약 담당자는 아직 정해지지 않았어요.', unknown: false, refs: [3], speakers: [] }), { answer: '예약 담당자는 아직 정해지지 않았어요.', unknown: false, sourceIds: ['role'] });
  assert.throws(() => validateChatSearchResult(input, { answer: '답', unknown: false, refs: [1, 2, 3, 4], speakers: [] }), /INVALID_MODEL_RESULT/);
  assert.throws(() => validateChatSearchResult(input, { answer: '문'.repeat(241), unknown: false, refs: [3], speakers: [] }), /INVALID_MODEL_RESULT/);
  const model = chatSearchModelInput(input);
  assert.equal(model.schema.properties.refs.maxItems, 3);
  assert.equal(model.schema.properties.answer.maxLength, 240);
});
