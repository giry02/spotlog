import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChatflow, createItineraryChatflow, loopbackOrigin, FLOW_NAME, PLANNER_FLOW_NAME, FLOWISE_VERSION } from './chatflow.mjs';

const project = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const dataDirectory = resolve(process.env.MOA_FLOWISE_DATA_DIR || resolve(project, '.sites-runtime/ai/flowise-data'));
const statePath = resolve(dataDirectory, 'bootstrap-private.json');
const exportPath = resolve(process.env.MOA_FLOWISE_EXPORT_PATH || resolve(project, 'work/flowise/moa-local-chatflow.json'));
const plannerExportPath = resolve(process.env.MOA_FLOWISE_PLANNER_EXPORT_PATH || resolve(project, 'work/flowise/moa-local-itinerary-chatflow.json'));
const origin = loopbackOrigin(process.env.FLOWISE_BASE_URL || 'http://127.0.0.1:3002', 'FLOWISE_BASE_URL');
const cookieJar = new Map();
await mkdir(dataDirectory, { recursive: true });
let state;
try { state = JSON.parse(await readFile(statePath, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw new Error('Cannot read local Flowise credentials');
  state = { ownerEmail: 'owner@moa.local', ownerPassword: `Moa!1${randomBytes(32).toString('base64url')}` };
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
async function saveState() { await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 }); }
async function api(path, { method = 'GET', body, publicRequest = false, bearer } = {}) {
  const response = await fetch(origin + '/api/v1' + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      ...(!publicRequest ? { 'x-request-from': 'internal', Cookie: [...cookieJar].map(([key, value]) => `${key}=${value}`).join('; ') } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.slice(0, cookie.indexOf(';') === -1 ? undefined : cookie.indexOf(';'));
    const equals = pair.indexOf('=');
    cookieJar.set(pair.slice(0, equals), pair.slice(equals + 1));
  }
  let result;
  try { result = await response.json(); } catch { result = undefined; }
  if (!response.ok) throw new Error(`Flowise ${method} ${path} failed with HTTP ${response.status}`);
  return result;
}

const version = await api('/version', { publicRequest: true });
const actualVersion = typeof version === 'string' ? version : version?.version;
if (actualVersion !== FLOWISE_VERSION) throw new Error(`Expected Flowise ${FLOWISE_VERSION}, got ${actualVersion || 'unknown'}`);
const auth = await api('/auth/resolve', { method: 'POST', body: {}, publicRequest: true });
if (auth.redirectUrl === '/organization-setup') {
  await api('/account/register', {
    method: 'POST', publicRequest: true,
    body: { user: { name: 'Moa Local Owner', email: state.ownerEmail, credential: state.ownerPassword } },
  });
  console.log('Created the local Flowise owner through the supported registration API.');
}
await api('/auth/login', { method: 'POST', publicRequest: true, body: { email: state.ownerEmail, password: state.ownerPassword } });
const keys = await api('/apikey');
const keyName = 'Moa local prediction only';
let key = (Array.isArray(keys) ? keys : keys.data || []).find((item) => item.keyName === keyName);
if (!key) {
  const created = await api('/apikey', { method: 'POST', body: { keyName, permissions: ['chatflows:view'] } });
  key = (Array.isArray(created) ? created : created.data || []).find((item) => item.keyName === keyName);
}
if (!key?.id || !key?.apiKey) throw new Error('Cannot obtain the dedicated prediction key');
const flows = await api('/chatflows');
const allFlows = Array.isArray(flows) ? flows : flows.data || [];
const existing = allFlows.find((item) => item.name === FLOW_NAME);
const plannerOnly = process.env.MOA_FLOWISE_BOOTSTRAP_PLANNER_ONLY === 'true';
const model = process.env.OLLAMA_MODEL || state.model || 'moa-qwen3-8b:20261015';
const graph = plannerOnly && existing
  ? JSON.parse(existing.flowData)
  : createChatflow({ ollamaBaseUrl: process.env.OLLAMA_BASE_URL, model });
const plannerGraph = createItineraryChatflow({ ollamaBaseUrl: process.env.OLLAMA_BASE_URL, model });
function bodyFor(name, flowGraph) { return {
  name, flowData: JSON.stringify(flowGraph), type: 'CHATFLOW',
  deployed: true, isPublic: false, apikeyid: key.id,
  apiConfig: JSON.stringify({ overrideConfig: { status: false, nodes: {}, variables: [] } }),
  // Flowise retains prediction messages in its local database. No memory node is
  // connected, and each Moa request carries only bounded server-selected history.
  chatbotConfig: JSON.stringify({ rateLimit: { limitMax: '30', limitDuration: '1', limitMsg: '잠시 후 다시 시도해 주세요.' } }),
}; }
async function upsert(name, flowGraph) {
  const current = allFlows.find((item) => item.name === name);
  const body = bodyFor(name, flowGraph);
  return current
    ? api(`/chatflows/${current.id}`, { method: 'PUT', body })
    : api('/chatflows', { method: 'POST', body });
}
const flow = plannerOnly && existing ? existing : await upsert(FLOW_NAME, graph);
const planner = await upsert(PLANNER_FLOW_NAME, plannerGraph);
if (!flow.id) throw new Error('Flowise did not return a chatflow ID');
if (!planner.id) throw new Error('Flowise did not return a planner chatflow ID');
state.flowiseVersion = actualVersion;
state.baseUrl = origin;
state.chatflowId = flow.id;
state.plannerChatflowId = planner.id;
state.apiKey = key.apiKey;
state.apiKeyId = key.id;
state.model = graph.nodes.find((item) => item.data.name === 'chatOllama').data.inputs.modelName;
await saveState();
await writeFile(resolve(dataDirectory, 'config.json'), JSON.stringify({
  FLOWISE_BASE_URL: origin, FLOWISE_CHATFLOW_ID: flow.id,
  FLOWISE_PLANNER_CHATFLOW_ID: planner.id,
  FLOWISE_API_KEY: key.apiKey, FLOWISE_TIMEOUT_MS: '45000',
}, null, 2) + '\n', { mode: 0o600 });
await mkdir(dirname(exportPath), { recursive: true });
await writeFile(exportPath, JSON.stringify(graph, null, 2) + '\n');
await mkdir(dirname(plannerExportPath), { recursive: true });
await writeFile(plannerExportPath, JSON.stringify(plannerGraph, null, 2) + '\n');
await writeFile(resolve(project, 'scripts/flowise/moa-local-itinerary-chatflow.json'), JSON.stringify(plannerGraph, null, 2) + '\n');
// The export contains prompt + local endpoint + model configuration only.
// Owner cookies, credential, API key/id, and user data are never exported.
const unauthenticated = await fetch(`${origin}/api/v1/prediction/${flow.id}`, {
  method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'auth probe', streaming: false }), signal: AbortSignal.timeout(15000),
});
let denial;
try { denial = await unauthenticated.json(); } catch { /* invalid response fails closed */ }
// 3.1.4 wraps the original Unauthorized in predictionsServices.buildChatflow,
// producing HTTP 500 instead of preserving 401. Require its exact denial body;
// an arbitrary 500 (or model output) never passes the authentication probe.
const unauthorizedWrapper = unauthenticated.status === 500 &&
  denial?.success === false && denial?.message === 'Error: predictionsServices.buildChatflow - Unauthorized';
if (![401, 403].includes(unauthenticated.status) && !unauthorizedWrapper) throw new Error(`Prediction API key check failed: HTTP ${unauthenticated.status}`);
const plannerUnauthenticated = await fetch(`${origin}/api/v1/prediction/${planner.id}`, {
  method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'auth probe', streaming: false }), signal: AbortSignal.timeout(15000),
});
let plannerDenial;
try { plannerDenial = await plannerUnauthenticated.json(); } catch { /* invalid response fails closed */ }
const plannerUnauthorizedWrapper = plannerUnauthenticated.status === 500 &&
  plannerDenial?.success === false && plannerDenial?.message === 'Error: predictionsServices.buildChatflow - Unauthorized';
if (![401, 403].includes(plannerUnauthenticated.status) && !plannerUnauthorizedWrapper) throw new Error(`Planner prediction API key check failed: HTTP ${plannerUnauthenticated.status}`);
console.log(JSON.stringify({ status: 'configured', version: actualVersion, baseUrl: origin, chatflowId: flow.id, plannerChatflowId: planner.id, mainFlowPreserved: plannerOnly && Boolean(existing), model: state.model, nativeNodes: graph.nodes.map((item) => item.data.name), unauthenticatedStatus: unauthenticated.status, unauthenticatedDenied: true, plannerUnauthenticatedStatus: plannerUnauthenticated.status, plannerUnauthenticatedDenied: true, upstreamUnauthorizedStatusBug: unauthorizedWrapper, exportPath, plannerExportPath, privateSettingsPath: statePath }, null, 2));
