import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';
const { isLocalOllamaModelName, hasLocalOllamaWeights } = await import('../lib/local-model-policy.ts');
const { predictLargeModel, readLocalLargeModelConfig } = await import('../lib/large-model-adapter.ts');
const { predictOllama, readOllamaConfig } = await import('../lib/ollama-adapter.ts');
const { createTripSession } = await import('../lib/trip-engine.ts');

const metadata = { details: { format: 'gguf', parameter_size: '14.8B', quantization_level: 'Q4_K_M' } };
const request = () => ({ protocolVersion: 1, requestId: 'local-policy-test', sessionId: 'local-policy-test', baseRevision: 1, session: createTripSession(), action: { type: 'message', text: '부산 여행 준비물을 알려줘.' } });
const config = readLocalLargeModelConfig({});

test('cloud, remote and host-qualified model names are rejected before contacting Ollama', async () => {
  for (const model of ['qwen3:235b-cloud', 'qwen3:14b-cloud', 'cloud-model:14b', 'qwen3:14b-remote', 'ollama.com/qwen3:14b', 'user/qwen3:14b', 'model.example:14b']) {
    assert.equal(isLocalOllamaModelName(model), false, model);
    assert.throws(() => readLocalLargeModelConfig({ LOCAL_LARGE_MODEL_NAME: model }), { code: 'LARGE_MODEL_CONFIG_INVALID' });
    assert.throws(() => readOllamaConfig({ CHAT_PROVIDER: 'ollama', OLLAMA_MODEL: model }), { code: 'OLLAMA_CONFIG_INVALID' });
    let calls = 0;
    await assert.rejects(predictLargeModel(request(), { ...config, model }, async () => { calls++; throw new Error('must not fetch'); }), { code: 'LARGE_MODEL_CONFIG_INVALID' });
    assert.equal(calls, 0);
  }
  for (const model of ['qwen3:14b', 'qwen2.5:14b', 'moa-qwen3-8b:20261015']) assert.equal(isLocalOllamaModelName(model), true, model);
});

test('valid installed 14B GGUF metadata is inspected before exactly one local generation', async () => {
  const calls = [];
  const reply = await predictLargeModel(request(), config, async (url, init) => {
    calls.push(String(url));
    assert.equal(init.redirect, 'manual');
    assert.equal(JSON.parse(init.body).model, 'qwen3:14b');
    if (String(url).endsWith('/api/show')) return Response.json(metadata);
    return Response.json({ done: true, done_reason: 'stop', message: { content: '{"message":"일반 지식에 따른 여행 제안이에요.","actions":[]}' } });
  });
  assert.equal(reply.actions.length, 0);
  assert.deepEqual(calls, ['http://127.0.0.1:11434/api/show', 'http://127.0.0.1:11434/api/chat']);
});

test('missing, remote-forwarding, non-GGUF, unknown-size and unquantified metadata cannot generate', async () => {
  for (const invalid of [
    {}, { details: {} }, { ...metadata, remote_host: 'https://ollama.com' },
    { ...metadata, remote_model: 'qwen3:235b' },
    { details: { ...metadata.details, remote_host: '' } },
    { details: { ...metadata.details, format: 'safetensors' } },
    { details: { ...metadata.details, parameter_size: '8B' } },
    { details: { ...metadata.details, parameter_size: 'unknown' } },
    { details: { ...metadata.details, quantization_level: '' } },
    { details: { ...metadata.details, quantization_level: undefined } },
  ]) {
    assert.equal(hasLocalOllamaWeights(invalid, 8), false);
    const calls = [];
    await assert.rejects(predictLargeModel(request(), config, async (url) => { calls.push(String(url)); return Response.json(invalid); }), { code: 'LARGE_MODEL_LOCAL_UNVERIFIED' });
    assert.deepEqual(calls, ['http://127.0.0.1:11434/api/show']);
  }
});

test('primary Ollama also refuses a cloud alias or missing local metadata before chat', async () => {
  const primary = readOllamaConfig({ CHAT_PROVIDER: 'ollama', OLLAMA_MODEL: 'qwen3:8b' });
  let calls = 0;
  await assert.rejects(predictOllama(request(), primary, async (url) => { calls++; assert.ok(String(url).endsWith('/api/show')); return Response.json({}); }), { code: 'OLLAMA_LOCAL_MODEL_UNVERIFIED' });
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(predictOllama(request(), { ...primary, baseUrl: 'https://paid-model.example' }, async () => { calls++; throw new Error('must not fetch'); }), { code: 'OLLAMA_LOCAL_MODEL_UNVERIFIED' });
  assert.equal(calls, 0);
});

test('unavailable or redirected model inspection never reaches a generation endpoint', async () => {
  for (const status of [302, 404, 500]) {
    const calls = [];
    await assert.rejects(predictLargeModel(request(), config, async (url) => { calls.push(String(url)); return new Response('private local metadata', { status }); }), { code: 'LARGE_MODEL_LOCAL_UNVERIFIED' });
    assert.deepEqual(calls, ['http://127.0.0.1:11434/api/show']);
  }
});
