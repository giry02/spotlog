import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { routeModelReply } = await import('../lib/model-routing.ts');
const { ChatContractError, parseModelReply } = await import('../lib/chat-contract.ts');
const { createTripSession, appendTrip } = await import('../lib/trip-engine.ts');
const gemini = { provider: 'gemini', model: 'gemini-3.6-flash', apiKey: 'test-only-never-sent-credential', timeoutMs: 1000 };
const local = { provider: 'ollama', model: 'qwen3:14b', baseUrl: 'http://127.0.0.1:11434', timeoutMs: 180000 };
const fail = code => new ChatContractError(code, '합성 라우팅 검사', 502);
const reply = { message: '현재 여행의 알려진 상태를 처리했어요.', actions: [] };
function input(text, { built = true } = {}) {
  let session = createTripSession();
  for (const id of ['catalog-busan-geumsu', 'catalog-busan-geodae']) session = appendTrip(session, { type: 'collect-entity', id });
  if (built) session = appendTrip(session, { type: 'build' });
  return { protocolVersion: 1, requestId: 'routing-known-state', sessionId: 'routing-known-state', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } };
}
async function route(request, { remote = gemini, remoteError = fail('LARGE_MODEL_QUOTA_EXCEEDED'), primaryError, primaryReply = reply, validationError } = {}) {
  const order = [], resources = { retrievalStatus: 'empty', retrievalInstruction: '새 관광지의 근거가 없다.', coverage: { sufficient: false, reason: 'outside-corpus' } };
  const before = structuredClone(resources);
  const result = await routeModelReply({
    request, resources, large: remote, localFallback: local,
    primary: { provider: 'flowise', model: 'qwen3:8b', async predict() {
      order.push('primary-8b');
      if (primaryError) throw primaryError;
      return primaryReply;
    } },
    async predictLarge(actualRequest, config) {
      assert.equal(actualRequest, request);
      order.push(config.provider === 'gemini' ? 'gemini' : 'local-14b');
      if (config.provider === 'gemini' && remoteError) throw remoteError;
      return reply;
    },
    validate(value, mode) {
      parseModelReply(value);
      if (mode === 'flowise' && validationError) throw validationError;
    },
  });
  assert.deepEqual(resources, before);
  return { result, order };
}

test('free Gemini remains first, then known metadata edits use 8B despite missing tourism coverage', async () => {
  const request = input('여행 이름을 부산 식당 검수로, 출발일을 2026-11-03으로 바꿔줘.');
  for (const code of ['LARGE_MODEL_FREE_TIER_UNVERIFIED', 'LARGE_MODEL_BILLING_ENABLED', 'LARGE_MODEL_FREE_LIMIT_REACHED', 'LARGE_MODEL_QUOTA_EXCEEDED', 'LARGE_MODEL_AUTH_REJECTED', 'LARGE_MODEL_TIMEOUT']) {
    const { result, order } = await route(request, { remoteError: fail(code) });
    assert.deepEqual(order, ['gemini', 'primary-8b'], code);
    assert.equal(result.mode, 'flowise');
    assert.equal(result.resources.modelRouting.reason, 'primary');
    assert.equal(result.resources.modelRouting.status, 'unavailable');
  }
});

test('DAY edits and explicitly collected-business builds share the same 8B-before-14B exception', async () => {
  for (const request of [
    input('DAY 1을 마지막에 새 DAY로 복사해줘.'),
    input('DAY 1 뒤에 빈 DAY를 추가해줘.'),
    input('담은 두 식당만으로 부산 2일 일정을 만들어줘.', { built: false }),
  ]) assert.deepEqual((await route(request)).order, ['gemini', 'primary-8b']);
});

test('known-state tasks retain the independent 14B fallback after a primary error or explicit context request', async () => {
  const request = input('금수복국 해운대본점 방문의 메모를 창가 자리 요청으로 바꿔줘.');
  for (const options of [
    { primaryError: fail('MODEL_OUTPUT_INVALID') },
    { validationError: fail('MODEL_ACTION_INVALID') },
    { primaryReply: { ...reply, needsMoreContext: true } },
  ]) {
    const { result, order } = await route(request, options);
    assert.deepEqual(order, ['gemini', 'primary-8b', 'local-14b']);
    assert.equal(result.resources.modelRouting.provider, 'ollama');
  }
});

test('fresh tourism and unsupported destinations still bypass 8B for insufficient RAG even with an old plan', async () => {
  for (const request of [
    input('부산 2일 새 관광지 일정을 만들어줘.'),
    input('도쿄 2박 3일 여행 일정을 만들어줘.'),
    input('DAY 복사 기능은 어떻게 써?'),
    input('여행 이름을 바꾸지 마.'),
  ]) assert.deepEqual((await route(request)).order, ['gemini', 'local-14b'], request.action.text);
});

test('a successful free Gemini avoids both local models even for a known-state task with no RAG', async () => {
  const { result, order } = await route(input('여행 이름을 부산 식당 검수로 바꿔줘.'), { remoteError: null });
  assert.deepEqual(order, ['gemini']);
  assert.equal(result.resources.modelRouting.provider, 'gemini');
  assert.equal(result.resources.modelRouting.reason, 'primary');
});

test('local-only configuration also tries the small known-state model before warming 14B', async () => {
  const { result, order } = await route(input('DAY 1을 마지막에 복사해줘.'), { remote: local });
  assert.deepEqual(order, ['primary-8b']);
  assert.equal(result.mode, 'flowise');
});

test('exact named registered-business collection uses 8B after free Gemini refusal without tourism coverage', async () => {
  const request = input('부산 여행 후보에 실제 등록된 식당 금수복국 해운대본점과 거대갈비 두 곳만 이 순서대로 담아줘. 아직 일정은 만들지 마.', { built: false });
  request.session = createTripSession();
  request.baseRevision = 1;
  const { result, order } = await route(request);
  assert.deepEqual(order, ['gemini', 'primary-8b']);
  assert.equal(result.mode, 'flowise');
  assert.equal(result.resources.modelRouting.reason, 'primary');
});

test('named collection explanations, cancellation and unsupported regions do not activate the fast known-state exception', async () => {
  for (const text of [
    '부산 금수복국 해운대본점을 여행 후보에 담는 방법을 설명해줘.',
    '부산 금수복국 해운대본점과 거대갈비를 담아줘. 아니 담지 마.',
    '도쿄 여행 후보에 금수복국 해운대본점과 거대갈비를 담아줘.',
  ]) {
    const request = input(text, { built: false });
    request.session = createTripSession();
    request.baseRevision = 1;
    assert.deepEqual((await route(request)).order, ['gemini', 'local-14b'], text);
  }
});
