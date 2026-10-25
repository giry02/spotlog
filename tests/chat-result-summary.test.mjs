import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
import { twoDayFixture } from '../scripts/evaluate-chatbot-matrix.mjs';
const { explicitExistingDayView, existingDayViewMessage, builtItineraryMessage } = await import('../lib/chat-result-summary.ts');
const { currentTrip, createTripSession } = await import('../lib/trip-engine.ts');
const { applyModelReply, parseTripSession } = await import('../lib/chat-contract.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const request = (session, text) => ({ protocolVersion: 1, requestId: 'summary-test', sessionId: 'summary-test',
  baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });

test('strict existing DAY views show actual visits and preserve other days and a locked booking', () => {
  const session = twoDayFixture({ booked: true }), original = structuredClone(session);
  const input = request(session, 'DAY 1 일정만 보여줘. 전체 여행 기간과 다른 날짜 일정, 예약한 숙소는 그대로 유지해.');
  assert.deepEqual(explicitExistingDayView(input), { type: 'show', stage: 'plan', day: 1 });
  const result = applyModelReply(input, { message: '하이포해변 주변 파도 한 모금 카페에서 12000원 차 시간이에요.', actions: [] }, 'local-action', undefined, { retrievalStatus: 'not-needed' });
  const turn = result.turns.at(-1);
  assert.equal(turn.source, 'local-action');
  assert.equal(turn.state.stage, 'plan');
  assert.equal(turn.state.activeDay, 1);
  assert.deepEqual(turn.state.plan, currentTrip(session).plan);
  assert.equal(turn.state.days, 2);
  assert.equal(turn.state.booked, true);
  assert.match(turn.assistantMessage, /협재해변/);
  assert.match(turn.assistantMessage, /오설록/);
  assert.match(turn.assistantMessage, /예약한 숙소/);
  assert.doesNotMatch(turn.assistantMessage, /파도 한 모금|하이포|12000|사려니/);
  assert.equal(turn.answerContext.modelRouting, undefined);
  assert.deepEqual(session, original);
  assert.ok(parseTripSession(result));
});

test('DAY view recognition does not intercept edits, negations, explanations, extra changes or uncreated days', () => {
  const session = twoDayFixture({ booked: true });
  for (const text of ['DAY 2 일정 보여줘', '2일차 일정만 보여 주세요', 'DAY 1 보여줘']) assert.ok(explicitExistingDayView(request(session, text)), text);
  for (const text of ['DAY 3 일정 보여줘', 'DAY 1 오후 장소만 돌문화공원으로 바꿔줘', 'DAY 1 일정만 보여주지 마',
    'DAY 1 일정 보여주는 방법 알려줘', 'DAY 1 일정만 보여줘. 숙소는 빼줘', 'DAY 1 일정만 보여줘 그리고 기간을 당일로 바꿔줘',
    '제주 DAY 1 일정 추천해줘', 'DAY 1 일정 확인해줘']) assert.equal(explicitExistingDayView(request(session, text)), null, text);
  assert.equal(explicitExistingDayView(request(createTripSession(), 'DAY 1 일정 보여줘')), null);
});

test('explicit display scope overrides a model rebuild rather than accepting unexpected changes', () => {
  const session = twoDayFixture({ booked: true });
  const result = applyModelReply(request(session, 'DAY 2 일정만 보여줘'), { message: '새로 만들게요.', actions: [
    { type: 'configure', days: 1, booked: false }, { type: 'build' },
  ] });
  assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan);
  assert.equal(currentTrip(result).days, 2);
  assert.equal(currentTrip(result).activeDay, 2);
  assert.match(result.turns.at(-1).assistantMessage, /사려니숲길/);
  assert.doesNotMatch(result.turns.at(-1).assistantMessage, /새로 만들/);
});

test('a one-day rebuild caption reflects the committed duration and keeps evidence and official caveats', () => {
  const session = twoDayFixture();
  const input = request(session, '기존 이틀 일정을 제주 당일 일정으로 다시 만들어줘. 사려니숲길과 절물자연휴양림만 오전 오후에 넣어줘. 식당 카페 숙소는 전부 빼줘.');
  const visits = [{ day: 1, placeId: 'saryeoni' }, { day: 1, placeId: 'jeolmul' }];
  const retrieval = { dataMode: 'curated-travel-data', indexVersion: 'idx:summary-current', embeddingModel: 'test-only',
    results: visits.map(({ placeId }) => ({ ...ragCatalog().find(item => item.placeId === placeId), evidenceId: `ev:summary:${placeId}`, sourceVersion: 'sv:summary' })) };
  const reply = { message: '제주 1박 2일 일정(사려니숲길·절물자연휴양림 포함) 생성 완료. 입장·예약은 공식 안내에서 확인하세요. 2026년 10월 16일 운항 정보도 공식 안내로 확인하세요.',
    actions: [{ type: 'build', visits }], evidenceIds: retrieval.results.map(item => item.evidenceId) };
  const before = structuredClone(reply);
  const result = applyModelReply(input, reply, 'flowise', retrieval);
  const turn = result.turns.at(-1);
  assert.equal(turn.state.days, 1);
  assert.match(turn.assistantMessage, /제주 당일 일정 초안/);
  assert.doesNotMatch(turn.assistantMessage, /1박\s*2일/);
  assert.match(turn.assistantMessage, /입장·예약은 공식 안내/);
  assert.match(turn.assistantMessage, /2026년 10월 16일/);
  assert.deepEqual(turn.evidenceIds, reply.evidenceIds);
  assert.deepEqual(reply, before);
});

test('result summaries do not reframe unrelated answers and use existing canonical names for display', () => {
  const session = twoDayFixture();
  const reply = { message: 'RAG는 검색 자료를 참고하는 방식이에요.', actions: [] };
  const result = applyModelReply(request(session, 'RAG가 뭐야?'), reply);
  assert.equal(result.turns.at(-1).assistantMessage, reply.message);
  assert.match(existingDayViewMessage(currentTrip(session), 2), /사려니숲길/);
  assert.match(builtItineraryMessage(currentTrip(session), '입장 예약을 확인해 주세요.'), /1박 2일/);
});

test('long source caveats keep complete sentences within the persisted reply bound', () => {
  const state = currentTrip(twoDayFixture());
  const long = '예약 ' + '확인'.repeat(1990) + '하세요.';
  const result = builtItineraryMessage(state, `${long} 공식 안내에서 입장을 확인하세요.`);
  assert.ok(result.length <= 4000);
  assert.match(result, /제주 1박 2일 일정 초안/);
  assert.match(result, /공식 안내에서 입장을 확인하세요/);
  assert.ok(!result.includes(long.slice(0, 50)), 'overlong caveats are omitted whole rather than truncated into fragments');
});
