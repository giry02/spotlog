import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { createTripSession, appendTrip, currentTrip } = await import('../lib/trip-engine.ts');
const { parseModelReply, parseTripAction, parseTripSession, applyModelReply, chatResponse } = await import('../lib/chat-contract.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const { routeModelReply } = await import('../lib/model-routing.ts');

const request = (session = createTripSession(), text = '제주 2박 3일 일정을 공식 자료로 만들어줘. 숙소 추천은 빼줘.') => ({
  protocolVersion: 1, requestId: 'rag_plan', sessionId: 'rag_plan', baseRevision: session.turns.at(-1).id,
  session, action: { type: 'message', text },
});
const retrieval = (...placeIds) => ({
  dataMode: 'curated-travel-data', indexVersion: 'idx:verified-current', embeddingModel: 'test-embedding',
  results: placeIds.map((placeId) => {
    const source = ragCatalog().find((item) => item.placeId === placeId && item.sourceKind === 'curated-official-summary');
    assert.ok(source, `official source required for ${placeId}`);
    return { ...source, evidenceId: `ev:${placeId}`, sourceVersion: `sv:${placeId}` };
  }),
});
const selection = [
  { day: 1, placeId: 'hallasan' }, { day: 2, placeId: 'udo' },
  { day: 3, placeId: 'jejumuseum' }, { day: 3, placeId: 'aquaplanet' },
];
const reply = (visits = selection) => ({ message: '검색에서 확인한 방문지만 배치한 초안이에요.', actions: [
  { type: 'region', region: '제주' }, { type: 'configure', days: 3, lodging: false }, { type: 'build', visits },
] });
const groundedPlan = () => applyModelReply(request(), reply(), 'flowise', retrieval(...selection.map((item) => item.placeId)));
const ungrounded = (callback) => assert.throws(callback, (error) => error.code === 'MODEL_ITINERARY_UNGROUNDED');

test('the model build schema accepts an exact day/place selection and rejects invented IDs and client source metadata', () => {
  const build = { type: 'build', visits: selection };
  assert.deepEqual(parseTripAction(build), build);
  for (const visits of [[], [{ day: 1, placeId: 'invented-resort' }], [{ day: 0, placeId: 'hallasan' }],
    [{ day: 1, placeId: 'hallasan' }, { day: 2, placeId: 'hallasan' }],
    [{ day: 1, placeId: 'hallasan', knowledge: { indexVersion: 'forged' } }]])
    assert.throws(() => parseModelReply(reply(visits)), (error) => error.code === 'MODEL_OUTPUT_INVALID');
});

test('RAG selected Hallasan, Udo and new indoor venues drive actual itinerary cards with no old-catalog fillers', () => {
  const input = request();
  const before = structuredClone(input);
  const evidence = retrieval(...selection.map((item) => item.placeId));
  const session = applyModelReply(input, reply(), 'flowise', evidence);
  const state = currentTrip(session);
  const visits = state.plan.filter((visit) => visit.kind === 'place');
  assert.deepEqual(visits.map(({ day, entityId }) => ({ day, placeId: entityId })), selection);
  assert.equal(visits.find((visit) => visit.entityId === 'hallasan').label, '하루 방문');
  assert.equal(visits.find((visit) => visit.entityId === 'udo').label, '하루 방문');
  assert.match(state.notice, /예약|기상|탐방/);
  assert.ok(state.plan.filter((visit) => visit.kind !== 'place').every((visit) => visit.entityId === null));
  assert.equal(state.plan.some((visit) => visit.kind === 'stay'), false);
  for (const visit of visits) {
    assert.equal(visit.knowledge.indexVersion, evidence.indexVersion);
    assert.deepEqual(visit.knowledge.evidenceIds, [`ev:${visit.entityId}`]);
    assert.equal(visit.knowledge.documentIds[0], evidence.results.find((item) => item.placeId === visit.entityId).documentId);
  }
  assert.deepEqual(session.turns.at(-1).evidenceIds, ['ev:hallasan', 'ev:udo', 'ev:jejumuseum', 'ev:aquaplanet']);
  assert.deepEqual(input, before);
  assert.ok(parseTripSession(session));
});

test('a sparse retrieved selection leaves other days empty instead of manufacturing additional destinations', () => {
  const session = applyModelReply(request(), reply([{ day: 2, placeId: 'udo' }]), 'flowise', retrieval('udo'));
  assert.deepEqual(currentTrip(session).plan.filter((visit) => visit.kind === 'place').map((visit) => [visit.day, visit.entityId]), [[2, 'udo']]);
  assert.equal(currentTrip(session).plan.some((visit) => visit.day === 1 || visit.day === 3), false);
});

test('missing or unrelated current RAG sources reject the whole model action batch without mutating a prior session', () => {
  const input = request();
  const before = structuredClone(input);
  for (const evidence of [retrieval('osulloc'), { ...retrieval('hallasan'), results: [] }])
    ungrounded(() => applyModelReply(input, reply(), 'flowise', evidence));
  ungrounded(() => applyModelReply(input, { message: '일정', actions: [{ type: 'region', region: '제주' }, { type: 'build' }] }, 'flowise', retrieval('hallasan')));
  ungrounded(() => applyModelReply(input, reply(), 'flowise'));
  assert.deepEqual(input, before);
});

test('Hallasan and Udo reserve their day instead of being stacked with another attraction', () => {
  for (const fullDay of ['hallasan', 'udo'])
    ungrounded(() => applyModelReply(request(), reply([{ day: 1, placeId: fullDay }, { day: 1, placeId: 'jejumuseum' }]), 'flowise', retrieval(fullDay, 'jejumuseum')));
});

test('RAG visit provenance survives save and reopen while historical metadata grants no authority to build again', () => {
  let session = groundedPlan();
  const visits = structuredClone(currentTrip(session).plan);
  session = appendTrip(session, { type: 'save' });
  const savedId = session.library[0].id;
  session = appendTrip(session, { type: 'reset' });
  session = appendTrip(session, { type: 'open', id: savedId });
  assert.deepEqual(currentTrip(session).plan, visits);
  assert.ok(parseTripSession(session));
  ungrounded(() => applyModelReply(request(session), { message: '다시 만들어요', actions: [{ type: 'build', visits: selection }] }, 'flowise', retrieval('osulloc')));
});

test('booked accommodation is retained exactly across a new RAG-grounded schedule', () => {
  let session = createTripSession();
  for (const action of [{ type: 'region', region: '제주' }, { type: 'configure', days: 3, booked: true }, { type: 'build' }]) session = appendTrip(session, action);
  const locked = structuredClone(currentTrip(session).plan.filter((visit) => visit.locked));
  const result = applyModelReply(request(session), { message: '예약을 유지해요.', actions: [{ type: 'build', visits: selection }] }, 'flowise', retrieval(...selection.map((item) => item.placeId)));
  for (const visit of locked) assert.deepEqual(currentTrip(result).plan.find((after) => after.id === visit.id), visit);
});

test('a scoped replacement changes only its visit and refreshes its source provenance', () => {
  const session = groundedPlan();
  const original = structuredClone(currentTrip(session).plan);
  const target = original.find((visit) => visit.entityId === 'aquaplanet');
  const result = applyModelReply(request(session, 'DAY 3 오후 장소만 다른 곳으로 바꿔줘.'), {
    message: '돌문화공원으로 바꿨어요.', actions: [{ type: 'edit', id: target.id }, { type: 'place', id: 'dolculturepark' }],
  }, 'flowise', retrieval('dolculturepark'));
  const after = currentTrip(result).plan;
  assert.equal(after.find((visit) => visit.id === target.id).entityId, 'dolculturepark');
  assert.deepEqual(after.find((visit) => visit.id === target.id).knowledge.evidenceIds, ['ev:dolculturepark']);
  for (const visit of original.filter((visit) => visit.id !== target.id)) assert.deepEqual(after.find((item) => item.id === visit.id), visit);
  assert.deepEqual(currentTrip(session).plan, original);
  ungrounded(() => applyModelReply(request(session, 'DAY 3 오후 장소만 바꿔줘.'), { message: '한라산', actions: [{ type: 'edit', id: target.id }, { type: 'place', id: 'hallasan' }] }, 'flowise', retrieval('hallasan')));
});

test('the insufficient context signal cannot execute mutations and large-model responses keep a distinct source', () => {
  assert.equal(parseModelReply({ message: '자료가 더 필요해요.', actions: [], needsMoreContext: true }).needsMoreContext, true);
  assert.throws(() => parseModelReply({ message: '자료', actions: [], needsMoreContext: 'true' }));
  ungrounded(() => applyModelReply(request(), { ...reply(), needsMoreContext: true }, 'flowise', retrieval('hallasan')));
  const context = { retrievalStatus: 'available', modelRouting: { tier: 'large', provider: 'ollama', model: 'large-local', reason: 'rag-insufficient', status: 'ready' } };
  const result = applyModelReply(request(), reply(), 'large-model', retrieval(...selection.map((item) => item.placeId)), context);
  assert.equal(result.turns.at(-1).source, 'large-model');
  assert.equal(chatResponse(request(), result, 'large-model').mode, 'large-model');
  assert.ok(parseTripSession(result));
});

test('six newly supported destinations and twelve source IDs persist through the complete saved-session round trip', () => {
  const selected = [
    { day: 1, placeId: 'jejumuseum' }, { day: 1, placeId: 'dolculturepark' },
    { day: 2, placeId: 'saryeoni' }, { day: 2, placeId: 'jeolmul' },
    { day: 3, placeId: 'hallimpark' }, { day: 3, placeId: 'yeomiji' },
  ];
  const sources = selected.flatMap(({ placeId }) => ragCatalog().filter((source) => source.placeId === placeId && source.sourceKind === 'curated-official-summary'));
  assert.equal(sources.length, 12);
  const evidence = {
    ...retrieval('jejumuseum'),
    results: sources.map((source, index) => ({ ...source, evidenceId: `ev:${index}:${'a'.repeat(145)}`, sourceVersion: `sv:${index}` })),
  };
  const model = parseModelReply({ ...reply(selected), evidenceIds: evidence.results.map((source) => source.evidenceId) });
  let session = applyModelReply(request(), model, 'flowise', evidence);
  assert.equal(session.turns.at(-1).evidenceIds.length, 12);
  assert.ok(currentTrip(session).notice.length < 300, 'the itinerary notice stays compact instead of concatenating full source paragraphs');
  assert.deepEqual(currentTrip(session).plan.filter((visit) => visit.kind === 'place').map((visit) => [visit.day, visit.entityId]), selected.map(({ day, placeId }) => [day, placeId]));
  const visits = JSON.parse(JSON.stringify(currentTrip(session).plan));
  session = appendTrip(session, { type: 'save' });
  const savedId = session.library[0].id;
  session = parseTripSession(JSON.parse(JSON.stringify(session)));
  session = appendTrip(session, { type: 'reset' });
  session = appendTrip(session, { type: 'open', id: savedId });
  assert.deepEqual(currentTrip(session).plan, visits);
  assert.ok(parseTripSession(JSON.parse(JSON.stringify(session))));
  assert.throws(() => parseModelReply({ ...reply(selected), evidenceIds: [...model.evidenceIds, 'ev:thirteenth'] }), (error) => error.code === 'MODEL_OUTPUT_INVALID');
});

const twoStopsEveryDay = [
  { day: 1, placeId: 'hyeopjae' }, { day: 1, placeId: 'gotjawal' },
  { day: 2, placeId: 'hamdeok' }, { day: 2, placeId: 'bijarim' },
  { day: 3, placeId: 'sehwa' }, { day: 3, placeId: 'saryeoni' },
];
const dailySlotsRequest = (extra = '') => request(createTripSession(), `제주도 2박 3일 여행 일정 짜줘. 바다랑 숲을 보고 싶고, 하루에 오전 오후 한 곳씩 넣어줘. 식당 카페 숙소는 빼줘. ${extra}`);

test('the explicit three-day morning and afternoon request commits six retrieved stops with exact labels and exclusions', () => {
  const input = dailySlotsRequest();
  const before = structuredClone(input);
  const evidence = retrieval(...twoStopsEveryDay.map(visit => visit.placeId));
  const session = applyModelReply(input, reply(twoStopsEveryDay), 'flowise', evidence);
  const state = currentTrip(session);
  assert.deepEqual(state.plan.map(({ day, entityId, label, kind }) => ({ day, placeId: entityId, label, kind })), twoStopsEveryDay.map((visit, index) => ({ ...visit, label: index % 2 ? '오후 방문' : '오전 방문', kind: 'place' })));
  for (const category of ['meals', 'cafes', 'lodging']) assert.equal(state[category], false);
  for (const visit of state.plan) assert.deepEqual(visit.knowledge.evidenceIds, [`ev:${visit.entityId}`]);
  assert.deepEqual(input, before);
});

test('automatic full-day substitutions and missing daily slots cannot silently become a successful five-stop itinerary', () => {
  const input = dailySlotsRequest();
  const before = structuredClone(input);
  const fiveWithUdo = [
    { day: 1, placeId: 'geomunoreum' }, { day: 1, placeId: 'osulloc' },
    { day: 2, placeId: 'yeomiji' }, { day: 2, placeId: 'cheonjiyeon' },
    { day: 3, placeId: 'udo' },
  ];
  for (const invalid of [fiveWithUdo, twoStopsEveryDay.slice(0, -1), twoStopsEveryDay.filter(visit => visit.day !== 3)]) {
    assert.throws(() => applyModelReply(input, reply(invalid), 'flowise', retrieval(...invalid.map(visit => visit.placeId))), { code: 'MODEL_ITINERARY_DAILY_SLOTS' });
    assert.deepEqual(input, before, 'rejected selections cannot mutate existing snapshots or partially fill slots');
  }
  const thenRemove = reply(twoStopsEveryDay);
  thenRemove.actions.push({ type: 'remove', id: 'visit-6' });
  assert.throws(() => applyModelReply(input, thenRemove, 'flowise', retrieval(...twoStopsEveryDay.map(visit => visit.placeId))), { code: 'MODEL_ITINERARY_DAILY_SLOTS' });
  assert.deepEqual(input, before, 'a later model action cannot remove a required slot from an otherwise valid batch');
});

test('a human-named full-day destination stays alone and explicitly explains the two-slot conflict', () => {
  const input = dailySlotsRequest('우도는 꼭 포함해줘.');
  const visits = [...twoStopsEveryDay.filter(visit => visit.day !== 3), { day: 3, placeId: 'udo' }];
  const session = applyModelReply(input, reply(visits), 'flowise', retrieval(...visits.map(visit => visit.placeId)));
  const state = currentTrip(session);
  assert.deepEqual(state.plan.filter(visit => visit.day === 3).map(visit => [visit.entityId, visit.label]), [['udo', '하루 방문']]);
  assert.match(state.notice, /직접 지정한.*우도.*종일.*오전·오후 두 곳 대신 한 곳/);
  assert.match(session.turns.at(-1).assistantMessage, /우도.*종일.*오전·오후 두 곳 대신 한 곳/);
  assert.throws(() => applyModelReply(input, reply(twoStopsEveryDay), 'flowise', retrieval(...twoStopsEveryDay.map(visit => visit.placeId))), { code: 'MODEL_ITINERARY_DAILY_SLOTS' });
  const crowded = [...visits, { day: 3, placeId: 'sehwa' }];
  assert.throws(() => applyModelReply(input, reply(crowded), 'flowise', retrieval(...crowded.map(visit => visit.placeId))), { code: 'MODEL_ITINERARY_DAILY_SLOTS' });
});

test('a rejected full-day destination does not count as a human-authorized daily-slot exception', () => {
  const input = dailySlotsRequest('우도는 빼고 만들어줘.');
  const visits = [...twoStopsEveryDay.filter(visit => visit.day !== 3), { day: 3, placeId: 'udo' }];
  assert.throws(() => applyModelReply(input, reply(visits), 'flowise', retrieval(...visits.map(visit => visit.placeId))), { code: 'MODEL_ITINERARY_DAILY_SLOTS' });
});

test('a five-stop primary answer fails validation and the same request can succeed with six verified larger-model selections', async () => {
  const input = dailySlotsRequest();
  const before = structuredClone(input);
  const evidence = retrieval(...twoStopsEveryDay.map(visit => visit.placeId), 'udo');
  let primaryCalls = 0;
  let largerCalls = 0;
  const result = await routeModelReply({
    request: input,
    resources: { retrieval: evidence, retrievalStatus: 'available', retrievalInstruction: '현재 검색 자료만 사용한다.', coverage: { sufficient: true, reason: 'covered' } },
    primary: { provider: 'flowise', async predict() { primaryCalls++; return reply([...twoStopsEveryDay.filter(visit => visit.day !== 3), { day: 3, placeId: 'udo' }]); } },
    large: { provider: 'ollama', model: 'qwen3:14b', baseUrl: 'http://127.0.0.1:11434', timeoutMs: 1000 },
    async predictLarge(actualRequest, config) { largerCalls++; assert.equal(actualRequest, input); assert.equal(config.provider, 'ollama'); return reply(twoStopsEveryDay); },
    validate(modelReply, mode) { applyModelReply(input, modelReply, mode, evidence); },
  });
  assert.equal(primaryCalls, 1);
  assert.equal(largerCalls, 1);
  assert.equal(result.resources.modelRouting.reason, 'primary-failed');
  const session = applyModelReply(input, result.reply, result.mode, evidence);
  assert.equal(currentTrip(session).plan.filter(visit => visit.kind === 'place').length, 6);
  assert.deepEqual(input, before);
});
