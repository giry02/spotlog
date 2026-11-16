import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState } from '../src/together/repository.ts';
import { previewVisitGuide, saveVisitGuide, publishVisitGuide, revokeVisitGuide, readVisitGuide, selectVisitGuide, isTogetherVisitGuide, isVisitGuideStateFields, isVisitGuideProjection, isVisitGuidePublication } from '../src/together/visitGuides.ts';
import { createVisitGuidePublicStore, reconcileVisitGuidePublicStore, visitGuidePublicStorageKey } from '../src/together/visitGuideStorage.ts';

const at = new Date('2026-11-12T03:00:00Z'), scope = { groupId: 'g', activityId: 'a' };
const place = (id, name = id) => ({ id, name, kind: 'FOOD', area: '부산', address: `${name} 공개 주소`, lat: 35.16, lng: 129.16, locationVerified: true, image: 'public-catalog.jpg', description: 'public catalogue', note: '', duration: '' });
const places = [place('pub-a', '음식점'), place('pub-b', '카페')];
function fixture() {
  const state = createEmptyState('owner', '모임장'); state.members.push({ id: 'member', name: '멤버' });
  state.groups.push({ id: 'g', name: '비밀 그룹', kind: 'FAMILY', region: '비밀 지역', introduction: 'private intro', cover: 'private-cover.jpg', visibility: 'PRIVATE', ownerId: 'owner', memberIds: ['owner', 'member'], managerIds: [], archived: false, promotionPublished: false });
  state.activities.push({ id: 'a', groupId: 'g', title: '개인 일정 이름', date: '2099-11-20', endDate: '2099-11-21', startTime: '18:00', meetingPoint: 'private exact meeting point', description: 'private meeting notes', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: { owner: 'MAYBE', member: 'JOINED' }, arrivedIds: ['member'], revision: 4,
    journey: { id: 'private-trip', title: 'private trip title', purpose: 'PLAN', planStage: 'READY', visibility: 'PRIVATE', status: 'PLANNING', region: '부산', dateRange: '', duration: '', cover: 'private-photo.jpg', summary: 'private summary', story: 'private story', tags: [], saves: 0, author: 'owner',
      days: [{ day: 1, dayId: 'private-day', date: '2099-11-20', title: 'private day title', story: 'private day story', blocks: [{ id: 'private-block', type: 'TEXT', body: 'private body' }], places: [
        { ...places[0], name: 'private override name', note: 'private booking note', image: 'private-visit-photo.jpg', visitId: 'private-visit-id', bookingFixed: true, time: '18:10' },
        { ...place('personal', '우리집 비공개'), personal: true }, { ...places[1], note: 'private cafe note' }, place('gone', '삭제된 장소'),
      ] }] } });
  state.activities.push({ ...structuredClone(state.activities[0]), id: 'other' });
  state.messages.push({ id: 'private-message', roomId: 'activity:a', authorId: 'member', body: 'private chat body', createdAt: at.toISOString() });
  return state;
}
const input = (state = fixture()) => ({ title: '함께 갈 분들 안내', meetingText: '공개 식당 정문', entry: '건물 오른쪽 입구로 오세요.', parking: '직접 확인한 공영 주차장 이용', preparations: '편한 신발과 물', selectedStopKeys: ['0:0:pub-a', '0:2:pub-b'], expectedActivityRevision: state.activities[0].revision, expectedGuideRevision: state.visitGuides?.[0]?.revision || 0, validityHours: 24 });
const preview = (state, actor = 'owner', changes = {}) => previewVisitGuide(state, actor, scope, { ...input(state), ...changes }, places, at);
function issue(state = fixture()) { const reviewed = preview(state), token = publishVisitGuide(state, 'owner', reviewed, places, at); return { state, token }; }
function memoryStorage() { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map }; }

test('review and private view never mutate a source or implicitly copy private meeting fields', () => {
  const state = fixture(), before = structuredClone(state), context = selectVisitGuide(state, 'member', scope, places, at);
  assert.equal(context.canEdit, false); assert.equal(context.fields.title, '방문 안내'); assert.equal(context.fields.meetingText, '');
  assert.deepEqual(context.fields.selectedStopKeys, []); const reviewed = preview(state); assert.deepEqual(state, before);
  assert.equal(reviewed.projection.title, '함께 갈 분들 안내'); assert.deepEqual(reviewed.projection.stops.map(row => row.name), ['음식점', '카페']);
  assert.deepEqual(reviewed.projection.stops.map(row => row.order), [1, 2]);
  assert.equal(reviewed.omissions.length, 2); assert.match(reviewed.omissions[0].reason, /개인 장소/);
  const published = JSON.stringify(reviewed.projection);
  for (const hidden of ['private', '우리집', '삭제된 장소', 'owner', 'member', '비밀 그룹', 'booking', 'visitId']) assert.equal(published.includes(hidden), false, hidden);
});

test('personal, disappeared and arbitrary route IDs cannot be selected or silently published', () => {
  for (const selectedStopKeys of [['0:1:personal'], ['0:3:gone'], ['0:9:foreign'], ['0:0:pub-a', '0:0:pub-a']]) {
    const state = fixture(), before = structuredClone(state); assert.throws(() => preview(state, 'owner', { selectedStopKeys })); assert.deepEqual(state, before);
  }
  const state = fixture(), reviewed = preview(state, 'owner', { selectedStopKeys: [] });
  assert.deepEqual(reviewed.projection.stops, []); assert.equal(reviewed.omissions.length, 4);
});

test('member-only save creates no token, membership, RSVP, post or source change', () => {
  const state = fixture(), before = structuredClone(state); saveVisitGuide(state, 'owner', scope, input(state), places, at);
  assert.equal(state.visitGuides.length, 1); assert.equal(state.visitGuides[0].publication, undefined); assert.equal(isTogetherState(state), true);
  const { visitGuides, ...rest } = state; assert.deepEqual(rest, before);
  assert.equal(selectVisitGuide(state, 'member', scope, places, at).projection.parking, '직접 확인한 공영 주차장 이용');
});

test('publication stores only reviewed allowlisted fields with cryptographically random 256-bit tokens', () => {
  const { state, token } = issue(), second = issue(); assert.match(token, /^[a-f0-9]{64}$/); assert.notEqual(token, second.token);
  const publication = readVisitGuide(state, token, places, at); assert.equal(isVisitGuidePublication(publication), true); assert.equal(isTogetherState(state), true);
  assert.deepEqual(Object.keys(publication).sort(), ['expiresAt', 'issuedAt', 'projection', 'revoked', 'token']);
  const hidden = JSON.stringify(publication); for (const word of ['creatorId', 'groupId', 'activityId', 'memberIds', 'participants', 'private', 'bookings', 'messages', '우리집']) assert.equal(hidden.includes(word), false, word);
  publication.projection.stops[0].name = 'mutated copy'; assert.equal(state.visitGuides[0].publication.projection.stops[0].name, '음식점');
});

test('publication rejects changed source, changed catalogue, another actor, or tampered reviewed projection atomically', () => {
  for (const modify of [s => { s.activities[0].revision += 1; }, s => { s.activities[0].startTime = '20:00'; }, s => { s.groups[0].blockedMemberIds = ['owner']; }]) {
    const state = fixture(), reviewed = preview(state); modify(state); const before = structuredClone(state);
    assert.throws(() => publishVisitGuide(state, 'owner', reviewed, places, at)); assert.deepEqual(state, before);
  }
  for (const modify of [r => { r.projection.entry = 'different'; }, r => { r.actorId = 'member'; }, r => { r.input.parking = 'different'; }]) {
    const state = fixture(), reviewed = preview(state); modify(reviewed); const before = structuredClone(state);
    assert.throws(() => publishVisitGuide(state, 'owner', reviewed, places, at)); assert.deepEqual(state, before);
  }
  const state = fixture(), reviewed = preview(state); assert.throws(() => publishVisitGuide(state, 'owner', reviewed, places.map(p => ({ ...p, address: 'changed' })), at));
});

test('exact scope, editor, registration, block, trash, archive, cancellation, completion and room expiry guard writes', () => {
  for (const modify of [s => { s.groups[0].archived = true; }, s => { s.groups[0].memberIds = ['member']; }, s => { s.groups[0].blockedMemberIds = ['owner']; },
    s => { s.members = s.members.filter(row => row.id !== 'owner'); }, s => { s.activities[0].status = 'CANCELLED'; }, s => { s.activities[0].status = 'COMPLETED'; },
    s => { s.groups[0].temporaryRoom = { purpose: 'DINNER', expiresAt: '2026-11-12T02:59:00Z' }; }, s => { s.groups[0].temporaryRoom = { purpose: 'DINNER', disposition: 'TRASH' }; },
    s => { s.activities[0].date = '2026-11-10'; s.activities[0].endDate = '2026-11-10'; }, s => { s.activities[0].journey.trash = { deletedAt: at.toISOString(), expiresAt: at.toISOString(), ownerId: 'owner', previousVisibility: 'PRIVATE', previousStatus: 'PLANNING' }; }]) {
    const state = fixture(); modify(state); const before = structuredClone(state); assert.throws(() => preview(state)); assert.deepEqual(state, before);
  }
  const state = fixture(); assert.throws(() => preview(state, 'member')); assert.throws(() => previewVisitGuide(state, 'owner', { groupId: 'foreign', activityId: 'a' }, input(state), places, at));
});

test('archived members can read the member guide while new publication is closed and current editors can revoke', () => {
  const { state, token } = issue(); state.groups[0].archived = true;
  assert.equal(selectVisitGuide(state, 'member', scope, places, at).projection.title, '함께 갈 분들 안내');
  assert.equal(selectVisitGuide(state, 'owner', scope, places, at).canEdit, false); assert.throws(() => readVisitGuide(state, token, places, at));
  revokeVisitGuide(state, 'owner', scope, state.visitGuides[0].id, state.visitGuides[0].revision, at);
  assert.equal(state.visitGuides[0].publication.revoked, true); assert.equal(state.groups[0].archived, true);
});

test('fresh reads close immediately on source revision, catalogue withdrawal or creator authority loss', () => {
  for (const modify of [s => { s.activities[0].revision += 1; }, s => { s.activities[0].status = 'CANCELLED'; }, s => { s.groups[0].memberIds = ['member']; }, s => { s.groups[0].blockedMemberIds = ['owner']; },
    s => { s.groups[0].archived = true; }, s => { s.groups[0].temporaryRoom = { purpose: 'BUSINESS', disposition: 'TRASH' }; }]) {
    const { state, token } = issue(); modify(state); assert.throws(() => readVisitGuide(state, token, places, at));
  }
  const { state, token } = issue(); assert.throws(() => readVisitGuide(state, token, places.slice(1), at));
  assert.throws(() => readVisitGuide(state, token, places.map(p => ({ ...p, personal: true })), at));
  assert.throws(() => readVisitGuide(state, token, places, new Date('2026-11-13T03:00:00Z')));
});

test('revoke checks exact guide, current authority and latest guide revision without exposing memberships', () => {
  const { state, token } = issue(), before = structuredClone(state);
  assert.throws(() => revokeVisitGuide(state, 'member', scope, state.visitGuides[0].id, 1, at));
  assert.throws(() => revokeVisitGuide(state, 'owner', scope, 'other-guide', 1, at));
  assert.throws(() => revokeVisitGuide(state, 'owner', scope, state.visitGuides[0].id, 0, at)); assert.deepEqual(state, before);
  revokeVisitGuide(state, 'owner', scope, state.visitGuides[0].id, 1, at); assert.throws(() => readVisitGuide(state, token, places, at));
});

test('public cache serializes only limited projections; guest reads never enumerate account namespaces', () => {
  const { state, token } = issue(), storage = memoryStorage(), store = createVisitGuidePublicStore(storage);
  reconcileVisitGuidePublicStore(state, places, store, at); assert.deepEqual([...storage.map.keys()], [visitGuidePublicStorageKey]);
  assert.equal(store.read(token, at).projection.entry, '건물 오른쪽 입구로 오세요.');
  const serialized = storage.getItem(visitGuidePublicStorageKey); for (const key of ['creatorId', 'groupId', 'activityId', 'members', 'participants', 'private', '우리집']) assert.equal(serialized.includes(key), false, key);
  store.read(token, at).projection.entry = 'outside mutation'; assert.equal(store.read(token, at).projection.entry, '건물 오른쪽 입구로 오세요.');
  assert.equal(store.read('bad', at), undefined); assert.equal(store.read(token, new Date('2026-11-13T03:00:00Z')), undefined);
});

test('account-side reconciliation retracts changed and revoked snapshots without scanning another account', () => {
  const first = issue(), second = issue(), storage = memoryStorage(), store = createVisitGuidePublicStore(storage);
  reconcileVisitGuidePublicStore(first.state, places, store, at); reconcileVisitGuidePublicStore(second.state, places, store, at);
  first.state.activities[0].revision += 1; reconcileVisitGuidePublicStore(first.state, places, store, at);
  assert.equal(store.read(first.token, at), undefined); assert.ok(store.read(second.token, at));
  revokeVisitGuide(second.state, 'owner', scope, second.state.visitGuides[0].id, 1, at); reconcileVisitGuidePublicStore(second.state, places, store, at);
  assert.equal(store.read(second.token, at), undefined);
});

test('reissue and private-only save withdraw every previous token rather than leaving public snapshots orphaned', () => {
  const { state, token: old } = issue(), storage = memoryStorage(), store = createVisitGuidePublicStore(storage);
  reconcileVisitGuidePublicStore(state, places, store, at); const newer = publishVisitGuide(state, 'owner', preview(state), places, at);
  reconcileVisitGuidePublicStore(state, places, store, at); assert.equal(store.read(old, at), undefined); assert.ok(store.read(newer, at));
  saveVisitGuide(state, 'owner', scope, input(state), places, at); reconcileVisitGuidePublicStore(state, places, store, at);
  assert.equal(store.read(newer, at), undefined); assert.equal(state.visitGuides[0].publication, undefined);
  assert.deepEqual(new Set(state.visitGuides[0].withdrawnTokens), new Set([old, newer]));
});

test('public storage corruption, privacy fields or failed persistence do not silently produce a usable link', () => {
  const { state, token } = issue(), publication = readVisitGuide(state, token, places, at), storage = memoryStorage(), store = createVisitGuidePublicStore(storage);
  assert.throws(() => store.publish({ ...publication, groupId: 'private' }));
  assert.throws(() => store.publish({ ...publication, projection: { ...publication.projection, memberIds: ['private'] } }));
  storage.setItem(visitGuidePublicStorageKey, '{bad'); assert.throws(() => store.read(token, at));
  const broken = createVisitGuidePublicStore({ getItem: () => null, setItem: () => { throw new Error('quota'); } }); assert.throws(() => reconcileVisitGuidePublicStore(state, places, broken, at), /quota/);
});

test('optional schema accepts old state but rejects extra private projection fields and duplicate guide scopes', () => {
  assert.equal(isVisitGuideStateFields(fixture()), true); const { state } = issue(); assert.equal(isTogetherVisitGuide(state.visitGuides[0]), true);
  for (const modify of [s => { s.visitGuides[0].publication.projection.booking = 'private'; }, s => { s.visitGuides[0].publication.memberIds = ['private']; }, s => { s.visitGuides.push({ ...structuredClone(s.visitGuides[0]), id: 'duplicate' }); }, s => { s.visitGuides[0].fields.secret = 'private'; }, s => { s.visitGuides[0].withdrawnTokens = ['predictable']; }]) {
    const next = structuredClone(state); modify(next); assert.equal(isVisitGuideStateFields(next), false); assert.equal(isTogetherState(next), false);
  }
  assert.equal(isVisitGuideProjection({ ...state.visitGuides[0].publication.projection, date: '2026-02-30' }), false);
});

test('invalid bounds and stale guide drafts fail before any mutation; unverified coordinates are never map pins', () => {
  for (const changes of [{ title: '' }, { title: 'x'.repeat(101) }, { preparations: 'x'.repeat(1001) }, { validityHours: 0 }, { validityHours: 169 }, { expectedActivityRevision: 3 }, { expectedGuideRevision: 3 }, { extraPrivateText: 'private' }]) {
    const state = fixture(), before = structuredClone(state); assert.throws(() => preview(state, 'owner', changes)); assert.deepEqual(state, before);
  }
  const state = fixture(), reviewed = previewVisitGuide(state, 'owner', scope, input(state), places.map(p => ({ ...p, locationVerified: false })), at);
  assert.equal(reviewed.projection.stops[0].lat, undefined); assert.equal(reviewed.projection.stops[0].lng, undefined);
});
