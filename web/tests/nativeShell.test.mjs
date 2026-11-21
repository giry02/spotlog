import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { CURRENT_AREA_CONSENT_VERSION, parseNativeToWebMessage, parseWebToNativeMessage } from '../../shared/hybridBridge.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../../src/hybrid/HybridShell.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve)); };
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function nativeFixture(overrides = {}) {
  const states = [], refs = [], messages = [], alerts = [], stored = [], opened = [], scheduled = [], locationCalls = [];
  let stateIndex = 0, refIndex = 0, effects = [], cleanups = [], back;
  const notifications = {
    AndroidImportance: { HIGH: 4 }, setNotificationHandler() {}, setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => ({ status: 'granted' }), requestPermissionsAsync: async () => ({ status: 'granted' }),
    scheduleNotificationAsync: async (value) => { scheduled.push(value); return 'preview-id'; }, ...overrides.notifications,
  };
  const storage = { getItem: async () => null, setItem: async (key, value) => { stored.push({ key, value: JSON.parse(value) }); }, ...overrides.storage };
  const linking = { openURL: async (value) => { opened.push(value); }, ...overrides.linking };
  const location = {
    Accuracy: { Low: 2 },
    hasServicesEnabledAsync: async () => { locationCalls.push('services'); return true; },
    getForegroundPermissionsAsync: async () => { locationCalls.push('getPermission'); return { granted: true, canAskAgain: true }; },
    requestForegroundPermissionsAsync: async () => { locationCalls.push('requestPermission'); return { granted: true, canAskAgain: true }; },
    getCurrentPositionAsync: async (options) => { locationCalls.push({ position: options }); return { coords: { latitude: 37.45, longitude: 126.68, accuracy: 900 }, timestamp: Date.now() }; },
    ...overrides.location,
  };
  const react = {
    useState(initial) { const index = stateIndex++; if (!(index in states)) states[index] = initial; return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial }; },
    useCallback: (callback) => callback, useMemo: (callback) => callback(), useEffect: (callback) => effects.push(callback),
  };
  const native = {
    ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
    Platform: { OS: overrides.platform ?? 'android', select: (values) => values[overrides.platform ?? 'android'] },
    StyleSheet: { create: (value) => value }, Alert: { alert: (...args) => alerts.push(args) }, Linking: linking,
    Share: { share: overrides.share ?? (async () => {}) },
    BackHandler: { addEventListener: (_, callback) => { back = callback; return { remove: () => { back = undefined; } }; } },
  };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'react-native': native,
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage }, 'expo-notifications': notifications, 'expo-location': location,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-webview': { __esModule: true, default: 'WebView' },
    '../../shared/hybridBridge': { parseWebToNativeMessage },
  };
  const module = { exports: {} };
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n })`, { URL, Promise, setTimeout, clearTimeout, process: { env: {} }, __DEV__: overrides.dev ?? true })(
    (name) => { if (!(name in dependencies)) throw new Error(`Unexpected native dependency ${name}`); return dependencies[name]; }, module, module.exports,
  );
  function render() {
    for (const cleanup of cleanups) cleanup?.();
    stateIndex = 0; refIndex = 0; effects = [];
    const tree = module.exports.HybridShell();
    refs[0].current = { postMessage: (value) => messages.push(JSON.parse(value)) };
    cleanups = effects.map((effect) => effect());
    return tree;
  }
  const tree = render();
  const web = (tree) => tree.props.children[0].props;
  const send = async (message, url = web(tree).source.uri) => { web(tree).onMessage({ nativeEvent: { url, data: typeof message === 'string' ? message : JSON.stringify(message) } }); await flush(); };
  const result = () => messages.filter((message) => message.type === 'PREVIEW_NOTIFICATION_RESULT');
  return { tree, web, render, send, result, messages, alerts, stored, opened, scheduled, locationCalls, back: () => back?.(), states, notifications, refs,
    unmount: () => { for (const cleanup of cleanups) cleanup?.(); cleanups = []; } };
}

const locationRequest = (fixture, extra = {}) => ({ type: 'CURRENT_LOCATION_REQUEST', payload: { requestId: 'location_request_0123456789', sessionId: fixture.refs[2].current,
  consentAccepted: true, consentVersion: CURRENT_AREA_CONSENT_VERSION, purpose: 'GROUP_NEARBY', ...extra } });
const locationResults = fixture => fixture.messages.filter(message => message.type === 'CURRENT_LOCATION_RESULT');

test('native location is never requested at startup, by untrusted documents or without valid feature consent/session', async () => {
  const fixture = nativeFixture();
  await fixture.send({ type: 'READY' });
  assert.equal(fixture.web(fixture.tree).geolocationEnabled, false);
  assert.equal(fixture.web(fixture.tree).injectedJavaScriptForMainFrameOnly, true);
  assert.equal(fixture.locationCalls.length, 0);
  await fixture.send(locationRequest(fixture), 'https://untrusted.example/app');
  await fixture.send(locationRequest(fixture), 'http://10.0.2.2:5173/admin.html');
  for (const extra of [{ sessionId: 'wrong_session_0123456789' }, { consentAccepted: false }, { consentVersion: 'old' }, { purpose: 'ADVERTISING' }]) await fixture.send(locationRequest(fixture, extra));
  assert.equal(fixture.locationCalls.length, 0); assert.equal(locationResults(fixture).length, 0);
});

test('native location returns one fresh low-accuracy reading only to the requesting main document and never stores it', async () => {
  const fixture = nativeFixture({ location: { getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: true }) } });
  await fixture.send(locationRequest(fixture));
  assert.deepEqual(fixture.locationCalls.slice(0, 2), ['services', 'requestPermission']);
  assert.equal(JSON.stringify(fixture.locationCalls.at(-1)), JSON.stringify({ position: { accuracy: 2, mayShowUserSettingsDialog: false } }));
  assert.equal(locationResults(fixture).length, 1);
  const result = locationResults(fixture)[0].payload;
  assert.equal(result.ok, true); assert.equal(result.coordinates.accuracy, 900);
  assert.equal('timestamp' in result || 'altitude' in result.coordinates, false);
  assert.equal(fixture.stored.length, 0);
});

test('native denial, disabled location, inaccurate and stale OS data do not leak coordinates or private OS errors', async () => {
  for (const [location, expected] of [
    [{ getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: false }) }, 'DENIED'],
    [{ hasServicesEnabledAsync: async () => false }, 'UNAVAILABLE'],
    [{ getCurrentPositionAsync: async () => { throw new Error('private OS data'); } }, 'UNAVAILABLE'],
    [{ getCurrentPositionAsync: async () => ({ coords: { latitude: 37.45, longitude: 126.68, accuracy: 10001 }, timestamp: Date.now() }) }, 'INACCURATE'],
    [{ getCurrentPositionAsync: async () => ({ coords: { latitude: 37.45, longitude: 126.68, accuracy: 10 }, timestamp: Date.now() - 60000 }) }, 'UNAVAILABLE'],
  ]) {
    const fixture = nativeFixture({ location }); await fixture.send(locationRequest(fixture));
    const result = locationResults(fixture).at(-1).payload;
    assert.equal(result.ok, false); assert.equal(result.code, expected);
    assert.equal(JSON.stringify(result).includes('37.45') || JSON.stringify(result).includes('private OS'), false);
  }
});

test('cancel, navigation, renderer error or unmount drops late native readings and prevents additional prompts while busy', async () => {
  for (const action of ['cancel', 'navigation', 'error', 'unmount']) {
    const pending = defer();
    const fixture = nativeFixture({ location: { getCurrentPositionAsync: async () => pending.promise } });
    const request = locationRequest(fixture); await fixture.send(request);
    if (action === 'cancel') await fixture.send({ type: 'CURRENT_LOCATION_CANCEL', payload: { requestId: request.payload.requestId, sessionId: request.payload.sessionId } });
    if (action === 'navigation') fixture.web(fixture.tree).onLoadStart({ nativeEvent: { url: 'http://10.0.2.2:5173/admin.html' } });
    if (action === 'error') fixture.web(fixture.tree).onError({ nativeEvent: { description: 'reload' } });
    if (action === 'unmount') fixture.unmount();
    pending.resolve({ coords: { latitude: 37.45, longitude: 126.68, accuracy: 10 }, timestamp: Date.now() }); await flush();
    assert.equal(locationResults(fixture).length, 0);
  }
  const pending = defer(), fixture = nativeFixture({ location: { getCurrentPositionAsync: async () => pending.promise } });
  await fixture.send(locationRequest(fixture));
  await fixture.send(locationRequest(fixture, { requestId: 'second_request_0123456789' }));
  assert.equal(locationResults(fixture).at(-1).payload.code, 'UNAVAILABLE');
  pending.resolve({ coords: { latitude: 37.45, longitude: 126.68, accuracy: 10 }, timestamp: Date.now() }); await flush();
});

test('closing while the OS permission sheet is open prevents a later GPS read', async () => {
  const permission = defer(), fixture = nativeFixture({ location: {
    getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: true }), requestForegroundPermissionsAsync: async () => permission.promise,
  } });
  const request = locationRequest(fixture); await fixture.send(request);
  await fixture.send({ type: 'CURRENT_LOCATION_CANCEL', payload: { requestId: request.payload.requestId, sessionId: request.payload.sessionId } });
  permission.resolve({ granted: true, canAskAgain: true }); await flush();
  assert.equal(fixture.locationCalls.some(value => typeof value === 'object' && value.position), false);
  assert.equal(locationResults(fixture).length, 0);
});

test('native bridge rejects malformed messages, unsupported notification results and nonfinite thresholds', () => {
  for (const value of ['', '{}', 'null', '[]', '{"type":"NEW_UNKNOWN"}', '{"type":"UPDATE_NOTIFICATION_PREFERENCES","payload":{"enabled":true,"viewMilestone":0}}', '{"type":"PREVIEW_CREATOR_NOTIFICATION","payload":{"viewMilestone":1e999}}']) assert.equal(parseWebToNativeMessage(value), null);
  for (const result of [{ sent: 'yes' }, { sent: false, reason: 'raw-error' }]) assert.equal(parseNativeToWebMessage(JSON.stringify({ type: 'PREVIEW_NOTIFICATION_RESULT', payload: result })), null);
  assert.deepEqual(parseNativeToWebMessage('{"type":"PREVIEW_NOTIFICATION_RESULT","payload":{"sent":false,"reason":"permission"}}'), { type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: false, reason: 'permission' } });
  assert.deepEqual(parseNativeToWebMessage('{"type":"PREVIEW_NOTIFICATION_RESULT","payload":{"sent":true}}'), { type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: true } });
});

test('app startup continues when the OS notification service is unavailable', async () => {
  const fixture = nativeFixture({ notifications: { getPermissionsAsync: async () => { throw new Error('OS unavailable'); } } });
  await fixture.send({ type: 'READY' });
  assert.equal(fixture.states[2], true);
  assert.deepEqual(fixture.messages, [{ type: 'NOTIFICATION_STATUS', payload: { enabled: false, permission: 'undetermined' } }]);
  assert.equal(fixture.alerts.length, 0);
});

test('startup restores valid notification intent and rejects malformed, nonfinite or unreadable device preferences', async () => {
  const valid = nativeFixture({ storage: { getItem: async () => '{"enabled":true,"viewMilestone":500}' } });
  await valid.send({ type: 'READY' });
  assert.equal(valid.messages.at(-1).payload.enabled, true);
  for (const value of ['malformed', '{"enabled":true,"viewMilestone":1e999}', '{"enabled":true,"viewMilestone":0}']) {
    const fixture = nativeFixture({ storage: { getItem: async () => value } });
    await fixture.send({ type: 'READY' });
    assert.equal(fixture.messages.at(-1).payload.enabled, false);
  }
  const unreadable = nativeFixture({ storage: { getItem: async () => { throw new Error('private storage error'); } } });
  await unreadable.send({ type: 'READY' });
  assert.equal(unreadable.messages.at(-1).payload.enabled, false);
});

test('notification channel and storage failures are handled and do not poison the following Off request', async () => {
  for (const failure of ['channel', 'storage']) {
    let failOnce = true;
    const fixture = nativeFixture({
      notifications: { setNotificationChannelAsync: async () => { if (failure === 'channel' && failOnce) { failOnce = false; throw new Error('channel'); } } },
      storage: { setItem: async (_, value) => { if (failure === 'storage' && failOnce) { failOnce = false; throw new Error('storage'); } } },
    });
    await fixture.send({ type: 'UPDATE_NOTIFICATION_PREFERENCES', payload: { enabled: true, viewMilestone: 100 } });
    assert.match(fixture.alerts[0][0], /저장할 수 없어요/);
    await fixture.send({ type: 'UPDATE_NOTIFICATION_PREFERENCES', payload: { enabled: false, viewMilestone: 100 } });
    assert.equal(fixture.messages.at(-1).payload.enabled, false);
  }
});

test('turning notifications off persists even when the permission service is unavailable', async () => {
  const fixture = nativeFixture({ notifications: { getPermissionsAsync: async () => { throw new Error('OS unavailable'); } } });
  await fixture.send({ type: 'UPDATE_NOTIFICATION_PREFERENCES', payload: { enabled: false, viewMilestone: 500 } });
  assert.deepEqual(fixture.stored.at(-1).value, { enabled: false, viewMilestone: 500 });
  assert.equal(fixture.alerts.length, 0);
});

test('a denied preview returns a failure result without claiming that a notification was sent', async () => {
  const fixture = nativeFixture({ notifications: { getPermissionsAsync: async () => ({ status: 'denied' }), requestPermissionsAsync: async () => ({ status: 'denied' }) } });
  await fixture.send({ type: 'PREVIEW_CREATOR_NOTIFICATION', payload: { viewMilestone: 100 } });
  assert.deepEqual(fixture.result(), [{ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: false, reason: 'permission' } }]);
  assert.equal(fixture.scheduled.length, 0);
});

test('preview completion is acknowledged only after OS scheduling and clearly says it is a test', async () => {
  const pending = defer(), scheduled = [];
  const fixture = nativeFixture({ notifications: { scheduleNotificationAsync: async (value) => { scheduled.push(value); return pending.promise; } } });
  await fixture.send({ type: 'PREVIEW_CREATOR_NOTIFICATION', payload: { viewMilestone: 100 } });
  assert.equal(scheduled.length, 1);
  assert.deepEqual(fixture.result(), []);
  assert.match(scheduled[0].content.title, /테스트/);
  assert.match(scheduled[0].content.body, /실제 조회수 달성 알림은 아니/);
  assert.equal(scheduled[0].content.data.type, 'CREATOR_VIEW_MILESTONE_PREVIEW');
  pending.resolve('preview-id'); await flush();
  assert.deepEqual(fixture.result(), [{ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: true } }]);
});

test('OS scheduling failures return a retryable preview failure result', async () => {
  const fixture = nativeFixture({ notifications: { scheduleNotificationAsync: async () => { throw new Error('private OS stack'); } } });
  await fixture.send({ type: 'PREVIEW_CREATOR_NOTIFICATION', payload: { viewMilestone: 100 } });
  assert.deepEqual(fixture.result(), [{ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: false, reason: 'unavailable' } }]);
  assert.equal(JSON.stringify(fixture.messages).includes('private OS stack'), false);
});

test('rapid On then Off changes serialize permission prompts and preserve the last choice', async () => {
  const permission = defer(), fixture = nativeFixture({ notifications: { getPermissionsAsync: async () => permission.promise } });
  await fixture.send({ type: 'UPDATE_NOTIFICATION_PREFERENCES', payload: { enabled: true, viewMilestone: 100 } });
  await fixture.send({ type: 'UPDATE_NOTIFICATION_PREFERENCES', payload: { enabled: false, viewMilestone: 100 } });
  assert.equal(fixture.stored.length, 0);
  permission.resolve({ status: 'granted' }); await flush();
  assert.deepEqual(fixture.stored.map(({ value }) => value.enabled), [true, false]);
  assert.equal(fixture.messages.at(-1).payload.enabled, false);
});

test('external WebView navigation failures are caught and internal navigation stays in the app', async () => {
  const fixture = nativeFixture({ linking: { openURL: async () => { throw new Error('link unavailable'); } } });
  const navigation = fixture.web(fixture.tree).onShouldStartLoadWithRequest;
  assert.equal(navigation({ url: 'http://10.0.2.2:5173/#saved' }), true);
  assert.equal(navigation({ url: 'about:blank' }), true);
  assert.equal(navigation({ url: 'https://map.naver.com/p/search/test' }), false);
  await flush(); assert.match(fixture.alerts[0][0], /링크를 열 수 없어요/);
  assert.equal(navigation({ url: 'javascript:alert(1)' }), false);
  assert.equal(navigation({ url: 'not a url' }), false);
});

test('share and explicit external-link failures recover without uncaught rejection', async () => {
  const fixture = nativeFixture({ share: async () => { throw new Error('share unavailable'); }, linking: { openURL: async () => { throw new Error('link unavailable'); } } });
  await fixture.send({ type: 'SHARE', payload: { title: '제주 여행', message: '제주 여행 동선' } });
  await fixture.send({ type: 'OPEN_EXTERNAL', payload: { url: 'https://map.naver.com/' } });
  await fixture.send({ type: 'OPEN_EXTERNAL', payload: { url: 'javascript:alert(1)' } });
  assert.equal(fixture.alerts.length, 3);
  assert.equal(fixture.opened.length, 0);
});

test('Android back respects web history, and failed load plus retry clears stale history and the error immediately', async () => {
  const fixture = nativeFixture();
  assert.equal(fixture.back(), false);
  await fixture.send({ type: 'NAVIGATION_STATE', payload: { canGoBack: true } });
  const active = fixture.render();
  assert.equal(fixture.back(), true);
  assert.equal(fixture.messages.at(-1).type, 'GO_BACK');
  fixture.web(active).onError({ nativeEvent: { description: 'Network failed' } });
  const error = fixture.render();
  assert.equal(fixture.back(), false);
  assert.equal(fixture.states[2], false);
  const retry = error.props.children[2].props.children.at(-1);
  retry.props.onPress();
  assert.equal(fixture.states[1], '');
  assert.equal(fixture.states[0], 1);
  assert.equal(fixture.states[3], false);
});

test('only main-document HTTP errors block the shell; web renderer termination offers recovery', () => {
  const fixture = nativeFixture(), web = fixture.web(fixture.tree);
  web.onHttpError({ nativeEvent: { url: 'https://images.example.test/photo.jpg', statusCode: 500 } });
  assert.equal(fixture.states[1], '');
  // A WebView normalizes the slash after the host even when the source URI omitted it.
  web.onHttpError({ nativeEvent: { url: 'http://10.0.2.2:5173/#saved', statusCode: 503 } });
  assert.equal(fixture.states[1], 'HTTP 503');
  web.onRenderProcessGone();
  assert.match(fixture.states[1], /다시 연결/);
  web.onContentProcessDidTerminate();
  assert.match(fixture.states[1], /다시 연결/);
});

test('iOS uses its own simulator URL and does not install an Android back handler', () => {
  const fixture = nativeFixture({ platform: 'ios' });
  assert.equal(fixture.web(fixture.tree).source.uri, 'http://localhost:5173');
  assert.equal(fixture.back(), undefined);
});

test('web preview subscriber receives native completion on either platform event target and cleans up on unmount', () => {
  const source = readFileSync(new URL('../src/nativeBridge.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const window = new EventTarget(), document = new EventTarget(), module = { exports: {} };
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n })`, { window, document })(
    (name) => { assert.equal(name, '../../shared/hybridBridge'); return { parseNativeToWebMessage }; }, module, module.exports,
  );
  const results = [], stop = module.exports.subscribePreviewNotificationResult((result) => results.push(result));
  const message = (payload) => new MessageEvent('message', { data: JSON.stringify(payload) });
  window.dispatchEvent(message({ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: true } }));
  document.dispatchEvent(message({ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: false, reason: 'permission' } }));
  window.dispatchEvent(message({ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: 'invalid' } }));
  assert.deepEqual(results, [{ sent: true }, { sent: false, reason: 'permission' }]);
  stop();
  window.dispatchEvent(message({ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: true } }));
  document.dispatchEvent(message({ type: 'PREVIEW_NOTIFICATION_RESULT', payload: { sent: true } }));
  assert.equal(results.length, 2);
});
