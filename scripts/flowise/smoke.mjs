import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('/lib/') && specifier.startsWith('./')) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
});
const project = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const data = resolve(process.env.MOA_FLOWISE_DATA_DIR || resolve(project, '.sites-runtime/ai/flowise-data'));
const output = resolve(project, 'work/flowise/native-smoke.json');
const { createTripSession, currentTrip } = await import('../../lib/trip-engine.ts');
const { parseChatRequest, revisionOf, applyModelReply } = await import('../../lib/chat-contract.ts');
const { predictFlowise, readFlowiseConfig } = await import('../../lib/flowise-adapter.ts');
const variables = JSON.parse(await readFile(resolve(data, 'config.json'), 'utf8'));
const config = readFlowiseConfig(variables);
const configuredGraph = JSON.parse(await readFile(resolve(project, 'work/flowise/moa-local-chatflow.json'), 'utf8'));
const configuredModel = configuredGraph.nodes.find((item) => item.data.name === 'chatOllama').data.inputs.modelName;
assert.ok(config?.apiKey);
const session = createTripSession();
const request = parseChatRequest({
  protocolVersion: 1, requestId: `smoke_${crypto.randomUUID()}`, sessionId: `smoke_${crypto.randomUUID()}`,
  baseRevision: revisionOf(session), session,
  action: { type: 'message', text: '제주 1박 2일, 오전 오후로 장소 넣어줘. 숙소 추천은 빼줘.' },
});
const start = performance.now();
const reply = await predictFlowise(request, config);
const updated = applyModelReply(request, reply, 'flowise');
const state = currentTrip(updated);
assert.equal(state.region, '제주');
assert.equal(state.days, 2);
assert.equal(state.plan.filter((visit) => visit.kind === 'stay').length, 0);
for (const day of [1, 2]) assert.ok(state.plan.filter((visit) => visit.day === day && visit.kind === 'place').length >= 2);
const report = {
  checkedAt: new Date().toISOString(), passed: true, path: 'Moa adapter -> native Flowise -> native ChatOllama -> local Ollama -> structured action validation -> trip engine',
  flowiseVersion: '3.1.4', configuredModel, baseUrl: config.baseUrl, chatflowId: config.chatflowId,
  latencyMs: Math.round(performance.now() - start), actionTypes: reply.actions.map((action) => action.type),
  state: { region: state.region, days: state.days, placeVisits: state.plan.filter((visit) => visit.kind === 'place').length, stayVisits: 0 },
};
await mkdir(resolve(project, 'work/flowise'), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
