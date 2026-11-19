import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createPlanningAiHandler } from '../server/planningAiGateway.mjs';

const origin = 'http://127.0.0.1:5210';
const modelUrl = 'http://127.0.0.1:8120/v1/chat/completions';
const catalog = [{ id: 'public-place', name: '공개 장소', area: '부산', kind: 'CAFE' }];
const scope = { userId: 'account-self', groupId: 'book-group', roomId: 'activity:book-night' };
const request = () => ({ schemaVersion: 1, requestId: 'chat-summary-test', feature: 'CHAT_SUMMARY', scope: { ...scope },
  payload: { purpose: 'KEY_POINTS', filters: { scope: 'all' }, cutoff: '2026-11-19T05:00:00.000Z', sources: [
    { id: 'original-a', authorId: 'person-private-a', roomId: scope.roomId, body: '두 시에 정문에서 만나요.', createdAt: '2026-11-19T04:00:00.000Z', introduction: 'private-member-bio' },
    { id: 'original-b', authorId: 'person-private-b', roomId: scope.roomId, body: '우산을 챙겨 주세요.', createdAt: '2026-11-19T04:01:00.000Z' },
  ] },
});
const output = () => ({ title: '약속과 준비', sections: [
  { kind: 'TIME_PLACE', items: [{ text: '두 시에 정문에서 만나요.', refs: [1] }] },
  { kind: 'PREPARATION', items: [{ text: '우산을 준비해요.', refs: [2, 2] }] },
] });
const response = (value, finish_reason = 'stop') => Response.json({ choices: [{ finish_reason, message: { content: JSON.stringify(value) } }] });

async function serve(t, mockModel, options = {}) {
  const calls = [];
  const handler = createPlanningAiHandler({ catalog, modelUrl, allowedOrigin: origin, apiKey: 'local-server-token',
    enableLocalChatSummary: true, ...options,
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body); calls.push({ url, init, body });
      return mockModel(body, init.signal);
    },
  });
  const server = createServer(async (request, reply) => {
    if (!(await handler(request, reply))) reply.writeHead(404).end();
  });
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, calls, post: (body = request(), headers = {}) => fetch(`${url}/api/chat-ai`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body),
  }) };
}

test('chat summaries remain unavailable unless explicitly enabled, including on the planning route', async t => {
  const app = await serve(t, () => assert.fail('disabled chat summary must never call a model'), { enableLocalChatSummary: false });
  assert.equal((await app.post()).status, 404);
  const result = await fetch(`${app.url}/api/planning-ai`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(request()) });
  assert.equal(result.status, 400);
  assert.equal(app.calls.length, 0);
});

test('explicit loopback opt-in summarizes selected originals with numbered pseudonyms and echoes the exact request scope', async t => {
  const app = await serve(t, ({ messages }) => {
    const data = JSON.parse(messages[1].content);
    assert.deepEqual(data, { purpose: 'KEY_POINTS', cutoff: '2026-11-19T05:00:00.000Z', sources: [
      { ref: 2, speaker: 'p2', at: '2026-11-19T04:01:00.000Z', body: '우산을 챙겨 주세요.' },
      { ref: 1, speaker: 'p1', at: '2026-11-19T04:00:00.000Z', body: '두 시에 정문에서 만나요.' },
    ] });
    for (const privateValue of ['account-self', 'book-group', 'book-night', 'person-private-a', 'person-private-b', 'original-a', 'original-b', 'private-member-bio']) {
      assert.equal(JSON.stringify(messages).includes(privateValue), false, privateValue);
    }
    return response({ ...output(), memberIds: ['invented'], scope: { userId: 'wrong-account' } });
  });
  const result = await app.post();
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(await result.json(), { schemaVersion: 1, requestId: 'chat-summary-test', scope, output: {
    title: '약속과 준비', sections: [
      { kind: 'TIME_PLACE', heading: '시간·집결 위치', items: [{ text: '두 시에 정문에서 만나요.', sourceIds: ['original-a'] }] },
      { kind: 'PREPARATION', heading: '준비할 일', items: [{ text: '우산을 준비해요.', sourceIds: ['original-b'] }] },
    ],
  } });
  assert.equal(app.calls.length, 1);
  const call = app.calls[0];
  assert.equal(call.url, modelUrl);
  assert.equal(call.init.redirect, 'error');
  assert.equal(call.init.headers.Authorization, 'Bearer local-server-token');
  assert.equal(call.body.response_format.json_schema.name, 'chat_summary');
  assert.equal(call.body.response_format.json_schema.strict, true);
});

test('the opt-in cannot be configured for a hosted or missing development origin or a nonlocal HTTP model', () => {
  for (const allowedOrigin of [undefined, 'https://giry02.github.io', 'http://192.168.0.12:5210', 'https://127.0.0.1.example.com']) {
    assert.throws(() => createPlanningAiHandler({ catalog, modelUrl, allowedOrigin, enableLocalChatSummary: true }), /loopback development origin/);
  }
  assert.throws(() => createPlanningAiHandler({ catalog, modelUrl: 'http://192.168.0.12:8120/v1/chat/completions', allowedOrigin: origin, enableLocalChatSummary: true }), /trusted HTTPS or loopback/);
  assert.doesNotThrow(() => createPlanningAiHandler({ catalog, modelUrl, allowedOrigin: 'http://localhost:5210', enableLocalChatSummary: true }));
});

test('other origins, non-JSON content, malformed JSON and non-POST methods fail before inference', async t => {
  const app = await serve(t, () => assert.fail('invalid request must never call a model'));
  const method = await fetch(`${app.url}/api/chat-ai`);
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'POST');
  for (const other of ['https://other.example', 'null', 'http://127.0.0.1:5210.evil.example']) assert.equal((await app.post(request(), { Origin: other })).status, 403);
  assert.equal((await app.post(request(), { 'Content-Type': 'text/plain' })).status, 415);
  const malformed = await fetch(`${app.url}/api/chat-ai`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: '{invalid' });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: 'INVALID_JSON' });
  assert.equal(app.calls.length, 0);
});

test('cross-room, future, duplicate and excessive ranges return a request error without sending partial originals', async t => {
  const app = await serve(t, () => assert.fail('invalid originals must never be sent'));
  for (const mutate of [
    body => { body.payload.sources[0].roomId = 'activity:different-room'; },
    body => { body.payload.sources[0].createdAt = '2026-11-19T05:00:00.001Z'; },
    body => { body.payload.sources[0].id = body.payload.sources[1].id; },
    body => { body.scope.roomId = 'group:not-the-current-group'; },
  ]) { const body = request(); mutate(body); assert.equal((await app.post(body)).status, 400); }
  const excessive = request();
  excessive.payload.sources = Array.from({ length: 81 }, (_, index) => ({ ...request().payload.sources[0], id: 'source-' + index }));
  const tooMany = await app.post(excessive);
  assert.equal(tooMany.status, 413);
  assert.deepEqual(await tooMany.json(), { error: 'CHAT_RANGE_TOO_LARGE' });
  const bytes = await app.post({ ...request(), ignored: 'x'.repeat(101_000) });
  assert.equal(bytes.status, 413);
  assert.equal(app.calls.length, 0);
});

test('model references to missing messages, metadata, or truncated output fail closed', async t => {
  const invalidOutputs = [
    response({ title: '잘못된 인용', sections: [{ kind: 'TIME_PLACE', items: [{ text: '없는 원문', refs: [3] }] }] }),
    response({ title: '잘못된 인용', sections: [{ kind: 'TIME_PLACE', items: [{ text: '없는 원문', refs: ['original-a'] }] }] }),
    response({ title: '원문 누락', sections: [{ kind: 'TIME_PLACE', items: [{ text: '원문 없음', refs: [] }] }] }),
    response(output(), 'length'),
  ];
  const app = await serve(t, () => invalidOutputs.shift());
  for (let index = 0; index < 4; index++) {
    const result = await app.post();
    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), { error: 'INVALID_MODEL_RESULT' });
  }
});

test('local summary timeouts leave no partial result and release the next request slot', async t => {
  let attempts = 0;
  const app = await serve(t, (_body, signal) => ++attempts > 1 ? response(output()) : new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }), { timeoutMs: 50 });
  const timedOut = await app.post();
  assert.equal(timedOut.status, 504);
  assert.deepEqual(await timedOut.json(), { error: 'MODEL_TIMEOUT' });
  assert.equal((await app.post()).status, 200);
});
