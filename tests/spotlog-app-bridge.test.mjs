import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) { return next(specifier.startsWith('./') && context.parentURL?.includes('/lib/') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context); } });
const { SPOTLOG_BRIDGE_CHANNEL: channel, SPOTLOG_TARGETS, buildSpotlogAppUrl, validateSpotlogOpenAction, isSpotlogContext, createSpotlogBridgeClient } = await import('../lib/spotlog-app-bridge.ts');
const { parseSpotlogActionRequest } = await import('../lib/spotlog-action.ts');
const { SPOTLOG_ENTRIES, SPOTLOG_ENTRY_TARGETS, isSpotlogDraftHandoff } = await import('../lib/spotlog-app-bridge.ts');
const { buildSpotlogDraftFromTrip } = await import('../lib/spotlog-draft-handoff.ts');
const { createTripSession, currentTrip } = await import('../lib/trip-engine.ts');
const action = target => ({ type: 'open_spotlog', target });
test('all thirteen app entries have fixed loopback URLs and typed targets', () => {
  assert.equal(Object.keys(SPOTLOG_TARGETS).length, 13);
  for (const target of Object.keys(SPOTLOG_TARGETS)) {
    const url = new URL(buildSpotlogAppUrl(action(target)));
    assert.equal(url.origin, 'http://localhost:5210'); assert.equal(url.pathname, '/spotlog/');
    assert.equal(url.searchParams.get('chatbotTarget'), target); assert.ok(url.hash);
  }
});
test('untrusted URLs, path traversal, arbitrary storage commands, extra fields and malformed days are rejected', () => {
  for (const value of [null, [], { type: 'open_spotlog', target: '__proto__' }, action('admin'), { ...action('trips'), url: 'https://evil.test' }, { ...action('trips'), journeyId: '../account' }, { ...action('trips'), journeyId: 'x?token=y' }, ...[0, -1, 31, '1', 1.5].map(day => ({ ...action('trips'), day })), { ...action('saved'), storageKey: 'account' }]) assert.equal(validateSpotlogOpenAction(value), false);
  assert.equal(validateSpotlogOpenAction({ ...action('trips'), journeyId: 'plan-제주:1', day: 2 }), true);
});
test('navigation parser preserves confirmation boundaries and cancelled requests', () => {
  for (const [input, target] of [['댓글을 신고하고 싶어', 'report'], ['위치 동의 어디서 해?', 'privacy'], ['로그인하고 싶어', 'account'], ['알림 설정 열어줘', 'notifications'], ['공유한 여행 원본 보여줘', 'share_source'], ['프로필 등급을 보여줘', 'profile'], ['여행기를 작성하고 싶어', 'journal'], ['사진 업로드하고 싶어', 'journal'], ['댓글 남기고 싶어', 'community'], ['영상으로 장소 보고 싶어', 'videos'], ['사진으로 장소 찾아줘', 'photos']]) assert.equal(parseSpotlogActionRequest(input)?.target, target);
  assert.equal(parseSpotlogActionRequest('로그인 하지마'), null); assert.equal(parseSpotlogActionRequest('제주 일정 알려줘'), null);
});
const context = { scope: 'selected-day', source: 'spotlog-device', account: 'guest-device', journey: { id: 'plan-1', title: '제주', region: '제주', days: [{ day: 2, places: [{ id: 'place-1', name: '협재', kind: 'LANDMARK', area: '제주' }] }] } };
test('context accepts minimum selected-day fields and rejects secrets, wrong scope and oversized data', () => {
  assert.equal(isSpotlogContext(context), true);
  for (const value of [{ ...context, token: 'secret' }, { ...context, account: 'admin' }, { ...context, journey: { ...context.journey, notes: 'private' } }, { ...context, journey: { ...context.journey, days: [...context.journey.days, ...context.journey.days] } }, { ...context, journey: { ...context.journey, days: [{ day: 2, places: [{ ...context.journey.days[0].places[0], lat: 33 }] }] } }]) assert.equal(isSpotlogContext(value), false);
});
function fakeBrowser(referrer = 'http://127.0.0.1:5210/spotlog/') {
  const listeners = new Set(), outgoing = [], timers = new Map(); let sequence = 0;
  const peer = { postMessage(data, origin) { outgoing.push({ data, origin }); } };
  const browser = { crypto: { randomUUID: () => `nonce-${++sequence}` }, document: { referrer }, parent: peer, addEventListener(type, fn) { if (type === 'message') listeners.add(fn); }, removeEventListener(type, fn) { listeners.delete(fn); }, setTimeout(fn) { const id = ++sequence; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } };
  Object.defineProperty(browser, 'localStorage', { get() { throw new Error('storage must not be read'); } });
  return { browser, peer, outgoing, timers, emit(data, origin = 'http://127.0.0.1:5210', source = peer) { for (const fn of listeners) fn({ data, origin, source }); } };
}
test('bridge transport keeps cryptographic nonces on LAN HTTP without randomUUID', async () => {
  const fake = fakeBrowser();
  let entropyCalls = 0;
  fake.browser.crypto = { getRandomValues(bytes) { return bytes.fill(++entropyCalls); } };
  const client = createSpotlogBridgeClient(fake.browser);
  const received = client.context('selected-day');
  const hello = fake.outgoing[0].data;
  assert.match(hello.nonce, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(hello.requestId, hello.nonce);
  fake.emit(response(hello, {}));
  await Promise.resolve();
  const request = fake.outgoing[1].data;
  assert.notEqual(request.requestId, hello.requestId);
  assert.equal(request.nonce, hello.nonce);
  fake.emit(response(request, context));
  assert.deepEqual(await received, context);
  assert.equal(entropyCalls, 3);
  client.destroy();
});
const response = (request, result, extra = {}) => ({ channel, version: 1, type: 'response', nonce: request.nonce, requestId: request.requestId, ok: true, result, ...extra });
test('client pins origin, peer, nonce and request id before accepting selected context', async () => {
  const fake = fakeBrowser(), client = createSpotlogBridgeClient(fake.browser);
  let resolved = false; const received = client.context('selected-day').then(value => { resolved = true; return value; });
  const hello = fake.outgoing[0].data;
  assert.equal(fake.outgoing[0].origin, 'http://127.0.0.1:5210');
  fake.emit(response(hello, {}), 'https://evil.test'); fake.emit(response(hello, {}), undefined, {}); fake.emit(response(hello, {}, { nonce: 'bad' }));
  await Promise.resolve(); assert.equal(fake.outgoing.length, 1); assert.equal(resolved, false);
  fake.emit(response(hello, {})); await Promise.resolve();
  const request = fake.outgoing[1].data; assert.equal(request.type, 'context-request');
  fake.emit(response(request, context, { requestId: 'old' })); await Promise.resolve(); assert.equal(resolved, false);
  fake.emit(response(request, context)); assert.deepEqual(await received, context); assert.equal(fake.timers.size, 0); client.destroy();
});
test('client rejects wrong scope and private fields even from its trusted peer', async () => {
  const fake = fakeBrowser(), client = createSpotlogBridgeClient(fake.browser);
  const received = client.context('selected-day'); fake.emit(response(fake.outgoing[0].data, {})); await Promise.resolve();
  fake.emit(response(fake.outgoing[1].data, { ...context, token: 'never-transfer' }));
  await assert.rejects(received, /자료를 확인/); client.destroy();
});
test('non-allowlisted referrer does not acquire a host transport', async () => {
  const fake = fakeBrowser('https://spotlog.example/'), client = createSpotlogBridgeClient(fake.browser);
  assert.equal(client.connected, false); await assert.rejects(client.open(action('account')), /앱 연결/); assert.equal(fake.outgoing.length, 0); client.destroy();
});
test('purpose entries are target-bound, contextual and URL-safe', () => {
  for (const entry of Object.keys(SPOTLOG_ENTRIES)) {
    const item = { type: 'open_spotlog', target: SPOTLOG_ENTRY_TARGETS[entry], entry, day: 2 };
    assert.equal(validateSpotlogOpenAction(item), true); assert.equal(new URL(buildSpotlogAppUrl(item)).searchParams.get('chatbotEntry'), entry);
  }
  assert.equal(validateSpotlogOpenAction({ ...action('account'), entry: 'journal-photos' }), false);
  assert.equal(validateSpotlogOpenAction({ ...action('community'), placeId: 'place-1' }), false);
  assert.equal(validateSpotlogOpenAction({ ...action('community'), entry: 'place-comment', placeId: 'place-1' }), true);
  assert.deepEqual(parseSpotlogActionRequest('DAY 2 여행기에 사진 추가해줘'), { type: 'open_spotlog', target: 'journal', entry: 'journal-photos', day: 2 });
  assert.equal(parseSpotlogActionRequest('계정 탈퇴 화면 열어줘').entry, 'account-delete');
  assert.equal(parseSpotlogActionRequest('비밀번호 재설정하고 싶어').entry, 'account-reset');
  assert.equal(parseSpotlogActionRequest('장소를 직접 등록하고 싶어').entry, 'personal-place');
});
test('public card reactions, whole-journey social and device profile have distinct navigation-only entries', () => {
  for (const [text, entry] of [['장소 카드에 좋아요 남기고 싶어', 'place-reaction'], ['여행기 전체 댓글 보고 싶어', 'journey-comment'], ['이 여행기 응원하고 싶어', 'journey-cheer'], ['내 프로필 등급 보여줘', 'profile-summary'], ['내 활동 통계를 보여줘', 'profile-activity']]) {
    const parsed = parseSpotlogActionRequest(text);
    assert.equal(parsed?.entry, entry); assert.equal(validateSpotlogOpenAction(parsed), true);
    assert.equal(parsed.type, 'open_spotlog'); assert.equal(Object.hasOwn(parsed, 'execute'), false);
  }
  const like = { ...action('community'), entry: 'place-reaction', placeId: 'actual-place', day: 2 };
  assert.equal(validateSpotlogOpenAction(like), true);
  const url = new URL(buildSpotlogAppUrl(like)); assert.equal(url.searchParams.get('chatbotPlace'), 'actual-place');
  for (const entry of ['journey-comment', 'journey-cheer', 'profile-summary', 'profile-activity']) assert.equal(validateSpotlogOpenAction({ ...action(SPOTLOG_ENTRY_TARGETS[entry]), entry, placeId: 'actual-place' }), false);
  for (const value of [{ ...like, liked: true }, { ...like, body: 'do not send' }, { ...action('profile'), entry: 'profile-activity', accountId: 'secret' }]) assert.equal(validateSpotlogOpenAction(value), false);
  assert.equal(parseSpotlogActionRequest('장소 좋아요 하지마'), null);
});
const draft = { title: '새 초안', region: '제주', days: [{ day: 1, places: [{ id: 'hyeopjae', name: '협재해변', kind: 'LANDMARK', area: '제주' }] }, { day: 2, places: [] }] };
test('draft contract keeps all DAYs and rejects secrets, skipped DAYs, raw actions and oversized fields', () => {
  assert.equal(isSpotlogDraftHandoff(draft), true);
  for (const value of [{ ...draft, sourceTripId: 'private-trip' }, { ...draft, days: [{ ...draft.days[0], day: 2 }] }, { ...draft, days: [{ day: 1, places: [{ ...draft.days[0].places[0], note: 'private' }] }] }, { ...draft, days: [{ day: 1, places: [{ ...draft.days[0].places[0], latitude: 33 }] }] }, { ...draft, title: 'a'.repeat(151) }]) assert.equal(isSpotlogDraftHandoff(value), false);
  assert.equal(validateSpotlogOpenAction({ ...action('trips'), draft }), false, 'draft is never an LLM navigation field');
});
test('browser handoff exports visits and empty DAYs without source IDs, notes, photos, times or booking details', () => {
  const state = { ...currentTrip(createTripSession()), region: '제주', days: 3, title: '초안', plan: [{ id: 'private-visit', day: 1, kind: 'place', entityId: 'hyeopjae', anchorId: 'hyeopjae', label: '오전', locked: false, note: 'private-note', time: '09:00' }, { id: 'private-booking', day: 3, kind: 'stay', entityId: null, anchorId: 'hyeopjae', label: '실제 예약 번호 secret', locked: true }] };
  const before = JSON.stringify(state), exported = buildSpotlogDraftFromTrip(state);
  assert.equal(exported.days.length, 3); assert.equal(exported.days[1].places.length, 0); assert.equal(exported.days[2].places.length, 1);
  assert.equal(JSON.stringify(exported).includes('secret'), false); assert.equal(JSON.stringify(exported).includes('private-'), false); assert.equal(JSON.stringify(exported).includes('09:00'), false);
  assert.equal(exported.days[2].places[0].name, '예약 숙소 (정보 미전달)'); assert.equal(JSON.stringify(state), before);
});
test('draft copy waits for an explicit host confirmation and never accepts overwrite IDs', async () => {
  const fake = fakeBrowser(), client = createSpotlogBridgeClient(fake.browser);
  await assert.rejects(client.handoff(draft, { ...action('trips'), journeyId: 'existing-private' }), /새 초안/); assert.equal(fake.outgoing.length, 0);
  const received = client.handoff(draft, { ...action('trips'), day: 2 }); fake.emit(response(fake.outgoing[0].data, {})); await Promise.resolve();
  assert.equal(fake.outgoing[1].data.type, 'draft-handoff');
  fake.emit({ ...response(fake.outgoing[1].data), ok: false, error: '가져오기를 취소했어요.' });
  await assert.rejects(received, /취소/); client.destroy();
});
