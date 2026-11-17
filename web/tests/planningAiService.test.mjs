import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuredPlanningAiEndpoint, requestGroupDraftAi, requestPlaceAi, requestTripDraftAi } from '../src/planningAiService.ts';

const endpoint = '/api/planning-ai';
const brief = { prompt: '부산에서 친구들과 가볍게 여행하고 싶어요', region: '부산', purpose: 'TRIP', transport: 'PUBLIC', topics: ['TRAVEL'], notes: '', dayCount: 2 };
const place = { prompt: '부산 카페를 찾고 싶어요', region: '부산', eligiblePlaceIds: ['cafe-1', 'cafe-2'] };
const respond = (request, result, fields = {}) => Response.json({ schemaVersion: 1, requestId: request.requestId, feature: request.feature, source: 'LLM', status: 'READY', result, ...fields });

test('unconfigured and off-origin URLs do not issue a request', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network'); });
  for (const path of ['', '//example.test/api/ai', 'https://example.test/api/ai', '/api/../admin', '/api/ai?key=fake', '/api/ai%2F', '/api\\ai']) {
    assert.equal(configuredPlanningAiEndpoint(path), '');
    await assert.rejects(requestPlaceAi(path, place), /연결/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('place AI sends only explicit input and bounded public IDs, then accepts correlated ordered results', async t => {
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, endpoint);
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), ['eligiblePlaceIds','feature','prompt','region','requestId','schemaVersion']);
    assert.equal(body.feature, 'PLACE_SEARCH');
    assert.deepEqual(body.eligiblePlaceIds, place.eligiblePlaceIds);
    return respond(body, { placeIds: ['cafe-2', 'cafe-1'] });
  });
  assert.deepEqual(await requestPlaceAi(endpoint, place), { placeIds: ['cafe-2', 'cafe-1'] });
});

test('rejects unknown or duplicate result IDs and a mismatched request; distinguishes no result', async t => {
  let result = { placeIds: ['withdrawn'] };
  let metadata = {};
  t.mock.method(globalThis, 'fetch', async (_path, options) => respond(JSON.parse(options.body), result, metadata));
  await assert.rejects(requestPlaceAi(endpoint, place), /등록된 장소/);
  result = { placeIds: ['cafe-1', 'cafe-1'] };
  await assert.rejects(requestPlaceAi(endpoint, place), /등록된 장소/);
  metadata = { requestId: 'older-request' };
  await assert.rejects(requestPlaceAi(endpoint, place), /지금 요청한/);
  metadata = { status: 'INSUFFICIENT_DATA' };
  assert.deepEqual(await requestPlaceAi(endpoint, place), { placeIds: [] });
});

test('group proposal only carries editable text and no model-supplied access fields', async t => {
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.feature, 'GROUP_DRAFT');
    assert.equal(Object.hasOwn(body, 'eligiblePlaceIds'), false);
    return respond(body, { name: ' 부산 골목 모임 ', introduction: '골목을 함께 걸어요.', firstActivityIdea: '첫 산책 후보를 이야기해요.', region: '외부', visibility: 'PUBLIC', memberIds: ['unknown'], joinMode: 'APPROVAL' });
  });
  assert.deepEqual(await requestGroupDraftAi(endpoint, brief, new AbortController().signal), { name: '부산 골목 모임', introduction: '골목을 함께 걸어요.', firstActivityIdea: '첫 산책 후보를 이야기해요.' });
});

test('trip response requires exact DAY sequence and only unique eligible stops', async t => {
  let days = [{ day: 1, placeIds: ['p1'] }, { day: 2, placeIds: ['p2'] }];
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.feature, 'TRIP_DRAFT');
    assert.equal(body.dayCount, 2);
    return respond(body, { title: '부산 여행 초안', days });
  });
  const request = () => requestTripDraftAi(endpoint, brief, 2, ['p1','p2'], new AbortController().signal);
  assert.deepEqual(await request(), { title: '부산 여행 초안', days });
  days = [{ day: 1, placeIds: ['p1'] }]; await assert.rejects(request(), /DAY 수/);
  days = [{ day: 2, placeIds: ['p1'] }, { day: 1, placeIds: ['p2'] }]; await assert.rejects(request(), /DAY 순서/);
  days = [{ day: 1, placeIds: ['p1'] }, { day: 2, placeIds: ['p1'] }]; await assert.rejects(request(), /장소 순서/);
});

test('cancellation prevents an adapter that ignores its abort signal from applying late output', async t => {
  let finish;
  let started;
  const observed = new Promise(resolve => { started = resolve; });
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    started();
    return new Promise(resolve => { finish = () => resolve(respond(JSON.parse(options.body), { placeIds: ['cafe-1'] })); });
  });
  const controller = new AbortController();
  const pending = requestPlaceAi(endpoint, place, controller.signal);
  await observed;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  finish();
});
