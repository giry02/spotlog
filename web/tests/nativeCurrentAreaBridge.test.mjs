import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_AREA_CONSENT_VERSION, parseNativeToWebMessage, parseWebToNativeMessage } from '../../shared/hybridBridge.ts';
import { isNativeCurrentLocationAvailable, requestNativeCurrentPosition } from '../src/nativeLocationBridge.ts';
import { acquireCurrentArea, CurrentAreaError } from '../src/currentAreaService.ts';

const consent = { accepted: true, purpose: 'GROUP_NEARBY', version: CURRENT_AREA_CONSENT_VERSION };
const sessionId = 'native_session_0123456789012345';
function fixture() {
  const originals = new Map(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const window = new EventTarget(), document = new EventTarget(), sent = [];
  window.top = window; window.location = { origin: 'https://spotlog.example' };
  window.__SPOTLOG_LOCATION_BRIDGE__ = { version: 1, sessionId };
  window.ReactNativeWebView = { postMessage: raw => sent.push(JSON.parse(raw)) };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  const reply = (extra = {}, target = window, origin = '') => target.dispatchEvent(new MessageEvent('message', { origin, data: JSON.stringify({ type: 'CURRENT_LOCATION_RESULT', payload: {
    requestId: sent.find(message => message.type === 'CURRENT_LOCATION_REQUEST')?.payload.requestId,
    sessionId, ok: true, coordinates: { latitude: 37.45, longitude: 126.68, accuracy: 900 }, ...extra,
  } }) }));
  const restore = () => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } };
  return { window, document, sent, reply, restore };
}

test('location protocol accepts only feature consent, bounded tokens and finite projected coordinates', () => {
  const request = { type: 'CURRENT_LOCATION_REQUEST', payload: { requestId: 'request_0123456789012345', sessionId, consentAccepted: true, consentVersion: CURRENT_AREA_CONSENT_VERSION, purpose: 'GROUP_NEARBY' } };
  assert.equal(parseWebToNativeMessage(JSON.stringify(request)).type, 'CURRENT_LOCATION_REQUEST');
  for (const extra of [{ consentAccepted: false }, { consentVersion: 'old' }, { purpose: 'TRACKING' }, { requestId: 'short' }, { sessionId: '<script>' }]) assert.equal(parseWebToNativeMessage(JSON.stringify({ ...request, payload: { ...request.payload, ...extra } })), null);
  for (const coordinates of [{ latitude: 91, longitude: 1, accuracy: 10 }, { latitude: 37, longitude: 181, accuracy: 10 }, { latitude: 37, longitude: 126, accuracy: -1 }, { latitude: 37, longitude: 126, accuracy: 10001 }, { latitude: '37', longitude: 126, accuracy: 10 }]) {
    assert.equal(parseNativeToWebMessage(JSON.stringify({ type: 'CURRENT_LOCATION_RESULT', payload: { requestId: request.payload.requestId, sessionId, ok: true, coordinates } })), null);
  }
});

test('native web adapter correlates document/session/request and ignores foreign or malformed messages', async () => {
  const env = fixture();
  try {
    assert.equal(isNativeCurrentLocationAvailable(), true);
    const controller = new AbortController(), pending = requestNativeCurrentPosition({ consent, signal: controller.signal });
    assert.equal(env.sent.length, 1); assert.equal(env.sent[0].payload.consentAccepted, true);
    env.reply({ requestId: 'another_request_0123456789' });
    env.reply({ sessionId: 'another_session_0123456789' });
    env.reply({ coordinates: { latitude: 37, longitude: 126, accuracy: -1 } });
    env.reply({}, env.window, 'https://foreign.example');
    assert.equal(env.sent.length, 1);
    env.reply({}, env.document);
    assert.deepEqual(await pending, { latitude: 37.45, longitude: 126.68, accuracy: 900 });
    env.reply(); assert.equal(env.sent.length, 1);
    env.window.top = {}; assert.equal(isNativeCurrentLocationAvailable(), false);
  } finally { env.restore(); }
});

test('native web adapter cancels explicitly and drops a late OS result without a network request', async () => {
  const env = fixture();
  try {
    const controller = new AbortController(), pending = requestNativeCurrentPosition({ consent, signal: controller.signal });
    controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(env.sent.at(-1).type, 'CURRENT_LOCATION_CANCEL');
    assert.equal(env.sent.at(-1).payload.requestId, env.sent[0].payload.requestId);
    env.reply(); assert.equal(env.sent.length, 2);
  } finally { env.restore(); }
});

test('area service uses the consented OS bridge in an app and directly geocodes only its fresh result', async () => {
  const env = fixture();
  try {
    const calls = [];
    const pending = acquireCurrentArea({ consent, secureContext: false, online: true, fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ countryCode: 'KR', lookupSource: 'reverseGeocoding', principalSubdivisionCode: 'KR-28', city: '인천광역시', locality: '미추홀구', localityInfo: { administrative: [{ name: '인천광역시' }, { name: '미추홀구' }, { name: '주안동' }] } }), { headers: { 'Content-Type': 'application/json' } });
    } });
    assert.equal(calls.length, 0); env.reply();
    const result = await pending;
    assert.equal(calls.length, 1); assert.equal(new URL(calls[0].url).searchParams.get('latitude'), '37.45');
    assert.equal(result.district, '미추홀구'); assert.equal(result.neighborhood, '주안동'); assert.equal('latitude' in result, false);
    env.window.__SPOTLOG_LOCATION_BRIDGE__ = undefined;
    await assert.rejects(acquireCurrentArea({ consent, secureContext: false, online: true, fetch: async () => { throw new Error('must not request'); } }), error => error instanceof CurrentAreaError && error.code === 'UNSUPPORTED');
  } finally { env.restore(); }
});

test('native denial maps to the existing manual-selection error and never calls the provider', async () => {
  const env = fixture();
  try {
    let called = false;
    const pending = acquireCurrentArea({ consent, online: true, fetch: async () => { called = true; throw new Error('must not request'); } });
    env.reply({ ok: false, code: 'DENIED', coordinates: undefined });
    await assert.rejects(pending, error => error instanceof CurrentAreaError && error.code === 'DENIED');
    assert.equal(called, false);
  } finally { env.restore(); }
});
