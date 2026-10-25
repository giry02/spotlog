import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier))
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});

const { appendTrip, createTripSession, currentTrip } = await import('../lib/trip-engine.ts');
const { applyModelReply, parseTripSession } = await import('../lib/chat-contract.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const { getTripMapData } = await import('../lib/trip-map-data.ts');

const selection = [
  { day: 1, placeId: 'osulloc' }, { day: 1, placeId: 'songaksan' },
  { day: 2, placeId: 'hyeopjae' }, { day: 2, placeId: 'geumneung' },
];
const evidence = {
  dataMode: 'curated-travel-data', indexVersion: 'idx:collection-regression', embeddingModel: 'test-only',
  results: selection.map(({ placeId }) => ({
    ...ragCatalog().find(source => source.placeId === placeId),
    evidenceId: `ev:${placeId}`, sourceVersion: `sv:${placeId}`,
  })),
};
const request = (session, text = '담은 곳으로 제주 1박 2일 일정 만들어줘') => ({
  protocolVersion: 1, requestId: 'collected-rag-regression', sessionId: 'collected-rag-regression',
  baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text },
});
const build = (session, configure = {}, text) => applyModelReply(request(session, text), {
  message: '선택한 방문지를 연결했어요.', actions: [
    { type: 'configure', days: 2, ...configure }, { type: 'build', visits: selection },
  ],
}, 'flowise', evidence);
const gather = () => ['hyeopjae', 'hj-rice', 'hj-pasta', 'osulloc', 'of-rice', 'of-cafe', 'stay-coast']
  .reduce((session, id) => appendTrip(session, { type: 'collect-entity', id }), createDemoSession());

test('a grounded LLM build retains multiple collected foods beside their selected anchor and keeps every selected place', () => {
  const before = gather();
  const snapshot = structuredClone(before);
  const result = build(before);
  const state = currentTrip(result);
  assert.deepEqual(state.plan.filter(visit => visit.kind === 'place').map(visit => ({ day: visit.day, placeId: visit.entityId })), selection);
  assert.deepEqual(state.plan.filter(visit => visit.entityId && ['food', 'cafe'].includes(visit.kind))
    .map(({ day, entityId, anchorId }) => [day, entityId, anchorId]), [
    [1, 'of-rice', 'osulloc'], [1, 'of-cafe', 'osulloc'],
    [2, 'hj-rice', 'hyeopjae'], [2, 'hj-pasta', 'hyeopjae'],
  ]);
  assert.deepEqual(state.plan.filter(visit => visit.kind === 'stay').map(visit => [visit.day, visit.entityId]), [[1, 'stay-coast']]);
  assert.equal(new Set(state.plan.map(visit => visit.id)).size, state.plan.length);
  for (const visit of state.plan.filter(visit => visit.kind === 'place'))
    assert.deepEqual(visit.knowledge.evidenceIds, [`ev:${visit.entityId}`]);
  assert.deepEqual(getTripMapData(state, { allDays: true }).points.map(point => point.placeId), selection.map(visit => visit.placeId));
  assert.deepEqual(state.collectedIds, currentTrip(before).collectedIds);
  assert.deepEqual(before, snapshot);
  assert.ok(parseTripSession(result));
});

test('later explicit category exclusions override collected business choices without erasing the collection', () => {
  const before = gather();
  const result = build(before, { meals: false, cafes: false, lodging: false }, '담은 장소로 제주 1박 2일 일정 만들어줘. 식당 카페 숙소는 빼줘.');
  assert.deepEqual(currentTrip(result).plan.map(visit => visit.entityId), selection.map(visit => visit.placeId));
  assert.deepEqual(currentTrip(result).collectedIds, currentTrip(before).collectedIds);
});

test('a collected cafe explicitly includes cafes until a subsequent exclusion disables them', () => {
  let session = appendTrip(createDemoSession(), { type: 'collect-entity', id: 'of-cafe' });
  assert.equal(currentTrip(session).cafes, true);
  session = appendTrip(session, { type: 'configure', cafes: false });
  assert.equal(currentTrip(session).cafes, false);
  assert.deepEqual(currentTrip(session).collectedIds, ['of-cafe']);
});

test('a new selected hotel fills missing nights in a RAG itinerary without any collection or rebuild', () => {
  let session = appendTrip(createDemoSession(), { type: 'region', region: '제주' });
  session = build(session, { meals: false, lodging: false });
  const original = structuredClone(currentTrip(session).plan);
  assert.deepEqual(currentTrip(session).collectedIds, []);
  session = appendTrip(session, { type: 'show', stage: 'stay' });
  session = appendTrip(session, { type: 'stay', id: 'stay-tea' });
  assert.equal(currentTrip(session).stage, 'plan');
  assert.equal(currentTrip(session).lodging, true);
  assert.deepEqual(currentTrip(session).plan.filter(visit => visit.kind !== 'stay'), original);
  assert.deepEqual(currentTrip(session).plan.filter(visit => visit.kind === 'stay').map(visit => [visit.day, visit.entityId]), [[1, 'stay-tea']]);
  assert.ok(parseTripSession(session));
});

test('adding a selected hotel preserves existing nights and all prior visit records', () => {
  let session = appendTrip(createDemoSession(), { type: 'region', region: '제주' });
  session = appendTrip(session, { type: 'configure', days: 3, meals: false, lodging: false });
  session = appendTrip(session, { type: 'build', visits: selection });
  session = appendTrip(session, { type: 'show', stage: 'stay' });
  session = appendTrip(session, { type: 'stay', id: 'stay-tea' });
  const original = structuredClone(currentTrip(session).plan);
  session = appendTrip(session, { type: 'show', stage: 'stay' });
  session = appendTrip(session, { type: 'stay', id: 'stay-garden' });
  assert.deepEqual(currentTrip(session).plan, original);
  assert.match(currentTrip(session).notice, /이미 숙박이 배치/);
});

test('booked overnight records outrank collected hotels during a grounded rebuild', () => {
  let session = gather();
  session = build(session);
  session = appendTrip(session, { type: 'configure', booked: true, lodging: false });
  const booked = structuredClone(currentTrip(session).plan.filter(visit => visit.locked));
  const result = build(session, { lodging: true });
  assert.deepEqual(currentTrip(result).plan.filter(visit => visit.kind === 'stay'), booked);
  assert.ok(parseTripSession(result));
});

test('the LLM add-entity action appends only the explicitly requested empty overnight', () => {
  let session = appendTrip(createDemoSession(), { type: 'region', region: '제주' });
  session = build(session, { meals: false, lodging: false });
  const original = structuredClone(currentTrip(session).plan);
  const result = applyModelReply(request(session, '차밭 작은집을 DAY 1 숙소로 추가해줘'), {
    message: '빈 숙박 자리에 추가했어요.', actions: [{ type: 'add-entity', id: 'stay-tea', day: 1 }],
  }, 'flowise');
  assert.deepEqual(currentTrip(result).plan.filter(visit => visit.kind !== 'stay'), original);
  assert.deepEqual(currentTrip(result).plan.filter(visit => visit.kind === 'stay').map(visit => [visit.day, visit.entityId]), [[1, 'stay-tea']]);
  assert.ok(parseTripSession(result));
  const alreadyPlaced = appendTrip(result, { type: 'add-entity', id: 'stay-garden', day: 1 });
  assert.deepEqual(currentTrip(alreadyPlaced).plan, currentTrip(result).plan);
  const lastDay = appendTrip(session, { type: 'add-entity', id: 'stay-tea', day: 2 });
  assert.deepEqual(currentTrip(lastDay).plan, original);
  const overBudget = appendTrip(session, { type: 'stay-budget', value: 50000 });
  assert.deepEqual(currentTrip(appendTrip(overBudget, { type: 'add-entity', id: 'stay-tea', day: 1 })).plan, original);
});

test('several explicitly collected hotels follow distinct nights while a booked trip cannot receive another hotel', () => {
  let session = appendTrip(gather(), { type: 'collect-entity', id: 'stay-tea' });
  session = appendTrip(session, { type: 'configure', days: 3 });
  session = appendTrip(session, { type: 'build', visits: selection });
  assert.deepEqual(currentTrip(session).plan.filter(visit => visit.kind === 'stay').map(visit => [visit.day, visit.entityId]), [[1, 'stay-coast'], [2, 'stay-tea']]);
  session = appendTrip(session, { type: 'configure', booked: true });
  const original = structuredClone(currentTrip(session).plan);
  session = appendTrip(session, { type: 'add-entity', id: 'stay-garden', day: 1 });
  assert.deepEqual(currentTrip(session).plan, original);
});

// This regression fixture intentionally uses the authored legacy businesses.
function createDemoSession(savedIds = [], library = []) { return createTripSession(savedIds, library, "demo"); }
