import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loopbackOrigin } from './chatflow.mjs';

const project = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const origin = loopbackOrigin(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434', 'OLLAMA_BASE_URL');
const base = process.env.MOA_OLLAMA_BASE_MODEL || 'qwen3:8b';
const model = process.env.MOA_OLLAMA_FLOWISE_MODEL || 'moa-qwen3-8b:20261015';
if (![base, model].every((name) => /^[A-Za-z0-9_.:/-]{1,160}$/.test(name)) || model === base) throw new Error('Use a distinct valid local alias');
async function api(path, body) {
  const response = await fetch(origin + path, {
    method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(45000),
    headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`Ollama ${path} returned HTTP ${response.status}`);
  return response.json();
}
const before = await api('/api/tags');
const baseModel = before.models?.find((item) => item.name === base);
if (!baseModel) throw new Error('Base model must already be installed; this script does not pull models');
const parameters = { num_predict: 1200, num_ctx: 12288, temperature: 0 };
const created = await api('/api/create', { model, from: base, parameters, stream: false });
if (created.status !== 'success') throw new Error('Ollama did not confirm model creation');
const after = await api('/api/tags');
const alias = after.models?.find((item) => item.name === model);
if (!alias) throw new Error('Created alias is missing');
const report = { status: 'configured', base, baseDigest: baseModel.digest, model, modelDigest: alias.digest, parameters, path: origin, inferred: false };
await mkdir(resolve(project, 'work/flowise'), { recursive: true });
await writeFile(resolve(project, 'work/flowise/model-alias.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
