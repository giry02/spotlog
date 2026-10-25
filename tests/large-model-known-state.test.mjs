import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { predictLargeModel, readLargeModelConfig } = await import('../lib/large-model-adapter.ts');
const { createTripSession, appendTrip, currentTrip } = await import('../lib/trip-engine.ts');
const { applyModelReply } = await import('../lib/chat-contract.ts');
const local = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'ollama', LARGE_MODEL_NAME: 'qwen3:14b' });
const ids = ['catalog-busan-geumsu', 'catalog-busan-geodae'];
const empty = {
  retrievalStatus: 'empty', retrievalInstruction: '새 관광지의 검색 근거가 없다. 현재 여행의 편집은 허용 도구를 사용한다.',
  coverage: { sufficient: false, reason: 'missing-evidence' },
  retrieval: { dataMode: 'curated-travel-data', indexVersion: 'idx:known-state', embeddingModel: 'test', results: [] },
};
const outside = { ...empty, coverage: { sufficient: false, reason: 'outside-corpus' }, retrieval: { ...empty.retrieval, results: [{
  evidenceId: 'ev:unrelated', placeId: 'hallasan', documentId: 'doc:unrelated', chunkId: 'chunk:unrelated', sourceVersion: 'sv:unrelated',
  text: '이번 편집과 관계없는 관광 안내 요약', sourceKind: 'curated-official-summary',
}] } };
const request = (session, text) => ({ protocolVersion: 1, requestId: 'known-state-test', sessionId: 'known-state-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } });
function businessTrip({ built = true } = {}) {
  let session = createTripSession();
  for (const id of ids) session = appendTrip(session, { type: 'collect-entity', id });
  if (built) session = appendTrip(session, { type: 'build' });
  return session;
}
async function predict(input, reply, resources = empty, inspect = () => {}) {
  let generationCalls = 0;
  const result = await predictLargeModel(input, local, async (url, init) => {
    if (String(url).endsWith('/api/show')) return Response.json({ details: { format: 'gguf', parameter_size: '14.8B', quantization_level: 'Q4_K_M' } });
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    generationCalls++;
    const body = JSON.parse(init.body);
    inspect(body, JSON.parse(body.messages[1].content));
    return Response.json({ done: true, done_reason: 'stop', message: { content: JSON.stringify(reply) } });
  }, resources);
  assert.equal(generationCalls, 1);
  return result;
}

test('no-evidence large fallback can edit known metadata and visit details atomically', async () => {
  const session = businessTrip(), original = structuredClone(session), first = currentTrip(session).plan[0];
  const input = request(session, '여행 이름을 부산 식당 검수로, 출발일을 2026-11-03으로 바꿔줘. 금수복국 해운대본점 방문의 메모를 창가 자리 요청으로, 방문 시각을 11:30으로, 체류시간을 60분으로 수정해줘. 다른 방문과 순서는 그대로 둬.');
  const actions = [{ type: 'trip-meta', title: '부산 식당 검수', startDate: '2026-11-03' }, { type: 'visit-details', id: first.id, note: '창가 자리 요청', time: '11:30', durationMinutes: 60 }];
  const reply = await predict(input, { message: '요청한 여행과 방문 정보를 바꿨어요.', actions }, empty, (body, envelope) => {
    assert.equal(envelope.userMessage, input.action.text);
    assert.match(body.messages[0].content, /visit-details/);
    assert.ok(body.messages[1].content.includes(first.id));
  });
  const result = applyModelReply(input, reply, 'large-model');
  assert.equal(currentTrip(result).title, '부산 식당 검수');
  assert.equal(currentTrip(result).startDate, '2026-11-03');
  assert.deepEqual(currentTrip(result).plan, currentTrip(session).plan.map(visit => visit.id === first.id ? { ...visit, note: '창가 자리 요청', time: '11:30', durationMinutes: 60 } : visit));
  assert.deepEqual(session, original);
});

test('outside-corpus coverage does not block a known DAY copy or a foreign word in a trip title', async () => {
  const session = businessTrip(), original = structuredClone(session);
  const input = request(session, 'DAY 1을 마지막에 새 DAY로 복사해줘.');
  const reply = await predict(input, { message: 'DAY 1을 복사했어요.', actions: [{ type: 'day-copy', day: 1 }] }, outside);
  const result = applyModelReply(input, reply, 'large-model');
  assert.equal(currentTrip(result).days, 2);
  assert.equal(currentTrip(result).plan.length, currentTrip(session).plan.length * 2);
  assert.deepEqual(currentTrip(result).plan.filter(visit => visit.day === 1), currentTrip(session).plan);
  assert.deepEqual(session, original);
  const named = request(session, '여행 이름을 도쿄 추억으로 바꿔줘.');
  assert.deepEqual((await predict(named, { message: '여행 이름을 바꿨어요.', actions: [{ type: 'trip-meta', title: '도쿄 추억' }] }, outside)).actions, [{ type: 'trip-meta', title: '도쿄 추억' }]);
});

test('explicit collected-business-only planning can use its canonical businesses without tourism evidence', async () => {
  const session = businessTrip({ built: false }), original = structuredClone(session);
  const input = request(session, '담은 금수복국 해운대본점과 거대갈비 두 식당만으로 부산 2일 일정을 만들어줘. DAY 1에는 금수복국 해운대본점, DAY 2에는 거대갈비를 넣어줘. 다른 장소는 넣지 마.');
  const actions = [{ type: 'configure', days: 2 }, { type: 'build' }];
  const reply = await predict(input, { message: '담은 식당만 이틀 일정으로 배치했어요.', actions }, empty, (_body, envelope) => {
    assert.equal(envelope.context.task, 'collected-business-itinerary');
    assert.deepEqual(envelope.context.collectedBusinesses.map(item => item.id), ids);
  });
  const result = applyModelReply(input, reply, 'large-model');
  assert.equal(currentTrip(result).days, 2);
  assert.deepEqual(currentTrip(result).plan.map(visit => [visit.day, visit.entityId]), [[1, ids[0]], [2, ids[1]]]);
  assert.ok(currentTrip(result).plan.every(visit => visit.kind === 'food'));
  assert.deepEqual(session, original);
});

test('known local save/open/trash/restore operations do not require fresh tourism retrieval', async () => {
  let session = businessTrip();
  const save = request(session, '지금 여행 일정을 저장해줘.');
  session = applyModelReply(save, await predict(save, { message: '이 기기에 저장했어요.', actions: [{ type: 'save' }] }), 'large-model');
  assert.equal(session.library.length, 1);
  const id = session.library[0].id;
  for (const [text, action] of [
    ['첫 번째 저장한 여행 열어줘.', { type: 'open', id }],
    ['저장한 여행을 휴지통으로 옮겨줘.', { type: 'trash', id }],
    ['휴지통의 저장 여행을 복원해줘.', { type: 'restore', id }],
  ]) {
    const input = request(session, text);
    session = applyModelReply(input, await predict(input, { message: '요청한 저장 여행을 처리했어요.', actions: [action] }), 'large-model');
  }
  assert.equal(session.library[0].deletedAt, undefined);
});

test('existing trips do not authorize new tourism or unsupported-region generation without evidence', async () => {
  const session = businessTrip(), original = structuredClone(session);
  for (const text of [
    '도쿄 2박 3일 새 여행 일정을 만들어줘.',
    '부산 2일 새 관광지 일정을 만들어줘.',
    'DAY 1에 새 관광지 해운대해수욕장 방문을 추가해줘.',
  ]) {
    const input = request(session, text);
    const actions = text.includes('추가') ? [{ type: 'add-entity', id: 'public-busan-haeundae', day: 1 }] : [{ type: 'build', visits: [{ day: 1, placeId: 'public-busan-haeundae' }] }];
    await assert.rejects(predict(input, { message: '관광지를 추가했어요.', actions }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  }
  assert.deepEqual(session, original);
});

test('known-state exceptions reject unrelated tool types, booking changes and invented citations', async () => {
  const session = businessTrip();
  const edit = request(session, '여행 이름을 식당 검수로 바꿔줘.');
  for (const reply of [
    { message: '지역을 바꿨어요.', actions: [{ type: 'region', region: '서울' }] },
    { message: '새 관광지를 넣었어요.', actions: [{ type: 'build', visits: [{ day: 1, placeId: 'public-busan-haeundae' }] }] },
    { message: '이름을 바꿨어요.', actions: [{ type: 'trip-meta', title: '식당 검수' }], evidenceIds: ['invented-source'] },
  ]) await assert.rejects(predict(edit, reply), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  const build = request(session, '담은 두 식당만으로 당일 일정을 만들어줘.');
  await assert.rejects(predict(build, { message: '예약 상태도 바꿨어요.', actions: [{ type: 'configure', days: 1, booked: false }, { type: 'build' }] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
});

test('exact named registered-business collection needs no tourism retrieval and keeps explicit region/order authority', async () => {
  const session = createTripSession(), original = structuredClone(session);
  const input = request(session, '부산 여행 후보에 실제 등록된 식당 금수복국 해운대본점과 거대갈비 두 곳만 이 순서대로 담아줘. 일정은 아직 만들지 말고 관광지·카페·숙소는 추가하지 마.');
  const actions = [{ type: 'region', region: '부산' }, ...ids.map(id => ({ type: 'collect-entity', id }))];
  const reply = await predict(input, { message: '부산의 두 등록 식당을 요청한 순서대로 담았어요.', actions }, empty, (_body, envelope) => {
    assert.equal(envelope.context.task, 'named-business-collector');
  });
  const result = applyModelReply(input, reply, 'large-model');
  assert.equal(currentTrip(result).region, '부산');
  assert.deepEqual(currentTrip(result).collectedIds, ids);
  assert.deepEqual(currentTrip(result).plan, []);
  assert.deepEqual(session, original);
});

test('named collector exception rejects tourism builds, a different region and unregistered business IDs', async () => {
  const input = request(createTripSession(), '부산 여행 후보에 실제 등록된 식당 금수복국 해운대본점과 거대갈비 두 곳만 이 순서대로 담아줘. 아직 일정은 만들지 마.');
  for (const actions of [
    [{ type: 'region', region: '서울' }, ...ids.map(id => ({ type: 'collect-entity', id }))],
    [{ type: 'build', visits: [{ day: 1, placeId: 'public-busan-haeundae' }] }],
    [{ type: 'collect-entity', id: 'of-cafe' }],
  ]) await assert.rejects(predict(input, { message: '업체를 담았어요.', actions }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
  await assert.rejects(predict(input, { message: '업체를 담았어요.', actions: [{ type: 'collect-entity', id: 'made-up-business-id' }] }), { code: 'MODEL_OUTPUT_INVALID' });
});

test('descriptive, cancelled and unsupported named-business collection requests retain the read-only fallback', async () => {
  for (const text of [
    '부산 금수복국 해운대본점을 여행 후보에 담는 방법을 설명해줘.',
    '부산 금수복국 해운대본점과 거대갈비를 담아줘. 아니 담지 마.',
    '도쿄 여행 후보에 금수복국 해운대본점과 거대갈비를 담아줘.',
  ]) await assert.rejects(predict(request(createTripSession(), text), { message: '식당을 담았어요.', actions: [{ type: 'collect-entity', id: ids[0] }] }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
});
