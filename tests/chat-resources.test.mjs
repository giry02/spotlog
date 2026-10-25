import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import '../scripts/evaluate-chat.mjs';
const { gatherChatResources, needsTravelRetrieval } = await import('../lib/chat-resources.ts');
const { createTripSession } = await import('../lib/trip-engine.ts');
const { buildModelInput } = await import('../lib/model-input.ts');
const { knowledgeSource } = await import('../lib/rag-catalog.ts');
const { itineraryRequest } = await import('../lib/itinerary-retrieval.ts');
const request = (text) => ({ protocolVersion: 1, requestId: 'resources', sessionId: 'resources', baseRevision: 1, session: createTripSession(), action: { type: 'message', text } });
const env = { RAG_ENABLED: 'true', RAG_API_KEY: 'test-only-auth-token-32characters', RAG_BASE_URL: 'http://127.0.0.1:8765' };

function weatherFixture() {
  const koreanNow = new Date(Date.now() + 9 * 3_600_000);
  const today = koreanNow.toISOString().slice(0, 10);
  return {
    timezone: 'Asia/Seoul', utc_offset_seconds: 32400,
    current_units: { temperature_2m: '°C', precipitation: 'mm', wind_speed_10m: 'm/s' },
    current: { time: koreanNow.toISOString().slice(0, 16), temperature_2m: 21.25, precipitation: 0, wind_speed_10m: 2.5, weather_code: 2 },
    daily_units: { temperature_2m_min: '°C', temperature_2m_max: '°C', precipitation_probability_max: '%', wind_speed_10m_max: 'm/s' },
    daily: { time: [today], temperature_2m_min: [17], temperature_2m_max: [24], precipitation_probability_max: [20], wind_speed_10m_max: [4], weather_code: [2] },
  };
}

function itineraryFixture() {
  return {
    dataMode: 'authored-demo-data', indexVersion: 'idx:resources', embeddingModel: 'embedding:test',
    results: ['osulloc', 'hyeopjae', 'seongsan', 'seopjikoji', 'bijarim', 'hamdeok'].map((id) => {
      const source = knowledgeSource(`moa-place:${id}`);
      return {
        evidenceId: `ev:resources:${id}`, placeId: id,
        documentId: `moa-place:${id}`, chunkId: source.chunkId,
        sourceVersion: 'sha256:' + createHash('sha256').update(source.text).digest('hex'),
        text: source.text, sourceKind: source.sourceKind,
      };
    }),
  };
}

test('greeting bypasses retrieval and remains a model conversation', async () => {
  let calls = 0;
  const input = request('안녕하세요');
  assert.equal(needsTravelRetrieval(input), false);
  const { resources } = await gatherChatResources(input, env, async () => { calls++; throw new Error(); });
  assert.equal(calls, 0);
  assert.equal(resources.retrievalStatus, 'not-needed');
  assert.equal(buildModelInput(input, resources).question.context.retrieval, undefined);
});

test('short names of additional knowledge destinations trigger retrieval', () => {
  for (const text of ['한라산 볼만해?', '우도 가는 법', '용머리해안 어때?', '아쿠아플라넷 볼만해?']) assert.equal(needsTravelRetrieval(request(text)), true, text);
});

test('search outage becomes explicit model context without unverified evidence', async () => {
  const input = request('제주 여행 준비할 때 무엇을 챙겨야 해?');
  const { resources, ragConfig } = await gatherChatResources(input, env, async () => { throw new TypeError('offline'); });
  assert.equal(resources.retrievalStatus, 'unavailable');
  assert.equal(resources.retrieval, undefined);
  assert.equal(ragConfig, undefined);
  const context = buildModelInput(input, resources).question.context;
  assert.equal(context.retrievalStatus, 'unavailable');
  assert.match(context.retrievalInstruction, /현재.*날씨|검색 연결/);
  assert.ok(!JSON.stringify(context).includes(env.RAG_API_KEY));
});

test('malformed or stale search material is discarded before generation', async () => {
  const input = request('제주 협재해변 설명해줘');
  const { resources } = await gatherChatResources(input, env, async () => Response.json({ dataMode: 'curated-travel-data', indexVersion: 'idx:test', embeddingModel: 'embedding:test', results: [{ placeId: 'invented', text: 'unsafe' }] }));
  assert.equal(resources.retrievalStatus, 'unavailable');
  assert.equal(resources.retrieval, undefined);
});

test('weather date or missing location is sent to the model without querying RAG', async () => {
  let calls = 0;
  const input = request('내일 날씨 어때?');
  const { resources } = await gatherChatResources(input, env, async () => { calls++; throw new Error(); });
  assert.equal(calls, 0);
  assert.equal(resources.weather.status, 'asked-location');
  assert.equal(resources.retrievalStatus, 'not-needed');
});

test('a combined itinerary and weather request carries validated places and forecast into the planner', async () => {
  const input = request('제주 2박 3일 일정 짜고 오늘 날씨도 알려줘');
  const calls = [];
  assert.equal(itineraryRequest(input).requested, true);
  const { resources, ragConfig } = await gatherChatResources(input, env, async (url, init) => {
    const target = new URL(url);
    calls.push(target.pathname);
    if (target.hostname === 'api.open-meteo.com') return Response.json(weatherFixture());
    if (target.pathname === '/internal/rag/search') {
      assert.equal(JSON.parse(init.body).distinctPlaces, true);
      return Response.json(itineraryFixture());
    }
    assert.equal(target.pathname, '/internal/rag/validate');
    return Response.json({ valid: true });
  });
  assert.deepEqual(calls, ['/v1/forecast', '/internal/rag/search', '/internal/rag/validate']);
  assert.equal(resources.weather.status, 'ready');
  assert.equal(resources.retrievalStatus, 'available');
  assert.equal(resources.coverage.sufficient, true);
  assert.equal(resources.retrieval.results.length, 6);
  assert.ok(ragConfig);
  const modelInput = buildModelInput(input, resources);
  assert.equal(modelInput.question.context.itineraryCandidates.length, 6);
  assert.deepEqual(modelInput.question.context.weather, resources.weather);
  assert.equal(modelInput.question.context.weather.facts.current.temperatureC, 21.25);
  assert.deepEqual(JSON.parse(modelInput.messages[1].content).context.weather, resources.weather);
  assert.match(modelInput.messages[0].content, /context\.weather/);
  assert.ok(!JSON.stringify(modelInput).includes(env.RAG_API_KEY));
});

test('a simple weather request skips RAG and does not manufacture insufficient-coverage escalation', async () => {
  for (const text of ['제주 오늘 날씨와 기온 알려줘', '제주 2박 3일 일정은 짜지 말고 오늘 날씨만 알려줘']) {
    const input = request(text);
    const { resources } = await gatherChatResources(input, env, async (url) => {
      assert.equal(new URL(url).hostname, 'api.open-meteo.com');
      return Response.json(weatherFixture());
    });
    assert.equal(resources.weather.status, 'ready');
    assert.equal(resources.retrievalStatus, 'not-needed');
    assert.equal(resources.retrieval, undefined);
    assert.equal(resources.coverage, undefined);
    assert.deepEqual(buildModelInput(input, resources).question.context.itineraryCandidates, []);
  }
});

test('forecast lookup failure does not suppress an explicitly requested itinerary search', async () => {
  const input = request('제주 2박 3일 일정 만들어줘. 오늘 날씨도 알려줘');
  const { resources } = await gatherChatResources(input, env, async (url) => {
    const target = new URL(url);
    if (target.hostname === 'api.open-meteo.com') throw new TypeError('weather offline');
    if (target.pathname === '/internal/rag/search') return Response.json(itineraryFixture());
    return Response.json({ valid: true });
  });
  assert.equal(resources.weather.status, 'unavailable');
  assert.equal(resources.retrievalStatus, 'available');
  assert.equal(resources.coverage.sufficient, true);
  assert.equal(buildModelInput(input, resources).question.context.weather.status, 'unavailable');
});

test('RAG failure preserves independently verified weather for a combined request', async () => {
  const input = request('제주 2박 3일 일정 만들어줘. 오늘 날씨도 알려줘');
  const { resources } = await gatherChatResources(input, env, async (url) => {
    if (new URL(url).hostname === 'api.open-meteo.com') return Response.json(weatherFixture());
    throw new TypeError('RAG offline');
  });
  assert.equal(resources.weather.status, 'ready');
  assert.equal(resources.retrievalStatus, 'unavailable');
  assert.equal(resources.retrieval, undefined);
  assert.equal(resources.coverage.sufficient, false);
  const context = buildModelInput(input, resources).question.context;
  assert.equal(context.weather.facts.current.temperatureC, 21.25);
  assert.deepEqual(context.itineraryCandidates, []);
});

test('overlong retrieval queries are not silently trimmed or converted to successful search', async () => {
  await assert.rejects(gatherChatResources(request('제주' + '가'.repeat(2050)), env, async () => { throw new Error('must not call'); }), { code: 'RAG_QUERY_TOO_LONG' });
});
