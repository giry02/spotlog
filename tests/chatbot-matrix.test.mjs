import test from 'node:test';
import assert from 'node:assert/strict';
import { chatbotMatrix, twoDayFixture, inspectMatrixResponse, evaluateChatbotMatrix } from '../scripts/evaluate-chatbot-matrix.mjs';
const { createTripSession, currentTrip } = await import('../lib/trip-engine.ts');
const { applyModelReply, chatResponse } = await import('../lib/chat-contract.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const request = (session = createTripSession()) => ({ protocolVersion: 1, requestId: 'matrix-test', sessionId: 'matrix-test', baseRevision: session.turns.at(-1).id,
  session, action: { type: 'message', text: '안녕하세요' } });
const readonlyResponse = input => chatResponse(input, applyModelReply(input, { message: '안녕하세요. 무엇을 도와드릴까요?', actions: [] }, 'flowise', undefined, { retrievalStatus: 'not-needed' }), 'flowise');

test('matrix covers distinct live intents and authored fixtures preserve a real slot target and locked booking', () => {
  assert.equal(chatbotMatrix.length, 11);
  assert.equal(new Set(chatbotMatrix.map(item => item.id)).size, chatbotMatrix.length);
  for (const profile of ['gemini', 'ollama']) assert.equal(chatbotMatrix.filter(item => !item.profile || item.profile === profile).length, 10);
  const fixture = twoDayFixture({ booked: true });
  const state = currentTrip(fixture);
  assert.equal(state.days, 2);
  assert.equal(state.booked, true);
  assert.ok(state.plan.some(visit => visit.locked && visit.kind === 'stay'));
  assert.ok(state.plan.some(visit => visit.day === 2 && visit.kind === 'place' && visit.label.includes('오후')));
  const other = twoDayFixture({ booked: true });
  state.plan[0].label = 'mutated only in this disposable fixture';
  assert.notEqual(currentTrip(other).plan[0].label, state.plan[0].label);
});

test('matrix refuses remote endpoints before calling the transport', async () => {
  let called = false;
  await assert.rejects(evaluateChatbotMatrix({ endpoint: 'https://example.com/api/chat', fetcher() { called = true; } }), /LOCAL_ENDPOINT_REQUIRED/);
  assert.equal(called, false);
});

test('matrix rejects stale correlation and demo success even with otherwise valid sessions', () => {
  const input = request(), item = chatbotMatrix.find(item => item.id === 'greeting');
  const body = readonlyResponse(input);
  assert.equal(inspectMatrixResponse(item, input, body).passed, true);
  assert.equal(inspectMatrixResponse(item, input, { ...body, requestId: 'another-request' }).checks.correlation, false);
  assert.equal(inspectMatrixResponse(item, input, { ...body, mode: 'demo' }).checks.executionMode, false);
  assert.equal(inspectMatrixResponse(item, input, { ...body, revision: body.revision + 1 }).checks.revision, false);
});

test('matrix catches silent historical changes and keeps the original fixture immutable', () => {
  const input = request(twoDayFixture({ booked: true }));
  const original = structuredClone(input);
  const body = structuredClone(readonlyResponse(input));
  body.session.turns[0].state.days = 3;
  const result = inspectMatrixResponse({ id: 'historical-integrity' }, input, body);
  assert.equal(result.checks.priorTurnsUnchanged, false);
  assert.deepEqual(input, original);
});

test('matrix rejects stale itinerary provenance instead of accepting a plausible selected place', () => {
  const input = request();
  input.action.text = '제주 당일 일정으로 사려니숲길과 절물자연휴양림만 넣어줘. 식당 카페 숙소는 빼줘.';
  const visits = [{ day: 1, placeId: 'saryeoni' }, { day: 1, placeId: 'jeolmul' }];
  const retrieval = { dataMode: 'curated-travel-data', indexVersion: 'idx:matrix-live', embeddingModel: 'test-only',
    results: visits.map(({ placeId }) => ({ ...ragCatalog().find(source => source.placeId === placeId), evidenceId: `ev:matrix:${placeId}`, sourceVersion: 'sv:matrix' })) };
  const session = applyModelReply(input, { message: '공식 자료에서 찾은 두 숲을 배치했어요.', actions: [
    { type: 'region', region: '제주' }, { type: 'configure', days: 1, meals: false, cafes: false, lodging: false }, { type: 'build', visits },
  ] }, 'flowise', retrieval);
  const body = chatResponse(input, session, 'flowise');
  const item = chatbotMatrix.find(item => item.id === 'new-rag-forest-day');
  assert.equal(inspectMatrixResponse(item, input, body).passed, true);
  assert.equal(inspectMatrixResponse(item, input, { ...body, message: '제주 1박 2일 일정 생성 완료' }).checks.replyDurationMatchesCards, false);
  const wrongFlags = structuredClone(body);
  currentTrip(wrongFlags.session).lodging = true;
  assert.equal(inspectMatrixResponse(item, input, wrongFlags).checks.excludedBusinesses, false, 'an absent one-day stay card cannot conceal a retained lodging preference');
  currentTrip(session).plan.find(visit => visit.kind === 'place').knowledge.indexVersion = 'idx:old';
  assert.equal(inspectMatrixResponse(item, input, body).checks.currentRagGrounding, false);
});

test('DAY view evaluation rejects a known cafe claimed as a planned visit when it is absent from that day', () => {
  const input = request(twoDayFixture({ booked: true }));
  const body = readonlyResponse(input);
  body.message = 'DAY 1 오후는 파도 한 모금(hj-cafe)에서 차 시간이에요.';
  const item = chatbotMatrix.find(item => item.id === 'day-one-view-preserves-duration-and-booking');
  assert.equal(inspectMatrixResponse(item, input, body).checks.noUnplannedBusinessClaims, false);
});

test('matrix continues independent cases after a transport failure and never records exception details', async () => {
  let calls = 0;
  const cases = [chatbotMatrix[0], { ...chatbotMatrix[0], id: 'second-independent-greeting' }];
  const report = await evaluateChatbotMatrix({ cases, fetcher: async (_url, init) => {
    if (++calls === 1) throw new Error('private-network-details-must-not-be-recorded');
    return Response.json(readonlyResponse(JSON.parse(init.body)));
  } });
  assert.equal(calls, 2);
  assert.equal(report.passed, false);
  assert.equal(report.cases[0].outcome, 'TRANSPORT_OR_CONTRACT_FAILURE');
  assert.equal(report.cases[1].passed, true);
  assert.equal(report.actualEndpointCalls, false);
  assert.ok(!JSON.stringify(report).includes('private-network-details'));
});

test('matrix records safe HTTP error codes while omitting upstream error payloads', async () => {
  const report = await evaluateChatbotMatrix({ cases: [chatbotMatrix[0]], fetcher: async () => Response.json({
    error: { code: 'FLOWISE_TIMEOUT', message: 'private credential and host diagnostic' },
  }, { status: 504 }) });
  assert.equal(report.cases[0].outcome, 'HTTP_504');
  assert.equal(report.cases[0].errorCode, 'FLOWISE_TIMEOUT');
  assert.ok(!JSON.stringify(report).includes('private credential'));
});
