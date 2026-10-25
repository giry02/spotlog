import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.includes('/lib/') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
} });

const { createTripSession, appendTrip, currentTrip } = await import('../lib/trip-engine.ts');
const { buildModelInput, usesItineraryPlanner, usesCollectedBusinessPlanner } = await import('../lib/model-input.ts');
const { parseModelReply, applyModelReply } = await import('../lib/chat-contract.ts');
const { modelSystemPrompt } = await import('../lib/model-system-prompt.ts');
const { predictFlowise, readFlowiseConfig } = await import('../lib/flowise-adapter.ts');

const foodIds = ['catalog-busan-geumsu', 'catalog-busan-geodae'];
const shopIds = ['public-busan-gukje', 'public-busan-jagalchi'];
const collect = ids => ids.reduce((session, id) => appendTrip(session, { type: 'collect-entity', id }), createTripSession());
const request = (session, text) => ({ protocolVersion: 1, requestId: 'business-input-test', sessionId: 'business-input-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });

test('the actual food-only generation prompt exposes only collected businesses and configure/build grammar', () => {
  const input = request(collect(foodIds), '부산 당일 일정으로 방금 담은 금수복국 해운대본점 → 거대갈비 두 식당만 이 순서대로 방문하게 만들어줘. 두 곳을 모두 넣고 관광지·숙소·카페나 다른 장소는 추가하지 마.');
  const original = structuredClone(input), model = buildModelInput(input);
  assert.equal(usesItineraryPlanner(input), false);
  assert.equal(model.question.context.task, 'collected-business-itinerary');
  assert.deepEqual(model.question.context.collectedBusinesses.map(item => [item.id, item.kind]), foodIds.map(id => [id, 'food']));
  assert.equal(model.question.context.itineraryRequest.days, 1);
  assert.equal(model.question.context.catalog, undefined);
  assert.equal(model.question.context.candidates, undefined);
  assert.equal(model.question.context.itineraryCandidates, undefined);
  assert.match(model.messages[0].content, /"type":"configure"/);
  assert.match(model.messages[0].content, /"type":"build"/);
  assert.match(model.messages[0].content, /build에 visits, placeId, entityId, ids, day 필드를 넣지 않는다/);
  assert.match(model.messages[0].content, /최근 대화의 수집·메타정보 편집을 다시 실행하지 않는다/);
  assert.equal(model.question.userMessage, input.action.text);
  assert.equal(model.messages[1].content, JSON.stringify(model.question));
  assert.deepEqual(input, original);
});

test('two shop-only days use the same narrow generation contract and preserve canonical SHOP identities', () => {
  const input = request(collect(shopIds), '담은 국제시장과 자갈치시장 두 상점만으로 부산 2일 일정을 만들어줘. DAY 1에는 국제시장만, DAY 2에는 자갈치시장만 넣어줘. 식당·카페·숙소·다른 관광지는 추가하지 마.');
  const model = buildModelInput(input);
  assert.equal(model.question.context.task, 'collected-business-itinerary');
  assert.equal(model.question.context.itineraryRequest.days, 2);
  assert.deepEqual(model.question.context.collectedBusinesses.map(item => [item.id, item.kind]), shopIds.map(id => [id, 'shop']));
  const reply = parseModelReply({ message: '담은 두 상점으로 이틀 초안을 만들었어요.', actions: [{ type: 'configure', days: 2 }, { type: 'build' }] });
  const result = applyModelReply(input, reply, 'large-model');
  assert.deepEqual(currentTrip(result).plan.map(v => [v.day, v.entityId, v.kind]), [[1, shopIds[0], 'shop'], [2, shopIds[1], 'shop']]);
});

test('regeneration carries current metadata and locked records but does not ask to replay earlier edits', () => {
  let session = appendTrip(collect(foodIds), { type: 'configure', days: 2, booked: true });
  session = appendTrip(session, { type: 'build' });
  session = appendTrip(session, { type: 'trip-meta', title: '부산 식당 검수', startDate: '2026-11-03' });
  session = appendTrip(session, { type: 'visit-details', id: currentTrip(session).plan[0].id, note: '창가 자리 요청', time: '11:30', durationMinutes: 60 });
  const input = request(session, '담은 두 식당만으로 2일 일정을 다시 만들어줘. 기존 메모·방문 시각·체류시간과 여행 이름·출발일은 그대로 유지하고 다른 장소는 넣지 마.');
  const original = structuredClone(input), model = buildModelInput(input);
  assert.equal(model.question.context.task, 'collected-business-itinerary');
  assert.equal(model.question.context.state.title, '부산 식당 검수');
  assert.equal(model.question.context.state.startDate, '2026-11-03');
  assert.deepEqual(model.question.context.state.plan, currentTrip(session).plan);
  assert.ok(model.question.context.state.plan.some(visit => visit.kind === 'stay' && visit.locked));
  assert.equal(model.question.context.state.plan[0].note, '창가 자리 요청');
  assert.match(model.messages[0].content, /서버가 같은 업체의 기존 값으로 보존/);
  assert.deepEqual(input, original);
});

test('partial edits, generation plus saving, cancelled generation and added landmarks keep the general action context', () => {
  const session = appendTrip(collect(foodIds), { type: 'build' });
  for (const text of [
    '금수복국 방문 메모만 창가로 바꿔줘.',
    '담은 식당으로 일정을 만들고 저장해줘.',
    '담은 식당 일정은 아직 만들지 마. 메모만 바꿔줘.',
    '담은 식당으로 일정을 만들고 DAY 1을 복사해줘.',
    '담은 식당을 유지하고 해운대해수욕장도 포함해서 부산 일정을 만들어줘.',
  ]) {
    const model = buildModelInput(request(session, text));
    assert.notEqual(model.question.context.task, 'collected-business-itinerary', text);
  }
  const mixed = collect(['public-busan-haeundae', ...foodIds]);
  assert.notEqual(buildModelInput(request(mixed, '담은 곳으로 부산 당일 일정을 만들어줘.')).question.context.task, 'collected-business-itinerary');
});

test('the server parser still rejects observed fabricated actions, extra fields and business IDs used as tourism place IDs', () => {
  for (const actions of [
    [{ type: 'build', visits: [{ day: 1, placeId: foodIds[0] }] }],
    [{ type: 'edit', targetType: 'visit', id: 'food-98765' }],
    [{ type: 'visit-add', id: 'public-busan-haeundae', day: 1, time: 'lunch' }],
    [{ type: 'build', entityIds: foodIds }],
  ]) assert.throws(() => parseModelReply({ message: '일정을 처리했어요.', actions }), { code: 'MODEL_OUTPUT_INVALID' });
  assert.deepEqual(parseModelReply({ message: '담은 두 식당만 배치했어요.', actions: [{ type: 'build' }] }).actions, [{ type: 'build' }]);
});

test('collecting businesses cannot turn a new tourism request into a business generation exception', () => {
  const session = collect(foodIds);
  for (const text of [
    '부산 2일 새 관광지 일정을 만들어줘.',
    '담은 식당과 새로운 관광 명소를 포함한 부산 2일 일정을 만들어줘.',
    '담은 식당을 유지하고 관광지도 추가해서 부산 일정을 만들어줘.',
    '부산 2일 일정을 만들어줘.',
  ]) assert.equal(usesCollectedBusinessPlanner(request(session, text)), false, text);
  assert.equal(usesCollectedBusinessPlanner(request(session, '담은 두 식당만으로 부산 당일 일정을 만들어줘.')), true);
});

test('main Flowise receives the closed business task in its question without changing flow selection', async () => {
  const input = request(collect(foodIds), '담은 두 식당만으로 부산 당일 일정을 만들어줘.'), requests = [];
  const config = readFlowiseConfig({ FLOWISE_BASE_URL: 'http://127.0.0.1:3002', FLOWISE_CHATFLOW_ID: 'main-flow', FLOWISE_PLANNER_CHATFLOW_ID: 'planner-flow' });
  const reply = await predictFlowise(input, config, async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return Response.json({ json: { message: '담은 식당만 배치했어요.', actions: [{ type: 'build' }] } });
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://127.0.0.1:3002/api/v1/prediction/main-flow');
  assert.equal(JSON.parse(requests[0].body.question).context.task, 'collected-business-itinerary');
  assert.deepEqual(reply.actions, [{ type: 'build' }]);
});

test('document and generated runtime prompt agree on the conditional no-visits build grammar', async () => {
  const document = await readFile(new URL('../docs/flowise-system-prompt.txt', import.meta.url), 'utf8');
  assert.equal(modelSystemPrompt, document);
  assert.match(document, /context.task가 collected-business-itinerary/);
  assert.match(document, /관광지 일정은 visits의 실제 날짜와 순서대로 만들며 검색 근거와 visits가 필수/);
  assert.match(document, /업체 ID를 visits의 placeId로 쓰지 않는다/);
  assert.doesNotMatch(document, /visits 없이 build만 반환하지 않는다/);
});
