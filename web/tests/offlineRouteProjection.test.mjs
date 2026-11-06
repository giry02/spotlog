import test from 'node:test';
import assert from 'node:assert/strict';
import { projectOfflineRoute } from '../src/offlineRouteProjection.ts';
import { draftPolicies, policyDocument } from '../src/accountPolicies.ts';
import { canUseCurrentLocation, requestCurrentLocation } from '../src/locationConsent.ts';

const place = (id, lat = 35.1587, lng = 129.1604, extra = {}) => ({ id, visitId: `visit-${id}`, kind: 'LANDMARK', name: id, area: '부산', address: '부산', lat, lng, image: '', description: '', note: '', duration: '1시간', ...extra });
const approved = () => ({ ...structuredClone(draftPolicies), status: 'PUBLISHED', locationEnabled: true, operator: { name: '시험 운영자', address: '시험 주소', email: 'qa@example.invalid' }, documents: draftPolicies.documents.map(doc => ({ ...doc, version: 'offline-fixture-1' })) });
const consent = bundle => ({ accepted: true, purpose: 'OFFLINE_ROUTE_DISPLAY', version: policyDocument(bundle, 'location').version });

test('coordinate diagram preserves visit identity, original ordinal and source data', () => {
  const route = [place('same', 35, 129, { visitId: 'lunch' }), place('unknown', 35.1, 129.1, { locationVerified: false }), place('same', 35, 129, { visitId: 'dinner' })];
  const before = structuredClone(route), view = projectOfflineRoute(route);
  assert.deepEqual(view.points.map(point => [point.key, point.number]), [['lunch', 1], ['dinner', 3]]);
  assert.deepEqual(view.missing.map(point => point.number), [2]);
  assert.deepEqual(view.segments, []); assert.equal(view.straightDistanceKm, 0);
  assert.notEqual(view.points[0].labelX, view.points[1].labelX);
  assert.deepEqual(route, before);
});
test('single, repeated, pole, antimeridian and invalid coordinates remain finite', () => {
  for (const input of [[place('single')], [place('a'), place('b')], [place('a', 90, 10), place('b', 89.9, 20)], [place('a', 1, 179.9), place('b', 1, -179.9)]]) {
    const view = projectOfflineRoute(input);
    assert.equal(view.points.length, input.length);
    for (const point of view.points) for (const field of ['x', 'y', 'labelX', 'labelY']) assert.ok(Number.isFinite(point[field]));
    assert.ok(view.straightDistanceKm >= 0 && Number.isFinite(view.straightDistanceKm));
  }
  assert.ok(projectOfflineRoute([place('a', 1, 179.9), place('b', 1, -179.9)]).straightDistanceKm < 25);
  const invalid = [place('nan', NaN), place('range', 91), place('longitude', 35, 181), place('unverified', 35, 129, { locationVerified: false })];
  const view = projectOfflineRoute(invalid);
  assert.equal(view.points.length, 0); assert.equal(view.missing.length, 4); assert.equal(view.project({ lat: 35, lng: 129 }), null);
});
test('only adjacent known visits form straight segments; distant GPS never changes route bounds', () => {
  const route = [place('a', 35, 129), place('b', 35.01, 129.01), place('invalid', NaN), place('d', 35.03, 129.03)];
  const view = projectOfflineRoute(route);
  assert.deepEqual(view.segments.map(([from, to]) => [from.number, to.number]), [[1, 2]]);
  const original = view.points.map(point => [point.x, point.y]);
  assert.equal(view.project({ lat: 60, lng: -100 }).within, false);
  assert.equal(view.project({ lat: NaN, lng: 129 }), null);
  assert.deepEqual(view.points.map(point => [point.x, point.y]), original);
});
test('nine repeated visits keep independent touch targets at a 320px mobile shell', () => {
  const view = projectOfflineRoute(Array.from({ length: 9 }, (_, index) => place('same', 35, 129, { visitId: `visit-${index}` })));
  assert.equal(view.points.length, 9);
  for (let index = 0; index < view.points.length; index += 1) for (let next = index + 1; next < view.points.length; next += 1) {
    const a = view.points[index], b = view.points[next];
    const visibleDistance = Math.max(Math.abs(a.labelX - b.labelX), Math.abs(a.labelY - b.labelY)) * 248 / view.width;
    assert.ok(visibleDistance >= 44, `touch targets ${index + 1} and ${next + 1} overlap`);
    assert.equal(a.x, b.x); assert.equal(a.y, b.y);
  }
});
test('offline GPS requires matching foreground purpose, published policy and explicit consent', async () => {
  const bundle = approved(), accepted = consent(bundle);
  assert.equal(canUseCurrentLocation(bundle, accepted), false);
  assert.equal(canUseCurrentLocation(bundle, accepted, 'OFFLINE_ROUTE_DISPLAY'), true);
  let calls = 0;
  const geo = { getCurrentPosition(success) { calls++; success({ coords: { latitude: 35, longitude: 129, accuracy: 12 }, timestamp: Date.now() }); } };
  for (const [policy, choice] of [[draftPolicies, accepted], [bundle, null], [bundle, { ...accepted, purpose: 'NEARBY_SEARCH' }], [bundle, { ...accepted, version: 'old' }]]) await assert.rejects(requestCurrentLocation(policy, choice, geo, undefined, 'OFFLINE_ROUTE_DISPLAY'));
  assert.equal(calls, 0);
  assert.deepEqual(Object.keys(await requestCurrentLocation(bundle, accepted, geo, undefined, 'OFFLINE_ROUTE_DISPLAY')).sort(), ['accuracy', 'lat', 'lng', 'measuredAt']);
  assert.equal(calls, 1);
});
test('offline GPS rejects denial, timeout, invalid measurements and ignores a late aborted callback', async () => {
  const bundle = approved(), accepted = consent(bundle);
  for (const [browserCode, code] of [[1, 'DENIED'], [2, 'UNAVAILABLE'], [3, 'TIMEOUT']]) await assert.rejects(requestCurrentLocation(bundle, accepted, { getCurrentPosition(_success, failure) { failure({ code: browserCode }); } }, undefined, 'OFFLINE_ROUTE_DISPLAY'), error => error.code === code);
  await assert.rejects(requestCurrentLocation(bundle, accepted, { getCurrentPosition(success) { success({ coords: { latitude: 35, longitude: 129, accuracy: -1 }, timestamp: Date.now() }); } }, undefined, 'OFFLINE_ROUTE_DISPLAY'), error => error.code === 'UNAVAILABLE');
  let done; const controller = new AbortController();
  const pending = requestCurrentLocation(bundle, accepted, { getCurrentPosition(success) { done = success; } }, controller.signal, 'OFFLINE_ROUTE_DISPLAY');
  controller.abort(); await assert.rejects(pending, error => error.name === 'AbortError');
  done({ coords: { latitude: 35, longitude: 129, accuracy: 10 }, timestamp: Date.now() });
});
test('offline GPS requests high accuracy once while nearby search options remain unchanged', async () => {
  const bundle = approved(), options = [];
  const geo = { getCurrentPosition(success, _failure, option) { options.push(option); success({ coords: { latitude: 35, longitude: 129, accuracy: 4 }, timestamp: Date.now() }); } };
  await requestCurrentLocation(bundle, consent(bundle), geo, undefined, 'OFFLINE_ROUTE_DISPLAY');
  await requestCurrentLocation(bundle, { ...consent(bundle), purpose: 'NEARBY_SEARCH' }, geo);
  assert.deepEqual(options, [{ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }]);
});
