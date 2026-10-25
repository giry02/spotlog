import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../scripts/evaluate-chat.mjs';
const { predictOllama: rawPredictOllama, readOllamaConfig, compactModelContext } =
  await import('../lib/ollama-adapter.ts');
async function predictOllama(request, config, fetcher, evidence) {
  return rawPredictOllama(request, config, async (url, init) => {
    if (String(url).endsWith('/api/show')) return Response.json({ details: { format: 'gguf', parameter_size: '8.2B', quantization_level: 'Q4_K_M' } });
    return fetcher(url, init);
  }, evidence);
}
const { modelSystemPrompt } = await import('../lib/model-system-prompt.ts');
const { createTripSession, isTripSession, appendTrip, currentTrip } =
  await import('../lib/trip-engine.ts');
const { applyModelReply, parseTripSession } =
  await import('../lib/chat-contract.ts');
const request = () => ({
  protocolVersion: 1,
  requestId: 'test',
  sessionId: 'test',
  baseRevision: 1,
  session: createDemoSession(),
  action: { type: 'message', text: '제주 여행' },
});
const config = {
  baseUrl: 'http://127.0.0.1:11434',
  model: 'test-local-model',
  timeoutMs: 1000,
};

test('local provider requires explicit selection and rejects remote unauthenticated endpoints', () => {
  assert.equal(readOllamaConfig({}), null);
  assert.throws(() =>
    readOllamaConfig({
      CHAT_PROVIDER: 'ollama',
      OLLAMA_MODEL: 'x',
      OLLAMA_BASE_URL: 'https://remote.example',
    }),
  );
  assert.throws(() =>
    readOllamaConfig({ CHAT_PROVIDER: 'ollama', OLLAMA_MODEL: '' }),
  );
  assert.equal(
    readOllamaConfig({ CHAT_PROVIDER: 'ollama', OLLAMA_MODEL: 'qwen3:4b' })
      .model,
    'qwen3:4b',
  );
});

test('generated shared prompt matches Flowise instructions and context has cafe candidates without media', async () => {
  assert.equal(
    modelSystemPrompt,
    await readFile(
      new URL('../docs/flowise-system-prompt.txt', import.meta.url),
      'utf8',
    ),
  );
  const context = compactModelContext(request());
  assert.ok(context.candidates.cafes);
  assert.ok(
    context.catalog.places.every(
      (p) => p.id && p.name && !p.image && !p.credit,
    ),
  );
});

test('real local structured reply uses common validation and retains Ollama source on saved snapshots', async () => {
  const input = request();
  const reply = await predictOllama(input, config, async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(init.redirect, 'manual');
    const body = JSON.parse(init.body);
    assert.equal(body.stream, false);
    assert.equal(body.think, false);
    assert.equal(body.format, 'json');
    return Response.json({
      done: true,
      message: {
        content: JSON.stringify({
          message: '제주 후보예요',
          actions: [{ type: 'region', region: '제주' }],
        }),
      },
    });
  });
  const session = applyModelReply(input, reply, 'ollama');
  assert.equal(session.turns.at(-1).source, 'ollama');
  assert.ok(isTripSession(session));
  assert.ok(parseTripSession(session));
});

test('local provider refuses redirect, incomplete output and model-created HTML', async () => {
  await assert.rejects(
    predictOllama(
      request(),
      config,
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'https://remote.example' },
        }),
    ),
    { code: 'OLLAMA_UPSTREAM_ERROR' },
  );
  await assert.rejects(
    predictOllama(request(), config, async () =>
      Response.json({ done: false, message: { content: '{}' } }),
    ),
    { code: 'MODEL_OUTPUT_INVALID' },
  );
  await assert.rejects(
    predictOllama(request(), config, async () =>
      Response.json({
        done: true,
        message: {
          content: JSON.stringify({ message: '<img src=x>', actions: [] }),
        },
      }),
    ),
    { code: 'MODEL_OUTPUT_INVALID' },
  );
});

test('local provider timeout aborts without applying a partial reply', async () => {
  await assert.rejects(
    predictOllama(
      request(),
      { ...config, timeoutMs: 10 },
      async (_url, init) =>
        new Promise((_, reject) =>
          init.signal.addEventListener('abort', () =>
            reject(new Error('private detail')),
          ),
        ),
    ),
    { code: 'OLLAMA_TIMEOUT' },
  );
});

test('model cannot claim a built plan while required region is still unknown', () => {
  const input = request();
  assert.throws(
    () =>
      applyModelReply(
        input,
        { message: '일정을 구성했어요', actions: [{ type: 'build' }] },
        'ollama',
      ),
    { code: 'MODEL_ACTION_INVALID' },
  );
  assert.equal(input.session.turns.length, 1);
});

test('collect accepts server cafe candidates without a hidden UI tab change and rejects other anchors', () => {
  const input = request();
  input.session = appendTrip(
    appendTrip(input.session, { type: 'region', region: '제주' }),
    { type: 'place', id: 'hyeopjae' },
  );
  input.baseRevision = input.session.turns.at(-1).id;
  assert.equal(currentTrip(input.session).foodKind, '식당');
  const reply = {
    message: '체험 카페를 담았어요',
    actions: [{ type: 'collect-entity', id: 'hj-cafe' }],
  };
  const next = applyModelReply(input, reply, 'ollama');
  assert.ok(currentTrip(next).collectedIds.includes('hj-cafe'));
  assert.deepEqual(currentTrip(next).plan, currentTrip(input.session).plan);
  assert.throws(
    () =>
      applyModelReply(
        input,
        { ...reply, actions: [{ type: 'collect-entity', id: 'of-cafe' }] },
        'ollama',
      ),
    { code: 'MODEL_ACTION_INVALID' },
  );
});

test('explicit DAY afternoon-only scope rejects wrong visit and full regeneration atomically', () => {
  const input = request();
  for (const a of [
    { type: 'region', region: '제주' },
    { type: 'configure', days: 2, lodging: false },
    { type: 'build' },
  ])
    input.session = appendTrip(input.session, a);
  input.baseRevision = input.session.turns.at(-1).id;
  input.action.text = 'DAY 2 오후 장소만 다른 곳으로 바꿔줘';
  const original = structuredClone(input.session);
  assert.throws(
    () =>
      applyModelReply(
        input,
        { message: '수정했어요', actions: [{ type: 'edit', id: 'visit-1' }] },
        'ollama',
      ),
    { code: 'MODEL_ACTION_INVALID' },
  );
  assert.throws(
    () =>
      applyModelReply(
        input,
        { message: '수정했어요', actions: [{ type: 'build' }] },
        'ollama',
      ),
    { code: 'MODEL_ACTION_INVALID' },
  );
  const target = currentTrip(input.session).plan.find(
    (v) => v.day === 2 && v.label.includes('오후'),
  );
  const result = applyModelReply(
    input,
    {
      message: '이 자리의 후보예요',
      actions: [{ type: 'edit', id: target.id }],
    },
    'ollama',
  );
  assert.equal(currentTrip(result).editingId, target.id);
  assert.deepEqual(input.session, original);
});

// This regression fixture intentionally uses the authored legacy businesses.
function createDemoSession(savedIds = [], library = []) { return createTripSession(savedIds, library, "demo"); }
