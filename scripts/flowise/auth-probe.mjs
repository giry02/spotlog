import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loopbackOrigin } from './chatflow.mjs';

const project = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const data = resolve(process.env.MOA_FLOWISE_DATA_DIR || resolve(project, '.sites-runtime/ai/flowise-data'));
const config = JSON.parse(await readFile(resolve(data, 'config.json'), 'utf8'));
const origin = loopbackOrigin(config.FLOWISE_BASE_URL, 'FLOWISE_BASE_URL');
async function request(path, { prediction = false, key } = {}) {
  const response = await fetch(origin + '/api/v1' + path, {
    method: prediction ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    ...(prediction ? { body: JSON.stringify({ question: 'auth probe', streaming: false }) } : {}),
  });
  let body;
  try { body = await response.json(); } catch { /* response remains a failure */ }
  return { status: response.status, body };
}
const report = { checkedAt: new Date().toISOString(), cases: [] };
for (const [name, key] of [['missing-prediction-key', undefined], ['invalid-prediction-key', 'moa-invalid-auth-probe']]) {
  const result = await request(`/prediction/${config.FLOWISE_CHATFLOW_ID}`, { prediction: true, key });
  const wrapped = result.status === 500 && result.body?.success === false && result.body?.message === 'Error: predictionsServices.buildChatflow - Unauthorized';
  assert.ok([401, 403].includes(result.status) || wrapped, name);
  report.cases.push({ name, status: result.status, deniedBeforeModel: true, upstreamUnauthorizedStatusBug: wrapped });
}
const management = await request('/chatflows');
assert.equal(management.status, 401);
report.cases.push({ name: 'unauthenticated-management', status: management.status, denied: true });
const readOnly = await request('/chatflows', { key: config.FLOWISE_API_KEY });
assert.equal(readOnly.status, 200);
report.cases.push({ name: 'valid-read-only-key', status: readOnly.status, accepted: true });
await mkdir(resolve(project, 'work/flowise'), { recursive: true });
await writeFile(resolve(project, 'work/flowise/auth-probe.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
