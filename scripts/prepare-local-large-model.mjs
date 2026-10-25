import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    return next(context.parentURL?.includes('/lib/') && specifier.startsWith('./') ? `${specifier}.ts` : specifier, context);
  },
});
const { parseProviderReply } = await import('../lib/model-output.ts');
const { readLargeModelConfig } = await import('../lib/large-model-adapter.ts');
const config = readLargeModelConfig({ LARGE_MODEL_PROVIDER: 'ollama', LARGE_MODEL_NAME: process.env.LARGE_MODEL_NAME || 'qwen3:14b', LARGE_MODEL_BASE_URL: process.env.LARGE_MODEL_BASE_URL || 'http://127.0.0.1:11434', LARGE_MODEL_TIMEOUT_MS: '180000' });
const api = async (path, body, timeout = 15000) => {
  const response = await fetch(config.baseUrl + path, { method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeout), headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`Local model preparation failed: HTTP ${response.status}`);
  return response;
};
const tags = await (await api('/api/tags')).json();
const installed = tags.models?.find((model) => model.name === config.model);
if (!installed) throw new Error('Download the selected local model before this verification script.');
const metadata = await (await api('/api/show', { model: config.model, verbose: false })).json();
const startedAt = new Date().toISOString();
const started = performance.now();
const body = await (await api('/api/chat', {
  model: config.model, stream: false, think: false, format: 'json', keep_alive: 0,
  options: { temperature: 0, num_ctx: 12288, num_predict: 128, repeat_penalty: 1.1 },
  messages: [
    { role: 'system', content: '한국어 여행 도우미다. 검색 도구나 RAG 자료는 제공되지 않았다. 일반 지식임을 밝히고 JSON 객체 {"message":"짧은 한국어 답변","actions":[]} 하나만 출력한다. JSON 외에는 출력하지 않는다.' },
    { role: 'user', content: '제주 여행 중 비가 오면 일정 조정할 때 어떤 점을 고려해야 해? 실시간 정보는 확인하지 말고 두 문장으로 설명해 줘.' },
  ],
}, 180000)).json();
if (body.done !== true || body.done_reason !== 'stop') throw new Error('The larger local model did not finish its connection test.');
const reply = parseProviderReply(JSON.parse(body.message.content));
if (reply.actions.length) throw new Error('The read-only larger-model probe attempted an action.');
const after = await (await api('/api/ps')).json();
const report = {
  startedAt, completedAt: new Date().toISOString(), provider: config.provider, model: config.model,
  digest: installed.digest, downloadBytes: installed.size, details: metadata.details,
  parameters: { think: false, format: 'json', keepAlive: 0, numCtx: 12288, probeMaxTokens: 128, productionMaxTokens: 900 },
  milliseconds: Math.round(performance.now() - started), loadMilliseconds: Math.round((body.load_duration ?? 0) / 1000000),
  promptTokens: body.prompt_eval_count, generatedTokens: body.eval_count,
  generationTokensPerSecond: body.eval_duration ? Math.round(body.eval_count / (body.eval_duration / 1000000000) * 100) / 100 : null,
  reply, contractPassed: true, unloadedAfterCall: !after.models?.some((model) => model.name === config.model),
  scope: 'Short isolated JSON and Korean generation probe; full application prompt is tested separately.',
};
const directory = new URL('../.sites-runtime/ai/large-model/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('local-model-probe.json', directory), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
