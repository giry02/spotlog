import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (/\/lib\/[^/]+\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./') && !/\.[a-z]+$/.test(specifier)) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { appendTrip, createTripSession, currentTrip } = await import('../lib/trip-engine.ts');
const { applyModelReply, parseTripSession, parseModelReply, MAX_MODEL_ACTIONS, validateActionContext } = await import('../lib/chat-contract.ts');
const { buildModelInput } = await import('../lib/model-input.ts');
const { places, restaurants, findPlace } = await import('../lib/trip-data.ts');

const text = '바다 앞 한상과 차밭 옆 밥상 두 식당, 바다곁 스테이 숙소도 여행 후보에 담아줘. 아직 일정은 만들지 마.';
const fixture = () => ['hyeopjae', 'geumneung', 'osulloc', 'songaksan'].reduce((session, id) => appendTrip(session, { type: 'collect-entity', id }), createDemoSession());
const request = (session = fixture(), question = text) => ({
  protocolVersion: 1, requestId: 'named-business-test', sessionId: 'named-business-test', baseRevision: session.turns.at(-1).id,
  session, action: { type: 'message', text: question },
});
const reply = { message: '가상 식당 두 곳과 숙소 후보를 담았어요. 일정은 아직 만들지 않았어요.', actions: [
  { type: 'collect-entity', id: 'hj-rice' }, { type: 'collect-entity', id: 'of-rice' }, { type: 'collect-entity', id: 'stay-coast' },
] };

test('three explicitly named businesses can be collected across anchors in one real model reply without extra place actions', () => {
  const input = request();
  const snapshot = structuredClone(input);
  const result = applyModelReply(input, parseModelReply(reply), 'ollama');
  assert.deepEqual(currentTrip(result).collectedIds, ['hyeopjae', 'geumneung', 'osulloc', 'songaksan', 'hj-rice', 'of-rice', 'stay-coast']);
  assert.equal(currentTrip(result).plan.length, 0);
  assert.equal(result.turns.length, input.session.turns.length + 1);
  assert.equal(result.turns.at(-1).source, 'ollama');
  assert.ok(parseTripSession(result));
  assert.deepEqual(input, snapshot);
  assert.equal(MAX_MODEL_ACTIONS, 4);
});

test('named collection model input provides only this request business choices and the direct collect grammar', () => {
  const input = request();
  const before = structuredClone(input);
  const built = buildModelInput(input);
  assert.deepEqual(built.question.context.namedBusinessCollectionCandidates.map(candidate => candidate.id), ['hj-rice', 'of-rice', 'stay-coast']);
  assert.ok(built.question.context.namedBusinessCollectionCandidates.every(candidate => candidate.eligible));
  assert.equal(built.question.context.catalog, undefined);
  assert.equal(built.question.context.retrieval, undefined);
  assert.match(built.messages[0].content, /collect-entity/);
  assert.match(built.messages[0].content, /place.*전환.*필요.*없/);
  assert.equal(built.question.userMessage, text);
  assert.ok(JSON.stringify(built).length < 6000);
  assert.deepEqual(input, before);
});

test('implicit names, past messages and RAG text do not authorize another anchor business', () => {
  for (const question of ['식당 하나 담아줘', '아까 말한 식당을 담아줘', '바다 앞 한상을 담지 마', '바다 앞 한상을 담아주지 마', '바다 앞 한상 메뉴 보여줘', '바다 앞 한상을 담아도 돼?', '바다 앞 한상은 말고 차밭 옆 밥상을 담아줘']) {
    const input = request();
    input.session.turns[0].state.question = text;
    input.action.text = question;
    assert.throws(() => applyModelReply(input, { ...reply, actions: reply.actions.slice(0, 1) }, 'ollama', {
      dataMode: 'authored-demo-data', indexVersion: 'test', embeddingModel: 'test', results: [], text,
    }), { code: 'MODEL_ACTION_INVALID' });
  }
  const input = request();
  input.action = { type: 'show', stage: 'collection' };
  assert.throws(() => applyModelReply(input, { ...reply, actions: reply.actions.slice(0, 1) }, 'ollama'), { code: 'MODEL_ACTION_INVALID' });
  assert.throws(() => validateActionContext(reply.actions[0], request().session, true), { code: 'INVALID_REQUEST' });
});

test('named collection still respects region, food kind, walk, food budget, stay budget, reservation and collection limits', () => {
  const cases = [
    [{ type: 'walk', value: 1 }, 'hj-rice'],
    [{ type: 'cuisine', value: '양식' }, 'hj-rice'],
    [{ type: 'configure', foodBudget: 1000 }, 'hj-rice'],
    [{ type: 'stay-budget', value: 50000 }, 'stay-coast'],
    [{ type: 'configure', booked: true }, 'stay-coast'],
  ];
  for (const [action, id] of cases) {
    const input = request(appendTrip(fixture(), action));
    const before = structuredClone(input.session);
    assert.throws(() => applyModelReply(input, { ...reply, actions: [{ type: 'collect-entity', id }] }, 'ollama'), { code: 'MODEL_ACTION_INVALID' });
    assert.deepEqual(input.session, before);
  }
  assert.throws(() => applyModelReply(request(fixture(), '숲앞 밥상을 담아줘'), { ...reply, actions: [{ type: 'collect-entity', id: 'sf-rice' }] }, 'ollama'), { code: 'MODEL_ACTION_INVALID' });
  const unnamed = request(fixture(), '차밭 옆 밥상만 담아줘');
  assert.throws(() => applyModelReply(unnamed, reply, 'ollama'), { code: 'MODEL_ACTION_INVALID' });
  const ids = [...places.filter(place => place.region === '제주').map(place => place.id),
    ...restaurants.filter(food => findPlace(food.placeId)?.region === '제주' && food.id !== 'hj-rice').map(food => food.id)].slice(0, 30);
  const full = request(ids.reduce((session, id) => appendTrip(session, { type: 'collect-entity', id }), createDemoSession()));
  assert.equal(currentTrip(full.session).collectedIds.length, 30);
  assert.throws(() => applyModelReply(full, { ...reply, actions: reply.actions.slice(0, 1) }, 'ollama'), { code: 'MODEL_ACTION_INVALID' });
});

// This regression fixture intentionally uses the authored legacy businesses.
function createDemoSession(savedIds = [], library = []) { return createTripSession(savedIds, library, "demo"); }
