import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { registerHooks } from 'node:module';
import { isGeminiTextModel, selectGeminiTextModel } from '../lib/gemini-models.ts';

registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.includes('/lib/') && specifier.startsWith('./') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
  return next(specifier, context);
} });
const { isFreeGeminiTextModel, readGeminiFreePolicy, reserveGeminiFreeCall } = await import('../lib/gemini-free-policy.ts');
const { isLocalOllamaModelName, hasLocalOllamaWeights } = await import('../lib/local-model-policy.ts');

const root = new URL('../', import.meta.url);
const endpoint = 'https://generativelanguage.googleapis.com/v1beta/';
class ConfigurationFailure extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new ConfigurationFailure(code, message, status); };

/** An explicit reauthentication child environment overrides only verification credentials. */
export function verificationPolicyEnvironment(processVariables, fileVariables) {
  const values = { ...processVariables, ...fileVariables };
  const refreshName = 'GEMINI_BILLING_VERIFICATION_CREDENTIALS';
  const tokenName = 'GEMINI_BILLING_VERIFICATION_TOKEN';
  const projectName = 'GEMINI_BILLING_VERIFICATION_PROJECT';
  const freshRefreshCredentials = Object.hasOwn(processVariables, refreshName) && String(processVariables[refreshName] ?? '').trim();
  if (Object.hasOwn(processVariables, refreshName)) {
    values[refreshName] = processVariables[refreshName];
    if (String(processVariables[refreshName] ?? '').trim()) values[tokenName] = '';
  }
  if (Object.hasOwn(processVariables, tokenName) && !freshRefreshCredentials) values[tokenName] = processVariables[tokenName];
  if (Object.hasOwn(processVariables, projectName)) values[projectName] = processVariables[projectName];
  return values;
}

async function readBoundedJson(response) {
  const maximum = 1048576;
  if (Number(response.headers.get('content-length') ?? 0) > maximum || !response.body) fail('RESPONSE_INVALID', 'Provider connection-test response was empty or too large.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > maximum) {
        await reader.cancel();
        fail('RESPONSE_TOO_LARGE', 'Provider response exceeded the connection-test limit.');
      }
      text += decoder.decode(item.value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); } catch { fail('RESPONSE_INVALID', 'Provider returned an invalid connection-test response.', response.status); }
}

function parseVariables(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch { continue; }
    } else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (typeof value === 'string') values[match[1]] = value;
  }
  return values;
}

async function officialRequest(path, key) {
  let response;
  try {
    response = await fetch(endpoint + path, {
      method: 'GET',
      headers: { 'x-goog-api-key': key },
      signal: AbortSignal.timeout(15000), redirect: 'manual',
    });
    const data = await readBoundedJson(response);
    if (!response.ok) {
      // Classify known problems without printing a provider body that may contain credentials.
      const leaked = String(data?.error?.message ?? '').toLowerCase().includes('leaked');
      fail(leaked ? 'KEY_REVOKED_AS_LEAKED' : response.status === 429 ? 'QUOTA_EXCEEDED' : [401, 403].includes(response.status) ? 'AUTH_REJECTED' : 'PROVIDER_REJECTED',
        leaked ? 'Google has revoked this API key as leaked. Replace it in the server environment or ignored .dev.vars; do not send it in chat.' : 'Gemini connection test was rejected. No local configuration was changed.', response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ConfigurationFailure) throw error;
    fail('CONNECTION_FAILED', 'Could not complete the Gemini connection test. No local configuration was changed.');
  }
}

async function saveConfiguration(existing, updates) {
  try {
    execFileSync('git', ['check-ignore', '--quiet', '.dev.vars'], { cwd: fileURLToPath(root), windowsHide: true, stdio: 'ignore' });
  } catch { fail('SECRET_FILE_NOT_IGNORED', '.dev.vars must be ignored by Git before storing server configuration.'); }
  const lines = existing.split(/\r?\n/).filter((line) => !Object.keys(updates).some((name) => new RegExp(`^\\s*${name}\\s*=`).test(line)));
  const content = lines.filter(Boolean).join('\n') + '\n' + Object.entries(updates).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n';
  const backupDirectory = new URL('.sites-runtime/ai/large-model/', root);
  await mkdir(backupDirectory, { recursive: true });
  if (existing) await writeFile(new URL(`dev-vars-${Date.now()}-${randomUUID()}.backup`, backupDirectory), existing, { flag: 'wx', mode: 0o600 });
  const temporary = new URL(`.dev.vars.${randomUUID()}.tmp`, root);
  await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
  await rename(temporary, new URL('.dev.vars', root));
}

async function configureLocal(args, selected, existing, variables) {
  const model = selected || variables.LARGE_MODEL_NAME || process.env.LARGE_MODEL_NAME;
  const modelSize = Number(model?.match(/(?:^|[:/_-])(\d+(?:\.\d+)?)b(?:$|[:/_-])/i)?.[1]);
  if (!model || !isLocalOllamaModelName(model) || !Number.isFinite(modelSize) || modelSize <= 8) fail('MODEL_INVALID', 'Select installed local weights such as qwen3:14b. Cloud and remote aliases are blocked.');
  let base;
  try { base = new URL(variables.LARGE_MODEL_BASE_URL || process.env.LARGE_MODEL_BASE_URL || 'http://127.0.0.1:11434'); } catch { fail('LOCAL_ENDPOINT_INVALID', 'The local Ollama endpoint is invalid.'); }
  if (!['http:', 'https:'].includes(base.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.username || base.password || base.search || base.hash || base.pathname !== '/') fail('LOCAL_ENDPOINT_INVALID', 'Unauthenticated Ollama is restricted to loopback.');
  let details;
  try {
    const response = await fetch(base.origin + '/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }), redirect: 'manual', signal: AbortSignal.timeout(15000) });
    if (!response.ok) fail('LOCAL_MODEL_NOT_INSTALLED', 'Install the selected model with Ollama before enabling automatic escalation.', response.status);
    details = await readBoundedJson(response);
  } catch (error) {
    if (error instanceof ConfigurationFailure) throw error;
    fail('LOCAL_CONNECTION_FAILED', 'Could not inspect the installed local model.');
  }
  const actualSize = Number(String(details.details?.parameter_size ?? '').match(/^(\d+(?:\.\d+)?)B$/i)?.[1]);
  if (!Number.isFinite(actualSize) || actualSize <= 8 || !hasLocalOllamaWeights(details, 8)) fail('MODEL_NOT_LOCAL_LARGER', 'Cannot verify GGUF weights, quantization and a model larger than 8B with no remote forwarding.');
  if (!args.includes('--check')) await saveConfiguration(existing, { LARGE_MODEL_PROVIDER: 'ollama', LARGE_MODEL_BASE_URL: base.origin, LARGE_MODEL_NAME: model, LARGE_MODEL_API_KEY: '', LARGE_MODEL_TIMEOUT_MS: '180000' });
  console.log(JSON.stringify({ connected: true, provider: 'ollama', model, parameterSize: details.details.parameter_size, quantization: details.details.quantization_level, modelInstalled: true, generationTested: false, configured: !args.includes('--check'), restartRequired: !args.includes('--check') }));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check' && !arg.startsWith('--model=') && !arg.startsWith('--provider='))) fail('INVALID_ARGUMENT', 'Supported options: --check, --provider=ollama|gemini, --model=...');
  const selected = args.find((arg) => arg.startsWith('--model='))?.slice('--model='.length);
  const target = new URL('.dev.vars', root);
  let existing = '';
  try { existing = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const variables = parseVariables(existing);
  const provider = args.find((arg) => arg.startsWith('--provider='))?.slice('--provider='.length) || variables.LARGE_MODEL_PROVIDER || process.env.LARGE_MODEL_PROVIDER || 'ollama';
  if (provider === 'ollama') return configureLocal(args, selected, existing, variables);
  if (provider !== 'gemini') fail('PROVIDER_INVALID', 'Use --provider=ollama or --provider=gemini. Other compatible APIs must be explicitly configured by their server settings.');
  const requestedModel = selected || (variables.LARGE_MODEL_PROVIDER === 'gemini' ? variables.LARGE_MODEL_NAME : '') || (process.env.LARGE_MODEL_PROVIDER === 'gemini' ? process.env.LARGE_MODEL_NAME : '');
  if (!requestedModel) fail('MODEL_REQUIRED', 'Explicitly select a Gemini text model with --model=...; model access does not establish free quota or billing status.');
  if (!isGeminiTextModel(requestedModel)) fail('MODEL_INVALID', 'Select a Gemini text Flash or Pro model returned by the official models API. Image, audio, live and other specialized models are not supported.');
  const value = (name) => variables[name]?.trim() || process.env[name]?.trim();
  const key = value('LARGE_MODEL_API_KEY') || value('GEMINI_API_KEY') || value('GOOGLE_API_KEY');
  if (!key || key.length < 16 || key.length > 512 || /[\r\n\x00-\x1f\x7f]/.test(key)) fail('KEY_MISSING', 'Save a valid API key in the server environment or ignored .dev.vars. Do not send it in chat.');
  if (!isFreeGeminiTextModel(requestedModel)) fail('FREE_MODEL_UNSUPPORTED', 'This model is not in the explicitly approved free text-model list. Use the local model.');
  // A valid key and available model do not establish an unbilled Google project.
  // No generateContent connection test is allowed during configuration.
  const policy = readGeminiFreePolicy(verificationPolicyEnvironment(process.env, variables));
  try {
    const permit = await reserveGeminiFreeCall(key, requestedModel, policy, fetch);
    permit.release();
  } catch {
    fail('FREE_TIER_UNVERIFIED', 'Cannot verify that this exact API key belongs to a project with billing disabled. Local LLM remains selected; no Gemini generation was sent.');
  }
  const models = [];
  let page;
  for (let attempt = 0; attempt < 5; attempt++) {
    const data = await officialRequest('models?pageSize=1000' + (page ? '&pageToken=' + encodeURIComponent(page) : ''), key);
    if (!Array.isArray(data.models)) fail('MODELS_INVALID', 'The official model list was invalid.');
    models.push(...data.models);
    page = data.nextPageToken;
    if (!page) break;
  }
  const choice = selectGeminiTextModel(models, requestedModel);
  if (!choice) fail('TEXT_MODEL_UNAVAILABLE', 'The explicitly selected Gemini text generation model is not available to this API key.');
  const model = choice.name.slice('models/'.length);
  if (args.includes('--check')) {
    console.log(JSON.stringify({ connected: true, provider: 'gemini', model, freeTierVerifiedAtSetup: true, generationTested: false, configured: false }));
    return;
  }
  const updates = { LARGE_MODEL_PROVIDER: 'gemini', LARGE_MODEL_NAME: model, LARGE_MODEL_API_KEY: key, LARGE_MODEL_TIMEOUT_MS: '60000' };
  await saveConfiguration(existing, updates);
  console.log(JSON.stringify({ connected: true, provider: 'gemini', model, freeTierVerifiedAtSetup: true, generationTested: false, configured: true, restartRequired: true }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) try { await main(); } catch (error) {
  const failure = error instanceof ConfigurationFailure ? error : new ConfigurationFailure('CONFIGURATION_FAILED', 'Could not safely save large-model configuration. Credentials were not printed.');
  console.error(JSON.stringify({ connected: false, code: failure.code, message: failure.message, ...(failure.status ? { status: failure.status } : {}) }));
  process.exitCode = 1;
}
