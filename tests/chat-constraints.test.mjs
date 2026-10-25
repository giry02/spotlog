import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { createTripSession, currentTrip, appendTrip } = await import('../lib/trip-engine.ts');
const { applyModelReply } = await import('../lib/chat-contract.ts');
const { explicitBuildConstraints } = await import('../lib/chat-constraints.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const { requestsMorningAfternoonVisits } = await import('../lib/itinerary-selection.ts');
const request = (text) => ({ protocolVersion: 1, requestId: 'constraints', sessionId: 'constraints', baseRevision: 1, session: createTripSession(), action: { type: 'message', text } });
const actions = [{ type: 'region', region: '제주' }, { type: 'configure', days: 3 }, { type: 'build' }];

test('explicit lodging exclusion survives a model omitting lodging:false in a three-day build', () => {
  const input = request('제주 2박 3일, 오전 오후로 관광지 일정 만들어줘. 숙소 추천은 빼줘.');
  const original = structuredClone(input);
  const session = applyModelReply(input, { message: '일정 초안이에요.', actions });
  const state = currentTrip(session);
  assert.equal(state.days, 3);
  assert.equal(state.lodging, false);
  assert.equal(state.plan.filter((v) => v.kind === 'place').length, 6);
  assert.equal(state.plan.some((v) => v.kind === 'stay'), false);
  assert.deepEqual(input, original);
  assert.equal(actions[1].lodging, undefined);
});
test('explicit build constraints do not invent builds or reverse a request to keep lodging', () => {
  assert.deepEqual(explicitBuildConstraints(request('숙소 추천은 빼줘'), []), []);
  for (const text of ['숙소를 빼지 말고 일정을 짜줘', '숙소 제외하는 방법을 설명해줘', '제주 2박 3일 일정']) assert.deepEqual(explicitBuildConstraints(request(text), actions), actions);
  const repaired = explicitBuildConstraints(request('제주 일정 만들어줘. 숙박은 제외해줘.'), [{ type: 'region', region: '제주' }, { type: 'build' }]);
  assert.deepEqual(repaired[1], { type: 'configure', lodging: false });
});

const forestSelection = [{ day: 1, placeId: 'saryeoni' }, { day: 1, placeId: 'jeolmul' }];
const forestRetrieval = () => ({ dataMode: 'curated-travel-data', indexVersion: 'idx:constraints', embeddingModel: 'test-embedding', results: forestSelection.map(({ placeId }) => ({
  ...ragCatalog().find((item) => item.placeId === placeId && item.sourceKind === 'curated-official-summary'), evidenceId: `ev:${placeId}`, sourceVersion: `sv:${placeId}`,
})) });

test('an existing two-day plan becomes the explicitly requested day trip even when a model omits every configure field', () => {
  let session = createTripSession();
  for (const action of [{ type: 'region', region: '제주' }, { type: 'configure', days: 2 }, { type: 'build' }]) session = appendTrip(session, action);
  const before = structuredClone(session);
  const input = { ...request('제주 당일 일정으로 사려니숲길과 절물자연휴양림만 오전 오후에 넣어줘. 식당 카페 숙소는 빼줘.'), session, baseRevision: session.turns.at(-1).id };
  const result = applyModelReply(input, { message: '당일 일정이에요.', actions: [{ type: 'build', visits: forestSelection }] }, 'large-model', forestRetrieval());
  const state = currentTrip(result);
  assert.equal(state.days, 1);
  assert.equal(state.meals, false);
  assert.equal(state.cafes, false);
  assert.equal(state.lodging, false);
  assert.deepEqual(state.plan.map((visit) => [visit.day, visit.kind, visit.entityId]), [[1, 'place', 'saryeoni'], [1, 'place', 'jeolmul']]);
  assert.deepEqual(session, before);
  const missing = forestRetrieval();
  missing.results.pop();
  assert.throws(() => applyModelReply(input, { message: '당일 일정이에요.', actions: [{ type: 'build', visits: forestSelection }] }, 'large-model', missing), { code: 'MODEL_ITINERARY_UNGROUNDED' });
  assert.deepEqual(session, before, 'a failed grounded rebuild does not commit the temporarily shortened plan');
});

test('grouped exclusions preserve retained categories and do not invent a build or override implicit model duration', () => {
  const build = [{ type: 'configure', days: 2, meals: true, cafes: true, lodging: true }, { type: 'build', visits: forestSelection }];
  const keep = explicitBuildConstraints(request('식당과 카페는 빼지 말고 숙소만 빼줘. 일정 만들어줘.'), build);
  assert.deepEqual(keep[0], { type: 'configure', days: 2, meals: true, cafes: true, lodging: false });
  const excluded = explicitBuildConstraints(request('식사·카페·숙박은 제외해줘. 일정 만들어줘.'), build);
  assert.deepEqual(excluded[0], { type: 'configure', days: 2, meals: false, cafes: false, lodging: false });
  assert.deepEqual(explicitBuildConstraints(request('당일로 식당 카페 숙소는 빼줘'), []), []);
  assert.deepEqual(explicitBuildConstraints(request('식당과 카페는 제외하지 말고 일정 만들어줘'), build), build);
});

test('an explicit shorter trip still cannot remove a booked night', () => {
  let session = createTripSession();
  for (const action of [{ type: 'region', region: '제주' }, { type: 'configure', days: 2, booked: true }, { type: 'build' }]) session = appendTrip(session, action);
  const locked = structuredClone(currentTrip(session).plan.filter((visit) => visit.locked));
  const input = { ...request('제주 당일 일정 만들어줘. 식당 카페 숙소는 빼줘.'), session, baseRevision: session.turns.at(-1).id };
  const result = applyModelReply(input, { message: '예약한 숙소는 유지해요.', actions: [{ type: 'build', visits: forestSelection }] }, 'flowise', forestRetrieval());
  assert.equal(currentTrip(result).days, 2);
  for (const visit of locked) assert.deepEqual(currentTrip(result).plan.find((after) => after.id === visit.id), visit);
});

test('all-category exclusion flags survive a day-trip rebuild and a later two-day extension', () => {
  let session = createTripSession();
  for (const action of [{ type: 'region', region: '제주' }, { type: 'configure', days: 2 }, { type: 'build' }]) session = appendTrip(session, action);
  const original = structuredClone(session);
  const input = { ...request('기존 이틀 일정을 제주 당일 일정으로 다시 만들어줘. 사려니숲길과 절물자연휴양림만 오전 오후에 넣어줘. 식당 카페 숙소는 전부 빼줘.'), session, baseRevision: session.turns.at(-1).id };
  const rebuilt = applyModelReply(input, { message: '당일 일정이에요.', actions: [{ type: 'build', visits: forestSelection }] }, 'flowise', forestRetrieval());
  for (const category of ['meals', 'cafes', 'lodging']) assert.equal(currentTrip(rebuilt)[category], false, category);
  assert.equal(currentTrip(rebuilt).days, 1);
  assert.match(rebuilt.turns.at(-1).assistantMessage, /식당·카페·숙소 추천은 제외/);
  const extension = { ...request('제주 1박 2일로 늘려줘. 두 숲을 하루씩 배치해줘.'), session: rebuilt, baseRevision: rebuilt.turns.at(-1).id };
  const extended = applyModelReply(extension, { message: '이틀 일정이에요.', actions: [
    { type: 'configure', days: 2 },
    { type: 'build', visits: [{ day: 1, placeId: 'saryeoni' }, { day: 2, placeId: 'jeolmul' }] },
  ] }, 'flowise', forestRetrieval());
  const state = currentTrip(extended);
  assert.equal(state.days, 2);
  for (const category of ['meals', 'cafes', 'lodging']) assert.equal(state[category], false, category);
  assert.deepEqual(state.plan.map(visit => [visit.day, visit.kind, visit.entityId]), [[1, 'place', 'saryeoni'], [2, 'place', 'jeolmul']]);
  assert.deepEqual(session, original);
});

test('all exclusion modifiers keep negations and explicitly retained categories intact', () => {
  const build = [{ type: 'configure', days: 2, meals: true, cafes: true, lodging: true }, { type: 'build' }];
  for (const modifier of ['전부', '전부 다', '모두', '모두 다', '다']) {
    const excluded = explicitBuildConstraints(request(`식당 카페 숙소는 ${modifier} 빼줘. 일정 만들어줘.`), build);
    assert.deepEqual(excluded[0], { type: 'configure', days: 2, meals: false, cafes: false, lodging: false });
    assert.deepEqual(explicitBuildConstraints(request(`식당 카페 숙소는 ${modifier} 빼지 말고 일정 만들어줘.`), build), build);
    const retained = explicitBuildConstraints(request(`식당과 카페는 ${modifier} 빼지 말고 숙소만 ${modifier} 빼줘. 일정 만들어줘.`), build);
    assert.deepEqual(retained[0], { type: 'configure', days: 2, meals: true, cafes: true, lodging: false });
  }
  assert.deepEqual(explicitBuildConstraints(request('식당 카페 숙소는 전부 빼줘'), []), []);
});

test('explicit do-not-add lists keep generic extra-stop tails inside the same excluded scope', () => {
  const build = [{ type: 'configure', days: 2, meals: true, cafes: true, lodging: true }, { type: 'build' }];
  for (const text of [
    '식당·카페·숙소·다른 장소나 미정 방문은 추가하지 마.',
    '식당·카페·숙소는 추가하지 마세요.',
    '식당·카페·숙소·다른 장소나 미정 방문은 추가하지 말아줘.',
  ]) assert.deepEqual(explicitBuildConstraints(request(text), build)[0], { type: 'configure', days: 2, meals: false, cafes: false, lodging: false });
  const retained = explicitBuildConstraints(request('식당·카페는 추가해줘. 숙소·다른 장소나 미정 방문은 추가하지 마.'), build);
  assert.deepEqual(retained[0], { type: 'configure', days: 2, meals: true, cafes: true, lodging: false });
  assert.deepEqual(explicitBuildConstraints(request('식당·카페·숙소·다른 장소나 미정 방문을 추가해줘.'), build), build);
  assert.deepEqual(explicitBuildConstraints(request('식당과 카페는 빼지 말고 숙소만 추가하지 마.'), build)[0], { type: 'configure', days: 2, meals: true, cafes: true, lodging: false });
  assert.deepEqual(explicitBuildConstraints(request('식당·카페·숙소·다른 장소나 미정 방문은 추가하지 마.'), []), []);
});

test('the exact Busan three-place request cannot acquire unrequested meal placeholders from model defaults', () => {
  const input = request('부산 2일 일정을 만들어줘. DAY 1에는 해운대해수욕장 → 동백섬, DAY 2에는 광안리해수욕장을 넣어줘. 이 관광지 세 곳만 넣고 식당·카페·숙소·다른 장소나 미정 방문은 추가하지 마.');
  const visits = [{ day: 1, placeId: 'public-busan-haeundae' }, { day: 1, placeId: 'public-busan-dongbaek' }, { day: 2, placeId: 'public-busan-gwangalli' }];
  const retrieval = { dataMode: 'curated-travel-data', indexVersion: 'idx:constraints-busan', embeddingModel: 'test-embedding', results: visits.map(({ placeId }) => ({
    ...ragCatalog().find(item => item.placeId === placeId && item.sourceKind === 'curated-official-summary'), evidenceId: `ev:${placeId}`, sourceVersion: `sv:${placeId}`,
  })) };
  const original = structuredClone(input);
  const reply = { message: '부산 일정 초안을 만들었어요.', actions: [{ type: 'region', region: '부산' }, { type: 'configure', days: 2, meals: true, cafes: false, lodging: false }, { type: 'build', visits }] };
  const result = applyModelReply(input, reply, 'large-model', retrieval), state = currentTrip(result);
  assert.deepEqual(state.plan.map(visit => [visit.day, visit.kind, visit.entityId]), visits.map(visit => [visit.day, 'place', visit.placeId]));
  assert.ok(state.plan.every(visit => visit.knowledge?.evidenceIds?.length));
  assert.equal(state.meals, false);
  assert.equal(state.cafes, false);
  assert.equal(state.lodging, false);
  assert.match(result.turns.at(-1).assistantMessage, /식당·카페·숙소 추천은 제외/);
  assert.deepEqual(input, original);
  assert.equal(reply.actions[1].meals, true, 'constraints do not mutate the provider output');
});

test('a daily morning and afternoon stop is enforced only when the human explicitly requests both slots', () => {
  for (const text of [
    '제주도 2박 3일 여행 일정 짜줘. 하루에 오전 오후 한 곳씩 넣어줘.',
    '매일 오전·오후에 각각 1곳을 배치해줘.',
    '오전과 오후에 각각 하나씩 넣어줘.',
    '오전 한 곳, 오후 한 곳으로 해줘.',
    '오전에는 한 곳 넣고 오후에는 한 곳 넣어줘.',
  ]) assert.equal(requestsMorningAfternoonVisits(text), true, text);
  for (const text of [
    '오전 오후에 맞춰 여행 일정 만들어줘.',
    '오전 한 곳, 오후 두 곳으로 짜줘.',
    '오전 오후 상관없이 한 곳씩 넣어줘.',
    '오전 오후 한 곳씩 말고 우도만 넣어줘.',
    '오전 오후 각 1곳씩 넣지 말고 하루 한 곳으로 해줘.',
    '오전 오후 한 곳씩은 필요없어.',
  ]) assert.equal(requestsMorningAfternoonVisits(text), false, text);
});
