// Real local Ollama retrieval evaluation. Unlike tests/local-rag.test.mjs this
// intentionally requires the installed embedding model and current persisted DB.
import { performance } from 'node:perf_hooks';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RagStore } from './store.mjs';
import { createOllamaEmbedder } from './ollama.mjs';
import { readConfig } from './cli.mjs';
import { authoredDemoDocuments } from './catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const config = await readConfig();
const embedder = createOllamaEmbedder({ baseUrl: config.baseUrl, model: config.model });
const store = new RagStore({ dbPath: config.dbPath });
const allIds = (await authoredDemoDocuments(root)).map((document) => document.placeId);
const scenarios = [
  { id: 'green-forest', query: '나무 그늘에서 천천히 숲길을 걸으며 쉬고 싶어', allowedPlaceIds: allIds, expectedAny: ['bijarim', 'seoulforest'], topK: 2 },
  { id: 'tea-culture', query: '차 문화 전시와 초록 차밭을 함께 둘러보고 싶어', allowedPlaceIds: allIds, expectedAny: ['osulloc'], topK: 1 },
  { id: 'west-white-beach', query: '비양도가 보이는 흰 모래 해변을 걷고 싶어', allowedPlaceIds: allIds, expectedAny: ['hyeopjae', 'geumneung'], topK: 2 },
  { id: 'waterfall', query: '폭포와 물이 흐르는 풍경을 보고 싶어', allowedPlaceIds: allIds, expectedAny: ['cheonjiyeon', 'jeongbang'], topK: 2 },
  { id: 'volcanic-shore', query: '해안의 주상절리와 바위 절벽을 감상하고 싶어', allowedPlaceIds: allIds, expectedAny: ['jusangjeolli'], topK: 2 },
  { id: 'candidate-isolation', query: '바다와 해변', allowedPlaceIds: ['bijarim', 'seoulforest'], expectedAny: ['bijarim', 'seoulforest'], topK: 2 },
  { id: 'no-candidates', query: '바다를 보여줘', allowedPlaceIds: [], expectedAny: [], topK: 2 },
];
const report = { evaluatedAt: new Date().toISOString(), execution: 'real-local-ollama-embedding', dataMode: store.stats().dataMode, metadata: store.stats(), scenarios: [] };
try {
  for (const scenario of scenarios) {
    const started = performance.now();
    const result = await store.search({ query: scenario.query, allowedPlaceIds: scenario.allowedPlaceIds, topK: scenario.topK }, embedder);
    const milliseconds = Math.round(performance.now() - started);
    const returnedIds = result.results.map((evidence) => evidence.placeId);
    const validation = store.validateEvidence({ indexVersion: result.indexVersion, allowedPlaceIds: scenario.allowedPlaceIds, results: result.results });
    const passed = scenario.expectedAny.length === 0
      ? returnedIds.length === 0
      : returnedIds.some((id) => scenario.expectedAny.includes(id)) && returnedIds.every((id) => scenario.allowedPlaceIds.includes(id)) && validation.valid;
    report.scenarios.push({ id: scenario.id, query: scenario.query, passed, milliseconds, returnedIds, evidenceIds: result.results.map((evidence) => evidence.evidenceId) });
  }
  // A disposable SQLite snapshot checks revocation against actual stored vectors,
  // without touching the running service's active index or rights ledger.
  const outputDir = resolve(root, '.sites-runtime/ai/rag/evaluations');
  await mkdir(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const clonePath = resolve(outputDir, `${stamp}.sqlite`);
  store.db.prepare('VACUUM INTO ?').run(clonePath);
  const clone = new RagStore({ dbPath: clonePath });
  try {
    const before = await clone.search({ query: '차밭 차문화 전시', allowedPlaceIds: ['osulloc'], topK: 1 }, embedder);
    const revokedDocuments = clone.db.prepare('SELECT document_id FROM documents WHERE place_id=?').all('osulloc');
    for (const doc of revokedDocuments) clone.revoke(doc.document_id, 'disposable-actual-vector-evaluation');
    let staleRejected = false;
    try { clone.validateEvidence({ indexVersion: before.indexVersion, allowedPlaceIds: ['osulloc'], results: before.results }); } catch (error) { staleRejected = error.code === 'evidence_no_longer_valid'; }
    const after = await clone.search({ query: '차밭 차문화 전시', allowedPlaceIds: ['osulloc'], topK: 1 }, embedder);
    report.revocation = { disposableDatabase: true, revokedDocuments: revokedDocuments.length, staleRejected, afterCount: after.results.length, passed: staleRejected && after.results.length === 0 };
  } finally { clone.close(); }
  try {
    const models = await (await fetch(`${config.baseUrl}/api/ps`)).json();
    report.loadedEmbeddingModel = models.models?.filter((model) => model.name === config.model).map(({ name, size, size_vram, context_length, details }) => ({ name, size, size_vram, context_length, details }));
  } catch { report.loadedEmbeddingModel = 'runtime-statistics-unavailable'; }
  report.passed = report.scenarios.every((scenario) => scenario.passed) && report.revocation.passed;
  const outputPath = resolve(outputDir, `${stamp}.json`);
  await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, outputPath }, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally { store.close(); }
