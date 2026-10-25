import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';

const { readLocalItineraryPlannerConfig, readOllamaConfig, predictOllama } = await import('../lib/ollama-adapter.ts');
const { readFlowiseConfig } = await import('../lib/flowise-adapter.ts');
const { createTripSession, appendTrip, currentTrip } = await import('../lib/trip-engine.ts');
const { ChatContractError, applyModelReply } = await import('../lib/chat-contract.ts');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const { routeModelReply } = await import('../lib/model-routing.ts');
const { answerContext } = await import('../lib/chat-resources.ts');

const localModel = 'qwen3:4b-instruct-2507-q4_K_M';
const environment = () => ({
  CHAT_PROVIDER: 'flowise',
  FLOWISE_BASE_URL: 'http://127.0.0.1:3002',
  FLOWISE_CHATFLOW_ID: 'main-flow',
  FLOWISE_PLANNER_CHATFLOW_ID: 'private-planner',
  FLOWISE_TIMEOUT_MS: '45000',
  OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
  OLLAMA_MODEL: 'qwen3:8b',
  LOCAL_ITINERARY_MODEL: localModel,
});
const request = (text = '제주도 2박 3일 일정 짜줘. 바다와 숲을 오전 오후에 넣어줘.') => {
  const session = createTripSession();
  return { protocolVersion: 1, requestId: 'local-planner-test', sessionId: 'local-planner-test',
    baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } };
};
const read = (input, env = environment(), config = readFlowiseConfig(env)) =>
  readLocalItineraryPlannerConfig(input, env, config);

test('only an explicit local planner opt-in selects direct inference for complete itineraries', () => {
  const input = request();
  const env = environment();
  const before = structuredClone({ input, env });
  assert.deepEqual(read(input, env), { baseUrl: 'http://127.0.0.1:11434', model: localModel, timeoutMs: 75000 });
  for (const value of [undefined, '', '  ']) assert.equal(read(input, { ...env, LOCAL_ITINERARY_MODEL: value }), null);
  let session = appendTrip(input.session, { type: 'region', region: '제주' });
  session = appendTrip(session, { type: 'build' });
  assert.equal(read({ ...input, session, baseRevision: session.turns.at(-1).id }).model, localModel);
  assert.deepEqual({ input, env }, before);
});

test('the optional planner timeout covers cold loading without widening the ordinary Ollama deadline', () => {
  assert.equal(read(request()).timeoutMs, 75000);
  for (const timeout of ['1000', '75000', '90000']) {
    assert.equal(read(request(), { ...environment(), LOCAL_ITINERARY_TIMEOUT_MS: timeout }).timeoutMs, Number(timeout));
  }
  for (const timeout of ['0', '999', '90001', '-1', '', '1000.5', 'NaN', 'Infinity']) {
    assert.equal(read(request(), { ...environment(), LOCAL_ITINERARY_TIMEOUT_MS: timeout }), null, timeout);
  }
  assert.throws(() => readOllamaConfig({ ...environment(), CHAT_PROVIDER: 'ollama', OLLAMA_TIMEOUT_MS: '75000' }),
    { code: 'OLLAMA_CONFIG_INVALID' });
});

test('ordinary chat, partial edits and mixed saving keep the configured Flowise route', () => {
  for (const text of [
    '제주 여행할 때 준비물 알려줘', 'DAY 2 일정 보여줘',
    'DAY 2 오후 장소만 다른 곳으로 바꿔줘', '제주 일정에 사려니숲길 추가해줘',
    '제주 2박 3일 일정 만들어서 저장해줘', '제주 일정 짜고 협재해변 찜해줘',
    '제주 일정 짜고 카페도 담아줘', '제주 일정 짜고 예약해줘',
  ]) assert.equal(read(request(text)), null, text);
  assert.equal(read({ ...request(), action: { type: 'build' } }), null);
});

test('remote, implicit and unrelated provider settings cannot enable the local planner', () => {
  const input = request();
  for (const provider of [undefined, '', 'ollama', 'other'])
    assert.equal(read(input, { ...environment(), CHAT_PROVIDER: provider }), null);
  for (const base of [undefined, '', 'https://flowise.example', 'http://localhost.evil:3002',
    'http://127.1:3002', 'http://2130706433:3002', 'http://user@127.0.0.1:3002',
    'http://127.0.0.1:3002/?x=1', 'http://127.0.0.1:3002/#fragment']) {
    const env = { ...environment(), FLOWISE_BASE_URL: base };
    assert.equal(readLocalItineraryPlannerConfig(input, env, readFlowiseConfig(environment())), null, String(base));
  }
  assert.equal(read(input, environment(), null), null);
  assert.equal(read(input, environment(), { ...readFlowiseConfig(environment()), plannerChatflowId: undefined }), null);
  assert.equal(read(input, { ...environment(), FLOWISE_PLANNER_CHATFLOW_ID: undefined }), null);
  assert.equal(read(input, environment(), { ...readFlowiseConfig(environment()), plannerChatflowId: 'other-planner' }), null);
});

test('explicit supported loopback hosts work while invalid optional Ollama configuration keeps Flowise', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    const env = { ...environment(), FLOWISE_BASE_URL: `http://${host}:3002`, OLLAMA_BASE_URL: `http://${host}:11434` };
    assert.equal(read(request(), env).baseUrl, `http://${host}:11434`);
  }
  for (const change of [
    { OLLAMA_BASE_URL: undefined }, { OLLAMA_BASE_URL: '' },
    { OLLAMA_BASE_URL: 'https://remote.example' }, { OLLAMA_BASE_URL: 'http://127.1:11434' },
    { OLLAMA_BASE_URL: 'http://user@127.0.0.1:11434' }, { OLLAMA_BASE_URL: 'http://127.0.0.1:11434/api' },
    { OLLAMA_TIMEOUT_MS: '45001' }, { OLLAMA_TIMEOUT_MS: '0' },
    { LOCAL_ITINERARY_MODEL: 'qwen3:4b-cloud' }, { LOCAL_ITINERARY_MODEL: 'remote.example/model:4b' },
  ]) assert.equal(read(request(), { ...environment(), ...change }), null, JSON.stringify(change));
});

test('unexpected implementation failures are not swallowed as optional configuration', () => {
  const env = environment();
  const failure = new TypeError('test implementation failure');
  Object.defineProperty(env, 'unexpected', { enumerable: true, get() { throw failure; } });
  assert.throws(() => read(request(), env), (error) => error === failure);
});

function groundedFixture() {
  const input = request('제주 당일 일정으로 오설록과 협재해변을 오전 오후에 넣어줘. 식당 카페 숙소는 빼줘.');
  const results = ['osulloc', 'hyeopjae'].map((id, index) => ({
    ...ragCatalog().find((source) => source.placeId === id && source.sourceKind === 'curated-official-summary'),
    evidenceId: `idx:test:evidence-${index}`, sourceVersion: 'sha256:' + 'a'.repeat(64),
  }));
  const retrieval = { dataMode: 'curated-travel-data', indexVersion: 'idx:test', embeddingModel: 'test-embedding', results };
  const resources = { retrievalStatus: 'available', retrievalInstruction: '현재 검증한 근거만 사용한다.',
    retrieval, coverage: { sufficient: true, reason: 'covered' } };
  const reply = { message: '검색 자료의 장소 두 곳으로 당일 초안을 만들었어요.', evidenceIds: ['ref1', 'ref2'],
    actions: [{ type: 'region', region: '제주' }, { type: 'configure', days: 1, meals: false, cafes: false, lodging: false },
      { type: 'build', visits: [{ day: 1, placeId: 'osulloc' }, { day: 1, placeId: 'hyeopjae' }] }] };
  return { input, retrieval, resources, reply };
}

function installedFetch(reply, calls) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    assert.equal(new URL(url).origin, 'http://127.0.0.1:11434');
    if (String(url).endsWith('/api/show')) return Response.json({ details: {
      format: 'gguf', parameter_size: '4.0B', quantization_level: 'Q4_K_M',
    } });
    assert.ok(String(url).endsWith('/api/chat'));
    const body = JSON.parse(init.body);
    assert.equal(body.model, localModel);
    assert.equal(body.options.num_ctx, 12288);
    assert.equal(body.options.num_predict, 1200);
    assert.equal(body.think, false);
    assert.equal(body.stream, false);
    return Response.json({ done: true, message: { content: JSON.stringify(reply) } });
  };
}

test('the local planner keeps actual retrieved IDs and the shared atomic grounding checks', async () => {
  const { input, retrieval, resources, reply } = groundedFixture();
  const calls = [];
  const predicted = await predictOllama(input, read(input), installedFetch(reply, calls), resources);
  assert.deepEqual(predicted.evidenceIds, retrieval.results.map((item) => item.evidenceId));
  const session = applyModelReply(input, predicted, 'ollama', retrieval, answerContext(resources));
  const visits = currentTrip(session).plan.filter((visit) => visit.kind === 'place');
  assert.deepEqual(visits.map((visit) => visit.entityId), ['osulloc', 'hyeopjae']);
  assert.ok(visits.every((visit) => visit.knowledge.indexVersion === retrieval.indexVersion &&
    visit.knowledge.evidenceIds.every((id) => retrieval.results.some((item) =>
      item.evidenceId === id && item.placeId === visit.entityId))));
  assert.equal(calls.length, 2);
  assert.throws(() => applyModelReply(input, { ...predicted, evidenceIds: ['unregistered-evidence'] }, 'ollama', retrieval),
    { code: 'MODEL_ACTION_INVALID' });
  assert.equal(input.session.turns.length, 1);
});

test('unverified or cloud weights cannot start generation and the fetch stays local', async () => {
  for (const metadata of [
    { details: { format: 'gguf', parameter_size: '4.0B', quantization_level: 'Q4_K_M' }, remote_host: 'cloud.example' },
    { details: { format: 'unknown', parameter_size: '4.0B', quantization_level: 'Q4_K_M' } },
  ]) {
    const calls = [];
    await assert.rejects(predictOllama(request(), read(request()), async (url) => {
      calls.push(url);
      assert.equal(url, 'http://127.0.0.1:11434/api/show');
      return Response.json(metadata);
    }), { code: 'OLLAMA_LOCAL_MODEL_UNVERIFIED' });
    assert.equal(calls.length, 1);
  }
});

test('Gemini success avoids local inference; quota denial runs the opted-in local planner once', async () => {
  for (const quotaDenied of [false, true]) {
    const { input, retrieval, resources, reply } = groundedFixture();
    const calls = [];
    let geminiCalls = 0;
    let primaryCalls = 0;
    const resolvedReply = { ...reply, evidenceIds: retrieval.results.map((item) => item.evidenceId) };
    const result = await routeModelReply({ request: input, resources,
      large: { provider: 'gemini', model: 'gemini-3.6-flash', apiKey: 'test-only-not-a-real-key', timeoutMs: 1000 },
      localFallback: { provider: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'qwen3:14b', timeoutMs: 1000 },
      primary: { provider: 'ollama', model: localModel, predict: async (context) => {
        primaryCalls += 1;
        return predictOllama(input, read(input), installedFetch(reply, calls), context);
      } },
      predictLarge: async (_request, selected) => {
        assert.equal(selected.provider, 'gemini', 'adequate RAG and a valid local reply must not invoke 14B');
        geminiCalls += 1;
        if (quotaDenied) throw new ChatContractError('LARGE_MODEL_QUOTA_EXCEEDED', 'test quota denial', 503);
        return resolvedReply;
      },
      validate(predicted, responseMode, context) {
        applyModelReply(input, predicted, responseMode, retrieval, answerContext(context));
      },
    });
    assert.equal(geminiCalls, 1);
    assert.equal(primaryCalls, quotaDenied ? 1 : 0);
    assert.equal(calls.length, quotaDenied ? 2 : 0);
    assert.equal(result.resources.modelRouting.provider, quotaDenied ? 'ollama' : 'gemini');
  }
});

test('direct local generation passes the same cancellation signal to weight checking and generation', async () => {
  const input = request();
  const signals = [];
  await assert.rejects(predictOllama(input, { ...read(input), timeoutMs: 10 }, async (url, init) => {
    signals.push(init.signal);
    if (url === 'http://127.0.0.1:11434/api/show') return Response.json({ details: {
      format: 'gguf', parameter_size: '4.0B', quantization_level: 'Q4_K_M',
    } });
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('cancelled'))));
  }), { code: 'OLLAMA_TIMEOUT' });
  assert.equal(signals.length, 2);
  assert.equal(signals[0], signals[1]);
  assert.equal(signals[1].aborted, true);
});

test('the planner still receives the remaining routing budget rather than its full cold-start allowance', async () => {
  const { input, resources } = groundedFixture();
  const planner = read(input);
  let receivedBudget;
  const routed = await routeModelReply({ request: input, resources, large: null, timeoutMs: 2000,
    primary: { provider: 'ollama', model: planner.model, predict: async (_context, remaining) => {
      receivedBudget = remaining;
      return { message: '현재 요청의 조건을 확인했어요.', actions: [] };
    } },
    validate() {},
  });
  assert.equal(planner.timeoutMs, 75000);
  assert.ok(receivedBudget > 0 && receivedBudget <= 2000);
  assert.ok(Math.min(planner.timeoutMs, receivedBudget) <= 2000);
  assert.equal(routed.mode, 'ollama');
});
