import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createChatflow, FLOW_NAME } from '../scripts/flowise/chatflow.mjs';
import { createOwnerApi, escapeSystemPrompt, flowFingerprints, localFlowiseOrigin, preparePromptPatch, syncSystemPrompt } from '../scripts/flowise/sync-system-prompt.mjs';
const fresh = () => ({ id: 'existing-general-flow', name: FLOW_NAME, type: 'CHATFLOW', deployed: true, isPublic: false,
  apikeyid: 'RETAINED_SECRET_KEY_ID', apiConfig: '{"overrideConfig":{"status":false}}', chatbotConfig: '{"rateLimit":{"limitMax":"30"}}',
  createdDate: '2026-10-01T00:00:00.000Z', updatedDate: '2026-10-01T00:00:00.000Z',
  flowData: JSON.stringify(createChatflow({ model: 'RETAINED_MODEL_ALIAS', systemPrompt: 'original {literal} prompt', ollamaBaseUrl: 'http://127.0.0.1:11434' })) });
const promptText = 'new social contract {"type":"social","target":{"kind":"entity","id":"known-id"}}';
function fixture({ driftModel = false, driftMetadata = false, updateFails = false, rollbackFails = false, settingsDrift = false } = {}) {
  const original = fresh(); let current = structuredClone(original), reads = 0, settingsReads = 0;
  const writes = [];
  return { original, writes, current: () => current, reads: () => reads,
    options: { promptText,
      readFlow: async () => { reads++; return structuredClone(current); },
      readSettingsFingerprint: async () => ++settingsReads >= 3 && settingsDrift ? 'changed-settings' : 'original-settings',
      writeFlow: async body => {
        writes.push(structuredClone(body));
        if (writes.length === 1 && updateFails || writes.length > 1 && rollbackFails) throw new Error('upstream private credential must stay private');
        current = { ...current, ...body, updatedDate: `2026-10-24T00:00:0${writes.length}.000Z` };
        if (writes.length === 1 && driftModel) { const graph = JSON.parse(current.flowData); graph.nodes[0].data.inputs.modelName = 'unwanted-model'; current.flowData = JSON.stringify(graph); }
        if (writes.length === 1 && driftMetadata) current.isPublic = true;
      },
    },
  };
}

test('prompt patch changes precisely one literal system field and preserves model, graph and flow metadata', () => {
  const original = fresh(), snapshot = structuredClone(original), patch = preparePromptPatch(original, promptText);
  assert.equal(patch.changed, true);
  const graph = JSON.parse(patch.flowData), prompt = graph.nodes.find(node => node.data.name === 'chatPromptTemplate');
  assert.equal(prompt.data.inputs.systemMessagePrompt, escapeSystemPrompt(promptText));
  assert.equal(prompt.data.inputs.humanMessagePrompt, '{input}');
  for (const key of ['metadata', 'maskedGraph', 'model']) assert.equal(patch.before[key], patch.expected[key]);
  assert.notEqual(patch.before.prompt, patch.expected.prompt);
  assert.deepEqual(original, snapshot);
});

test('dry-run is the default and emits only non-secret fingerprints without PUT', async () => {
  const f = fixture(), report = await syncSystemPrompt(f.options);
  assert.equal(report.status, 'dry-run'); assert.equal(report.apply, false); assert.equal(f.writes.length, 0); assert.equal(f.reads(), 1);
  assert.deepEqual(f.current(), f.original);
  const encoded = JSON.stringify(report);
  for (const secret of ['RETAINED_SECRET_KEY_ID', 'RETAINED_MODEL_ALIAS', 'original {literal}', 'target', 'ownerPassword']) assert.ok(!encoded.includes(secret));
});

test('apply sends flowData only and verifies a fresh GET, every other graph field, metadata and settings', async () => {
  const f = fixture(), report = await syncSystemPrompt({ ...f.options, apply: true });
  assert.equal(report.status, 'updated'); assert.equal(f.writes.length, 1); assert.equal(f.reads(), 3);
  assert.deepEqual(Object.keys(f.writes[0]), ['flowData']);
  assert.equal(report.hashes.before.model, report.hashes.confirmed.model);
  assert.equal(report.hashes.before.metadata, report.hashes.confirmed.metadata);
  assert.equal(report.hashes.before.maskedGraph, report.hashes.confirmed.maskedGraph);
  assert.equal(report.hashes.expected.prompt, report.hashes.confirmed.prompt);
  assert.equal(report.settingsUnchanged, true);
});

test('an identical existing prompt remains a no-op even with apply', async () => {
  const f = fixture();
  const report = await syncSystemPrompt({ ...f.options, apply: true, promptText: 'original {literal} prompt' });
  assert.equal(report.status, 'unchanged'); assert.equal(report.changed, false); assert.equal(f.writes.length, 0);
});

test('unknown flow, planner flow, malformed graph or duplicated prompt is refused before mutation', () => {
  for (const change of [{ id: '../other-flow' }, { name: 'Moa local RAG itinerary v1' }, { type: 'AGENTFLOW' }, { flowData: 'not-json' }, { flowData: '{"nodes":[],"edges":[]}' }]) assert.throws(() => preparePromptPatch({ ...fresh(), ...change }, promptText));
  const flow = fresh(), graph = JSON.parse(flow.flowData); graph.nodes.push(structuredClone(graph.nodes.find(node => node.data.name === 'chatPromptTemplate')));
  assert.throws(() => preparePromptPatch({ ...flow, flowData: JSON.stringify(graph) }, promptText));
});

test('model drift after PUT is detected and rolls back only the exact original flowData', async () => {
  const f = fixture({ driftModel: true });
  await assert.rejects(syncSystemPrompt({ ...f.options, apply: true }), { code: 'POST_UPDATE_INVARIANT_FAILED', rollback: 'verified-original-flow-data' });
  assert.equal(f.writes.length, 2);
  assert.deepEqual(f.writes[1], { flowData: f.original.flowData });
  assert.equal(f.current().flowData, f.original.flowData);
});

test('metadata and settings drift fail closed; rollback does not attempt to rewrite protected files or metadata', async () => {
  for (const options of [{ driftMetadata: true }, { settingsDrift: true }]) {
    const f = fixture(options);
    await assert.rejects(syncSystemPrompt({ ...f.options, apply: true }), error => {
      assert.ok(['POST_UPDATE_INVARIANT_FAILED', 'SETTINGS_CHANGED'].includes(error.code));
      assert.equal(error.rollback, 'verified-original-flow-data'); return true;
    });
    assert.equal(f.writes.length, 2); assert.ok(f.writes.every(body => Object.keys(body).length === 1 && typeof body.flowData === 'string'));
    assert.equal(f.current().flowData, f.original.flowData);
    if (options.driftMetadata) assert.equal(f.current().isPublic, true, 'the original metadata failure remains visible and is never silently rewritten');
  }
});

test('update failures perform the bounded rollback and expose no upstream body or credential text', async () => {
  for (const rollbackFails of [false, true]) {
    const f = fixture({ updateFails: true, rollbackFails });
    await assert.rejects(syncSystemPrompt({ ...f.options, apply: true }), error => {
      assert.equal(error.code, 'FLOWISE_UPDATE_FAILED');
      assert.equal(error.rollback, rollbackFails ? 'failed' : 'verified-original-flow-data');
      assert.ok(!error.message.includes('credential')); return true;
    });
    assert.equal(f.writes.length, 2);
  }
});

test('concurrent flow change is detected before PUT', async () => {
  const f = fixture(); let reads = 0;
  await assert.rejects(syncSystemPrompt({ ...f.options, apply: true, readFlow: async () => ({ ...f.original, ...(++reads > 1 ? { updatedDate: 'another-editor-update' } : {}) }) }), { code: 'FLOW_CHANGED_BEFORE_UPDATE' });
  assert.equal(f.writes.length, 0);
});

test('owner API permits existing loopback flow paths only and keeps cookies solely in the in-memory request', async () => {
  for (const origin of ['http://127.0.0.1:3002', 'http://localhost:3002/']) assert.ok(localFlowiseOrigin(origin));
  for (const origin of ['https://example.com', 'http://192.168.0.1:3002', 'http://127.0.0.2:3002', 'http://user:secret@localhost:3002', 'http://localhost:3002/path', 'http://localhost:3002/?token=secret']) assert.throws(() => localFlowiseOrigin(origin));
  const requests = [], api = createOwnerApi('http://localhost:3002', async (url, options) => {
    requests.push({ url, options });
    return Response.json({ okay: true }, { headers: { 'set-cookie': 'session=COOKIE_SECRET; HttpOnly' } });
  });
  await api('/auth/login', { method: 'POST', publicRequest: true, body: { email: 'private', password: 'LOGIN_SECRET' } });
  await api('/chatflows/known-flow');
  assert.equal(requests[0].options.headers.Cookie, undefined);
  assert.equal(requests[1].options.headers.Cookie, 'session=COOKIE_SECRET');
  assert.equal(requests[1].options.headers['x-request-from'], 'internal');
  assert.equal(requests[1].options.redirect, 'error');
  for (const [path, options] of [['/apikey', {}], ['/account/register', { method: 'POST' }], ['/prediction/known-flow', { method: 'POST' }], ['/chatflows/known-flow', { method: 'DELETE' }], ['/chatflows/known-flow', { method: 'POST' }], ['/chatflows/known-flow', { method: 'PUT', body: { flowData: '{}', apikeyid: 'changed' } }]]) await assert.rejects(api(path, options), { code: 'FLOWISE_API_SCOPE_INVALID' });
  assert.equal(requests.length, 2);
});

test('owner API errors are sanitized instead of exposing returned bodies, cookies or network details', async () => {
  const http = createOwnerApi('http://127.0.0.1:3002', async () => Response.json({ error: 'PRIVATE_UPSTREAM' }, { status: 403 }));
  await assert.rejects(http('/chatflows/known-flow'), { code: 'FLOWISE_HTTP_FAILED', message: 'FLOWISE_HTTP_FAILED' });
  const network = createOwnerApi('http://127.0.0.1:3002', async () => { throw new Error('PRIVATE_NETWORK_SECRET'); });
  await assert.rejects(network('/chatflows/known-flow'), { code: 'FLOWISE_REQUEST_FAILED', message: 'FLOWISE_REQUEST_FAILED' });
});

test('entry point never imports bootstrap or writes settings and only runs when invoked directly', async () => {
  const script = await readFile(new URL('../scripts/flowise/sync-system-prompt.mjs', import.meta.url), 'utf8');
  assert.ok(!script.includes("from './bootstrap.mjs'"));
  assert.ok(!script.includes('writeFile('));
  assert.ok(!script.includes('/prediction/'));
  assert.ok(script.includes('pathToFileURL(resolve(process.argv[1])).href'));
  assert.equal(flowFingerprints(fresh()).model.length, 64);
});
