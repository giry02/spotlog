import test from 'node:test';
import assert from 'node:assert/strict';
const { CHATBOT_CHANNEL: channel, CHATBOT_TARGET_LABELS, readChatbotLaunch, clearChatbotLaunch, isChatbotOpenAction, projectChatbotContext, installChatbotHostBridge } = await import('../src/chatbotHostBridge.ts');
const { CHATBOT_ENTRY_LABELS, isChatbotDraft, previewChatbotDraft, createChatbotDraftCopy, resolveChatbotSocialSelection } = await import('../src/chatbotHostBridge.ts');
const place = { id: 'place-1', kind: 'LANDMARK', name: '협재해변', area: '제주', note: 'private note', time: '09:00', lat: 33, lng: 126, image: 'data:image/png;base64,secret', bookingFixed: true };
const journey = { id: 'plan-1', purpose: 'PLAN', isMine: true, visibility: 'PRIVATE', title: '내 여행', region: '제주', planningPreferences: { prompt: 'secret' }, days: [{ day: 1, date: 'secret date', story: 'private story', places: [place], blocks: [] }, { day: 2, places: [place], blocks: [] }] };
test('launch accepts only supported customer targets, preserving unrelated query/hash values', () => {
  assert.equal(Object.keys(CHATBOT_TARGET_LABELS).length, 13);
  assert.deepEqual(readChatbotLaunch('?chatbotTarget=trips&chatbotJourney=plan-1&chatbotDay=2'), { type: 'open_spotlog', target: 'trips', journeyId: 'plan-1', day: 2 });
  assert.equal(readChatbotLaunch('?chatbotTarget=admin'), null); assert.equal(readChatbotLaunch('?chatbotTarget=trips&chatbotJourney=../x'), null);
  assert.equal(isChatbotOpenAction({ type: 'open_spotlog', target: 'account', token: 'bad' }), false);
  const cleaned = new URL(clearChatbotLaunch('http://127.0.0.1:5210/spotlog/?keep=1&chatbotTarget=account&chatbotJourney=x&chatbotDay=1#profile'));
  assert.equal(cleaned.search, '?keep=1'); assert.equal(cleaned.hash, '#profile');
});
test('selected-DAY projection excludes all private and account content without mutating records', () => {
  const before = JSON.stringify(journey);
  const projected = projectChatbotContext('selected-day', 'guest-device', { journey, day: 2 });
  assert.equal(projected.account, 'guest-device'); assert.equal(projected.journey.days.length, 1); assert.equal(projected.journey.days[0].day, 2);
  assert.deepEqual(projected.journey.days[0].places[0], { id: 'place-1', name: '협재해변', kind: 'LANDMARK', area: '제주' });
  for (const field of ['note', 'bookingFixed', 'lat', 'lng', 'image', 'planningPreferences', 'time', 'date', 'story']) assert.equal(JSON.stringify(projected).includes(`"${field}"`), false);
  assert.equal(JSON.stringify(journey), before);
});
test('context never falls back to all trips or publishes private journal/member records', () => {
  assert.throws(() => projectChatbotContext('selected-trip', 'guest-device', {}));
  for (const invalid of [{ ...journey, isMine: false }, { ...journey, visibility: 'PUBLIC' }, { ...journey, purpose: 'JOURNAL' }, { ...journey, trash: {} }]) assert.throws(() => projectChatbotContext('selected-trip', 'guest-device', { journey: invalid }));
  assert.throws(() => projectChatbotContext('selected-day', 'guest-device', { journey, day: 99 }));
  assert.throws(() => projectChatbotContext('saved-places', 'local-review', { places: [] }));
  assert.throws(() => projectChatbotContext('saved-places', 'local-review', { places: Array(31).fill(place) }));
  assert.equal(projectChatbotContext('saved-places', 'local-review', { places: [place] }).places.length, 1);
});
function fakeHost(origin = 'http://127.0.0.1:5210') {
  const listeners = new Set(), replies = [], source = { postMessage: (message, target) => replies.push({ message, target }) };
  const browser = { location: { origin, href: `${origin}/spotlog/` }, parent: null, opener: null, document: { querySelectorAll: () => [{ src: 'http://127.0.0.1:3001/', contentWindow: source }] }, addEventListener: (type, fn) => listeners.add(fn), removeEventListener: (type, fn) => listeners.delete(fn) };
  browser.parent = browser;
  Object.defineProperty(browser, 'localStorage', { get() { throw new Error('must never read storage'); } });
  return { browser, replies, source, emit(data, eventOrigin = 'http://127.0.0.1:3001', peer = source) { for (const fn of listeners) fn({ data, origin: eventOrigin, source: peer }); } };
}
const message = (type, requestId, payload, nonce = 'nonce-1') => ({ channel, version: 1, type, requestId, nonce, payload });
test('host requires local allowlist, registered window, handshake, nonce and unused request id', () => {
  const host = fakeHost(), opened = [], contexts = [];
  const stop = installChatbotHostBridge({ onOpen: (action, reply) => opened.push({ action, reply }), onContext: (scope, reply) => contexts.push({ scope, reply }) }, host.browser);
  const request = message('open', 'r-2', { type: 'open_spotlog', target: 'account' });
  host.emit(request); host.emit(message('hello', 'r-1'), 'https://evil.test'); host.emit(message('hello', 'r-1'), undefined, {});
  assert.equal(host.replies.length, 0); assert.equal(opened.length, 0);
  host.emit(message('hello', 'r-1')); assert.equal(host.replies.length, 1); assert.equal(host.replies[0].target, 'http://127.0.0.1:3001');
  host.emit({ ...request, nonce: 'different' }); assert.equal(opened.length, 0);
  host.emit(request); host.emit(request); assert.equal(opened.length, 1); assert.equal(host.replies.length, 1, 'navigation waits for explicit host confirmation');
  opened[0].reply({ ok: true, result: { opened: 'account' } }); opened[0].reply({ ok: true }); assert.equal(host.replies.length, 2);
  host.emit(message('context-request', 'r-3', { scope: 'selected-day' })); assert.equal(contexts.length, 1); assert.equal(host.replies.length, 2, 'no context shared until approval');
  contexts[0].reply({ ok: false, error: '취소' }); assert.equal(host.replies[2].message.ok, false);
  stop(); host.emit(message('hello', 'r-4')); assert.equal(host.replies.length, 3);
});
test('public host and arbitrary data/storage commands never install an action handler', () => {
  const host = fakeHost('https://giry02.github.io'), options = { onOpen: () => { throw Error('not allowed'); }, onContext: () => { throw Error('not allowed'); } };
  installChatbotHostBridge(options, host.browser); host.emit(message('hello', 'r-1')); assert.equal(host.replies.length, 0);
  const local = fakeHost(); installChatbotHostBridge(options, local.browser); local.emit(message('hello', 'r-1'));
  local.emit(message('storage-read', 'r-2', { key: 'account' })); assert.equal(local.replies.length, 1);
  local.emit(message('context-request', 'r-3', { scope: 'all-storage' })); assert.equal(local.replies[1].message.ok, false);
});
test('specific entry/PLACE identity roundtrips and rejects cross-purpose fields', () => {
  assert.equal(Object.keys(CHATBOT_ENTRY_LABELS).length, 16);
  assert.deepEqual(readChatbotLaunch('?chatbotTarget=community&chatbotEntry=place-comment&chatbotPlace=place-1&chatbotDay=2'), { type: 'open_spotlog', target: 'community', entry: 'place-comment', placeId: 'place-1', day: 2 });
  assert.equal(isChatbotOpenAction({ type: 'open_spotlog', target: 'account', entry: 'journal-preview' }), false);
  assert.equal(isChatbotOpenAction({ type: 'open_spotlog', target: 'account', entry: 'account-delete', execute: true }), false);
});
const socialJournal = { ...journey, id: 'public-1', purpose: 'JOURNAL', isMine: false, visibility: 'PUBLIC', status: 'PUBLISHED', days: [{ day: 1, places: [{ ...place, visitId: 'visit-1' }, { ...place, visitId: 'visit-2' }], blocks: [{ id: 'card-1', type: 'PLACE', placeId: place.id, visitId: 'visit-1' }, { id: 'card-2', type: 'PLACE', placeId: place.id, visitId: 'visit-2' }, { id: 'text-1', type: 'TEXT', body: 'story' }] }] };
test('social destination resolves exact public card identity without changing journal, comments or reaction state', () => {
  const original = structuredClone(socialJournal), before = JSON.stringify(original);
  for (const entry of ['place-comment', 'place-reaction']) {
    const destination = resolveChatbotSocialSelection({ type: 'open_spotlog', target: 'community', entry, placeId: place.id }, [original], original.id, 1, 'card-2');
    assert.equal(destination.blockId, 'card-2'); assert.equal(destination.placeName, place.name); assert.equal(destination.day, 1);
  }
  for (const entry of ['journey-comment', 'journey-cheer']) assert.deepEqual(resolveChatbotSocialSelection({ type: 'open_spotlog', target: 'community', entry }, [original], original.id, 99, ''), { journeyId: original.id, entry });
  assert.equal(JSON.stringify(original), before);
});
test('social destination rejects private, PLAN, unpublished, trashed, nonexistent DAY and non-PLACE targets', () => {
  const request = { type: 'open_spotlog', target: 'community', entry: 'place-reaction' };
  for (const changed of [{ visibility: 'PRIVATE' }, { purpose: 'PLAN' }, { status: 'PLANNING' }, { trash: { deletedAt: 'now' } }]) assert.throws(() => resolveChatbotSocialSelection(request, [{ ...socialJournal, ...changed }], socialJournal.id, 1, 'card-1'), /공개 여행기/);
  for (const [day, blockId] of [[2, 'card-1'], [1, 'text-1'], [1, 'missing']]) assert.throws(() => resolveChatbotSocialSelection(request, [socialJournal], socialJournal.id, day, blockId), /실제 장소 카드/);
  const brokenVisit = { ...socialJournal, days: [{ ...socialJournal.days[0], blocks: [{ id: 'wrong-visit', type: 'PLACE', placeId: place.id, visitId: 'absent' }] }] };
  assert.throws(() => resolveChatbotSocialSelection(request, [brokenVisit], socialJournal.id, 1, 'wrong-visit'), /실제 장소 카드/);
  assert.throws(() => resolveChatbotSocialSelection({ ...request, execute: true }, [socialJournal], socialJournal.id, 1, 'card-1'), /다시 선택/);
});
test('five additional purpose entries cannot carry account data, arbitrary actions or cross-purpose PLACE IDs', () => {
  for (const [entry, target] of [['place-reaction', 'community'], ['journey-comment', 'community'], ['journey-cheer', 'community'], ['profile-summary', 'profile'], ['profile-activity', 'profile']]) {
    assert.equal(isChatbotOpenAction({ type: 'open_spotlog', target, entry }), true);
    assert.equal(isChatbotOpenAction({ type: 'open_spotlog', target, entry, submitted: true }), false);
    assert.equal(isChatbotOpenAction({ type: 'open_spotlog', target, entry, token: 'secret' }), false);
    assert.equal(isChatbotOpenAction({ type: 'open_spotlog', target: 'account', entry }), false);
  }
  assert.equal(isChatbotOpenAction({ type: 'open_spotlog', target: 'community', entry: 'journey-cheer', placeId: place.id }), false);
  assert.deepEqual(readChatbotLaunch('?chatbotTarget=community&chatbotEntry=place-reaction&chatbotPlace=place-1&chatbotDay=1'), { type: 'open_spotlog', target: 'community', entry: 'place-reaction', placeId: 'place-1', day: 1 });
});
const draft = { title: '챗봇 새 사본', region: '제주', days: [{ day: 1, places: [{ id: 'place-1', name: '협재해변', kind: 'LANDMARK', area: '제주' }] }, { day: 2, places: [] }, { day: 3, places: [{ id: 'unknown-1', name: '직접 입력', kind: 'CAFE', area: '제주', address: '개인 입력 주소' }] }] };
test('new copy validates the complete preview and cannot silently drop unresolved or empty DAYs', () => {
  const before = JSON.stringify(draft), catalogBefore = JSON.stringify(place), preview = previewChatbotDraft(draft, [place]);
  assert.equal(preview[0].places[0].verified, true); assert.equal(preview[2].places[0].verified, false);
  assert.throws(() => createChatbotDraftCopy(draft, [place], '기기 작성자', false), /개인 입력/);
  const copy = createChatbotDraftCopy(draft, [place], '기기 작성자', true);
  assert.equal(copy.planStage, 'DRAFT'); assert.equal(copy.visibility, 'PRIVATE'); assert.equal(copy.purpose, 'PLAN'); assert.equal(copy.days.length, 3); assert.equal(copy.days[1].places.length, 0);
  assert.equal(copy.days[0].places[0].id, 'place-1'); assert.equal(copy.days[2].places[0].personal, true); assert.equal(copy.days[2].places[0].locationVerified, false); assert.equal(Number.isFinite(copy.days[2].places[0].lat), false);
  assert.notEqual(copy.days[2].places[0].id, 'unknown-1'); assert.equal(copy.days[0].places[0].note, ''); assert.equal(copy.days[0].places[0].image, ''); assert.equal(copy.days[0].places[0].bookingFixed, undefined); assert.equal(copy.days[0].places[0].time, undefined);
  assert.equal(JSON.stringify(draft), before); assert.equal(JSON.stringify(place), catalogBefore);
});
test('untrusted draft fields, noncontiguous DAYs, excessive counts and fake official identity are blocked', () => {
  assert.equal(isChatbotDraft(draft), true);
  assert.equal(isChatbotDraft({ ...draft, account: 'member' }), false);
  assert.equal(isChatbotDraft({ ...draft, days: [{ day: 2, places: [] }] }), false);
  assert.equal(isChatbotDraft({ ...draft, days: [{ day: 1, places: Array(31).fill(draft.days[0].places[0]) }] }), false);
  assert.equal(isChatbotDraft({ ...draft, days: [{ day: 1, places: [{ ...draft.days[0].places[0], photos: ['private'] }] }] }), false);
  const fake = { ...draft, days: [{ day: 1, places: [{ ...draft.days[0].places[0], name: '다른 업체' }] }] };
  assert.equal(previewChatbotDraft(fake, [place])[0].places[0].verified, false);
});
test('draft request is consent-only, idempotent per request ID, bounded and unavailable on public hosts', () => {
  const host = fakeHost(), requests = [];
  installChatbotHostBridge({ onOpen() {}, onContext() {}, onDraft: (draft, action, reply) => requests.push({ draft, action, reply }) }, host.browser);
  host.emit(message('hello', 'new-hello'));
  const request = message('draft-handoff', 'copy-1', { draft, action: { type: 'open_spotlog', target: 'trips', day: 3 } });
  host.emit(request); host.emit(request); assert.equal(requests.length, 1); assert.equal(host.replies.length, 1, 'copy requires host approval');
  requests[0].reply({ ok: false, error: '취소' }); assert.equal(host.replies[1].message.ok, false);
  host.emit(message('draft-handoff', 'copy-2', { draft, action: { type: 'open_spotlog', target: 'trips', journeyId: 'existing' } })); assert.equal(host.replies[2].message.ok, false);
});
