import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (
      /\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') &&
      specifier.startsWith('./') &&
      !/\.[a-z]+$/.test(specifier)
    )
      return next(specifier + '.ts', context);
    return next(specifier, context);
  },
});
const {
  createTripSession,
  appendTrip,
  currentTrip,
  isTripSession,
  nextQuestions,
  explanation,
} = await import('../lib/trip-engine.ts');
const { parseTripSession, applyModelReply } =
  await import('../lib/chat-contract.ts');
const say = (session, text) => appendTrip(session, { type: 'message', text });
const collect = (session, id) =>
  appendTrip(session, { type: 'collect-entity', id });
const uncollect = (session, id) =>
  appendTrip(session, { type: 'uncollect-entity', id });
const gathering = () =>
  ['hyeopjae', 'hj-rice', 'osulloc', 'of-rice', 'of-cafe'].reduce(
    collect,
    createDemoSession(),
  );

test('collecting preserves all picked IDs and favorite IDs while moving the nearby-search focus', () => {
  let session = appendTrip(createDemoSession(['saebyeol']), {
    type: 'place',
    id: 'hyeopjae',
  });
  session = appendTrip(session, { type: 'show', stage: 'food' });
  session = appendTrip(session, { type: 'food', id: 'hj-rice' });
  const before = currentTrip(session),
    originalTurns = JSON.stringify(session.turns);
  session = collect(session, 'hyeopjae');
  session = collect(session, 'osulloc');
  assert.equal(currentTrip(session).anchorId, 'osulloc');
  assert.equal(currentTrip(session).foodId, before.foodId);
  assert.deepEqual(currentTrip(session).savedIds, ['saebyeol']);
  assert.deepEqual(currentTrip(session).collectedIds, ['hyeopjae', 'osulloc']);
  assert.equal(currentTrip(session).stage, 'collection');
  assert.equal(JSON.stringify(session.turns.slice(0, -2)), originalTurns);
});
test('choosing a focus alone does not add it to the travel collection', () => {
  const session = appendTrip(createDemoSession(), {
    type: 'place',
    id: 'hyeopjae',
  });
  assert.equal(currentTrip(session).anchorId, 'hyeopjae');
  assert.deepEqual(currentTrip(session).collectedIds, []);
  assert.ok(
    nextQuestions(currentTrip(session)).includes('이 장소를 여행에 담아줘'),
  );
});
test('duplicate collected entities stay unique and preserve unrelated choices', () => {
  const before = gathering(),
    result = collect(before, 'hj-rice');
  assert.deepEqual(
    currentTrip(result).collectedIds,
    currentTrip(before).collectedIds,
  );
  assert.equal(currentTrip(result).cafeId, 'of-cafe');
  assert.match(currentTrip(result).notice, /이미 담은/);
});
test('cross-region collection and browsing changes are refused without erasing gathered entities', () => {
  const before = gathering();
  for (const action of [
    { type: 'collect-entity', id: 'seoulforest' },
    { type: 'region', region: '서울' },
    { type: 'select-entity', id: 'sf-rice' },
  ]) {
    const result = appendTrip(before, action);
    assert.equal(currentTrip(result).region, '제주');
    assert.deepEqual(
      currentTrip(result).collectedIds,
      currentTrip(before).collectedIds,
    );
    assert.doesNotThrow(() =>
      parseTripSession(JSON.parse(JSON.stringify(result))),
    );
  }
});
test('multiple named collection follows utterance order and uses an atomic same-region decision', () => {
  let session = say(createDemoSession(), '협재랑 오설록을 여행에 담아줘');
  assert.deepEqual(currentTrip(session).collectedIds, ['hyeopjae', 'osulloc']);
  assert.equal(currentTrip(session).anchorId, 'osulloc');
  const original = currentTrip(session).collectedIds;
  session = say(session, '새별오름이랑 서울숲도 담아줘');
  assert.deepEqual(currentTrip(session).collectedIds, original);
  assert.match(currentTrip(session).notice, /다른 지역/);
});
test('selected and ordinal candidates can be collected through chat before an itinerary exists', () => {
  let session = say(createDemoSession(), '협재 찾아줘');
  session = say(session, '이 장소를 여행에 담아줘');
  session = say(session, '여기 근처 식당 찾아줘');
  session = say(session, '첫 번째 식당을 여행에 담아줘');
  assert.deepEqual(currentTrip(session).collectedIds, ['hyeopjae', 'catalog-jeju-hyeopjae-sin-guksu']);
  assert.equal(currentTrip(session).plan.length, 0);
  assert.equal(currentTrip(session).stage, 'collection');
  assert.ok(!nextQuestions(currentTrip(session)).some((q) => /숙소/.test(q)));
  assert.match(explanation(currentTrip(session)), /2곳/);
});
test('further discovery and collection list views retain all collected entities', () => {
  const before = gathering();
  let session = say(before, '다른 장소 더 찾아줘');
  assert.equal(currentTrip(session).stage, 'discover');
  assert.deepEqual(
    currentTrip(session).collectedIds,
    currentTrip(before).collectedIds,
  );
  session = say(session, '담은 곳 보여줘');
  assert.equal(currentTrip(session).stage, 'collection');
  assert.deepEqual(
    currentTrip(session).collectedIds,
    currentTrip(before).collectedIds,
  );
});
test('two places and two foods from different anchors are all used without an automatic hotel or extra candidates', () => {
  let before = gathering();
  before = appendTrip(before, { type: 'configure', days: 2 });
  const session = say(before, '담은 곳으로 일정 짜줘'),
    state = currentTrip(session);
  assert.deepEqual(
    state.plan.map((v) => v.entityId),
    ['hyeopjae', 'hj-rice', 'osulloc', 'of-rice', 'of-cafe'],
  );
  assert.equal(state.plan.find((v) => v.entityId === 'hyeopjae').day, 1);
  assert.equal(state.plan.find((v) => v.entityId === 'hj-rice').day, 1);
  assert.equal(state.plan.find((v) => v.entityId === 'osulloc').day, 2);
  assert.equal(state.plan.find((v) => v.entityId === 'of-rice').day, 2);
  assert.ok(!state.plan.some((v) => v.kind === 'stay'));
  assert.match(state.notice, /숙소는 아직/);
  assert.doesNotThrow(() =>
    parseTripSession(JSON.parse(JSON.stringify(session))),
  );
});
test('food-only collection produces only collected foods and does not invent its anchor place as a visit', () => {
  let session = collect(createDemoSession(), 'hj-rice');
  session = collect(session, 'of-cafe');
  session = say(session, '담은 곳으로 당일 일정 짜줘');
  assert.deepEqual(
    currentTrip(session).plan.map((v) => v.entityId),
    ['hj-rice', 'of-cafe'],
  );
  assert.ok(!currentTrip(session).plan.some((v) => v.kind === 'place'));
});
test('optional stay is added only when directly collected, with an explicit duration change', () => {
  const before = gathering(),
    session = collect(before, 'stay-tea');
  assert.equal(currentTrip(session).days, 2);
  assert.match(currentTrip(session).notice, /숙소를 직접 담아.*1박 2일/);
  const plan = appendTrip(session, { type: 'build' });
  assert.deepEqual(
    currentTrip(plan)
      .plan.filter((v) => v.kind === 'stay')
      .map((v) => v.entityId),
    ['stay-tea'],
  );
  assert.deepEqual(
    currentTrip(plan)
      .plan.filter((v) => v.kind !== 'stay')
      .map((v) => v.entityId),
    currentTrip(before).collectedIds,
  );
});
test('explicitly returning to a day trip keeps overnight stays out without inventing another hotel', () => {
  let session = collect(gathering(), 'stay-tea');
  session = appendTrip(session, { type: 'configure', days: 1 });
  session = appendTrip(session, { type: 'build' });
  assert.equal(currentTrip(session).days, 1);
  assert.ok(!currentTrip(session).plan.some((v) => v.kind === 'stay'));
  assert.match(currentTrip(session).notice, /당일 여행/);
});
test('multiple stay choices must fit the number of nights before collection build succeeds', () => {
  let session = collect(gathering(), 'stay-tea');
  session = collect(session, 'stay-coast');
  const before = currentTrip(session);
  session = appendTrip(session, { type: 'build' });
  assert.equal(currentTrip(session).stage, 'collection');
  assert.match(currentTrip(session).notice, /숙소 후보가 2곳/);
  assert.deepEqual(currentTrip(session).collectedIds, before.collectedIds);
  session = appendTrip(session, { type: 'configure', days: 3 });
  session = appendTrip(session, { type: 'build' });
  assert.deepEqual(
    currentTrip(session)
      .plan.filter((v) => v.kind === 'stay')
      .map((v) => v.entityId),
    ['stay-tea', 'stay-coast'],
  );
});
test('booked overnight records survive rebuilding a collection exactly, including identity and visit status', () => {
  let session = say(
    createDemoSession(),
    '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
  );
  const locked = currentTrip(session).plan.find((v) => v.locked);
  session = appendTrip(session, {
    type: 'progress',
    id: locked.id,
    status: 'done',
  });
  const protectedStays = currentTrip(session).plan.filter((v) => v.locked);
  session = collect(session, 'hyeopjae');
  session = collect(session, 'hj-rice');
  const modelResult = applyModelReply(
    {
      protocolVersion: 1,
      requestId: 'booked-collection-test',
      sessionId: 'collection-session',
      baseRevision: session.turns.at(-1).id,
      session,
      action: { type: 'message', text: '담은 곳으로 일정 짜줘' },
    },
    { message: '담은 곳으로 일정 구성', actions: [{ type: 'build' }] },
  );
  assert.deepEqual(
    currentTrip(modelResult).plan.filter((v) => v.locked),
    protectedStays,
  );
  assert.equal(
    new Set(currentTrip(modelResult).plan.map((v) => v.id)).size,
    currentTrip(modelResult).plan.length,
  );
  assert.doesNotThrow(() =>
    parseTripSession(JSON.parse(JSON.stringify(modelResult))),
  );
});
test('a chosen hotel fills only empty nights on an already built collection itinerary', () => {
  let session = appendTrip(gathering(), { type: 'configure', days: 2 });
  session = appendTrip(session, { type: 'build' });
  const originalVisits = currentTrip(session).plan;
  session = appendTrip(session, { type: 'show', stage: 'stay' });
  session = appendTrip(session, { type: 'stay', id: 'stay-coast' });
  assert.equal(currentTrip(session).stage, 'plan');
  assert.deepEqual(
    currentTrip(session).plan.filter((v) => v.kind !== 'stay'),
    originalVisits,
  );
  assert.deepEqual(
    currentTrip(session)
      .plan.filter((v) => v.kind === 'stay')
      .map((v) => [v.day, v.entityId]),
    [[1, 'stay-coast']],
  );
});
test('removing one collected entity recomputes focus, keeps other choices, and can be undone', () => {
  const before = gathering(),
    originalTurns = JSON.stringify(before.turns);
  let session = uncollect(before, 'of-cafe');
  assert.deepEqual(currentTrip(session).collectedIds, [
    'hyeopjae',
    'hj-rice',
    'osulloc',
    'of-rice',
  ]);
  assert.equal(currentTrip(session).foodId, 'of-rice');
  assert.equal(currentTrip(session).cafeId, null);
  assert.equal(currentTrip(session).anchorId, 'osulloc');
  session = say(session, '방금 수정 취소해줘');
  assert.deepEqual(
    currentTrip(session).collectedIds,
    currentTrip(before).collectedIds,
  );
  assert.equal(currentTrip(session).cafeId, 'of-cafe');
  assert.equal(currentTrip(session).stage, 'collection');
  assert.equal(JSON.stringify(session.turns.slice(0, -2)), originalTurns);
});
test('named removal affects only the active collection, not favorites or saved plans', () => {
  let session = appendTrip(gathering(), { type: 'bookmark', id: 'hyeopjae' });
  session = appendTrip(session, { type: 'build' });
  session = appendTrip(session, { type: 'save' });
  const library = JSON.stringify(session.library),
    plan = JSON.stringify(currentTrip(session).plan);
  session = say(session, '협재 담은 목록에서 빼줘');
  assert.ok(!currentTrip(session).collectedIds.includes('hyeopjae'));
  assert.ok(currentTrip(session).savedIds.includes('hyeopjae'));
  assert.equal(JSON.stringify(currentTrip(session).plan), plan);
  assert.equal(JSON.stringify(session.library), library);
});
test('reset clears the active collection but keeps favorites and saved itineraries', () => {
  let session = appendTrip(gathering(), { type: 'bookmark', id: 'osulloc' });
  session = appendTrip(session, { type: 'build' });
  session = appendTrip(session, { type: 'save' });
  const library = session.library;
  session = appendTrip(session, { type: 'reset' });
  assert.deepEqual(currentTrip(session).collectedIds, []);
  assert.deepEqual(currentTrip(session).savedIds, ['osulloc']);
  assert.deepEqual(session.library, library);
  assert.equal(session.turns.length, 1);
});
test('legacy sessions without collectedIds retain automatic itinerary and favorites-only behavior', () => {
  let session = createDemoSession(['hyeopjae']);
  delete session.turns[0].state.collectedIds;
  assert.ok(isTripSession(session));
  assert.doesNotThrow(() => parseTripSession(session));
  const automatic = say(session, '제주 1박 2일 일정 짜줘');
  assert.ok(currentTrip(automatic).plan.some((v) => v.kind === 'stay'));
  const favoritesOnly = appendTrip(say(session, '제주에서 찾아줘'), {
    type: 'build',
    savedOnly: true,
  });
  assert.deepEqual(
    currentTrip(favoritesOnly)
      .plan.filter((v) => v.kind === 'place')
      .map((v) => v.entityId),
    ['hyeopjae'],
  );
});
test('collection explanations or negative requests cannot add or remove candidates', () => {
  const before = gathering();
  for (const q of [
    '협재 담기 방법 알려줘',
    '오설록 담지 마',
    '협재 담은 목록에서 빼주지 마',
  ]) {
    const result = say(before, q);
    assert.deepEqual(
      currentTrip(result).collectedIds,
      currentTrip(before).collectedIds,
      q,
    );
  }
});

// This regression fixture intentionally uses the authored legacy businesses.
function createDemoSession(savedIds = [], library = []) { return createTripSession(savedIds, library, "demo"); }
