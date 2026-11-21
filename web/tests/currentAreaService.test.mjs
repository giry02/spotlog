import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireCurrentArea, currentAreaFromResponse, CurrentAreaError, CURRENT_AREA_CONSENT_VERSION, CURRENT_AREA_ENDPOINT } from '../src/currentAreaService.ts';

const consent = { accepted: true, purpose: 'GROUP_NEARBY', version: CURRENT_AREA_CONSENT_VERSION };
const position = (accuracy = 30) => ({ coords: { latitude: 37.45, longitude: 126.68, accuracy }, timestamp: Date.now() });
const incheon = extra => ({ countryCode: 'KR', lookupSource: 'reverseGeocoding', principalSubdivision: '인천광역시', principalSubdivisionCode: 'KR-28', city: '인천광역시', locality: '주안동',
  localityInfo: { administrative: [{ order: 1, name: '대한민국' }, { order: 2, name: '인천광역시' }, { order: 3, name: '미추홀구' }, { order: 4, name: '주안동' }] }, ...extra });
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
function environment(extra = {}) {
  const calls = { geo: [], fetch: [] };
  return { calls, options: { consent, secureContext: true, online: true,
    geolocation: { getCurrentPosition: (success, _failure, options) => { calls.geo.push(options); success(position()); } },
    fetch: async (url, options) => { calls.fetch.push({ url, options }); return json(incheon()); }, ...extra } };
}
const code = expected => error => error instanceof CurrentAreaError && error.code === expected && !/https?:|37\.45|126\.68/.test(error.message);

test('consent, a secure page and online foreground geolocation are prerequisites, never implicit IP requests', async () => {
  for (const extra of [{ consent: null }, { consent: { ...consent, version: 'old' } }, { consent: { ...consent, purpose: 'OTHER' } }]) {
    const env = environment(extra);
    await assert.rejects(acquireCurrentArea(env.options), code('CONSENT_REQUIRED'));
    assert.equal(env.calls.geo.length, 0); assert.equal(env.calls.fetch.length, 0);
  }
  for (const [extra, expected] of [[{ secureContext: false }, 'UNSUPPORTED'], [{ online: false }, 'OFFLINE'], [{ endpoint: '/api/reverse-proxy' }, 'UNSUPPORTED'], [{ endpoint: 'https://unapproved.example/reverse' }, 'UNSUPPORTED']]) {
    const env = environment(extra);
    await assert.rejects(acquireCurrentArea(env.options), code(expected));
    assert.equal(env.calls.geo.length, 0); assert.equal(env.calls.fetch.length, 0);
  }
});

test('one current device lookup sends only fresh GPS to the browser provider and returns area names without raw address or coordinates', async () => {
  const env = environment();
  const result = await acquireCurrentArea(env.options);
  assert.equal(env.calls.geo.length, 1); assert.equal(env.calls.fetch.length, 1);
  assert.deepEqual(env.calls.geo[0], { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
  const request = env.calls.fetch[0], url = new URL(request.url);
  assert.equal(url.origin + url.pathname, CURRENT_AREA_ENDPOINT);
  assert.deepEqual([...url.searchParams.keys()].sort(), ['latitude', 'localityLanguage', 'longitude']);
  assert.equal(url.searchParams.get('latitude'), '37.45'); assert.equal(url.searchParams.get('longitude'), '126.68'); assert.equal(url.searchParams.get('localityLanguage'), 'ko');
  for (const [key, expected] of Object.entries({ method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' })) assert.equal(request.options[key], expected);
  assert.equal(result.region, '인천'); assert.equal(result.district, '미추홀구'); assert.equal(result.neighborhood, '주안동');
  assert.equal(result.needsReview, true); assert.equal(result.precision, 'NEIGHBORHOOD');
  assert.equal('latitude' in result || 'longitude' in result || 'lat' in result || 'lng' in result || 'timestamp' in result || 'display_name' in result || 'postcode' in result, false);
});

test('province city and nested ward are retained, Sejong omits a nonexistent ward and region-only results stay coarse', () => {
  const nested = currentAreaFromResponse(incheon({ principalSubdivision: '경기도', principalSubdivisionCode: 'KR-41', city: '성남시', locality: '판교동', localityInfo: { administrative: [{ name: '경기도', order: 1 }, { name: '성남시', order: 2 }, { name: '분당구', order: 3 }, { name: '판교동', order: 4 }] } }), 20);
  assert.equal(nested.region, '경기'); assert.equal(nested.district, '성남시 분당구'); assert.equal(nested.neighborhood, '판교동');
  const sejong = currentAreaFromResponse(incheon({ principalSubdivision: '세종특별자치시', principalSubdivisionCode: 'KR-50', city: '세종특별자치시', locality: '고운동', localityInfo: { administrative: [] } }), 20);
  assert.equal(sejong.region, '세종'); assert.equal(sejong.district, ''); assert.equal(sejong.neighborhood, '고운동');
  const coarse = currentAreaFromResponse(incheon({ city: '인천광역시', locality: '미추홀구', localityInfo: { administrative: [] } }), 20);
  assert.equal(coarse.district, '미추홀구'); assert.equal(coarse.neighborhood, undefined); assert.equal(coarse.precision, 'DISTRICT');
  const onlyCity = currentAreaFromResponse(incheon({ locality: '', localityInfo: { administrative: [] }, display_name: '인천 미추홀구 주안동 123-4', road: '상세 도로명' }), 20);
  assert.equal(onlyCity.district, ''); assert.equal(onlyCity.neighborhood, undefined); assert.equal(onlyCity.precision, 'REGION');
  const shortWard = currentAreaFromResponse(incheon({ principalSubdivision: '부산광역시', principalSubdivisionCode: 'KR-26', city: '부산광역시', locality: '중앙동', localityInfo: { administrative: [{ name: '부산광역시' }, { name: '중구' }, { name: '중앙동' }] } }), 20);
  assert.equal(shortWard.region, '부산'); assert.equal(shortWard.district, '중구'); assert.equal(shortWard.neighborhood, '중앙동');
  const shortTown = currentAreaFromResponse(incheon({ principalSubdivision: '경기도', principalSubdivisionCode: 'KR-41', city: '안산시', locality: '이동', localityInfo: { administrative: [{ name: '안산시' }, { name: '상록구' }, { name: '이동' }] } }), 20);
  assert.equal(shortTown.district, '안산시 상록구'); assert.equal(shortTown.neighborhood, '이동');
});

test('inaccurate GPS never returns a guessed town, and foreign or IP-only results are rejected', async () => {
  const coarse = currentAreaFromResponse(incheon(), 1500);
  assert.equal(coarse.neighborhood, undefined); assert.equal(coarse.district, '미추홀구');
  assert.throws(() => currentAreaFromResponse(incheon(), 10001), code('INACCURATE'));
  assert.throws(() => currentAreaFromResponse(incheon({ lookupSource: 'ipGeolocation' }), 10), code('INACCURATE'));
  assert.throws(() => currentAreaFromResponse(incheon({ lookupSource: '' }), 10), code('INACCURATE'));
  assert.throws(() => currentAreaFromResponse(incheon({ countryCode: 'JP' }), 10), code('UNSUPPORTED_COUNTRY'));
  assert.throws(() => currentAreaFromResponse(incheon({ principalSubdivisionCode: 'KR-26' }), 10), code('INVALID_RESPONSE'));
  const missingWard = currentAreaFromResponse(incheon({ localityInfo: { administrative: [] } }), 10);
  assert.equal(missingWard.neighborhood, undefined); assert.equal(missingWard.district, '');
  const env = environment({ geolocation: { getCurrentPosition: success => success(position(15000)) } });
  await assert.rejects(acquireCurrentArea(env.options), code('INACCURATE')); assert.equal(env.calls.fetch.length, 0);
});

test('permission denial, unavailable GPS and GPS timeout do not call a reverse lookup or leak adapter errors', async () => {
  for (const [geoCode, expected] of [[1, 'DENIED'], [2, 'UNAVAILABLE'], [3, 'TIMEOUT']]) {
    const env = environment({ geolocation: { getCurrentPosition: (_success, failure) => failure({ code: geoCode, message: 'sensitive adapter details' }) } });
    await assert.rejects(acquireCurrentArea(env.options), code(expected)); assert.equal(env.calls.fetch.length, 0);
  }
  const env = environment({ geolocation: { getCurrentPosition: () => { throw new Error('sensitive adapter details'); } } });
  await assert.rejects(acquireCurrentArea(env.options), code('UNAVAILABLE')); assert.equal(env.calls.fetch.length, 0);
});

test('closing during GPS ignores a late result and performs no HTTP request', async () => {
  let succeed;
  const controller = new AbortController();
  const env = environment({ signal: controller.signal, geolocation: { getCurrentPosition: success => { succeed = success; } } });
  const pending = acquireCurrentArea(env.options); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  succeed(position()); await Promise.resolve();
  assert.equal(env.calls.fetch.length, 0);
});

test('closing during an abort-ignoring fetch or body read settles immediately and cannot apply late data', async () => {
  for (const stage of ['fetch', 'body']) {
    const controller = new AbortController(); let finish, started;
    const ready = new Promise(resolve => { started = resolve; });
    const blocked = new Promise(resolve => { finish = resolve; });
    const env = environment({ signal: controller.signal, fetch: async () => {
      if (stage === 'fetch') { started(); return blocked; }
      return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), text: () => { started(); return blocked; } };
    } });
    const pending = acquireCurrentArea(env.options); await ready; controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    finish(stage === 'fetch' ? json(incheon()) : JSON.stringify(incheon())); await Promise.resolve();
  }
});

test('HTTP, invalid JSON, oversized and nonadministrative provider errors retain a safe manual-selection message', async () => {
  for (const [response, expected] of [[new Response('provider confidential message', { status: 402 }), 'REVERSE_UNAVAILABLE'], [new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } }), 'INVALID_RESPONSE'], [new Response('{', { headers: { 'content-type': 'application/json' } }), 'INVALID_RESPONSE'], [new Response('x'.repeat(64001), { headers: { 'content-type': 'application/json' } }), 'INVALID_RESPONSE']]) {
    const env = environment({ fetch: async () => response });
    await assert.rejects(acquireCurrentArea(env.options), code(expected));
  }
  assert.throws(() => currentAreaFromResponse(incheon({ localityInfo: { administrative: Array.from({ length: 41 }, () => ({ name: '동' })) } }), 30), code('INVALID_RESPONSE'));
});
