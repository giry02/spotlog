import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { predictLargeModel: rawPredictLargeModel, readLargeModelConfig, readLocalLargeModelConfig } = await import('../lib/large-model-adapter.ts');
const { createTripSession } = await import('../lib/trip-engine.ts');
const { geminiGenerationConfig, isGeminiTextModel, selectGeminiTextModel } = await import('../lib/gemini-models.ts');

const request = () => ({
  protocolVersion: 1, requestId: 'large-model-test', sessionId: 'large-model-test', baseRevision: 1,
  session: createTripSession(), action: { type: 'message', text: '제주 한라산 여행 주의점을 설명해 줘.' },
});
const config = { provider: 'gemini', model: 'gemini-3.6-flash', apiKey: 'test-server-credential', timeoutMs: 1000, freePolicy: { verificationAccessToken: 'test-oauth-not-a-real-token', maxRequestsPerMinute: 5, maxRequestsPerDay: 20 } };
let testKey = 0;
async function predictLargeModel(request, selected, fetcher, evidence) {
  const scoped = selected.provider === 'gemini' ? { ...selected, apiKey: selected.apiKey + '-' + (++testKey) } : selected;
  return rawPredictLargeModel(request, scoped, async (url, init) => {
    if (String(url).startsWith('https://apikeys.googleapis.com/')) return Response.json({ parent: 'projects/123456/locations/global', name: 'projects/123456/locations/global/keys/test-key' });
    if (String(url).startsWith('https://cloudbilling.googleapis.com/')) return Response.json({ name: 'projects/test-free-project/billingInfo', projectId: 'test-free-project', billingEnabled: false, billingAccountName: '' });
    if (String(url).endsWith('/api/show')) return Response.json({ details: { format: 'gguf', parameter_size: '14.8B', quantization_level: 'Q4_K_M' } });
    return fetcher(url, init);
  }, evidence);
}
const response = (reply, overrides = {}) => Response.json({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(reply) }] }, ...overrides }],
});

test('large model requires explicit server selection, a text Flash or Pro model and valid bounded settings', () => {
  assert.equal(readLargeModelConfig({ GEMINI_API_KEY: config.apiKey }), null);
  assert.equal(readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'disabled' }), null);
  const env = { LARGE_MODEL_PROVIDER: 'gemini', LARGE_MODEL_NAME: config.model, GEMINI_API_KEY: config.apiKey };
  assert.deepEqual(readLargeModelConfig(env), { ...config, timeoutMs: 60000, freePolicy: { maxRequestsPerMinute: 5, maxRequestsPerDay: 20 } });
  assert.equal(readLargeModelConfig({ ...env, LARGE_MODEL_API_KEY: 'explicit-server-credential' }).apiKey, 'explicit-server-credential');
  for (const change of [
    { LARGE_MODEL_PROVIDER: 'custom' }, { LARGE_MODEL_NAME: 'gemini-embedding-001' },
    { LARGE_MODEL_NAME: '../remote' }, { LARGE_MODEL_NAME: 'https://evil.example' },
    { GEMINI_API_KEY: '' }, { GEMINI_API_KEY: 'test\r\nInjected: true' },
    { LARGE_MODEL_TIMEOUT_MS: '90001' }, { LARGE_MODEL_TIMEOUT_MS: '0' },
  ]) assert.throws(() => readLargeModelConfig({ ...env, ...change }), { code: 'LARGE_MODEL_CONFIG_INVALID' });
});

test('explicit text Flash models are accepted while specialized Gemini models are rejected', () => {
  for (const model of ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview']) {
    assert.equal(isGeminiTextModel(model), true, model);
    assert.equal(readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'gemini', LARGE_MODEL_NAME: model, LARGE_MODEL_API_KEY: config.apiKey }).model, model);
  }
  for (const model of ['gemini-3.8-flash-tts', 'gemini-3.8-flash-live', 'gemini-3.1-flash-image', 'gemini-2.5-flash-native-audio-preview', 'gemini-2.5-pro-vision', 'gemini-robotics-er-1.5-preview', 'gemini-2.5-computer-use-preview', 'gemini-3-flash-video', 'gemini-3.5-flash-transcribe']) {
    assert.equal(isGeminiTextModel(model), false, model);
    assert.throws(() => readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'gemini', LARGE_MODEL_NAME: model, LARGE_MODEL_API_KEY: config.apiKey }), { code: 'LARGE_MODEL_CONFIG_INVALID' });
  }
});

test('setup selection requires the explicit text model and generateContent access', () => {
  const models = [
    { name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
    { name: 'models/gemini-3.1-pro-preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['countTokens'] },
  ];
  assert.equal(selectGeminiTextModel(models, 'gemini-3.8-flash'), models[1]);
  assert.equal(selectGeminiTextModel(models, 'gemini-3.1-pro-preview'), models[2]);
  for (const name of ['gemini-3.8-flash-tts', 'gemini-2.5-flash', 'gemini-3.6-flash', '']) assert.equal(selectGeminiTextModel(models, name), undefined);
  assert.equal(selectGeminiTextModel([null, {}, { name: 'models/gemini-3.8-flash', supportedGenerationMethods: 'generateContent' }], 'gemini-3.8-flash'), undefined);
});

test('Gemini 3 Flash uses modern thinking configuration without legacy sampling or candidate count', async () => {
  const modern = { ...config, model: 'gemini-3.8-flash' };
  const reply = await predictLargeModel(request(), modern, async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    assert.ok(init.headers['x-goog-api-key'].startsWith(config.apiKey + '-'));
    const body = JSON.parse(init.body);
    assert.deepEqual(body.generationConfig, { responseMimeType: 'application/json', maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: 'LOW' } });
    assert.equal(body.tools, undefined);
    assert.ok(body.contents[0].parts[0].text.length);
    return response({ message: '일반 지식에 따른 여행 제안이에요.', actions: [] });
  });
  assert.equal(reply.message, '일반 지식에 따른 여행 제안이에요.');
  assert.deepEqual(geminiGenerationConfig('gemini-3.8-flash', 2048, 0), { responseMimeType: 'application/json', maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'LOW' } });
  assert.deepEqual(geminiGenerationConfig('gemini-2.5-pro', 2048, 0), { responseMimeType: 'application/json', maxOutputTokens: 2048, temperature: 0, candidateCount: 1 });
});

test('local large model requires no key, stays on loopback and must exceed the primary model size', () => {
  const env = { LARGE_MODEL_PROVIDER: 'ollama', LARGE_MODEL_NAME: 'qwen3:14b' };
  assert.deepEqual(readLargeModelConfig(env), { provider: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'qwen3:14b', timeoutMs: 180000 });
  for (const update of [
    { LARGE_MODEL_NAME: 'qwen3:8b' }, { LARGE_MODEL_NAME: 'qwen3:4b' },
    { LARGE_MODEL_NAME: 'custom:latest' }, { OLLAMA_MODEL: 'qwen3:14b' },
    { LARGE_MODEL_BASE_URL: 'http://remote.example:11434' },
    { LARGE_MODEL_BASE_URL: 'http://127.0.0.1:11434/api' },
    { LARGE_MODEL_BASE_URL: 'http://127.0.0.1:11434/?key=x' },
    { LARGE_MODEL_TIMEOUT_MS: '180001' },
  ]) assert.throws(() => readLargeModelConfig({ ...env, ...update }), { code: 'LARGE_MODEL_CONFIG_INVALID' });
});

test('local larger model uses bounded JSON generation and unloads after every fallback', async () => {
  const local = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'ollama', LARGE_MODEL_NAME: 'qwen3:14b' });
  const reply = await predictLargeModel(request(), local, async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(init.headers.Authorization, undefined);
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'qwen3:14b');
    assert.equal(body.keep_alive, 0);
    assert.equal(body.think, false);
    assert.equal(body.format, 'json');
    assert.equal(body.stream, false);
    assert.equal(body.options.num_ctx, 12288);
    assert.equal(body.options.num_predict, 900);
    assert.equal(body.options.repeat_penalty, 1.1);
    return Response.json({ done: true, done_reason: 'stop', message: { content: JSON.stringify({ message: '일반적인 여행 제안이에요.', actions: [] }) } });
  });
  assert.equal(reply.message, '일반적인 여행 제안이에요.');
  await assert.rejects(predictLargeModel(request(), local, async () => Response.json({ done: true, done_reason: 'length', message: { content: '{}' } })), { code: 'LARGE_MODEL_RESPONSE_INVALID' });
});

test('a corpus miss preserves the question, six Q/As and tool context without serializing the action catalog', async () => {
  const input = request();
  const initial = input.session.turns[0];
  input.session.turns = Array.from({ length: 8 }, (_, index) => ({
    ...initial, id: index + 1, state: { ...initial.state, region: '제주', days: 3, question: `이전 질문 ${index}` }, assistantMessage: `이전 답변 ${index}`,
  }));
  input.action.text = '부산 2박 3일 여행을 자연어 일정으로 짜줘. 유모차가 있어.';
  const resources = {
    retrievalStatus: 'empty', retrievalInstruction: '부산 자료가 없어 일반 지식으로 제안한다.',
    coverage: { sufficient: false, reason: 'outside-corpus' },
    modelRouting: { tier: 'large', provider: 'ollama', model: 'qwen3:14b', reason: 'rag-insufficient', status: 'ready' },
    weather: { status: 'unavailable', retrievedAt: '2026-10-15T04:00:00Z', instruction: '날씨 조회 실패' },
    retrieval: { results: [] },
  };
  const local = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'ollama', LARGE_MODEL_NAME: 'qwen3:14b' });
  await predictLargeModel(input, local, async (_url, init) => {
    const body = JSON.parse(init.body);
    const envelope = JSON.parse(body.messages[1].content);
    assert.equal(envelope.userMessage, input.action.text);
    assert.deepEqual(envelope.recentConversation, Array.from({ length: 6 }, (_, index) => ({ question: `이전 질문 ${index + 2}`, answer: `이전 답변 ${index + 2}` })));
    assert.deepEqual(envelope.context.state, { region: '제주', days: 3 });
    assert.deepEqual(envelope.context.weather, resources.weather);
    assert.deepEqual(envelope.context.modelRouting, resources.modelRouting);
    assert.equal(envelope.context.retrievalInstruction, resources.retrievalInstruction);
    assert.equal(envelope.context.catalog, undefined);
    assert.equal(envelope.context.candidates, undefined);
    assert.equal(envelope.context.itineraryCandidates, undefined);
    assert.ok(body.messages[0].content.length < 1000);
    assert.ok(!body.messages[0].content.includes('collect-entity'));
    return Response.json({ done: true, done_reason: 'stop', message: { content: '{"message":"일반 지식에 따른 부산 여행 제안이에요.","actions":[]}' } });
  }, resources);
});

test('a no-evidence large-model answer cannot execute even valid configure actions or invent citations', async () => {
  for (const reply of [
    { message: '날짜를 바꿨어요.', actions: [{ type: 'configure', days: 2 }] },
    { message: '참고 자료예요.', actions: [], evidenceIds: ['invented-source'] },
  ]) await assert.rejects(predictLargeModel(request(), config, async () => response(reply), { retrievalStatus: 'empty', retrievalInstruction: '검색 결과가 없다.' }), { code: 'LARGE_MODEL_READONLY_VIOLATION' });
});

test('compatible provider requires explicit model and a public HTTPS API base', () => {
  const env = { LARGE_MODEL_PROVIDER: 'openai-compatible', LARGE_MODEL_BASE_URL: 'https://api.provider.example/v1', LARGE_MODEL_NAME: 'provider/explicit-large-model', LARGE_MODEL_API_KEY: config.apiKey };
  assert.equal(readLargeModelConfig(env).baseUrl, env.LARGE_MODEL_BASE_URL);
  for (const baseUrl of ['http://api.provider.example/v1', 'https://localhost/v1', 'https://127.0.0.1/v1', 'https://2130706433/v1', 'https://10.0.0.1/v1', 'https://169.254.169.254/v1', 'https://172.16.0.1/v1', 'https://192.168.0.1/v1', 'https://[::1]/v1', 'https://[::ffff:127.0.0.1]/v1', 'https://service.internal/v1', 'https://user:pass@api.provider.example/v1', 'https://api.provider.example/v1?key=test', 'https://api.provider.example/v1#fragment'])
    assert.throws(() => readLargeModelConfig({ ...env, LARGE_MODEL_BASE_URL: baseUrl }), { code: 'LARGE_MODEL_CONFIG_INVALID' });
  assert.throws(() => readLargeModelConfig({ ...env, LARGE_MODEL_NAME: '' }), { code: 'LARGE_MODEL_CONFIG_INVALID' });
});

test('unverified compatible remote APIs are blocked without any generation request', async () => {
  const compatible = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'openai-compatible', LARGE_MODEL_BASE_URL: 'https://api.provider.example/v1/', LARGE_MODEL_NAME: 'explicit-large-model', LARGE_MODEL_API_KEY: config.apiKey });
  let calls = 0;
  await assert.rejects(predictLargeModel(request(), compatible, async () => { calls++; throw new Error('must not fetch'); }), { code: 'LARGE_MODEL_FREE_TIER_UNVERIFIED' });
  assert.equal(calls, 0);
});

test('external calls use the official fixed endpoint, header auth and existing prompt/evidence contract', async () => {
  const input = request();
  const evidence = {
    retrievalStatus: 'ready', retrievalInstruction: '제공한 자료를 사용한다.',
    modelRouting: { tier: 'large', reason: 'primary', status: 'ready', provider: 'gemini', model: config.model },
    retrieval: { dataMode: 'curated', results: [{ evidenceId: 'server-owned-evidence-id', placeId: 'hallasan', title: '한라산 공식 안내', text: '성판악과 관음사 탐방로 예약을 확인하세요.', sourceKind: 'official-summary' }] },
  };
  const reply = await predictLargeModel(input, config, async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
    assert.equal(init.redirect, 'manual');
    assert.ok(init.headers['x-goog-api-key'].startsWith(config.apiKey + '-'));
    assert.equal(new URL(url).search, '');
    const body = JSON.parse(init.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.candidateCount, undefined);
    assert.equal(body.tools, undefined);
    assert.ok(body.systemInstruction.parts[0].text.includes('웹에서 확인했다고 말하지 않는다'));
    assert.match(body.systemInstruction.parts[0].text, /이번 요청에 우선 호출된 모델/);
    assert.doesNotMatch(body.systemInstruction.parts[0].text, /자료가 부족한 요청을 처리하는 대형 모델|자료 부족 또는 기본 모델 실패로 호출/);
    const context = JSON.parse(body.contents[0].parts[0].text);
    assert.equal(context.userMessage, input.action.text);
    assert.equal(context.context.retrieval.results[0].evidenceId, 'ref1');
    assert.ok(context.context.catalog.places.length, 'fresh evidence retains the shared action/catalog prompt');
    assert.equal(body.contents[0].parts[0].text.includes(config.apiKey), false);
    return response({ message: '탐방로 예약을 확인해 주세요.', actions: [], evidenceIds: ['ref1'] });
  }, evidence);
  assert.deepEqual(reply.evidenceIds, ['server-owned-evidence-id']);
  assert.deepEqual(reply.actions, []);
});

test('server validates action IDs and safe message shape after external prediction', async () => {
  for (const value of [
    { status: 'ok', response: 'hello' },
    { message: '<img src=x>', actions: [] },
    { message: '장소를 추가했어요.', actions: [{ type: 'place', id: 'made-up-place' }] },
  ]) await assert.rejects(predictLargeModel(request(), config, async () => response(value)), { code: 'MODEL_OUTPUT_INVALID' });
  const reply = await predictLargeModel(request(), config, async () => response({ message: '일반적인 여행 준비 안내예요.' }));
  assert.deepEqual(reply.actions, []);
});

test('authentication, quota and redirects never expose upstream bodies or credentials', async () => {
  for (const [status, code] of [[403, 'LARGE_MODEL_AUTH_REJECTED'], [401, 'LARGE_MODEL_AUTH_REJECTED'], [429, 'LARGE_MODEL_QUOTA_EXCEEDED'], [302, 'LARGE_MODEL_UPSTREAM_ERROR'], [500, 'LARGE_MODEL_UPSTREAM_ERROR']]) {
    await assert.rejects(predictLargeModel(request(), config, async () => new Response('private upstream detail ' + config.apiKey, { status })), (error) => error.code === code && !error.message.includes('private') && !error.message.includes(config.apiKey));
  }
});

test('blocked, truncated, malformed and multipart tool output is rejected atomically', async () => {
  const bodies = [
    Response.json({ promptFeedback: { blockReason: 'SAFETY' } }),
    response({ message: '부분 답변', actions: [] }, { finishReason: 'MAX_TOKENS' }),
    Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } }] }),
    Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ functionCall: { name: 'unrequested' } }] } }] }),
    new Response('{'),
  ];
  for (const body of bodies) await assert.rejects(predictLargeModel(request(), config, async () => body), { code: 'LARGE_MODEL_RESPONSE_INVALID' });
  const input = request();
  input.action = { type: 'help' };
  await assert.rejects(predictLargeModel(input, config, async () => { throw new Error('must not fetch'); }), { code: 'LARGE_MODEL_ACTION_INVALID' });
});

test('declared and streamed oversized responses are bounded', async () => {
  await assert.rejects(predictLargeModel(request(), config, async () => new Response('{}', { headers: { 'content-length': '200000' } })), { code: 'LARGE_MODEL_RESPONSE_TOO_LARGE' });
  await assert.rejects(predictLargeModel(request(), config, async () => new Response('a'.repeat(140000))), { code: 'LARGE_MODEL_RESPONSE_TOO_LARGE' });
});

test('a hard deadline also bounds a fetcher that fails to honor AbortSignal', async () => {
  await assert.rejects(predictLargeModel(request(), config, async () => new Promise(() => {})), { code: 'LARGE_MODEL_TIMEOUT' });
});

test('network failures are distinct from timeouts and never expose connection details', async () => {
  await assert.rejects(predictLargeModel(request(), config, async () => { throw new Error('private provider credential'); }), (error) => error.code === 'LARGE_MODEL_UNAVAILABLE' && !error.message.includes('private'));
});
