import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import '../scripts/evaluate-chat.mjs';
const {
  readRagConfig,
  parseRagRetrieval,
  retrieveForChat,
  revalidateRetrieval,
} = await import('../lib/rag-adapter.ts');
const { createTripSession } = await import('../lib/trip-engine.ts');
const { parseModelReply, applyModelReply, parseTripSession } =
  await import('../lib/chat-contract.ts');
const { authoredPlaceText } = await import('../lib/rag-source.ts');
const { places } = await import('../lib/trip-data.ts');
const { ragCatalog, ragPlaceIdsForQuery } = await import('../lib/rag-catalog.ts');
const config = {
  baseUrl: 'http://127.0.0.1:8765',
  apiKey: 'test-only-auth-token-32characters',
  timeoutMs: 1000,
};
const fixture = () => ({
  dataMode: 'authored-demo-data',
  indexVersion: 'idx:test',
  embeddingModel: 'embedding:test',
  results: [
    {
      evidenceId: 'ev:test',
      placeId: 'hyeopjae',
      documentId: 'moa-place:hyeopjae',
      chunkId: 'moa-place:hyeopjae:description',
      sourceVersion:
        'sha256:' +
        createHash('sha256')
          .update(authoredPlaceText(places.find((p) => p.id === 'hyeopjae')))
          .digest('hex'),
      text: authoredPlaceText(places.find((p) => p.id === 'hyeopjae')),
      sourceKind: 'authored-demo-data',
    },
  ],
});
const request = () => ({
  protocolVersion: 1,
  requestId: 'test',
  sessionId: 'test',
  baseRevision: 1,
  session: createTripSession(),
  action: { type: 'message', text: '바다 풍경을 보고 싶어' },
});

test('specific destination evidence excludes unrelated bus and venue instructions while discovery remains broad', () => {
  assert.deepEqual(ragPlaceIdsForQuery('제주 우도 배편과 차량 반입 조건을 설명해줘'), ['udo']);
  assert.deepEqual(ragPlaceIdsForQuery('한라산 성판악과 관음사, 영실과 어리목 코스 설명'), ['hallasan']);
  assert.deepEqual(ragPlaceIdsForQuery('한라산 성판악과 관음사, 영실과 어리목 코스를 알려줘. 일정은 만들지 말고 설명만 해줘.'), ['hallasan']);
  assert.deepEqual(new Set(ragPlaceIdsForQuery('협재와 금능 차이를 설명해줘')), new Set(['hyeopjae', 'geumneung']));
  for (const query of ['오설록처럼 초록이 많은 다른 제주 장소', '우도 말고 비 오는 날 갈 대안', '우도 말고 실내 갈 곳', '협재 근처 실내 추천']) {
    assert.ok(ragPlaceIdsForQuery(query).length > 10, query);
  }
  assert.ok(ragPlaceIdsForQuery('비가 올 경우도 있어?').length > 10);
});

test('RAG is explicit server config and incomplete authorization fails closed', () => {
  assert.equal(readRagConfig({}), null);
  assert.throws(() => readRagConfig({ RAG_ENABLED: 'true' }), {
    code: 'RAG_CONFIG_INVALID',
  });
  assert.equal(
    readRagConfig({ RAG_ENABLED: 'true', RAG_API_KEY: config.apiKey }).baseUrl,
    config.baseUrl,
  );
});
test('RAG accepts only canonical allowed source IDs and bounded plain text', () => {
  assert.equal(parseRagRetrieval(fixture(), ['hyeopjae']).results.length, 1);
  assert.throws(() => parseRagRetrieval(fixture(), ['seoulforest']), {
    code: 'RAG_OUTPUT_INVALID',
  });
  const unsafe = fixture();
  unsafe.results[0].text = '<script>run()</script>';
  assert.throws(() => parseRagRetrieval(unsafe, ['hyeopjae']), {
    code: 'RAG_OUTPUT_INVALID',
  });
});
test('RAG search transmits server allowlist and uses separate Bearer auth without redirects', async () => {
  const result = await retrieveForChat(request(), config, async (url, init) => {
    assert.equal(url, config.baseUrl + '/internal/rag/search');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.Authorization, `Bearer ${config.apiKey}`);
    const body = JSON.parse(init.body);
    assert.ok(body.allowedPlaceIds.includes('hyeopjae'));
    assert.ok(!body.allowedPlaceIds.includes('model-invented-place'));
    return Response.json(fixture());
  });
  assert.equal(result.results[0].placeId, 'hyeopjae');
});
test('unknown citations and revoked source block before a model turn can apply', async () => {
  const retrieval = fixture();
  await assert.rejects(
    revalidateRetrieval(
      retrieval,
      { message: '근거 설명', actions: [], evidenceIds: ['made-up'] },
      config,
    ),
    { code: 'RAG_OUTPUT_INVALID' },
  );
  await assert.rejects(
    revalidateRetrieval(
      retrieval,
      { message: '근거 설명', actions: [], evidenceIds: ['ev:test'] },
      config,
      async (_url, init) => {
        assert.equal(JSON.parse(init.body).results.length, 1);
        assert.ok(JSON.parse(init.body).allowedPlaceIds.includes('hyeopjae'));
        return Response.json({ error: 'revoked' }, { status: 409 });
      },
    ),
    { code: 'RAG_STALE_EVIDENCE' },
  );
  assert.throws(
    () =>
      applyModelReply(request(), {
        message: '설명',
        actions: [],
        evidenceIds: ['made-up'],
      }),
    { code: 'MODEL_ACTION_INVALID' },
  );
});
test('verified citation metadata survives the same existing session contract', () => {
  const reply = parseModelReply({
    message: '해변 풍경을 참고했어요',
    actions: [],
    evidenceIds: ['ev:test'],
  });
  const result = applyModelReply(request(), reply, 'flowise', fixture());
  assert.equal(result.turns.at(-1).retrieval.results[0].placeId, 'hyeopjae');
  assert.deepEqual(result.turns.at(-1).evidenceIds, ['ev:test']);
  assert.throws(
    () => parseModelReply({ ...reply, evidenceIds: ['ev:test', 'ev:test'] }),
    { code: 'MODEL_OUTPUT_INVALID' },
  );
});

test('canonical source changes block stale RAG material before contacting the model', async () => {
  const retrieval = fixture();
  retrieval.results[0].text += '오래된 추가 설명';
  let calls = 0;
  await assert.rejects(
    revalidateRetrieval(
      retrieval,
      { message: '설명', actions: [] },
      config,
      async () => {
        calls++;
        return Response.json({ valid: true });
      },
    ),
    { code: 'RAG_STALE_EVIDENCE' },
  );
  assert.equal(calls, 0);
});

test('official knowledge preserves source provenance and supports the registered destination without inventing IDs', async () => {
  const source = ragCatalog().find((doc) => doc.placeId === 'hallasan');
  assert.ok(source);
  const retrieval = {
    dataMode: 'curated-travel-data', indexVersion: 'idx:official', embeddingModel: 'embedding:test',
    results: [{ ...source, evidenceId: 'ev:official', sourceVersion: 'sha256:' + createHash('sha256').update(source.text).digest('hex') }],
  };
  assert.equal(parseRagRetrieval(retrieval, ['hallasan']).results[0].sourceKind, 'curated-official-summary');
  await revalidateRetrieval(retrieval, { message: '한라산 코스 설명', actions: [], evidenceIds: ['ev:official'] }, config, async () => Response.json({ valid: true }));
  const session = applyModelReply(request(), { message: '한라산 코스를 설명할게요.', actions: [], evidenceIds: ['ev:official'] }, 'flowise', retrieval);
  assert.equal(session.turns.at(-1).retrieval.results[0].sourceUrl, source.sourceUrl);
  const historical = structuredClone(session);
  Object.assign(historical.turns.at(-1).retrieval.results[0], { documentId: 'moa-knowledge:retired-document', placeId: 'retired-jeju-place', title: '이전 제목', sourceUrl: 'https://www.visitjeju.net/kr/old-source', checkedAt: '2025-01-01' });
  assert.ok(parseTripSession(historical));
  historical.turns.at(-1).retrieval.results[0].sourceUrl = 'javascript:alert(1)';
  assert.throws(() => parseTripSession(historical));
  const forged = structuredClone(retrieval);
  forged.results[0].sourceUrl = 'https://attacker.example/';
  assert.throws(() => parseRagRetrieval(forged, ['hallasan']), { code: 'RAG_OUTPUT_INVALID' });
  const collected = applyModelReply(request(), { message: '한라산을 담았어요.', actions: [{ type: 'collect-entity', id: 'hallasan' }] }, 'flowise', retrieval);
  assert.ok(collected.turns.at(-1).state.collectedIds.includes('hallasan'));
  assert.throws(() => applyModelReply(request(), { message: '새 장소를 담았어요.', actions: [{ type: 'collect-entity', id: 'unregistered-jeju-place' }] }, 'flowise', retrieval), { code: 'MODEL_ACTION_INVALID' });
});
