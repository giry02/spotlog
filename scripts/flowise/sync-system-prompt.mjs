import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FLOW_NAME, FLOWISE_VERSION } from './chatflow.mjs';

export class PromptSyncError extends Error {
  constructor(code, rollback) { super(code); this.name = 'PromptSyncError'; this.code = code; if (rollback) this.rollback = rollback; }
}
const fail = code => { throw new PromptSyncError(code); };
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const hashObject = value => sha256(JSON.stringify(value));
export const escapeSystemPrompt = text => text.replaceAll('{', '{{').replaceAll('}', '}}');

export function localFlowiseOrigin(value) {
  let url;
  try { url = new URL(value); } catch { return fail('FLOWISE_ORIGIN_INVALID'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail('FLOWISE_ORIGIN_INVALID');
  return url.origin;
}

function graphFor(flow) {
  if (!flow || typeof flow !== 'object' || flow.name !== FLOW_NAME || flow.type !== 'CHATFLOW' ||
      typeof flow.id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(flow.id) || typeof flow.flowData !== 'string') fail('GENERAL_FLOW_INVALID');
  let graph;
  try { graph = JSON.parse(flow.flowData); } catch { return fail('GENERAL_GRAPH_INVALID'); }
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) fail('GENERAL_GRAPH_INVALID');
  const prompts = graph.nodes.filter(node => node?.data?.name === 'chatPromptTemplate');
  const models = graph.nodes.filter(node => node?.data?.name === 'chatOllama');
  if (prompts.length !== 1 || models.length !== 1 || typeof prompts[0]?.data?.inputs?.systemMessagePrompt !== 'string') fail('GENERAL_GRAPH_INVALID');
  return { graph, prompt: prompts[0], model: models[0] };
}

export function flowFingerprints(flow) {
  const { graph, prompt, model } = graphFor(flow);
  const { flowData: _flowData, updatedDate: _updatedDate, ...metadata } = flow;
  const promptHash = sha256(prompt.data.inputs.systemMessagePrompt);
  const modelHash = hashObject(model);
  prompt.data.inputs.systemMessagePrompt = '__MOA_LITERAL_SYSTEM_PROMPT__';
  return { metadata: hashObject(metadata), maskedGraph: hashObject(graph), model: modelHash, prompt: promptHash };
}

export function preparePromptPatch(flow, promptText) {
  if (typeof promptText !== 'string' || !promptText.trim() || Buffer.byteLength(promptText) > 262144) fail('SYSTEM_PROMPT_INVALID');
  const { graph, prompt } = graphFor(flow);
  const escaped = escapeSystemPrompt(promptText);
  const changed = prompt.data.inputs.systemMessagePrompt !== escaped;
  prompt.data.inputs.systemMessagePrompt = escaped;
  const patched = { ...flow, flowData: JSON.stringify(graph) };
  const before = flowFingerprints(flow), after = flowFingerprints(patched);
  if (['metadata', 'maskedGraph', 'model'].some(key => before[key] !== after[key])) fail('PATCH_SCOPE_INVALID');
  return { flowData: patched.flowData, changed, before, expected: after };
}

function unchangedExceptPrompt(before, after, expectedPrompt) {
  const current = flowFingerprints(after);
  if (['metadata', 'maskedGraph', 'model'].some(key => before[key] !== current[key]) || current.prompt !== expectedPrompt) fail('POST_UPDATE_INVARIANT_FAILED');
  return current;
}

/** No model prediction, bootstrap, configuration write, or credential export.
 * API callbacks make the transaction independently testable without a server. */
export async function syncSystemPrompt({ readFlow, writeFlow, readSettingsFingerprint, promptText, apply = false }) {
  const settingsBefore = await readSettingsFingerprint();
  const original = await readFlow();
  const patch = preparePromptPatch(original, promptText);
  const report = { status: patch.changed ? apply ? 'updated' : 'dry-run' : 'unchanged', apply,
    changed: patch.changed, scope: 'general-flow-system-prompt-only', modelUnchanged: true,
    metadataUnchanged: true, graphExceptPromptUnchanged: true, settingsUnchanged: true,
    hashes: { before: patch.before, expected: patch.expected, settings: settingsBefore } };
  if (!apply || !patch.changed) {
    if (await readSettingsFingerprint() !== settingsBefore) fail('SETTINGS_CHANGED');
    return report;
  }
  // Fail before PUT if another editor changed the existing graph or metadata.
  const fresh = await readFlow();
  if (hashObject(fresh) !== hashObject(original)) fail('FLOW_CHANGED_BEFORE_UPDATE');
  if (await readSettingsFingerprint() !== settingsBefore) fail('SETTINGS_CHANGED');
  try {
    await writeFlow({ flowData: patch.flowData });
    const confirmed = await readFlow();
    report.hashes.confirmed = unchangedExceptPrompt(patch.before, confirmed, patch.expected.prompt);
    if (await readSettingsFingerprint() !== settingsBefore) fail('SETTINGS_CHANGED');
    return report;
  } catch (error) {
    let rollback = 'failed';
    try {
      await writeFlow({ flowData: original.flowData });
      const restored = await readFlow();
      const restoredGraph = graphFor(restored).graph;
      if (hashObject(restoredGraph) === hashObject(graphFor(original).graph)) rollback = 'verified-original-flow-data';
    } catch { /* Never expose upstream or credential-bearing error contents. */ }
    throw new PromptSyncError(error instanceof PromptSyncError ? error.code : 'FLOWISE_UPDATE_FAILED', rollback);
  }
}

export function createOwnerApi(origin, fetcher = fetch) {
  const base = localFlowiseOrigin(origin), cookies = new Map();
  return async function api(path, { method = 'GET', body, publicRequest = false } = {}) {
    const flowPath = /^\/chatflows\/[A-Za-z0-9_-]{1,160}$/.test(path);
    if (!(method === 'GET' && (path === '/version' || flowPath) || method === 'POST' && path === '/auth/login' || method === 'PUT' && flowPath)) fail('FLOWISE_API_SCOPE_INVALID');
    if (method === 'PUT' && (!/^\/chatflows\//.test(path) || !body || Object.keys(body).length !== 1 || typeof body.flowData !== 'string')) fail('FLOWISE_API_SCOPE_INVALID');
    let response;
    try {
      response = await fetcher(`${base}/api/v1${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', ...(!publicRequest ? {
          'x-request-from': 'internal', Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
        } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { return fail('FLOWISE_REQUEST_FAILED'); }
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0], equals = pair.indexOf('=');
      if (equals > 0) cookies.set(pair.slice(0, equals), pair.slice(equals + 1));
    }
    if (!response.ok) fail('FLOWISE_HTTP_FAILED');
    try { return await response.json(); } catch { return fail('FLOWISE_REPLY_INVALID'); }
  };
}

async function settingsFingerprint(paths) {
  const fingerprints = [];
  for (const path of paths) {
    try { fingerprints.push(sha256(await readFile(path))); }
    catch (error) { if (error?.code === 'ENOENT') fingerprints.push('absent'); else fail('SETTINGS_READ_FAILED'); }
  }
  return hashObject(fingerprints);
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || args.length > 1) fail('ARGUMENT_INVALID');
  const apply = args.includes('--apply');
  const project = resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const data = resolve(environment.MOA_FLOWISE_DATA_DIR || resolve(project, '.sites-runtime/ai/flowise-data'));
  const privatePath = resolve(data, 'bootstrap-private.json'), configPath = resolve(data, 'config.json');
  const settingsPaths = [privatePath, configPath, resolve(project, '.dev.vars'), resolve(project, '.env'), resolve(project, '.env.local')];
  const initialSettings = await settingsFingerprint(settingsPaths);
  let privateSettings, config;
  try { privateSettings = JSON.parse(await readFile(privatePath, 'utf8')); config = JSON.parse(await readFile(configPath, 'utf8')); }
  catch { return fail('EXISTING_FLOWISE_SETTINGS_REQUIRED'); }
  const origin = localFlowiseOrigin(environment.FLOWISE_BASE_URL || config.FLOWISE_BASE_URL);
  const id = environment.FLOWISE_CHATFLOW_ID || config.FLOWISE_CHATFLOW_ID;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(id) ||
      typeof privateSettings.ownerEmail !== 'string' || typeof privateSettings.ownerPassword !== 'string') fail('EXISTING_FLOWISE_SETTINGS_REQUIRED');
  const api = createOwnerApi(origin);
  const version = await api('/version', { publicRequest: true });
  if ((typeof version === 'string' ? version : version?.version) !== FLOWISE_VERSION) fail('FLOWISE_VERSION_MISMATCH');
  await api('/auth/login', { method: 'POST', publicRequest: true,
    body: { email: privateSettings.ownerEmail, password: privateSettings.ownerPassword } });
  if (await settingsFingerprint(settingsPaths) !== initialSettings) fail('SETTINGS_CHANGED');
  const report = await syncSystemPrompt({
    readFlow: async () => { const flow = await api(`/chatflows/${id}`); if (flow?.id !== id) fail('GENERAL_FLOW_ID_MISMATCH'); return flow; },
    writeFlow: body => api(`/chatflows/${id}`, { method: 'PUT', body }),
    readSettingsFingerprint: () => settingsFingerprint(settingsPaths),
    promptText: await readFile(resolve(project, 'docs/flowise-system-prompt.txt'), 'utf8'), apply,
  });
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(JSON.stringify({ status: 'failed', code: error instanceof PromptSyncError ? error.code : 'PROMPT_SYNC_FAILED',
      ...(error instanceof PromptSyncError && error.rollback ? { rollback: error.rollback } : {}) }));
    process.exitCode = 1;
  });
}
