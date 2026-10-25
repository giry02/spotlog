import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/evaluate-chat.mjs';

const { createTripSession } = await import('../lib/trip-engine.ts');
const { applyModelReply } = await import('../lib/chat-contract.ts');
const { buildModelInput } = await import('../lib/model-input.ts');
const { routeModelReply } = await import('../lib/model-routing.ts');
const { knowledgeSource } = await import('../lib/rag-catalog.ts');
const request = text => ({ protocolVersion: 1, requestId: 'registered-fact-grounding', sessionId: 'registered-fact-grounding', baseRevision: 1, session: createTripSession(), action: { type: 'message', text } });
const source = knowledgeSource('moa-knowledge:registered-catalog-jeju-hyeopjae-sin-guksu');
const retrieval = { dataMode: 'curated-travel-data', indexVersion: 'idx:registered-grounding', embeddingModel: 'test-only', results: [{ ...source, evidenceId: 'ev:registered-grounding', sourceVersion: 'sv:registered-grounding' }] };
const resources = { retrieval, retrievalStatus: 'available', retrievalInstruction: '현재 등록 자료만 참고한다.', coverage: { sufficient: true, reason: 'not-required' } };
const safeMessage = '협재신국수 주소는 제주특별자치도 제주시 한림읍 명재로 17입니다. 협재해수욕장 인근의 국수 식당으로 등록되어 있어요.';
const reply = message => ({ message, actions: [], evidenceIds: ['ev:registered-grounding'] });
const local = { provider: 'ollama', model: 'qwen3:14b', baseUrl: 'http://127.0.0.1:11434', timeoutMs: 1000 };

test('a named registered fact question rejects unsupported popularity, rank and star claims for every model source', () => {
  const input = request('협재신국수 주소와 소개 알려줘'), before = structuredClone(input);
  for (const message of [
    `${safeMessage} 관광객들에게 인기가 있습니다.`,
    '인기 많은 식당이에요.', '인기도 1등입니다.', '인기 순위는 1위입니다.',
    '별점 4.8점입니다.', '평점이 4.9점이에요.',
    '관광객들이 즐겨 찾는 곳이에요.',
    '현재 인기도는 미확인이지만 관광객들에게 인기가 있습니다.',
  ]) for (const mode of ['flowise', 'ollama', 'large-model']) {
    const candidate = reply(message), originalReply = structuredClone(candidate);
    assert.throws(() => applyModelReply(input, candidate, mode, retrieval), { code: 'MODEL_FACTS_UNGROUNDED' }, message);
    assert.deepEqual(candidate, originalReply, 'the guard rejects the completion rather than deleting or rewriting its sentences');
    assert.deepEqual(input, before, 'an unsupported factual caption cannot create a persisted turn');
  }
});

test('normal sourced address/description and explicit unknown or negative reputation statements remain unchanged', () => {
  const input = request('협재신국수 주소와 소개 알려줘');
  for (const message of [
    safeMessage,
    '인기도와 별점은 등록 자료에서 확인하지 못했어요.',
    '인기가 높은지는 확인하지 못했어요.',
    '인기가 높지 않다는 주장도 확인할 수 없어요.',
    '평점 4.8이라는 정보는 확인되지 않았어요.',
    '현재 인기도 자료가 없으므로 유명하거나 인기 있다고 단정할 수 없어요.',
  ]) {
    const result = applyModelReply(input, reply(message), 'large-model', retrieval);
    assert.equal(result.turns.at(-1).assistantMessage, message);
    assert.deepEqual(result.turns.at(-1).evidenceIds, ['ev:registered-grounding']);
  }
});

test('only the direct registered fact prompt receives the unavailable reputation fields and grounding hint', () => {
  const scoped = buildModelInput(request('협재신국수 주소와 소개 알려줘'), resources);
  assert.deepEqual(scoped.question.context.registeredBusinessFacts.ids, ['catalog-jeju-hyeopjae-sin-guksu']);
  assert.match(scoped.messages[0].content, /인기도·인기 순위·평점·별점·방문객 수가 제공되지 않는다/);
  const general = buildModelInput(request('요즘 제주 여행이 인기 있는 이유를 설명해줘'), resources);
  assert.equal(general.question.context.registeredBusinessFacts, undefined);
  const message = '제주 여행은 바다 풍경 때문에 인기가 있습니다.';
  assert.equal(applyModelReply(request('여행지에 관한 일반적인 문장 예시를 알려줘'), { message, actions: [] }, 'large-model').turns.at(-1).assistantMessage, message);
});

test('an unsupported factual caption uses the existing validation failure fallback before saving a safe reply', async () => {
  const input = request('협재신국수 주소와 소개 알려줘'), before = structuredClone(input);
  const calls = [], unsafe = reply(`${safeMessage} 관광객들에게 인기가 있습니다.`), safe = reply(safeMessage);
  const routed = await routeModelReply({
    request: input, resources, large: local,
    primary: { provider: 'flowise', async predict() { calls.push('primary'); return unsafe; } },
    async predictLarge() { calls.push('allowed-local-fallback'); return safe; },
    validate(candidate, mode) { applyModelReply(input, candidate, mode, retrieval); },
  });
  assert.deepEqual(calls, ['primary', 'allowed-local-fallback']);
  assert.equal(routed.reply, safe); assert.equal(routed.mode, 'large-model');
  assert.equal(routed.resources.modelRouting.reason, 'primary-failed');
  assert.deepEqual(input, before);
  const persisted = applyModelReply(input, routed.reply, routed.mode, retrieval);
  assert.equal(persisted.turns.length, 2); assert.equal(persisted.turns.at(-1).assistantMessage, safeMessage);
});

test('if all allowed models repeat unsupported popularity no reply is accepted or written as success', async () => {
  const input = request('협재신국수 주소와 소개 알려줘'), before = structuredClone(input);
  const unsafe = reply('협재신국수는 인기도 1등입니다.'), calls = [];
  await assert.rejects(routeModelReply({
    request: input, resources, large: local,
    primary: { provider: 'flowise', async predict() { calls.push('primary'); return unsafe; } },
    async predictLarge() { calls.push('allowed-local-fallback'); return unsafe; },
    validate(candidate, mode) { applyModelReply(input, candidate, mode, retrieval); },
  }), { code: 'MODEL_FACTS_UNGROUNDED' });
  assert.deepEqual(calls, ['primary', 'allowed-local-fallback']);
  assert.deepEqual(input, before);
});
