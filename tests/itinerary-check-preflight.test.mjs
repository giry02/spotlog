import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export const env = {}', shortCircuit: true };
  if (specifier.startsWith('@/')) return next(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (/(?:\/lib\/[^/]+|\/app\/api\/chat\/route)\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./')) return next(specifier + '.ts', context);
  return next(specifier, context);
} });

const { POST } = await import('../app/api/chat/route.ts');
const { explicitExistingItineraryCheck } = await import('../lib/chat-result-summary.ts');
const { createTripSession, appendTrip, currentTrip } = await import('../lib/trip-engine.ts');
const { itineraryChecks } = await import('../lib/trip-chat-features.ts');
const { parseTripSession } = await import('../lib/chat-contract.ts');
const { env } = await import('cloudflare:workers');
Object.assign(env, { CHAT_PROVIDER: 'ollama', OLLAMA_MODEL: 'invalid-cloud-model' });

const input = (session, text) => ({ protocolVersion: 1, requestId: 'check-preflight-test', sessionId: 'check-preflight-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });
function plannedSession() {
  let session = createTripSession();
  for (const action of [{ type: 'region', region: '부산' }, { type: 'configure', days: 2, booked: true }, { type: 'build' }]) session = appendTrip(session, action);
  const visits = currentTrip(session).plan.filter(visit => !visit.locked).slice(0, 2);
  assert.equal(visits.length, 2);
  session = appendTrip(session, { type: 'visit-details', id: visits[0].id, time: '10:30', durationMinutes: 90, note: '첫 방문 메모' });
  session = appendTrip(session, { type: 'visit-details', id: visits[1].id, time: '10:50', durationMinutes: 50, note: '두 번째 메모' });
  return appendTrip(session, { type: 'day', day: 2 });
}

test('only explicit full inspection requests open existing calculated checks', () => {
  const session = plannedSession();
  for (const text of [
    '일정 점검해줘', '현재 일정만 점검해 주세요.', '방문 시간이 겹치는지 점검해줘.',
    '시간 겹치는지 점검 결과 보여줘', '기존 일정 점검 결과만 보여주세요.',
    '지금 일정의 방문 시간이 겹치는지 점검해줘. 일정과 메모·시간은 바꾸지 말고 점검 결과를 보여줘.',
    '일정과 메모·시간은 그대로 유지하고 현재 일정 점검해줘.',
  ]) assert.deepEqual(explicitExistingItineraryCheck(input(session, text)), { type: 'check' }, text);
});

test('inspection preflight never consumes edits, new plans, negations, explanations or mixed requests', () => {
  const session = plannedSession();
  for (const text of [
    '점검', '점검해줘', '시간 확인해줘', '일정 점검 방법 알려줘', '일정 점검해주는 기능 있어?',
    '일정 점검하지 마', '일정 점검해줘. 아니 점검하지 말아줘.',
    '일정 점검해줘. DAY 1 첫 방문을 11시로 바꿔줘.', '메모는 점검 완료로 수정하고 일정 점검해줘.',
    '부산 2박 3일 일정 만들어주고 점검해줘.', '새 일정 점검해줘.',
    '일정 점검해줘. 날씨도 알려줘.', '일정 점검해줘. 시간은 바꿔도 돼.',
    '일정 점검해줘. 점검하지 않는 방법도 설명해줘.', 'DAY 2 시간 겹치는지 점검해줘.',
  ]) assert.equal(explicitExistingItineraryCheck(input(session, text)), null, text);
  assert.equal(explicitExistingItineraryCheck(input(createTripSession(), '일정 점검해줘')), null);
  assert.equal(explicitExistingItineraryCheck({ ...input(session, ''), action: { type: 'check' } }), null);
});

test('route uses calculated checks without any provider call and preserves all trip data', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', () => { calls++; throw new Error('inspection must not call any external service'); });
  const session = plannedSession(), before = structuredClone(session), stateBefore = structuredClone(currentTrip(session));
  const request = input(session, '지금 일정의 방문 시간이 겹치는지 점검해줘. 일정과 메모·시간은 바꾸지 말고 점검 결과를 보여줘.');
  const response = await POST(new Request('http://localhost/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }));
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body.error));
  assert.equal(calls, 0);
  assert.equal(body.mode, 'local-action');
  assert.equal(body.session.turns.at(-1).source, 'local-action');
  assert.equal(body.session.turns.at(-1).answerContext.retrievalStatus, 'not-needed');
  const after = currentTrip(body.session);
  assert.equal(after.stage, 'check');
  assert.deepEqual(after.plan, stateBefore.plan);
  assert.equal(after.activeDay, stateBefore.activeDay);
  assert.equal(after.days, stateBefore.days);
  assert.equal(after.booked, true);
  assert.deepEqual(body.session.library, session.library);
  assert.deepEqual(body.session.turns.slice(0, -1), JSON.parse(JSON.stringify(session.turns)));
  assert.deepEqual(session, before);
  assert.doesNotMatch(body.message, /\d+\s*분|visit-\d/);
  assert.equal(itineraryChecks(after).filter(check => check.focus === 'time').length, 1);
  const warning = itineraryChecks(after).find(check => check.focus === 'time');
  assert.match(warning.description, /10:30, 90분/);
  assert.match(warning.description, /10:50, 50분/);
  assert.ok(parseTripSession(body.session));
});

test('read-only check reflects edited and cleared times instead of an old generated explanation', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('inspection must remain local'); });
  let session = plannedSession();
  const later = currentTrip(session).plan.find(visit => visit.time === '10:50');
  session = appendTrip(session, { type: 'visit-details', id: later.id, time: '12:00' });
  for (const time of ['12:00', '']) {
    session = appendTrip(session, { type: 'visit-details', id: later.id, time });
    const request = input(session, '일정 점검해줘');
    const response = await POST(new Request('http://localhost/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(currentTrip(body.session).stage, 'check');
    assert.deepEqual(currentTrip(body.session).plan, currentTrip(session).plan);
    assert.equal(itineraryChecks(currentTrip(body.session)).filter(check => check.focus === 'time').length, 0);
  }
});
