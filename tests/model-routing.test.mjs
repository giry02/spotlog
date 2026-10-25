import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { routeModelReply, remainingModelRoutingBudget } = await import('../lib/model-routing.ts');
const { ChatContractError, parseModelReply } = await import('../lib/chat-contract.ts');
const { createTripSession } = await import('../lib/trip-engine.ts');

const request = { protocolVersion: 1, requestId: 'routing-test', sessionId: 'routing-test', baseRevision: 1, session: createTripSession(), action: { type: 'message', text: '제주 2박 3일 일정 만들어줘' } };
const largeConfig = { provider: 'gemini', model: 'gemini-3.6-flash', apiKey: 'test-only-key-not-a-real-credential', timeoutMs: 1000 };
// Injected routing stub only: the real adapter continues to deny unverified APIs.
const legacyConfig = { provider: 'openai-compatible', model: 'test-legacy-model', baseUrl: 'https://example.test/v1', apiKey: 'test-only-key-not-a-real-credential', timeoutMs: 1000 };
const localConfig = { provider: 'ollama', model: 'qwen3:14b', baseUrl: 'http://127.0.0.1:11434', timeoutMs: 180000 };
const reply = (message = '확인한 자료로 답해요.') => ({ message, actions: [] });
const failure = (code) => new ChatContractError(code, '테스트 중 오류', 502);

function harness({ sufficient = true, large = legacyConfig, localFallback, primaryReply = reply(), primaryError, largeReply = reply('더 큰 모델의 답변이에요.'), largeError, localReply = reply('로컬 14B 답변이에요.'), localError, validate } = {}) {
  const calls = { primary: [], large: [], validate: [], order: [] };
  const resources = { retrievalStatus: 'available', retrievalInstruction: '현재 검색 자료만 근거로 사용한다.', coverage: { sufficient, reason: sufficient ? 'covered' : 'too-few-places' } };
  const before = structuredClone(resources);
  const promise = routeModelReply({
    request, resources, large, localFallback,
    primary: { provider: 'flowise', model: 'qwen3:8b', async predict(context) {
      calls.primary.push(context);
      calls.order.push('primary');
      if (primaryError) throw primaryError;
      return primaryReply;
    } },
    async predictLarge(actualRequest, config, fetcher, context) {
      assert.equal(actualRequest, request);
      assert.equal(config, config.provider === 'ollama' ? localFallback : large);
      assert.equal(fetcher, undefined);
      calls.large.push(context);
      calls.order.push(config.provider);
      if (config.provider === 'ollama') {
        if (localError) throw localError;
        return localReply;
      }
      if (largeError) throw largeError;
      return largeReply;
    },
    validate(value, mode, context) {
      calls.validate.push({ value, mode, context });
      parseModelReply(value);
      validate?.(value, mode, context);
    },
  });
  return { promise, calls, resources, before };
}

test('a non-Gemini provider keeps sufficient retrieval on the primary model without promoting another remote API', async () => {
  const run = harness();
  const result = await run.promise;
  assert.equal(result.mode, 'flowise');
  assert.equal(run.calls.primary.length, 1);
  assert.equal(run.calls.large.length, 0);
  assert.equal(run.calls.validate.length, 1);
  assert.deepEqual(result.resources.modelRouting, { tier: 'local', reason: 'primary', status: 'ready', provider: 'flowise', model: 'qwen3:8b' });
  assert.deepEqual(run.resources, run.before);
});

test('inadequate coverage directly uses the large model once and passes an explicit general-knowledge boundary', async () => {
  const run = harness({ sufficient: false });
  const result = await run.promise;
  assert.equal(run.calls.primary.length, 0);
  assert.equal(run.calls.large.length, 1);
  assert.equal(result.mode, 'large-model');
  assert.deepEqual(result.resources.modelRouting, { tier: 'large', reason: 'rag-insufficient', status: 'ready', provider: 'openai-compatible', model: 'test-legacy-model' });
  assert.match(run.calls.large[0].retrievalInstruction, /일반 지식.*검색으로 확인한 사실처럼 말하지/);
  assert.match(run.calls.large[0].retrievalInstruction, /후보가 없거나 지역이 지원되지 않으면.*actions:\[\]/);
  assert.deepEqual(run.resources, run.before);
});

test('the primary model can signal missing context even when deterministic retrieval coverage appears sufficient', async () => {
  const run = harness({ primaryReply: { ...reply('질문의 사실을 뒷받침할 자료가 없어요.'), needsMoreContext: true } });
  const result = await run.promise;
  assert.equal(run.calls.primary.length, 1);
  assert.equal(run.calls.large.length, 1);
  assert.equal(run.calls.validate.length, 1);
  assert.equal(result.mode, 'large-model');
  assert.equal(result.resources.modelRouting.reason, 'rag-insufficient');
});

test('a malformed or ungrounded primary result gets one large-model attempt rather than executing invalid tools', async () => {
  for (const code of ['MODEL_OUTPUT_INVALID', 'MODEL_ITINERARY_UNGROUNDED', 'FLOWISE_UPSTREAM_FAILED']) {
    const run = harness(code === 'MODEL_ITINERARY_UNGROUNDED'
      ? { validate(_reply, mode) { if (mode === 'flowise') throw failure(code); } }
      : { primaryError: failure(code) });
    const result = await run.promise;
    assert.equal(result.mode, 'large-model', code);
    assert.equal(result.resources.modelRouting.reason, 'primary-failed', code);
    assert.equal(run.calls.primary.length, 1, code);
    assert.equal(run.calls.large.length, 1, code);
  }
});

test('revoked-source and source-validation errors never trigger a model handoff or a fallback answer', async () => {
  for (const code of ['RAG_SOURCE_REVOKED', 'RAG_VALIDATION_UNAVAILABLE']) {
    const run = harness({ validate() { throw failure(code); } });
    await assert.rejects(run.promise, { code });
    assert.equal(run.calls.primary.length, 1);
    assert.equal(run.calls.large.length, 0);
  }
  const duringLarge = harness({ sufficient: false, validate() { throw failure('RAG_SOURCE_REVOKED'); } });
  await assert.rejects(duringLarge.promise, { code: 'RAG_SOURCE_REVOKED' });
  assert.equal(duringLarge.calls.large.length, 1);
  assert.equal(duringLarge.calls.primary.length, 0);
});

test('an unavailable large model falls back to a validated local answer and records the large-model outage', async () => {
  const run = harness({ sufficient: false, largeError: failure('LARGE_MODEL_TIMEOUT') });
  const result = await run.promise;
  assert.equal(run.calls.large.length, 1);
  assert.equal(run.calls.primary.length, 1);
  assert.equal(run.calls.validate.length, 1);
  assert.equal(result.mode, 'flowise');
  assert.equal(result.resources.modelRouting.tier, 'local');
  assert.equal(result.resources.modelRouting.reason, 'rag-insufficient');
  assert.equal(result.resources.modelRouting.status, 'unavailable');
});

test('a valid cached local context request can survive a large-model outage without a second primary prediction', async () => {
  const primaryReply = { ...reply('검색이 부족해 일반적인 안내만 드릴 수 있어요.'), needsMoreContext: true };
  const run = harness({ primaryReply, largeError: failure('LARGE_MODEL_RESPONSE_INVALID') });
  const result = await run.promise;
  assert.equal(result.reply, primaryReply);
  assert.equal(result.resources.modelRouting.status, 'unavailable');
  assert.equal(run.calls.primary.length, 1);
  assert.equal(run.calls.large.length, 1);
  assert.equal(run.calls.validate.length, 1);
});

test('when both models fail the invalid primary reply is never returned as a successful fallback', async () => {
  const run = harness({ primaryError: failure('MODEL_OUTPUT_INVALID'), largeError: failure('LARGE_MODEL_TIMEOUT') });
  await assert.rejects(run.promise, { code: 'LARGE_MODEL_TIMEOUT' });
  assert.equal(run.calls.primary.length, 1);
  assert.equal(run.calls.large.length, 1);
  assert.equal(run.calls.validate.length, 0);
});

test('missing large-model configuration is visible while a valid local response remains usable', async () => {
  for (const sufficient of [false, true]) {
    const run = harness({ sufficient, large: null, primaryReply: { ...reply('일반 지식 안내예요.'), needsMoreContext: true } });
    const result = await run.promise;
    assert.equal(result.mode, 'flowise');
    assert.equal(result.resources.modelRouting.status, 'not-configured');
    assert.equal(result.resources.modelRouting.tier, 'local');
    assert.equal(run.calls.primary.length, 1);
    assert.equal(run.calls.large.length, 0);
  }
});

test('missing configuration cannot turn a failed primary call into a successful demo response', async () => {
  const run = harness({ large: null, primaryError: failure('MODEL_OUTPUT_INVALID') });
  await assert.rejects(run.promise, { code: 'MODEL_OUTPUT_INVALID' });
  assert.equal(run.calls.primary.length, 1);
  assert.equal(run.calls.large.length, 0);
});

test('unexpected application errors are not hidden behind a large-model retry', async () => {
  const error = new TypeError('unexpected implementation failure');
  const run = harness({ primaryError: error });
  await assert.rejects(run.promise, (actual) => actual === error);
  assert.equal(run.calls.large.length, 0);
});

test('free-policy denial, quota, authentication and outage each fall through to the independent local 14B once', async () => {
  for (const code of ['LARGE_MODEL_FREE_TIER_UNVERIFIED', 'LARGE_MODEL_BILLING_ENABLED', 'LARGE_MODEL_FREE_LIMIT_REACHED', 'LARGE_MODEL_QUOTA_EXCEEDED', 'LARGE_MODEL_AUTH_REJECTED', 'LARGE_MODEL_UNAVAILABLE']) {
    const run = harness({ sufficient: false, large: largeConfig, localFallback: localConfig, largeError: failure(code) });
    const result = await run.promise;
    assert.equal(run.calls.primary.length, 0, code);
    assert.equal(run.calls.large.length, 2, code);
    assert.equal(run.calls.validate.length, 1, code);
    assert.equal(result.reply.message, '로컬 14B 답변이에요.', code);
    assert.deepEqual(result.resources.modelRouting, { tier: 'large', reason: 'rag-insufficient', status: 'ready', provider: 'ollama', model: 'qwen3:14b' });
    assert.deepEqual(run.resources, run.before);
  }
});

test('a failed primary, unavailable Gemini and working local 14B produce a validated answer rather than an error', async () => {
  const run = harness({ large: largeConfig, primaryError: failure('FLOWISE_UPSTREAM_FAILED'), localFallback: localConfig, largeError: failure('LARGE_MODEL_QUOTA_EXCEEDED') });
  const result = await run.promise;
  assert.equal(result.resources.modelRouting.reason, 'primary-failed');
  assert.equal(result.resources.modelRouting.provider, 'ollama');
  assert.equal(run.calls.primary.length, 1);
  assert.equal(run.calls.large.length, 2);
  assert.deepEqual(run.calls.order, ['gemini', 'primary', 'ollama']);
});

test('unconfigured remote models still use the independently configured local 14B for missing RAG', async () => {
  const run = harness({ sufficient: false, large: null, localFallback: localConfig });
  const result = await run.promise;
  assert.equal(run.calls.primary.length, 0);
  assert.equal(run.calls.large.length, 1);
  assert.equal(result.resources.modelRouting.model, 'qwen3:14b');
});

test('a revoked source from the remote result never reaches the local fallback', async () => {
  const run = harness({ sufficient: false, localFallback: localConfig, validate() { throw failure('RAG_SOURCE_REVOKED'); } });
  await assert.rejects(run.promise, { code: 'RAG_SOURCE_REVOKED' });
  assert.equal(run.calls.large.length, 1);
});

test('one total routing budget clips each later model call to the remaining time', async () => {
  const actualNow = Date.now;
  let now = actualNow();
  Date.now = () => now;
  const timeouts = [];
  try {
    const result = await routeModelReply({
      request,
      resources: { retrievalStatus: 'empty', retrievalInstruction: '자료 없음', coverage: { sufficient: false, reason: 'outside-corpus' } },
      large: { ...largeConfig, timeoutMs: 60000 }, localFallback: localConfig,
      primary: { provider: 'flowise', async predict() { throw new Error('must not call'); } },
      async predictLarge(_request, config) {
        timeouts.push(config.timeoutMs);
        if (config.provider === 'gemini') { now += 60000; throw failure('LARGE_MODEL_TIMEOUT'); }
        return reply('로컬 응답이에요.');
      },
      validate() {},
    });
    assert.equal(result.resources.modelRouting.provider, 'ollama');
    assert.deepEqual(timeouts, [60000, 165000]);
  } finally { Date.now = actualNow; }
});

test('the HTTP request budget includes time already spent reading input and gathering RAG', () => {
  assert.equal(remainingModelRoutingBudget(100000, 115000), 195000);
  assert.equal(remainingModelRoutingBudget(100000, 100000), 210000);
  assert.throws(() => remainingModelRoutingBudget(100000, 310000), { code: 'MODEL_ROUTING_TIMEOUT' });
});

test('configured Gemini is the first and only inference when adequate retrieval succeeds', async () => {
  const run = harness({ large: largeConfig, localFallback: localConfig });
  const result = await run.promise;
  assert.deepEqual(run.calls.order, ['gemini']);
  assert.equal(run.calls.primary.length, 0);
  assert.equal(run.calls.validate.length, 1);
  assert.equal(result.mode, 'large-model');
  assert.deepEqual(result.resources.modelRouting, { tier: 'large', reason: 'primary', status: 'ready', provider: 'gemini', model: 'gemini-3.6-flash' });
  assert.match(run.calls.large[0].retrievalInstruction, /우선 호출된 모델/);
  assert.doesNotMatch(run.calls.large[0].retrievalInstruction, /자료 부족 또는 기본 모델 실패로 호출/);
  assert.match(run.calls.large[0].retrievalInstruction, /검증한 장소만 build.visits/);
  assert.deepEqual(run.resources, run.before);
});

test('Gemini first retains the missing-evidence boundary without warming either local model', async () => {
  const run = harness({ sufficient: false, large: largeConfig, localFallback: localConfig });
  const result = await run.promise;
  assert.deepEqual(run.calls.order, ['gemini']);
  assert.equal(result.resources.modelRouting.reason, 'rag-insufficient');
  assert.match(run.calls.large[0].retrievalInstruction, /후보가 없거나 지역이 지원되지 않으면.*actions:\[\]/);
});

test('a denied or exhausted Gemini immediately uses the small local model for sufficient RAG', async () => {
  for (const code of ['LARGE_MODEL_FREE_TIER_UNVERIFIED', 'LARGE_MODEL_BILLING_ENABLED', 'LARGE_MODEL_FREE_LIMIT_REACHED', 'LARGE_MODEL_QUOTA_EXCEEDED', 'LARGE_MODEL_AUTH_REJECTED', 'LARGE_MODEL_TIMEOUT']) {
    const run = harness({ large: largeConfig, localFallback: localConfig, largeError: failure(code) });
    const result = await run.promise;
    assert.deepEqual(run.calls.order, ['gemini', 'primary'], code);
    assert.equal(run.calls.validate.length, 1, code);
    assert.equal(result.mode, 'flowise', code);
    assert.deepEqual(result.resources.modelRouting, { tier: 'local', reason: 'primary', status: 'unavailable', provider: 'flowise', model: 'qwen3:8b' });
    assert.deepEqual(run.resources, run.before);
  }
});

test('Gemini quota exhaustion skips the small model when retrieval is insufficient', async () => {
  const run = harness({ sufficient: false, large: largeConfig, localFallback: localConfig, largeError: failure('LARGE_MODEL_QUOTA_EXCEEDED') });
  const result = await run.promise;
  assert.deepEqual(run.calls.order, ['gemini', 'ollama']);
  assert.equal(run.calls.primary.length, 0);
  assert.equal(result.resources.modelRouting.reason, 'rag-insufficient');
});

test('a small fallback that requests more context uses local 14B without retrying Gemini', async () => {
  const run = harness({
    large: largeConfig, localFallback: localConfig,
    largeError: failure('LARGE_MODEL_QUOTA_EXCEEDED'),
    primaryReply: { ...reply(), needsMoreContext: true },
  });
  const result = await run.promise;
  assert.deepEqual(run.calls.order, ['gemini', 'primary', 'ollama']);
  assert.equal(run.calls.validate.length, 1);
  assert.equal(result.resources.modelRouting.reason, 'rag-insufficient');
});

test('a broken Gemini and both broken local models never retry a model or accept invalid actions', async () => {
  const run = harness({
    large: largeConfig, localFallback: localConfig,
    largeError: failure('LARGE_MODEL_QUOTA_EXCEEDED'),
    primaryError: failure('MODEL_OUTPUT_INVALID'),
    localReply: { ...reply(), actions: [{ type: 'unknown-action' }] },
  });
  await assert.rejects(run.promise, { code: 'MODEL_OUTPUT_INVALID' });
  assert.deepEqual(run.calls.order, ['gemini', 'primary', 'ollama']);
  assert.equal(run.calls.validate.length, 1);
});

test('Gemini validation rejects revoked sources before either local fallback runs', async () => {
  for (const code of ['RAG_SOURCE_REVOKED', 'RAG_VALIDATION_UNAVAILABLE']) {
    const run = harness({ large: largeConfig, localFallback: localConfig, validate() { throw failure(code); } });
    await assert.rejects(run.promise, { code });
    assert.deepEqual(run.calls.order, ['gemini']);
  }
});

test('source validation failures in the small fallback do not start the large local model', async () => {
  const run = harness({
    large: largeConfig, localFallback: localConfig, largeError: failure('LARGE_MODEL_QUOTA_EXCEEDED'),
    validate() { throw failure('RAG_SOURCE_REVOKED'); },
  });
  await assert.rejects(run.promise, { code: 'RAG_SOURCE_REVOKED' });
  assert.deepEqual(run.calls.order, ['gemini', 'primary']);
});

test('an unexpected Gemini implementation error is not hidden by local fallback', async () => {
  const error = new TypeError('unexpected Gemini implementation failure');
  const run = harness({ large: largeConfig, localFallback: localConfig, largeError: error });
  await assert.rejects(run.promise, actual => actual === error);
  assert.deepEqual(run.calls.order, ['gemini']);
});

test('Gemini, small fallback and local 14B all receive one shrinking routing budget', async () => {
  const actualNow = Date.now;
  let now = actualNow();
  Date.now = () => now;
  const attempts = [];
  try {
    const result = await routeModelReply({
      request,
      resources: { retrievalStatus: 'available', retrievalInstruction: '검증된 자료', coverage: { sufficient: true, reason: 'covered' } },
      timeoutMs: 100000,
      large: { ...largeConfig, timeoutMs: 60000 }, localFallback: localConfig,
      primary: { provider: 'flowise', async predict(_context, timeoutMs) {
        attempts.push(['primary', timeoutMs]);
        now += 30000;
        throw failure('FLOWISE_UPSTREAM_FAILED');
      } },
      async predictLarge(_request, config) {
        attempts.push([config.provider, config.timeoutMs]);
        if (config.provider === 'gemini') { now += 20000; throw failure('LARGE_MODEL_TIMEOUT'); }
        return reply('로컬 응답이에요.');
      },
      validate() {},
    });
    assert.equal(result.resources.modelRouting.provider, 'ollama');
    assert.deepEqual(attempts, [['gemini', 60000], ['primary', 80000], ['ollama', 50000]]);
  } finally { Date.now = actualNow; }
});
