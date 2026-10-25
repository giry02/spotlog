import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import '../scripts/evaluate-chat.mjs';

const { ragPlaceIdsForQuery, namedKnowledgePlaceIds, knowledgeSource } = await import('../lib/rag-catalog.ts');
const { gatherChatResources, needsTravelRetrieval } = await import('../lib/chat-resources.ts');
const { retrieveForChat } = await import('../lib/rag-adapter.ts');
const { createTripSession } = await import('../lib/trip-engine.ts');
const { itineraryRequest } = await import('../lib/itinerary-retrieval.ts');

const request = text => ({ protocolVersion: 1, requestId: 'registered-basic-facts', sessionId: 'registered-basic-facts', baseRevision: 1, session: createTripSession(), action: { type: 'message', text } });
const env = { RAG_ENABLED: 'true', RAG_API_KEY: 'test-only-registered-facts-token', RAG_BASE_URL: 'http://127.0.0.1:8765' };
const config = { baseUrl: env.RAG_BASE_URL, apiKey: env.RAG_API_KEY, timeoutMs: 1000 };
const cases = [
  ['봉성식당 설명해줘', 'catalog-jeju-bongseong'],
  ['협재신국수 주소', 'catalog-jeju-hyeopjae-sin-guksu'],
  ['명리동식당 본점 위치를 찾아줘', 'catalog-jeju-myeongri-main'],
  ['파라토도스 소개해줘', 'catalog-jeju-paratodos'],
  ['커피스케치 정보 알려줘', 'catalog-jeju-coffee-sketch'],
  ['랜딩관 제주신화월드 호텔앤리조트 객실 요금 정보를 찾아줘', 'catalog-jeju-landing-shinhwa'],
];
const retrievalFor = id => {
  const source = knowledgeSource(`moa-knowledge:registered-${id}`);
  assert.ok(source);
  return {
    dataMode: 'curated-travel-data', indexVersion: 'idx:registered-basic-facts', embeddingModel: 'test-only-embedding',
    results: [{ ...source, evidenceId: `ev:registered:${id}`, sourceVersion: `sha256:${createHash('sha256').update(source.text).digest('hex')}` }],
  };
};

test('full registered business names trigger a source lookup without generic travel words', () => {
  for (const [text, id] of cases) {
    assert.equal(needsTravelRetrieval(request(text)), true, text);
    assert.deepEqual(namedKnowledgePlaceIds(text), [id], text);
    assert.deepEqual(ragPlaceIdsForQuery(text), [id], text);
    assert.equal(itineraryRequest(request(text)).requested, false, text);
  }
  for (const text of ['봉성식당', '봉성식당은 어떤 곳이야?', '제주도봉성식당주소', '협재 신국수 주소']) {
    const id = text.includes('국수') ? 'catalog-jeju-hyeopjae-sin-guksu' : 'catalog-jeju-bongseong';
    assert.deepEqual(namedKnowledgePlaceIds(text), [id], text);
    assert.equal(needsTravelRetrieval(request(text)), true, text);
  }
});

test('a business name masks only its own tourism alias and keeps separately named places', () => {
  assert.deepEqual(namedKnowledgePlaceIds('협재신국수 주소 알려줘'), ['catalog-jeju-hyeopjae-sin-guksu']);
  assert.deepEqual(new Set(ragPlaceIdsForQuery('협재신국수 주소와 협재해변 위치를 찾아줘')), new Set(['catalog-jeju-hyeopjae-sin-guksu', 'hyeopjae']));
  assert.deepEqual(ragPlaceIdsForQuery('금수복국 해운대본점 주소를 찾아줘'), ['catalog-busan-geumsu']);
  assert.deepEqual(new Set(ragPlaceIdsForQuery('봉성식당과 협재신국수 주소 알려줘')), new Set(['catalog-jeju-bongseong', 'catalog-jeju-hyeopjae-sin-guksu']));
});

test('short names, invented branches and embedded longer names do not gain registered business identity', () => {
  for (const text of ['봉성 설명해줘', '명리동식당 주소', '랜딩관 소개', '모모스커피 주소', '협재 국수 주소', '가짜봉성식당 주소', '봉성식당2호점 주소', '협재신국수별관 주소']) {
    assert.ok(!namedKnowledgePlaceIds(text).some(id => id.startsWith('catalog-')), text);
  }
  assert.deepEqual(namedKnowledgePlaceIds('협재 주소 알려줘'), ['hyeopjae']);
  assert.ok(ragPlaceIdsForQuery('협재신국수 주변의 다른 식당 찾아줘').length > 10);
});

test('registered basic-info retrieval sends only the explicitly named business allowlist and validates its canonical evidence', async () => {
  for (const [text, id] of cases) {
    const seen = [];
    const { resources } = await gatherChatResources(request(text), env, async (url, init) => {
      const endpoint = new URL(url).pathname, body = JSON.parse(init.body);
      seen.push(endpoint);
      assert.equal(new URL(url).origin, env.RAG_BASE_URL);
      if (endpoint === '/internal/rag/search') {
        assert.equal(body.query, text); assert.deepEqual(body.allowedPlaceIds, [id]);
        return Response.json(retrievalFor(id));
      }
      assert.equal(endpoint, '/internal/rag/validate');
      assert.equal(body.results.length, 1); assert.equal(body.results[0].placeId, id);
      return Response.json({ valid: true });
    });
    assert.deepEqual(seen, ['/internal/rag/search', '/internal/rag/validate']);
    assert.equal(resources.retrievalStatus, 'available');
    assert.deepEqual(resources.retrieval.results.map(source => source.placeId), [id]);
    assert.match(resources.retrieval.results[0].text, /주소: 제주특별자치도/);
    assert.match(resources.retrieval.results[0].text, /현재 영업시간.*제공되지 않습니다/);
    assert.equal(resources.retrieval.results[0].checkedAt, '2026-10-22');
  }
});

test('a foreign registered business source cannot pass a Jeju business fact lookup allowlist', async () => {
  await assert.rejects(retrieveForChat(request('협재신국수 주소를 찾아줘'), config, async (_url, init) => {
    assert.deepEqual(JSON.parse(init.body).allowedPlaceIds, ['catalog-jeju-hyeopjae-sin-guksu']);
    return Response.json(retrievalFor('catalog-busan-geumsu'));
  }), { code: 'RAG_OUTPUT_INVALID' });
});
