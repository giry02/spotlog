import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import '../scripts/evaluate-chat.mjs';
import { RagStore, validateSearchRequest } from '../scripts/rag/store.mjs';

const { ragCatalog, ragAllowedPlaceIds } = await import('../lib/rag-catalog.ts');
const { retrieveForChat, parseRagRetrieval, validateRetrievedEvidence } = await import('../lib/rag-adapter.ts');
const { createTripSession } = await import('../lib/trip-engine.ts');
const { itineraryRequest, itineraryRetrievalScope, assessRetrievalCoverage, itineraryEvidenceCandidates } = await import('../lib/itinerary-retrieval.ts');
const { buildModelInput } = await import('../lib/model-input.ts');
const sources = ragCatalog();
const config = { baseUrl: 'http://127.0.0.1:8765', apiKey: 'test-only-planning-rag-auth-token', timeoutMs: 1000 };
const identity = { model: 'test-only-planning-fake', digest: 'b'.repeat(64), pipelineVersion: 'planning-regression-v1' };
// These vectors only exercise selection, isolation and bounds. They are not a
// claim about embedding quality and never call Ollama or another model service.
const fake = { identity: async () => identity, embed: async () => [1, 0] };
const hash = value => createHash('sha256').update(value).digest('hex');
const asDocument = source => ({ ...source, rightsStatus: 'approved' });
const asEvidence = (source, indexVersion = 'idx:planning-test') => ({
  ...source,
  sourceVersion: `sha256:${hash(source.text)}`,
  evidenceId: `${indexVersion}:${hash(source.documentId).slice(0, 24)}`,
});
const response = (selected, indexVersion = 'idx:planning-test', embeddingModel = identity.model) => ({
  dataMode: 'curated-travel-data', indexVersion, embeddingModel,
  results: selected.map(source => asEvidence(source, indexVersion)),
});
const request = text => ({
  protocolVersion: 1, requestId: 'planning-search', sessionId: 'planning-search',
  baseRevision: 1, session: createTripSession(), action: { type: 'message', text },
});
const officialFor = id => sources.filter(source => source.placeId === id && source.sourceKind === 'curated-official-summary');

test('distinct-place search keeps the best document per destination instead of filling all slots with one destination', async () => {
  const store = new RagStore({ dbPath: ':memory:' });
  const selected = sources.filter(source => ['osulloc', 'hallasan', 'udo'].includes(source.placeId));
  const vectors = new Map(selected.map(source => [source.text,
    source.placeId === 'osulloc' ? [1, 0] : source.placeId === 'hallasan' ? [0.8, 0.6] : [0.6, 0.8],
  ]));
  const rankedFake = { ...fake, embed: async (text, options) => options?.query ? [1, 0] : vectors.get(text) };
  try {
    await store.seed(selected.map(asDocument), rankedFake);
    const query = { query: '제주 여행 일정', allowedPlaceIds: ['osulloc', 'hallasan', 'udo'], topK: 3 };
    const repeated = await store.search(query, rankedFake);
    assert.deepEqual(repeated.results.map(item => item.placeId), ['osulloc', 'osulloc', 'osulloc']);
    const diverse = await store.search({ ...query, distinctPlaces: true }, rankedFake);
    assert.deepEqual(diverse.results.map(item => item.placeId), ['osulloc', 'hallasan', 'udo']);
    assert.equal(diverse.results[0].evidenceId, repeated.results[0].evidenceId);
    assert.equal(store.validateEvidence({ indexVersion: diverse.indexVersion, allowedPlaceIds: query.allowedPlaceIds, results: diverse.results }).valid, true);
    store.revoke(diverse.results[0].documentId);
    const after = await store.search({ ...query, distinctPlaces: true }, rankedFake);
    assert.equal(after.results.filter(item => item.placeId === 'osulloc').length, 1);
    assert.notEqual(after.results[0].evidenceId, diverse.results[0].evidenceId);
  } finally { store.close(); }
});

test('the larger search window still rejects unknown fields, nonboolean diversification and malformed topK or index values', () => {
  const valid = { query: '제주 일정', allowedPlaceIds: ['hallasan'], topK: 12, distinctPlaces: true };
  assert.equal(validateSearchRequest(valid).topK, 12);
  assert.equal(validateSearchRequest({ ...valid, distinctPlaces: false }).distinctPlaces, false);
  for (const input of [
    { ...valid, distinctPlaces: 'true' }, { ...valid, distinctPlaces: 1 },
    { ...valid, distinctPlaces: null }, { ...valid, distinctPlaces: {} },
    { ...valid, topK: 13 }, { ...valid, topK: '12' }, { ...valid, topK: 0 },
    { ...valid, bypassRights: true }, { ...valid, indexVersion: 'idx:one?bypass=1' },
  ]) assert.throws(() => validateSearchRequest(input), { code: 'invalid_search_request' });
});

test('both SQLite and chat adapter accept twelve real source records and reject a thirteenth record', async () => {
  const store = new RagStore({ dbPath: ':memory:' });
  const onePerPlace = [...new Map(sources.map(source => [source.placeId, source])).values()].filter(source => source.placeId !== 'jeju-general').slice(0, 13);
  const allowedPlaceIds = onePerPlace.map(source => source.placeId);
  try {
    await store.seed(onePerPlace.map(asDocument), fake);
    const twelve = await store.search({ query: '여행 후보', allowedPlaceIds, topK: 12, distinctPlaces: true }, fake);
    assert.equal(twelve.results.length, 12);
    assert.equal(store.validateEvidence({ indexVersion: twelve.indexVersion, allowedPlaceIds, results: twelve.results }).valid, true);
    assert.equal(parseRagRetrieval(twelve, allowedPlaceIds).results.length, 12);
    const missingId = allowedPlaceIds.find(id => !twelve.results.some(item => item.placeId === id));
    const extra = await store.search({ query: '여행 후보', allowedPlaceIds: [missingId], topK: 1, indexVersion: twelve.indexVersion }, fake);
    const thirteen = { ...twelve, results: [...twelve.results, ...extra.results] };
    assert.equal(thirteen.results.length, 13);
    assert.throws(() => store.validateEvidence({ indexVersion: thirteen.indexVersion, allowedPlaceIds, results: thirteen.results }), { code: 'invalid_evidence_request' });
    assert.throws(() => parseRagRetrieval(thirteen, allowedPlaceIds), { code: 'RAG_OUTPUT_INVALID' });
    assert.throws(() => store.validateEvidence({ indexVersion: twelve.indexVersion, allowedPlaceIds, results: twelve.results, skipRights: true }), { code: 'invalid_evidence_request' });
    assert.throws(() => parseRagRetrieval({ ...twelve, skipRights: true }, allowedPlaceIds), { code: 'RAG_OUTPUT_INVALID' });
    assert.throws(() => parseRagRetrieval({ ...twelve, results: [{ ...twelve.results[0], inventedScore: 1 }] }, allowedPlaceIds), { code: 'RAG_OUTPUT_INVALID' });
  } finally { store.close(); }
});

test('planning retrieval pins named supplements to one index and preserves distinct candidates within twelve records', async () => {
  const input = request('제주 2박 3일 일정 짜줘. 사려니숲길, 아쿠아플라넷 제주, 여미지식물원을 꼭 넣어줘.');
  const named = itineraryRequest(input).namedPlaceIds;
  assert.equal(named.length, 3);
  const preferred = named.flatMap(officialFor);
  const broad = [...new Map(sources.filter(source => source.placeId !== 'jeju-general' && source.placeId !== 'seoulforest' && !named.includes(source.placeId)).map(source => [source.placeId, source])).values()].slice(0, 8);
  const calls = [];
  const retrieval = await retrieveForChat(input, config, async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    if (calls.length === 1) {
      assert.equal(body.topK, 8);
      assert.equal(body.distinctPlaces, true);
      assert.equal(body.allowedPlaceIds.length, 28);
      assert.ok(!body.allowedPlaceIds.includes('seoulforest'));
      return Response.json(response(broad));
    }
    assert.equal(body.topK, 2);
    assert.equal(body.indexVersion, 'idx:planning-test');
    assert.deepEqual(body.allowedPlaceIds, [named[calls.length - 2]]);
    return Response.json(response(officialFor(body.allowedPlaceIds[0])));
  });
  assert.equal(calls.length, 4);
  assert.equal(retrieval.results.length, 12);
  assert.deepEqual(retrieval.results.slice(0, 3).map(item => item.documentId), preferred.filter((_, index) => index % 2 === 0).map(item => item.documentId));
  assert.deepEqual(retrieval.results.slice(3, 11).map(item => item.documentId), broad.map(item => item.documentId));
  assert.equal(new Set(retrieval.results.map(item => item.placeId)).size, 11);
  assert.equal(retrieval.results.at(-1).documentId, preferred[1].documentId);
  assert.equal(new Set(retrieval.results.map(item => item.evidenceId)).size, 12);
  assert.equal(parseRagRetrieval(retrieval, ragAllowedPlaceIds()).results.length, 12);
  await validateRetrievedEvidence(retrieval, config, async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.results.length, 12);
    assert.equal(body.indexVersion, 'idx:planning-test');
    return Response.json({ valid: true });
  });
});

test('morning and afternoon planning searches current sea and forest sources without automatic full-day destinations', async () => {
  const input = request('제주도 2박 3일 일정 짜줘. 바다랑 숲 위주로 하루에 오전 오후 한 곳씩 넣고 식당 카페 숙소는 빼줘.');
  const scope = itineraryRetrievalScope(input);
  const regional = itineraryRetrievalScope(request('제주 2박 3일 일정 짜줘.'));
  assert.equal(regional.allowedPlaceIds.length, 28);
  assert.equal(scope.morningAfternoon, true);
  assert.deepEqual(scope.themes.map(theme => theme.name), ['바다·해안', '숲']);
  for (const text of ['제주2박3일바다랑숲위주일정짜줘.오전오후한곳씩', '제주 2박 3일 숲하고 바다 위주 일정 짜줘'])
    assert.deepEqual(itineraryRetrievalScope(request(text)).themes.map(theme => theme.name), ['바다·해안', '숲']);
  assert.ok(!scope.allowedPlaceIds.includes('hallasan'));
  assert.ok(!scope.allowedPlaceIds.includes('udo'));
  assert.ok(!scope.allowedPlaceIds.includes('seoulforest'));
  // Tea fields and indoor gardens do not become forests just because their
  // authored tags say green; each requested interest must reach fresh search.
  assert.ok(!scope.allowedPlaceIds.includes('osulloc'));
  assert.ok(!scope.allowedPlaceIds.includes('yeomiji'));
  assert.ok(scope.themes.every(theme => theme.placeIds.length >= 3));
  const forestIds = new Set(scope.themes[1].placeIds);
  const sourceByText = new Map(sources.map(source => [source.text, source]));
  const biasedFake = { ...fake, embed: async (text, options) => options?.query
    ? [1, 0] : forestIds.has(sourceByText.get(text)?.placeId) ? [1, 0] : [0.8, 0.6] };
  const store = new RagStore({ dbPath: ':memory:' });
  const calls = [];
  try {
    await store.seed(sources.map(asDocument), biasedFake);
    const retrieval = await retrieveForChat(input, config, async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      assert.equal(body.distinctPlaces, true);
      assert.ok(body.allowedPlaceIds.every(id => scope.allowedPlaceIds.includes(id)));
      return Response.json(await store.search(body, biasedFake));
    });
    assert.equal(calls.length, 3);
    assert.equal(calls[1].indexVersion, retrieval.indexVersion);
    assert.equal(calls[2].indexVersion, retrieval.indexVersion);
    assert.deepEqual(calls[1].allowedPlaceIds, scope.themes[0].placeIds);
    assert.deepEqual(calls[2].allowedPlaceIds, scope.themes[1].placeIds);
    const firstSix = retrieval.results.slice(0, 6).map(item => item.placeId);
    assert.equal(new Set(firstSix).size, 6);
    assert.equal(firstSix.filter(id => scope.themes[0].placeIds.includes(id)).length, 3);
    assert.equal(firstSix.filter(id => scope.themes[1].placeIds.includes(id)).length, 3);
    assert.equal(assessRetrievalCoverage(input, retrieval).sufficient, true);
    await validateRetrievedEvidence(retrieval, config, async (_url, init) => Response.json(store.validateEvidence(JSON.parse(init.body))));
    const model = buildModelInput(input, { retrieval, retrievalStatus: 'available', retrievalInstruction: '검증된 검색 자료' });
    assert.ok(model.question.context.itineraryCandidates.length >= 6);
    assert.ok(model.question.context.itineraryCandidates.every(candidate => !['udo', 'hallasan'].includes(candidate.id)));
    assert.deepEqual(model.question.context.itineraryPreferences, { morningAfternoon: true, themes: ['바다·해안', '숲'] });
    assert.ok(model.question.context.itineraryCandidates.every(candidate => candidate.tags.length));
  } finally { store.close(); }
});

test('coverage and planner candidates cannot count unsolicited full-day evidence toward requested half-day slots', () => {
  const input = request('제주 2박 3일 일정으로 오전과 오후에 각각 1곳씩 넣어줘.');
  const retrieval = response(['hallasan', 'udo', 'hyeopjae', 'osulloc'].map(id => officialFor(id)[0]));
  assert.equal(assessRetrievalCoverage(input, retrieval).sufficient, false);
  assert.deepEqual(itineraryEvidenceCandidates(retrieval, input).map(place => place.id), ['hyeopjae', 'osulloc']);
  const named = request('제주 2박 3일 오전 오후 한 곳씩 일정 짜줘. 우도는 꼭 넣어줘.');
  assert.ok(itineraryRetrievalScope(named).allowedPlaceIds.includes('udo'));
  assert.ok(!itineraryRetrievalScope(named).allowedPlaceIds.includes('hallasan'));
  assert.ok(itineraryEvidenceCandidates(retrieval, named).some(place => place.id === 'udo'));
});

test('enough forest sources cannot stand in for an explicitly requested sea and forest mix', () => {
  const input = request('제주 2박 3일 바다랑 숲 위주로 오전 오후 한 곳씩 일정 짜줘.');
  const scope = itineraryRetrievalScope(input);
  const forestSources = scope.themes[1].placeIds.map(id => officialFor(id)[0]);
  assert.equal(forestSources.length, 6);
  assert.deepEqual(assessRetrievalCoverage(input, response(forestSources)), { sufficient: false, reason: 'missing-requested-theme' });
});

test('thematic supplementary reads reject an index change instead of mixing sea and forest snapshots', async () => {
  const input = request('제주 2박 3일 바다랑 숲 위주로 오전 오후 한 곳씩 일정 짜줘.');
  let calls = 0;
  await assert.rejects(retrieveForChat(input, config, async (_url, init) => {
    const body = JSON.parse(init.body);
    calls++;
    const selected = body.allowedPlaceIds.map(id => officialFor(id)[0]).filter(Boolean).slice(0, body.topK);
    return Response.json(response(selected, calls === 1 ? 'idx:planning-test' : 'idx:changed'));
  }), { code: 'RAG_OUTPUT_INVALID' });
  assert.equal(calls, 2);
});

test('a named document repeated in broad search is merged once while retaining both source documents for that destination', async () => {
  const input = request('제주 사려니숲길을 넣어서 1일 일정 짜줘.');
  const named = officialFor('saryeoni');
  const broad = [named[0], ...officialFor('aquaplanet')];
  let calls = 0;
  const retrieval = await retrieveForChat(input, config, async () => Response.json(response(++calls === 1 ? broad : named)));
  assert.deepEqual(retrieval.results.map(item => item.documentId), [named[0], named[1], ...officialFor('aquaplanet')].map(item => item.documentId));
  assert.equal(new Set(retrieval.results.map(item => item.evidenceId)).size, 4);
});

test('changed index or embedding identity during named reads fails closed instead of merging different snapshots', async () => {
  for (const mutation of [
    { indexVersion: 'idx:changed', embeddingModel: identity.model },
    { indexVersion: 'idx:planning-test', embeddingModel: 'changed-embedding-model' },
  ]) {
    let calls = 0;
    await assert.rejects(retrieveForChat(request('제주 사려니숲길 넣어서 1일 일정 짜줘.'), config, async (_url, init) => {
      const body = JSON.parse(init.body);
      calls++;
      if (calls === 1) return Response.json(response(officialFor('aquaplanet')));
      assert.equal(body.indexVersion, 'idx:planning-test');
      return Response.json(response(officialFor('saryeoni'), mutation.indexVersion, mutation.embeddingModel));
    }), { code: 'RAG_OUTPUT_INVALID' });
    assert.equal(calls, 2);
  }
  let calls = 0;
  await assert.rejects(retrieveForChat(request('제주 사려니숲길 넣어서 1일 일정 짜줘.'), config, async () => ++calls === 1
    ? Response.json(response(officialFor('aquaplanet')))
    : Response.json({ error: 'index_version_mismatch' }, { status: 409 })), { code: 'RAG_STALE_EVIDENCE' });
  assert.equal(calls, 2);
});
