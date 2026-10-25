import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RagStore } from '../scripts/rag/store.mjs';
import { createRagServer } from '../scripts/rag/server.mjs';
import { createOllamaEmbedder, localOllamaUrl, normalizeVector } from '../scripts/rag/ollama.mjs';

// Deterministic fake embeddings exercise rights, isolation and persistence only.
// These tests make no claim about actual model retrieval quality or latency.
const identity = { model: 'test-only-fake', digest: 'f'.repeat(64), pipelineVersion: 'test-v1' };
const fake = {
  identity: async () => identity,
  embed: async (text) => text.includes('바다') ? [1, 0, 0] : text.includes('숲') ? [0, 1, 0] : [0, 0, 1],
};
const documents = [
  { placeId: 'coast', text: '바다 해변 산책', sourceKind: 'authored-demo-data', rightsStatus: 'approved' },
  { placeId: 'forest', text: '숲 그늘 산책', sourceKind: 'authored-demo-data', rightsStatus: 'approved' },
  { placeId: 'museum', text: '전시 관람', sourceKind: 'authored-demo-data', rightsStatus: 'approved' },
];
const request = { query: '바다를 보고 싶어', allowedPlaceIds: ['coast', 'forest', 'museum'], topK: 2 };
const memoryStore = () => new RagStore({ dbPath: ':memory:' });

test('RAG persists actual index metadata and requires explicit server candidate allowlist', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moa-rag-test-'));
  let store = new RagStore({ dbPath: join(dir, 'rag.sqlite') });
  try {
    const seeded = await store.seed(documents, fake);
    store.close();
    store = new RagStore({ dbPath: join(dir, 'rag.sqlite') });
    assert.equal(store.stats().indexVersion, seeded.indexVersion);
    const result = await store.search({ ...request, allowedPlaceIds: ['forest'] }, fake);
    assert.deepEqual(result.results.map((row) => row.placeId), ['forest']);
    assert.equal(result.results[0].sourceKind, 'authored-demo-data');
    assert.match(result.results[0].sourceVersion, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual((await store.search({ ...request, allowedPlaceIds: [] }, fake)).results, []);
    assert.deepEqual((await store.search({ ...request, allowedPlaceIds: ['missing'] }, fake)).results, []);
    await assert.rejects(store.search({ query: '바다' }, fake), { code: 'invalid_search_request' });
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});

test('revocation blocks returned evidence, survives reseed and excludes prior versions', async () => {
  const store = memoryStore();
  try {
    await store.seed(documents, fake);
    const result = await store.search(request, fake);
    assert.equal(result.results[0].placeId, 'coast');
    const validation = { indexVersion: result.indexVersion, allowedPlaceIds: request.allowedPlaceIds, results: result.results };
    assert.equal(store.validateEvidence(validation).valid, true);
    store.revoke('moa-place:coast');
    assert.throws(() => store.validateEvidence(validation), { code: 'evidence_no_longer_valid' });
    await store.seed(documents, fake);
    assert.ok((await store.search(request, fake)).results.every((row) => row.placeId !== 'coast'));
  } finally { store.close(); }
});

test('revoke while query embedding is running takes effect before result reads', async () => {
  const store = memoryStore();
  try {
    await store.seed(documents, fake);
    const revokingEmbedder = { ...fake, embed: async (text) => { store.revoke('moa-place:coast'); return fake.embed(text); } };
    assert.ok((await store.search(request, revokingEmbedder)).results.every((row) => row.placeId !== 'coast'));
  } finally { store.close(); }
});

test('reseed during the final awaited model identity check rejects the old snapshot', async () => {
  const store = memoryStore();
  try {
    await store.seed(documents, fake);
    let calls = 0;
    const reseedingIdentity = { ...fake, identity: async () => {
      calls += 1;
      if (calls === 2) await store.seed(documents.map((doc) => ({ ...doc, text: `${doc.text} 새 버전` })), fake);
      return identity;
    } };
    await assert.rejects(store.search(request, reseedingIdentity), { code: 'index_version_mismatch' });
    assert.match((await store.search(request, fake)).results[0].text, /새 버전$/);
  } finally { store.close(); }
});

test('new source activation invalidates old evidence; changed text cannot be cited', async () => {
  const store = memoryStore();
  try {
    await store.seed(documents, fake);
    const previous = await store.search(request, fake);
    const mutated = { ...previous.results[0], text: '임의로 만든 정보' };
    assert.throws(() => store.validateEvidence({ indexVersion: previous.indexVersion, allowedPlaceIds: request.allowedPlaceIds, results: [mutated] }), { code: 'evidence_no_longer_valid' });
    assert.throws(() => store.validateEvidence({ indexVersion: previous.indexVersion, allowedPlaceIds: ['forest'], results: [previous.results[0]] }), { code: 'evidence_no_longer_valid' });
    await store.seed(documents.map((doc) => doc.placeId === 'coast' ? { ...doc, text: '새로 승인한 바다 설명' } : doc), fake);
    assert.throws(() => store.validateEvidence({ indexVersion: previous.indexVersion, allowedPlaceIds: request.allowedPlaceIds, results: previous.results }), { code: 'index_version_mismatch' });
    await assert.rejects(store.search({ ...request, indexVersion: previous.indexVersion }, fake), { code: 'index_version_mismatch' });
  } finally { store.close(); }
});

test('failed or mixed-dimension index preparation never replaces active documents', async () => {
  const store = memoryStore();
  try {
    const previous = await store.seed(documents, fake);
    const failure = { ...fake, embed: async (text) => { if (text.includes('전시')) throw new Error('test unavailable'); return [1, 0, 0]; } };
    await assert.rejects(store.seed(documents.map((doc) => ({ ...doc, text: `${doc.text} 업데이트` })), failure));
    assert.equal(store.stats().indexVersion, previous.indexVersion);
    assert.equal((await store.search(request, fake)).results[0].text, documents[0].text);
    await assert.rejects(store.seed(documents.map((doc) => ({ ...doc, text: `${doc.text} 새 청크` })), { ...fake, embed: async (text) => text.includes('바다') ? [1, 0] : [1, 0, 0] }), { code: 'invalid_embedding' });
    assert.equal(store.stats().indexVersion, previous.indexVersion);
  } finally { store.close(); }
});

test('unchanged vectors reuse only the identical model identity and source text', async () => {
  const store = memoryStore();
  try {
    await store.seed(documents, fake);
    let calls = 0;
    const counting = { ...fake, embed: async (text) => { calls++; return fake.embed(text); } };
    await store.seed(documents.map((doc) => doc.placeId === 'coast' ? { ...doc, text: doc.text + ' 새 설명' } : doc), counting);
    assert.equal(calls, 1);
    calls = 0;
    await store.seed(documents, { ...counting, identity: async () => ({ ...identity, digest: 'a'.repeat(64) }) });
    assert.equal(calls, documents.length);
  } finally { store.close(); }
});

test('official summary documents share a destination but retain distinct source and revocation identities', async () => {
  const store = memoryStore();
  const official = (id, text) => ({ documentId: `moa-knowledge:${id}`, placeId: 'coast', text, sourceKind: 'curated-official-summary', rightsStatus: 'approved', title: `해변 | ${id}`, sourceUrl: 'https://www.visitjeju.net/kr/', checkedAt: '2026-10-15' });
  try {
    await store.seed([...documents, official('overview', '바다 지형'), official('visit', '바다 방문 안내')], fake);
    const result = await store.search({ ...request, allowedPlaceIds: ['coast'], topK: 5 }, fake);
    assert.equal(result.dataMode, 'curated-travel-data');
    assert.equal(result.results.length, 3);
    const evidence = result.results.find((doc) => doc.documentId === 'moa-knowledge:overview');
    assert.equal(evidence.title, '해변 | overview');
    const validation = { indexVersion: result.indexVersion, allowedPlaceIds: ['coast'], results: result.results };
    assert.equal(store.validateEvidence(validation).valid, true);
    assert.throws(() => store.validateEvidence({ ...validation, results: [{ ...evidence, sourceUrl: 'https://attacker.example/' }] }), { code: 'evidence_no_longer_valid' });
    store.revoke(evidence.documentId, 'source-withdrawn');
    assert.throws(() => store.validateEvidence(validation), { code: 'evidence_no_longer_valid' });
    const after = await store.search({ ...request, allowedPlaceIds: ['coast'], topK: 5 }, fake);
    assert.equal(after.results.length, 2);
    assert.ok(after.results.every((doc) => doc.documentId !== evidence.documentId));
  } finally { store.close(); }
});

test('search rejects tag digest, preprocessing or dimension changes instead of mixing vectors', async () => {
  const store = memoryStore();
  try {
    await store.seed(documents, fake);
    await assert.rejects(store.search(request, { ...fake, identity: async () => ({ ...identity, digest: 'e'.repeat(64) }) }), { code: 'embedding_model_mismatch' });
    await assert.rejects(store.search(request, { ...fake, identity: async () => ({ ...identity, pipelineVersion: 'test-v2' }) }), { code: 'embedding_model_mismatch' });
    await assert.rejects(store.search(request, { ...fake, identity: async () => ({ ...identity, options: { num_ctx: 4096 } }) }), { code: 'embedding_model_mismatch' });
    await assert.rejects(store.search(request, { ...fake, embed: async () => [1, 0] }), { code: 'invalid_embedding' });
    let calls = 0;
    await assert.rejects(store.seed(documents, { ...fake, identity: async () => (++calls === 1 ? identity : { ...identity, digest: 'e'.repeat(64) }) }), { code: 'embedding_model_changed_during_index' });
  } finally { store.close(); }
});

test('removed and rights-denied sources cannot be retrieved; only approved demo documents ingest', async () => {
  const store = memoryStore();
  try {
    await store.seed(documents, fake);
    await store.seed(documents.filter((doc) => doc.placeId !== 'coast'), fake);
    assert.ok((await store.search(request, fake)).results.every((row) => row.placeId !== 'coast'));
    await assert.rejects(store.seed([{ ...documents[0], rightsStatus: 'revoked' }], fake), { code: 'invalid_document' });
    await assert.rejects(store.seed([{ ...documents[0], sourceKind: 'private-conversation' }], fake), { code: 'invalid_document' });
    store.db.prepare("UPDATE documents SET rights_status='revoked' WHERE place_id='forest'").run();
    assert.ok((await store.search(request, fake)).results.every((row) => row.placeId !== 'forest'));
  } finally { store.close(); }
});

test('validation and search constrain arbitrary request data and malformed vectors', async () => {
  const store = memoryStore();
  try {
    await store.seed(documents, fake);
    for (const invalid of [{ ...request, topK: 99 }, { ...request, allowedPlaceIds: ['x); DROP TABLE documents;'] }, { ...request, bypassRights: true }, { ...request, query: 'x'.repeat(2049) }]) await assert.rejects(store.search(invalid, fake), { code: 'invalid_search_request' });
    assert.throws(() => normalizeVector([0, 0]), { code: 'invalid_embedding' });
    assert.throws(() => normalizeVector([Infinity]), { code: 'invalid_embedding' });
    store.db.prepare("UPDATE chunks SET vector='[0,0,0]' WHERE place_id='coast'").run();
    await assert.rejects(store.search(request, fake), { code: 'corrupt_index' });
  } finally { store.close(); }
});

test('HTTP runtime enforces Bearer auth, JSON and body limit without exposing keys', async () => {
  const store = memoryStore();
  await store.seed(documents, fake);
  const apiKey = 'test-only-secret-for-regression';
  const server = createRagServer({ store, embedder: fake, apiKey });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await (await fetch(`${baseUrl}/health`)).json();
    assert.equal(health.status, 'ready');
    assert.ok(!JSON.stringify(health).includes(apiKey));
    assert.equal((await fetch(`${baseUrl}/internal/rag/search`, { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await fetch(`${baseUrl}/internal/rag/search`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: '{}' })).status, 415);
    assert.equal((await fetch(`${baseUrl}/internal/rag/search`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: 'x'.repeat(32769) })).status, 413);
    const response = await fetch(`${baseUrl}/internal/rag/search`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(request) });
    assert.equal(response.status, 200);
    const result = await response.json();
    const validation = await fetch(`${baseUrl}/internal/rag/validate`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ indexVersion: result.indexVersion, allowedPlaceIds: request.allowedPlaceIds, results: result.results }) });
    assert.equal(validation.status, 200);
    assert.equal((await validation.json()).valid, true);
  } finally { await new Promise((done) => server.close(done)); store.close(); }
});

test('HTTP runtime rejects excess concurrent embedding requests with429', async () => {
  const store = memoryStore();
  await store.seed(documents, fake);
  let releaseEmbedding;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const gated = { ...fake, embed: async (text) => { markStarted(); await new Promise((resolve) => { releaseEmbedding = resolve; }); return fake.embed(text); } };
  const apiKey = 'test-only-secret-for-regression';
  const server = createRagServer({ store, embedder: gated, apiKey, maxConcurrent: 1 });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/internal/rag/search`;
  const options = { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(request) };
  const first = fetch(url, options);
  try {
    await started;
    assert.equal((await fetch(url, options)).status, 429);
    releaseEmbedding();
    assert.equal((await first).status, 200);
  } finally { releaseEmbedding?.(); await new Promise((done) => server.close(done)); store.close(); }
});

test('Ollama adapter uses local real embed API contract, rejects remote URL and failed call', async () => {
  assert.throws(() => localOllamaUrl('https://external.example'), { code: 'ollama_url_must_be_local' });
  assert.throws(() => localOllamaUrl('http://user:secret@127.0.0.1:11434'), { code: 'ollama_url_must_be_local' });
  const calls = [];
  const adapter = createOllamaEmbedder({ model: 'qwen3-embedding:0.6b', fetchImpl: async (url, options) => {
    calls.push([url, options]);
    return Response.json(url.endsWith('/api/tags') ? { models: [{ name: 'qwen3-embedding:0.6b', digest: 'a'.repeat(64) }] } : { model: 'qwen3-embedding:0.6b', embeddings: [[3, 4]] });
  } });
  assert.equal((await adapter.identity()).digest, 'a'.repeat(64));
  assert.deepEqual(await adapter.embed('나무 그늘', { query: true }), [0.6, 0.8]);
  assert.equal(calls[1][0], 'http://127.0.0.1:11434/api/embed');
  const body = JSON.parse(calls[1][1].body);
  assert.equal(body.truncate, false);
  assert.deepEqual(body.options, { num_ctx: 4096, num_batch: 64, num_gpu: 0 });
  assert.match(body.input, /Instruct:.*\nQuery: 나무 그늘/);
  await assert.rejects(createOllamaEmbedder({ fetchImpl: async () => { throw new Error('network'); } }).embed('바다'), { code: 'embedding_unavailable' });
});
