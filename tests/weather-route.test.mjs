import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export const env = {}', shortCircuit: true };
  if (specifier.startsWith('@/')) return next(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (/(?:\/lib\/[^/]+|\/app\/api\/chat\/route)\.ts$/.test(context.parentURL ?? '') && specifier.startsWith('./')) return next(specifier + '.ts', context);
  return next(specifier, context);
} });

const { POST } = await import('../app/api/chat/route.ts');
const { createTripSession, appendTrip, currentTrip } = await import('../lib/trip-engine.ts');
const { env } = await import('cloudflare:workers');
const { ragCatalog } = await import('../lib/rag-catalog.ts');
const { NEARBY_GROUPING_NOTICE } = await import('../lib/itinerary-proximity.ts');
Object.assign(env, { CHAT_PROVIDER: 'flowise', FLOWISE_BASE_URL: 'http://127.0.0.1:3002', FLOWISE_CHATFLOW_ID: 'weather-test', FLOWISE_API_KEY: 'authored-test-key', RAG_ENABLED: 'false', LARGE_MODEL_PROVIDER: 'disabled' });

const dayMs = 86400000;
const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
function forecast() {
  return {
    timezone: 'Asia/Seoul', utc_offset_seconds: 32400,
    current_units: { temperature_2m: '°C', precipitation: 'mm', wind_speed_10m: 'm/s' },
    current: { time: new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16), temperature_2m: 24.2, precipitation: 0, wind_speed_10m: 4.9, weather_code: 1 },
    daily_units: { temperature_2m_min: '°C', temperature_2m_max: '°C', precipitation_probability_max: '%', wind_speed_10m_max: 'm/s' },
    daily: {
      time: Array.from({ length: 7 }, (_, index) => new Date(Date.parse(today() + 'T00:00:00Z') + index * dayMs).toISOString().slice(0, 10)),
      temperature_2m_min: [16.6, 20.2, 21.3, 20, 19, 18, 18], temperature_2m_max: [24.2, 25, 28.6, 26, 24, 23, 24],
      precipitation_probability_max: [7, 2, 60, 30, 40, 50, 60], wind_speed_10m_max: [5.31, 4, 5, 6, 7, 8, 9], weather_code: [1, 1, 61, 3, 61, 63, 65],
    },
  };
}
function plannedSession() {
  let session = createTripSession(['hyeopjae']);
  for (const action of [{ type: 'region', region: '제주' }, { type: 'configure', days: 3, booked: true }, { type: 'build' }, { type: 'day', day: 2 }]) session = appendTrip(session, action);
  return session;
}
async function ask(text, session = createTripSession()) {
  const input = { protocolVersion: 1, requestId: 'weather-route-test', sessionId: 'weather-route-test', baseRevision: session.turns.at(-1).id, session, action: { type: 'message', text } };
  const response = await POST(new Request('http://localhost/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }));
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body.error));
  return body;
}

function mockCombinedItinerary(t, visits) {
  Object.assign(env, { RAG_ENABLED: 'true', RAG_BASE_URL: 'http://127.0.0.1:8765', RAG_API_KEY: 'test-only-weather-rag-token-32chars' });
  t.after(() => Object.assign(env, { RAG_ENABLED: 'false', RAG_BASE_URL: '', RAG_API_KEY: '' }));
  const results = visits.map(({ placeId }) => {
    const source = ragCatalog().find(item => item.placeId === placeId && item.sourceKind === 'curated-official-summary');
    assert.ok(source, `a current canonical source is required for ${placeId}`);
    return { ...source, evidenceId: `ev:weather:${placeId}`, sourceVersion: 'sha256:' + createHash('sha256').update(source.text).digest('hex') };
  });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.hostname === 'api.open-meteo.com') return Response.json(forecast());
    if (url.pathname === '/internal/rag/search') {
      const query = JSON.parse(init.body);
      return Response.json({ dataMode: 'curated-travel-data', indexVersion: 'idx:weather', embeddingModel: 'embedding:test', results: results.filter(result => query.allowedPlaceIds.includes(result.placeId)) });
    }
    if (url.pathname === '/internal/rag/validate') return Response.json({ valid: true });
    assert.equal(url.origin, 'http://127.0.0.1:3002');
    assert.equal(url.pathname, '/api/v1/prediction/weather-test');
    return Response.json({ json: { message: '현재 날씨는 999°C이며 풍속은 999m/s라고 forecasted.', actions: [
      { type: 'region', region: '제주' }, { type: 'configure', days: 3 }, { type: 'build', visits },
    ] } });
  });
  return calls;
}

test('standalone three-day weather uses verified units without a model and preserves the current trip', async t => {
  const session = plannedSession(), before = structuredClone(currentTrip(session));
  const calls = [];
  t.mock.method(globalThis, 'fetch', async input => {
    calls.push(String(input));
    assert.equal(new URL(String(input)).hostname, 'api.open-meteo.com', 'no model, RAG, or billed endpoint may be called');
    return Response.json(forecast());
  });
  const body = await ask('오늘부터 3일간 제주 날씨 알려줘. 기온, 강수확률, 바람을 알려주고 기존 일정은 그대로 유지해.', session);
  const turn = body.session.turns.at(-1), after = currentTrip(body.session);
  assert.equal(body.mode, 'local-action');
  assert.equal(turn.answerContext.weather.status, 'ready');
  assert.equal(turn.answerContext.weather.dates.length, 3);
  assert.equal(calls.length, 1);
  assert.match(body.message, /24\.2\s*°C/);
  assert.match(body.message, /4\.9\s*m\/s/);
  assert.match(body.message, /60\s*%/);
  assert.doesNotMatch(body.message, /forecasted|시속\s*\d+(?:\.\d+)?\s*m\b/);
  assert.deepEqual(after.plan, before.plan);
  assert.equal(after.activeDay, before.activeDay);
  assert.equal(after.days, 3);
  assert.equal(after.booked, true);
  assert.deepEqual(body.session.turns.slice(0, -1), JSON.parse(JSON.stringify(session.turns)));
});

test('weather service failure stays honest and never hands unverified measurements to a model', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async input => { calls++; assert.equal(new URL(String(input)).hostname, 'api.open-meteo.com'); return new Response('unavailable', { status: 503 }); });
  const body = await ask('제주 오늘 날씨 알려줘.');
  assert.equal(body.mode, 'local-action');
  assert.equal(body.session.turns.at(-1).answerContext.weather.status, 'unavailable');
  assert.equal(calls, 1);
  assert.doesNotMatch(body.message, /\d+(?:\.\d+)?\s*(?:°C|m\/s|%)/);
});

test('unsupported weather range is not silently reduced to today and makes no external request', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('must not call a service or model'); });
  const body = await ask('제주 오늘부터 8일 날씨 알려줘.');
  assert.equal(body.mode, 'local-action');
  assert.equal(body.session.turns.at(-1).answerContext.weather.status, 'unsupported-date');
  assert.doesNotMatch(body.message, /\d+(?:\.\d+)?\s*(?:°C|m\/s|%)/);
});

test('weather without a location asks for one instead of guessing Jeju or calling a model', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('must not call a service or model'); });
  const body = await ask('내일 날씨 어때?');
  assert.equal(body.mode, 'local-action');
  assert.equal(body.session.turns.at(-1).answerContext.weather.status, 'asked-location');
  assert.match(body.message, /지역|어디/);
});

test('a pure forecast bypasses malformed Ollama configuration without contacting a model', async t => {
  Object.assign(env, { CHAT_PROVIDER: 'ollama', OLLAMA_MODEL: 'qwen3:235b-cloud' });
  t.after(() => Object.assign(env, { CHAT_PROVIDER: 'flowise', OLLAMA_MODEL: '' }));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    calls++;
    assert.equal(new URL(String(input)).hostname, 'api.open-meteo.com');
    return Response.json(forecast());
  });
  const body = await ask('제주 오늘 날씨 알려줘.');
  assert.equal(body.mode, 'local-action');
  assert.equal(body.session.turns.at(-1).answerContext.weather.status, 'ready');
  assert.equal(calls, 1);
});

test('combined itinerary and forecast retain grounded visits and replace generated weather numbers with verified measurements', async t => {
  const visits = [
    { day: 1, placeId: 'hyeopjae' }, { day: 1, placeId: 'gotjawal' },
    { day: 2, placeId: 'hamdeok' }, { day: 2, placeId: 'bijarim' },
    { day: 3, placeId: 'sehwa' }, { day: 3, placeId: 'saryeoni' },
  ];
  const calls = mockCombinedItinerary(t, visits);
  const body = await ask('제주 2박 3일 일정 짜줘. 하루에 오전 오후 한 곳씩 넣고 식당 카페 숙소는 빼줘. 오늘 제주 날씨도 알려줘.');
  assert.equal(body.mode, 'flowise');
  assert.equal(body.session.turns.at(-1).answerContext.weather.status, 'ready');
  assert.deepEqual(currentTrip(body.session).plan.map(visit => ({ day: visit.day, placeId: visit.entityId })), visits);
  assert.match(body.message, /24\.2°C/);
  assert.match(body.message, /4\.9m\/s/);
  assert.doesNotMatch(body.message, /999|forecasted/);
  assert.equal(calls.filter(path => path === '/api/v1/prediction/weather-test').length, 1);
  assert.equal(calls.filter(path => path === '/internal/rag/validate').length, 2);
});

test('a combined weather reply preserves the deterministic explanation for an explicitly named full-day exception', async t => {
  const visits = [
    { day: 1, placeId: 'hyeopjae' }, { day: 1, placeId: 'gotjawal' },
    { day: 2, placeId: 'hamdeok' }, { day: 2, placeId: 'bijarim' },
    { day: 3, placeId: 'udo' },
  ];
  mockCombinedItinerary(t, visits);
  const body = await ask('제주 2박 3일 일정 짜줘. 하루에 오전 오후 한 곳씩 넣고 식당 카페 숙소는 빼줘. 우도는 꼭 포함해줘. 오늘 날씨도 알려줘.');
  assert.equal(body.mode, 'flowise');
  assert.equal(body.session.turns.at(-1).answerContext.weather.status, 'unsupported-location', 'Udo forecast remains unsupported rather than borrowing Jeju measurements');
  assert.equal(currentTrip(body.session).plan.filter(visit => visit.day === 3).length, 1);
  assert.match(body.message, /직접 지정한.*우도.*종일.*오전·오후 두 곳 대신 한 곳/);
  assert.equal(body.message.match(/직접 지정한/g).length, 1);
  assert.doesNotMatch(body.message, /999|forecasted/);
});

test('combined weather keeps one deterministic nearby-grouping explanation alongside verified measurements', async t => {
  const visits = [
    { day: 1, placeId: 'hyeopjae' }, { day: 1, placeId: 'hamdeok' },
    { day: 2, placeId: 'gotjawal' }, { day: 2, placeId: 'bijarim' },
    { day: 3, placeId: 'sehwa' }, { day: 3, placeId: 'saryeoni' },
  ];
  mockCombinedItinerary(t, visits);
  const body = await ask('제주 2박 3일 일정 짜줘. 가까운 장소끼리 같은 날로 묶어줘. 하루에 오전 오후 한 곳씩 넣고 식당 카페 숙소는 빼줘. 오늘 제주 날씨도 알려줘.');
  assert.ok(body.message.includes(NEARBY_GROUPING_NOTICE));
  assert.equal(body.message.split(NEARBY_GROUPING_NOTICE).length - 1, 1);
  assert.match(body.message, /24\.2°C/);
  assert.doesNotMatch(body.message, /999|forecasted/);
  assert.deepEqual(currentTrip(body.session).plan.map(visit => visit.entityId).sort(), visits.map(visit => visit.placeId).sort());
});


test('forecast follow-ups that preserve the recently created plan use only the deterministic weather path', async t => {
  const session = plannedSession(), before = structuredClone(currentTrip(session));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    calls++;
    assert.equal(new URL(String(input)).hostname, 'api.open-meteo.com', 'a preservation-only follow-up must not call a model or RAG');
    return Response.json(forecast());
  });
  for (const text of [
    '제주도 오늘부터 3일 날씨도 알려줘. 방금 만든 일정은 그대로 유지해줘.',
    '제주도 오늘부터 3일 날씨도 알려줘. 방금 짠 일정은 그대로 유지해줘.',
    '앞서 만든 일정은 그대로 두고 제주도 오늘부터 3일 날씨도 알려줘.',
  ]) {
    const body = await ask(text, session);
    const turn = body.session.turns.at(-1), after = currentTrip(body.session);
    assert.equal(body.mode, 'local-action');
    assert.equal(turn.source, 'local-action');
    assert.equal(turn.answerContext.weather.status, 'ready');
    assert.equal(turn.answerContext.weather.dates.length, 3);
    for (const date of turn.answerContext.weather.dates) assert.ok(body.message.includes(date + ' 예보:'), 'every selected date has a deterministic forecast row');
    assert.match(body.message, /24\.2°C/);
    assert.match(body.message, /4\.9m\/s/);
    assert.match(body.message, /60%/);
    assert.deepEqual(after.plan, before.plan);
    assert.equal(after.activeDay, before.activeDay);
    assert.equal(after.days, before.days);
    assert.equal(after.booked, before.booked);
    assert.deepEqual(body.session.turns.slice(0, -1), JSON.parse(JSON.stringify(session.turns)));
  }
  assert.equal(calls, 3);
});
