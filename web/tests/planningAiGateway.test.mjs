import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createPlanningAiHandler } from '../server/planningAiGateway.mjs';

const origin = 'http://127.0.0.1:5210';
const modelUrl = 'http://127.0.0.1:8120/v1/chat/completions';
const places = [
  { id: 'busan-coffee', name: '해변 커피', area: '부산 해운대', kind: 'CAFE', tags: ['바다'], lat: 35.1592, lng: 129.159 },
  { id: 'busan-park', name: '해안 공원', area: '부산 수영', kind: 'LANDMARK', lat: 35.15869, lng: 129.12071 },
  { id: 'private-hotel', name: '개인 여행 기록의 숙소', area: '부산', kind: 'STAY', personal: true },
];

const response = (output, finish_reason = 'stop') => Response.json({ choices: [{ finish_reason, message: { content: JSON.stringify(output) } }] });
const prompt = '가족과 부산 바닷가에서 이틀 보내고 싶어요.';
const placeRequest = { schemaVersion: 1, feature: 'PLACE_SEARCH', requestId: 'place-test', region: '부산', prompt, eligiblePlaceIds: ['busan-park', 'busan-coffee'] };
const groupRequest = { schemaVersion: 1, feature: 'GROUP_DRAFT', requestId: 'group-test', region: '부산', prompt: '해변 사진 모임을 열고 싶어요.', topics: ['PHOTO', 'OUTDOOR'] };
const tripRequest = {
  schemaVersion: 1, feature: 'TRIP_DRAFT', requestId: 'trip-test', dayCount: 2, region: '부산', prompt,
  eligiblePlaceIds: ['busan-coffee', 'busan-park'],
  conditions: { purpose: 'TRIP', topics: ['FAMILY', 'WALK'], people: 4, transport: 'WALK', budgetPerPerson: 100_000, walkingLimitMinutes: 60, notes: '카페와 바다 산책' },
};

async function serve(t, mockModel, options = {}) {
  const calls = [];
  const handler = createPlanningAiHandler({
    catalog: places, modelUrl, allowedOrigin: origin, apiKey: 'server-test-token', ...options,
    fetchImpl: async (url, init) => { const body = JSON.parse(init.body); calls.push({ url, init, body }); return mockModel(body, init.signal); },
  });
  const server = createServer(async (request, reply) => {
    if (!(await handler(request, reply))) reply.writeHead(404).end();
  });
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    calls, url,
    post: (body, headers = {}) => fetch(`${url}/api/planning-ai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body),
    }),
  };
}

test('place search uses only canonical public catalog data and translates model references in order', async t => {
  const app = await serve(t, model => {
    const data = JSON.parse(model.messages[1].content);
    assert.deepEqual(data, {
      region: '부산', prompt,
      places: [
        { ref: 1, name: '해안 공원', kind: 'LANDMARK', area: '부산 수영' },
        { ref: 2, name: '해변 커피', kind: 'CAFE', area: '부산 해운대', tags: ['바다'] },
      ],
    });
    return response({ refs: [2, 1], placeIds: ['not-allowed'] });
  });
  const result = await app.post({ ...placeRequest, eligiblePlaceIds: [...placeRequest.eligiblePlaceIds, 'private-hotel', 'invented'], places: [{ name: '무시할 이름' }], userId: 'private-test' });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await result.json(), {
    schemaVersion: 1, requestId: 'place-test', feature: 'PLACE_SEARCH', source: 'LLM', status: 'READY',
    result: { placeIds: ['busan-coffee', 'busan-park'] },
  });
  assert.equal(app.calls.length, 1);
  const [{ url, init, body }] = app.calls;
  assert.equal(url, modelUrl);
  assert.equal(init.redirect, 'error');
  assert.equal(init.headers.Authorization, 'Bearer server-test-token');
  assert.equal(body.model, 'spotlog-local');
  assert.equal(body.chat_template_kwargs.enable_thinking, false);
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.schema.properties.refs.items.maximum, 2);
});

test('group model can propose copy but cannot control member access, publishing, or attendance', async t => {
  const app = await serve(t, ({ messages }) => {
    const data = JSON.parse(messages[1].content);
    assert.deepEqual(data, { prompt: groupRequest.prompt, region: '부산', topics: ['PHOTO', 'OUTDOOR'] });
    return response({ name: '부산 바다 사진', introduction: '주말에 해변에서 사진을 찍어요.', welcome: '', joinGuide: '관심 분야를 남겨주세요.', firstActivityIdea: '카메라를 들고 해변 산책', joinMode: 'DIRECT', visibility: 'PUBLIC' });
  });
  const result = await app.post({ ...groupRequest, memberIds: ['secret-id'], role: 'OWNER' });
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).result, {
    name: '부산 바다 사진', introduction: '주말에 해변에서 사진을 찍어요.', joinGuide: '관심 분야를 남겨주세요.', firstActivityIdea: '카메라를 들고 해변 산책',
  });
});

test('trip returns exact numbered days with current place IDs and preserves model visit order', async t => {
  const app = await serve(t, ({ messages }) => {
    const data = JSON.parse(messages[1].content);
    assert.deepEqual(data.conditions, tripRequest.conditions);
    assert.equal(data.dayCount, 2);
    assert.deepEqual(data.places[0].position, [35.159, 129.159]);
    return response({ title: '부산 바다 산책 2일', days: [[2], [1]], route: { unsafe: true } });
  });
  const result = await app.post(tripRequest);
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).result, {
    title: '부산 바다 산책 2일',
    days: [{ day: 1, placeIds: ['busan-park'] }, { day: 2, placeIds: ['busan-coffee'] }],
  });
});

test('invalid or unpublished browser requests never call the model', async t => {
  const app = await serve(t, () => assert.fail('Model must not be called'));
  assert.equal((await fetch(`${app.url}/healthz`)).status, 404);
  assert.equal((await fetch(`${app.url}/api/planning-ai`)).status, 405);
  assert.equal((await app.post(groupRequest, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await app.post(groupRequest, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await app.post({ ...groupRequest, topics: ['NOT_A_TOPIC'] })).status, 400);
  assert.equal((await app.post({ ...groupRequest, prompt: 'x'.repeat(17_000) })).status, 413);
  assert.equal((await app.post({ ...tripRequest, dayCount: 9 })).status, 400);
  assert.equal((await app.post({ ...tripRequest, conditions: { ...tripRequest.conditions, transport: 'UNKNOWN' } })).status, 400);
  assert.equal((await app.post({ ...placeRequest, eligiblePlaceIds: ['busan-park', 'busan-park'] })).status, 400);
  assert.equal((await app.post({ ...placeRequest, eligiblePlaceIds: ['private-hotel', 'published-but-withdrawn'] })).status, 422);
  assert.equal(app.calls.length, 0);
});

test('invalid model references, content truncation and wrong DAY counts fail closed', async t => {
  const outputs = [
    response({ refs: [3] }), response({ refs: [1] }, 'length'),
    response({ title: '장소 범위 오류', days: [[3], [1]] }), response({ title: '하루 누락', days: [[1]] }),
  ];
  const app = await serve(t, () => outputs.shift());
  for (const request of [placeRequest, placeRequest, tripRequest, tripRequest]) {
    const result = await app.post(request);
    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), { error: 'INVALID_MODEL_RESULT' });
  }
});

test('a repeated travel place is retained once and an empty day asks the model again with only unused public places', async t => {
  let turn = 0;
  const app = await serve(t, body => {
    const data = JSON.parse(body.messages[1].content);
    const daysSchema = body.response_format.json_schema.schema.properties.days;
    assert.equal(daysSchema.minItems, data.dayCount);
    assert.equal(daysSchema.maxItems, data.dayCount);
    if (++turn === 1) return response({ title: '부산 산책', days: [[1, 1, 1], [1, 1]] });
    assert.equal(data.dayCount, 1);
    assert.deepEqual(data.places.map(place => place.name), ['해안 공원']);
    return response({ title: '공원', days: [[1]] });
  });
  const result = await app.post(tripRequest);
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).result, {
    title: '부산 산책', days: [{ day: 1, placeIds: ['busan-coffee'] }, { day: 2, placeIds: ['busan-park'] }],
  });
  assert.equal(app.calls.length, 2);
});

test('a model that suggests unconfirmed group joining requirements leaves the app default guidance in place', async t => {
  const app = await serve(t, () => response({
    name: '부산 독립영화 모임', introduction: '매달 함께 감상해요.', joinGuide: '참가 전에 예약이나 승인이 필요해요.',
  }));
  const result = await app.post(groupRequest);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).result.joinGuide, undefined);
});

test('only a real model response can supply an insufficient-data result', async t => {
  const app = await serve(t, () => response({ refs: [] }));
  const result = await app.post(placeRequest);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { schemaVersion: 1, requestId: 'place-test', feature: 'PLACE_SEARCH', source: 'LLM', status: 'INSUFFICIENT_DATA' });
});

test('model timeout responds without partial data and releases its concurrency slot', async t => {
  let attempts = 0;
  const app = await serve(t, (_request, signal) => ++attempts > 1 ? response({ refs: [1] }) : new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }), { timeoutMs: 100 });
  const result = await app.post(placeRequest);
  assert.equal(result.status, 504);
  assert.deepEqual(await result.json(), { error: 'MODEL_TIMEOUT' });
  assert.equal((await app.post(placeRequest)).status, 200);
});

for (const [purpose, prompt, expected] of [
  ['MEETUP','해운대에서 식사하고 카페에 가요.',['food-one','coffee']],
  ['MEETUP','해운대에서 점심과 저녁을 먹고 카페에 가요.',['food-one','coffee','food-two']],
  ['TRIP','해운대에서 맛집 여행을 해요.',['food-one','coffee','food-two','food-three']],
]) test(`${purpose}: a simple meal and coffee is concise while explicitly requested meals and travel stay distinct`,async t=>{
  const catalog=[['food-one','FOOD'],['coffee','CAFE'],['food-two','FOOD'],['food-three','FOOD']].map(([id,kind])=>({id,kind,name:id,area:'부산 해운대'}));
  const app=await serve(t,()=>response({title:'해운대 식사와 카페',days:[[1,2,3,4]]}),{catalog});
  const result=await app.post({...tripRequest,prompt,dayCount:1,eligiblePlaceIds:catalog.map(place=>place.id),conditions:{...tripRequest.conditions,purpose}});
  assert.equal(result.status,200);
  assert.deepEqual((await result.json()).result.days,[{day:1,placeIds:expected}]);
});
