import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.includes('/lib/') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
} });

const { createTripSession, appendTrip, currentTrip } = await import('../lib/trip-engine.ts');
const { buildModelInput, usesNamedBusinessCollector } = await import('../lib/model-input.ts');
const { parseModelReply, applyModelReply } = await import('../lib/chat-contract.ts');
const { modelSystemPrompt } = await import('../lib/model-system-prompt.ts');
const request = (session, text) => ({ protocolVersion: 1, requestId: 'named-collect-test', sessionId: 'named-collect-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });
const foodText = '부산 여행 후보에 실제 등록된 식당 금수복국 해운대본점과 거대갈비 두 곳만 이 순서대로 담아줘. 일정은 아직 만들지 말고 관광지·카페·숙소는 추가하지 마.';
const foodIds = ['catalog-busan-geumsu', 'catalog-busan-geodae'];
const shopIds = ['public-busan-gukje', 'public-busan-jagalchi'];

test('the exact live named-food request carries only eligible registered names in request order', () => {
  const input = request(createTripSession(), foodText), original = structuredClone(input), model = buildModelInput(input);
  assert.equal(usesNamedBusinessCollector(input), true);
  assert.equal(model.question.context.task, 'named-business-collector');
  assert.equal(model.question.context.requestedRegion, '부산');
  const example = model.question.context.collectionReplyExample;
  assert.deepEqual(parseModelReply(example).actions, [{ type: 'region', region: '부산' }, ...foodIds.map(id => ({ type: 'collect-entity', id }))]);
  assert.ok(model.messages[0].content.includes(JSON.stringify(example)));
  assert.deepEqual(model.question.context.namedBusinessCollectionCandidates.map(item => item.id), foodIds);
  assert.ok(model.question.context.namedBusinessCollectionCandidates.every(item => item.registered === true && item.eligible === true));
  assert.ok(model.question.context.namedBusinessCollectionCandidates.every(item => Object.keys(item).every(key => ['id', 'name', 'kind', 'eligible', 'registered'].includes(key))));
  assert.equal(model.question.context.catalog, undefined);
  assert.equal(model.question.context.itineraryCandidates, undefined);
  assert.match(model.messages[0].content, /"type":"collect-entity"/);
  assert.match(model.messages[0].content, /type과id 외에 entityType\/targetType\/fields\/visitId\/name\/kind를 행동에 넣지 않는다/);
  const reply = parseModelReply({ message: '등록된 두 식당을 순서대로 담았어요.', actions: [{ type: 'region', region: '부산' }, ...foodIds.map(id => ({ type: 'collect-entity', id }))] });
  const result = applyModelReply(input, reply, 'ollama');
  assert.deepEqual(currentTrip(result).collectedIds, foodIds);
  assert.deepEqual(currentTrip(result).plan, []);
  assert.deepEqual(input, original);
});

test('a named SHOP collection preserves the active trip and uses no unnecessary region action', () => {
  let session = appendTrip(createTripSession(), { type: 'region', region: '부산' });
  session = appendTrip(session, { type: 'configure', days: 2, meals: false, lodging: false });
  session = appendTrip(session, { type: 'build', visits: [{ day: 1, placeId: 'public-busan-haeundae' }, { day: 2, placeId: 'public-busan-gwangalli' }] });
  session = appendTrip(session, { type: 'collect-entity', id: foodIds[0] });
  const before = structuredClone(currentTrip(session));
  const input = request(session, '국제시장과 자갈치시장 두 상점만 이 순서대로 담아줘. 일정은 아직 만들지 마. 식당·카페·숙소는 추가하지 마.'), model = buildModelInput(input);
  assert.equal(usesNamedBusinessCollector(input), true);
  assert.equal(model.question.context.requestedRegion, null);
  assert.deepEqual(model.question.context.namedBusinessCollectionCandidates.map(item => [item.id, item.kind]), shopIds.map(id => [id, 'shop']));
  const result = currentTrip(applyModelReply(input, { message: '두 시장을 후보로 담았어요.', actions: shopIds.map(id => ({ type: 'collect-entity', id })) }, 'ollama'));
  assert.deepEqual(result.collectedIds, [foodIds[0], ...shopIds]);
  assert.deepEqual(result.plan, before.plan);
  assert.equal(result.days, before.days);
});

test('positive and negative named scopes remain server-selected and wholly negative requests never enter the collector', () => {
  const session = appendTrip(createTripSession(), { type: 'region', region: '부산' });
  const positive = request(session, '국제시장은 담지 말고 자갈치시장만 담아줘.'), model = buildModelInput(positive);
  assert.equal(usesNamedBusinessCollector(positive), true);
  assert.deepEqual(model.question.context.namedBusinessCollectionCandidates.map(item => item.id), [shopIds[1]]);
  for (const text of ['국제시장과 자갈치시장을 담지 마.', '국제시장과 자갈치시장을 담아도 돼?', '국제시장과 자갈치시장 담아줘. 아니 담지 마.', '국제시장 담는 방법 알려줘.']) {
    assert.equal(usesNamedBusinessCollector(request(session, text)), false, text);
  }
});

test('unknown names, unmentioned region, incompatible filters and mixed actions cannot open the collector exception', () => {
  for (const text of [
    '부산 검증되지않은식당만 담아줘.',
    '금수복국 해운대본점과 거대갈비를 담아줘.',
    foodText + ' 그리고 당일 일정도 만들어줘.',
    foodText + ' 여행을 저장해줘.',
    foodText + ' 방문 메모도 수정해줘.',
    foodText + ' DAY 1도 복사해줘.',
  ]) assert.equal(usesNamedBusinessCollector(request(createTripSession(), text)), false, text);
  let filtered = appendTrip(createTripSession(), { type: 'region', region: '부산' });
  filtered = appendTrip(filtered, { type: 'configure', foodBudget: 10000 });
  assert.equal(usesNamedBusinessCollector(request(filtered, foodText)), false);
  const busan = appendTrip(createTripSession(), { type: 'region', region: '부산' });
  assert.equal(usesNamedBusinessCollector(request(busan, '도쿄 여행 후보에 금수복국 해운대본점을 담아줘.')), false);
  assert.throws(() => parseModelReply({ message: '담았어요.', actions: [{ type: 'collect-entity', id: 'made-up-unknown-company' }] }), { code: 'MODEL_OUTPUT_INVALID' });
});

test('the Flowise system prompt recognizes the closed collector task and whole DAY copies remain a single action', () => {
  assert.match(modelSystemPrompt, /context.task가 named-business-collector/);
  assert.match(modelSystemPrompt, /후보 밖 이름·ID를 만들거나 place\/food\/stay\/show\/build\/edit\/shop\/visit-add를 사용하지 않는다/);
  assert.match(modelSystemPrompt, /DAY 전체 복사는 day-copy를 정확히 한 번만 쓴다/);
});

test('explicit demo named collection keeps its legacy compact grammar without opening the registered collector exception', () => {
  const ids = ['hyeopjae', 'geumneung', 'osulloc', 'songaksan'];
  const session = ids.reduce((current, id) => appendTrip(current, { type: 'collect-entity', id }), createTripSession([], [], 'demo'));
  const text = '바다 앞 한상과 차밭 옆 밥상 두 식당, 바다곁 스테이 숙소도 여행 후보에 담아줘. 아직 일정은 만들지 마.';
  const input = request(session, text), model = buildModelInput(input);
  assert.equal(usesNamedBusinessCollector(input), false);
  assert.equal(model.question.context.task, 'demo-named-business-collector');
  assert.equal(model.question.context.dataMode, 'authored-demo-data');
  assert.deepEqual(model.question.context.namedBusinessCollectionCandidates.map(item => item.id), ['hj-rice', 'of-rice', 'stay-coast']);
  assert.equal(model.question.context.catalog, undefined);
  assert.equal(model.question.context.retrieval, undefined);
  assert.match(model.messages[0].content, /가상 업체 체험/);
  for (const question of ['바다 앞 한상을 담지 마.', '숲앞 밥상을 담아줘.', text + ' 그리고 메모도 수정해줘.']) {
    assert.notEqual(buildModelInput(request(session, question)).question.context.task, 'demo-named-business-collector', question);
  }
  const registered = appendTrip(createTripSession(), { type: 'region', region: '제주' });
  assert.notEqual(buildModelInput(request(registered, text)).question.context.task, 'demo-named-business-collector');
});
