import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { regroupExplicitNearbyBuild, NEARBY_GROUPING_NOTICE } = await import('../lib/itinerary-proximity.ts');
const { createTripSession, currentTrip, appendTrip } = await import('../lib/trip-engine.ts');
const { applyModelReply, parseTripSession } = await import('../lib/chat-contract.ts');
const { builtItineraryMessage } = await import('../lib/chat-result-summary.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const { placeMapCoordinates } = await import('../lib/trip-map-data.ts');

const text = '제주 2박 3일 일정 만들어줘. 하루에 오전 오후 한 곳씩, 가까운 장소끼리 같은 날 묶어줘. 식당 카페 숙소는 빼줘.';
const request = (question = text, session = createTripSession()) => ({
  protocolVersion: 1, requestId: 'proximity', sessionId: 'proximity', baseRevision: session.turns.at(-1).id,
  session, action: { type: 'message', text: question },
});
const visits = [
  { day: 1, placeId: 'jusangjeolli' }, { day: 1, placeId: 'jeongbang' },
  { day: 2, placeId: 'geomunoreum' }, { day: 2, placeId: 'gotjawal' },
  { day: 3, placeId: 'seopjikoji' }, { day: 3, placeId: 'jeolmul' },
];
const actions = () => [
  { type: 'region', region: '제주' }, { type: 'configure', days: 3, meals: false, cafes: false, lodging: false },
  { type: 'build', visits: structuredClone(visits) },
];
const retrieval = (ids = visits.map(visit => visit.placeId)) => ({
  dataMode: 'curated-travel-data', indexVersion: 'idx:nearby', embeddingModel: 'test-only-embedding',
  results: ids.map(placeId => ({
    ...ragCatalog().find(source => source.placeId === placeId && source.sourceKind === 'curated-official-summary'),
    evidenceId: `ev:${placeId}`, sourceVersion: `sv:${placeId}`,
  })),
});
const state = () => ({ ...currentTrip(createTripSession()), region: '제주', days: 3 });
function sumDistance(selection) {
  let sum = 0;
  for (let day = 1; day <= 3; day++) {
    const pair = selection.filter(visit => visit.day === day);
    if (pair.length !== 2) continue;
    const [first, second] = pair.map(visit => placeMapCoordinates[visit.placeId]);
    const radians = Math.PI / 180;
    const arc = Math.sin((second.latitude - first.latitude) * radians / 2) ** 2 + Math.cos(first.latitude * radians) *
      Math.cos(second.latitude * radians) * Math.sin((second.longitude - first.longitude) * radians / 2) ** 2;
    sum += 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
  }
  return sum;
}

test('explicit nearby grouping improves the actual six-stop cross-island example using the same retrieved places and slots', () => {
  const input = request(), batch = actions(), evidence = retrieval();
  const before = structuredClone({ input, batch, evidence });
  const result = regroupExplicitNearbyBuild(input, batch, batch.at(-1), state(), evidence);
  assert.ok(result);
  assert.equal(result.notice, NEARBY_GROUPING_NOTICE);
  assert.equal(result.action.visits.length, 6);
  assert.deepEqual(result.action.visits.map(visit => visit.placeId).sort((first, second) => first.localeCompare(second)), visits.map(visit => visit.placeId).sort((first, second) => first.localeCompare(second)));
  for (let day = 1; day <= 3; day++) assert.equal(result.action.visits.filter(visit => visit.day === day).length, 2);
  assert.ok(sumDistance(result.action.visits) + 10 < sumDistance(visits));
  assert.equal(result.action.visits[0].placeId, visits[0].placeId);
  assert.deepEqual({ input, batch, evidence }, before);
  // An already improved grouping does not churn day order or repeat notices.
  const settled = [...batch.slice(0, -1), result.action];
  assert.equal(regroupExplicitNearbyBuild(input, settled, result.action, state(), evidence), undefined);
});

test('ordinary generation, negation, named days, fixed times and ordering instructions never trigger regrouping', () => {
  const batch = actions();
  for (const question of [
    '제주 2박 3일 일정 만들어줘. 오전 오후 한 곳씩 넣어줘.',
    text + ' 가까운 장소끼리 묶지 마.',
    text + ' 동선을 바꾸지 말아줘.',
    text + ' DAY 1 오전은 정방폭포로 해줘.',
    text + ' 2일차는 곶자왈로 해줘.',
    text + ' 첫날은 정방폭포를 넣어줘.',
    text + ' 오전 10시에는 정방폭포로 해줘.',
    text + ' 14:30에 정방폭포로 가줘.',
    text + ' 정방폭포를 먼저 넣어줘.',
    text + ' 지금 순서를 유지해줘.',
    text + ' 오전 정방폭포는 꼭 넣어줘.',
    text + ' 예약한 숙소는 그대로 유지해줘.',
  ]) assert.equal(regroupExplicitNearbyBuild(request(question), batch, batch.at(-1), state(), retrieval()), undefined, question);
});

test('booking, full-day visits, missing evidence and later mutations are preserved rather than optimized', () => {
  const batch = actions(), input = request(), before = state();
  for (const protectedState of [
    { ...before, booked: true },
    { ...before, plan: [{ id: 'reserved', day: 1, kind: 'stay', entityId: null, anchorId: 'gotjawal', label: '숙박', locked: true }] },
  ]) assert.equal(regroupExplicitNearbyBuild(input, batch, batch.at(-1), protectedState, retrieval()), undefined);
  const previous = createTripSession();
  currentTrip(previous).booked = true;
  assert.equal(regroupExplicitNearbyBuild(request(text, previous), batch, batch.at(-1), before, retrieval()), undefined);
  const fullDay = { ...batch.at(-1), visits: [{ day: 1, placeId: 'udo' }, ...visits.slice(1)] };
  assert.equal(regroupExplicitNearbyBuild(input, [...batch.slice(0, -1), fullDay], fullDay, before, retrieval(['udo', ...visits.slice(1).map(visit => visit.placeId)])), undefined);
  assert.equal(regroupExplicitNearbyBuild(input, batch, batch.at(-1), before, retrieval(visits.slice(1).map(visit => visit.placeId))), undefined);
  assert.equal(regroupExplicitNearbyBuild(input, [...batch, { type: 'show', stage: 'plan' }], batch.at(-1), before, retrieval()), undefined);
  const sparse = { ...batch.at(-1), visits: visits.slice(1) };
  assert.equal(regroupExplicitNearbyBuild(input, [...batch.slice(0, -1), sparse], sparse, before, retrieval()), undefined);
});

test('the committed transcript, map plan and regenerated combined-weather caption retain honest grouping notice and source identities', () => {
  const input = request(), evidence = retrieval();
  const before = structuredClone(input);
  const session = applyModelReply(input, { message: '가까운 곳으로 일정을 만들었어요.', actions: actions() }, 'flowise', evidence);
  const committed = currentTrip(session);
  const selection = committed.plan.filter(visit => visit.kind === 'place').map(visit => ({ day: visit.day, placeId: visit.entityId }));
  assert.ok(sumDistance(selection) + 10 < sumDistance(visits));
  assert.deepEqual(selection.map(visit => visit.placeId).sort((first, second) => (first ?? '').localeCompare(second ?? '')), visits.map(visit => visit.placeId).sort((first, second) => first.localeCompare(second)));
  assert.equal(committed.plan.length, 6);
  assert.ok(committed.notice.includes(NEARBY_GROUPING_NOTICE));
  assert.ok(session.turns.at(-1).assistantMessage.includes(NEARBY_GROUPING_NOTICE));
  assert.ok(builtItineraryMessage(committed, '').includes(NEARBY_GROUPING_NOTICE));
  for (const visit of committed.plan) assert.deepEqual(visit.knowledge.evidenceIds, [`ev:${visit.entityId}`]);
  assert.ok(parseTripSession(session));
  assert.deepEqual(input, before);
  const continued = appendTrip(session, { type: 'day', day: 2 });
  assert.deepEqual(currentTrip(continued).plan, committed.plan);
});
