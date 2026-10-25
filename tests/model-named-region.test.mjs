import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { createTripSession, currentTrip, appendTrip } = await import('../lib/trip-engine.ts');
const { applyModelReply, parseModelReply, namedBusinessCollectorScope } = await import('../lib/chat-contract.ts');
const foods = ['catalog-busan-geumsu', 'catalog-busan-geodae'];
const shops = ['public-busan-gukje', 'public-busan-jagalchi'];
const input = (session, text) => ({ protocolVersion: 1, requestId: 'explicit-region', sessionId: 'explicit-region', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });
const collect = ids => ids.map(id => ({ type: 'collect-entity', id }));
const apply = (request, actions) => applyModelReply(request, parseModelReply({ message: '명시한 등록 업체를 담았어요.', actions }), 'flowise');

test('missing region is completed only from a single explicit supported region for positive registered IDs', () => {
  for (const [text, ids] of [
    ['부산 여행 후보에 실제 등록된 금수복국 해운대본점과 거대갈비 두 식당만 이 순서대로 담아줘. 아직 일정은 만들지 마.', foods],
    ['부산 여행 후보에 국제시장과 자갈치시장 두 상점만 이 순서대로 담아줘. 아직 일정은 만들지 마.', shops],
  ]) {
    const session = createTripSession(), original = structuredClone(session), request = input(session, text);
    const result = apply(request, collect(ids)), state = currentTrip(result);
    assert.equal(state.region, '부산');
    assert.deepEqual(state.collectedIds, ids);
    assert.deepEqual(state.plan, []);
    assert.deepEqual(session, original);
    assert.deepEqual(result.turns.slice(0, -1), original.turns);
    assert.equal(result.turns.length, original.turns.length + 1);
  }
});

test('the already valid explicit-region model batch is preserved and region completion cannot change an existing trip', () => {
  const text = '부산 여행 후보에 금수복국 해운대본점과 거대갈비 두 식당만 담아줘.';
  const fresh = createTripSession();
  assert.equal(currentTrip(apply(input(fresh, text), [{ type: 'region', region: '부산' }, ...collect(foods)])).region, '부산');
  const seoul = appendTrip(createTripSession(), { type: 'region', region: '서울' }), original = structuredClone(seoul);
  assert.throws(() => apply(input(seoul, text), collect(foods)), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(seoul, original);
});

test('no region, conflicting regions, unsupported destinations, explanations and negation never infer a region', () => {
  for (const text of [
    '금수복국 해운대본점과 거대갈비 두 식당을 담아줘.',
    '서울과 부산 여행 후보에 금수복국 해운대본점과 거대갈비를 담아줘.',
    '도쿄 여행 후보에 부산 금수복국 해운대본점과 거대갈비를 담아줘.',
    '부산 금수복국 해운대본점과 거대갈비를 담는 방법을 설명해줘.',
    '부산 금수복국 해운대본점과 거대갈비를 담지 마.',
  ]) {
    const session = createTripSession(), original = structuredClone(session), request = input(session, text);
    assert.equal(namedBusinessCollectorScope(request), undefined, text);
    assert.throws(() => apply(request, collect(foods)), { code: 'MODEL_ACTION_INVALID' }, text);
    assert.deepEqual(session, original);
  }
});

test('an unrequested ID, fabricated ID or mixed tourist build cannot use explicit-region completion', () => {
  const session = createTripSession(), original = structuredClone(session);
  const request = input(session, '부산 금수복국 해운대본점 한 식당만 여행 후보에 담아줘.');
  assert.throws(() => apply(request, collect(foods)), { code: 'MODEL_ACTION_INVALID' });
  assert.throws(() => apply(request, collect(['made-up-business-id'])), { code: 'MODEL_OUTPUT_INVALID' });
  assert.throws(() => apply(request, [...collect([foods[0]]), { type: 'build', visits: [{ day: 1, placeId: 'public-busan-haeundae' }] }]), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(session, original);
});

test('a full four-action batch cannot acquire a hidden fifth action', () => {
  const session = createTripSession(), original = structuredClone(session);
  const request = input(session, '부산 금수복국 해운대본점과 거대갈비 두 식당만 여행 후보에 담아줘.');
  assert.throws(() => apply(request, [...collect(foods), ...collect(foods)]), { code: 'MODEL_ACTION_INVALID' });
  assert.deepEqual(session, original);
});
