import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { isTogetherState, createTogetherRepository, togetherStorageKey } from '../src/together/repository.ts';
import { savePersonalRoute, removePersonalRoute, selectPersonalRoutes, previewPersonalRouteAcknowledgement, acknowledgePersonalRoute, isTogetherPersonalRoute, isPersonalRouteStateFields } from '../src/together/personalRoutes.ts';
import { selectPersonalRouteSummary } from '../src/together/personalRouteSummaryModel.ts';

const at = new Date('2026-11-12T03:00:00Z');
const scope = { groupId: 'group', activityId: 'activity' };
const p = (id, visitId = `visit-${id}`, extra = {}) => ({ id, visitId, kind: 'FOOD', name: `${id} 식당`, area: '부산', address: `${id} 지점 주소`, lat: 35.1, lng: 129.1, image: '/photo.jpg', description: '', note: '비공개 메모 금지', duration: '1시간', time: '12:00', ...extra });
const places = [p('a'), p('b'), p('c'), p('d'), p('origin'), p('private', 'private-visit', { personal: true })];
function fixture() {
  const state = createEmptyState('owner', '나');
  state.members.push({ id: 'member', name: '모임원' }, { id: 'third', name: '세 번째' });
  state.groups.push({ id: 'group', name: '모임', kind: 'FRIENDS', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'owner', memberIds: ['owner', 'member', 'third'], managerIds: [], archived: false, promotionPublished: false });
  const journey = { id: 'journey', title: '공동 일정', region: '부산', dateRange: '', duration: '', cover: '', summary: '', story: '원본 이야기', tags: [], author: '나', visibility: 'PRIVATE', status: 'PLANNING', saves: 0, purpose: 'PLAN', days: [
    { dayId: 'day-1', day: 1, date: '2026-11-20', title: '첫날', story: '공유 이야기', places: places.slice(0, 3), blocks: [] },
    { dayId: 'day-2', day: 2, date: '2026-11-21', title: '둘째 날', story: '', places: [places[3]], blocks: [] },
  ] };
  state.activities.push({ id: 'activity', groupId: 'group', title: '여행', date: '2026-11-20', endDate: '2026-11-21', startTime: '10:00', meetingPoint: '부산역 2번 출구', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: { owner: 'JOINED', member: 'MAYBE', third: 'DECLINED' }, arrivedIds: ['member'], revision: 7, journey: structuredClone(journey) });
  state.activities.push({ ...structuredClone(state.activities[0]), id: 'sibling' });
  return state;
}
const select = (state, actor = 'owner', now = at) => selectPersonalRoutes(state, actor, scope, places, now);
function input(state, actor = 'owner', first = 0, last = 3, changes = {}) {
  const selected = select(state, actor);
  return { startKey: selected.route.stops[first].key, endKey: selected.route.stops[last].key, expectedRevision: selected.own?.revision || 0, routeVersion: selected.route.version, ...changes };
}
const save = (state, actor = 'owner', first = 0, last = 3, changes = {}) => savePersonalRoute(state, actor, scope, input(state, actor, first, last, changes), places, at);
const reject = (state, fn) => { const before = structuredClone(state); assert.throws(fn); assert.deepEqual(state, before); };

test('summary shows actual RSVP before the actor saves any personal route', () => {
  const state = fixture(), before = structuredClone(state);
  for (const [actorId, participation, label] of [['owner', 'JOINED', '참가 선택'], ['member', 'MAYBE', '참석 미정'], ['third', 'DECLINED', '불참 선택']]) {
    const summary = selectPersonalRouteSummary(state, actorId, scope, places, at);
    assert.equal(summary.own, undefined); assert.equal(summary.participation, participation); assert.equal(summary.participationLabel, label);
  }
  assert.deepEqual(state, before);
});

test('route summary reads changed or removed RSVP separately from a retained personal route', () => {
  const state = fixture(); save(state, 'member', 1, 2);
  state.activities[0].participants.member = 'DECLINED';
  let summary = selectPersonalRouteSummary(state, 'member', scope, places, at);
  assert.equal(summary.participationLabel, '불참 선택'); assert.equal(summary.own.stops.length, 2);
  const personalRoute = structuredClone(state.personalRoutes);
  delete state.activities[0].participants.member;
  summary = selectPersonalRouteSummary(state, 'member', scope, places, at);
  assert.equal(summary.participation, undefined); assert.equal(summary.participationLabel, '참석 응답 전');
  assert.deepEqual(state.personalRoutes, personalRoute);
});

test('old schema-v1 fields remain optional and new records preserve every shared route, booking and RSVP', () => {
  const state = fixture(), before = structuredClone(state);
  state.activities[0].journey.days[0].places[1].bookingFixed = true;
  const activityBefore = structuredClone(state.activities);
  assert.equal(isPersonalRouteStateFields(state), true);
  save(state, 'member', 1, 2, { originPlaceId: 'origin', joinTime: '18:30' });
  assert.deepEqual(state.activities, activityBefore); assert.deepEqual(state.groups, before.groups);
  assert.equal(state.personalRoutes[0].userId, 'member'); assert.equal(state.personalRoutes[0].revision, 1);
  assert.equal(isTogetherPersonalRoute(state.personalRoutes[0]), true); assert.equal(isPersonalRouteStateFields(state), true);
  assert.equal(JSON.stringify(state.personalRoutes).includes('비공개 메모 금지'), false);
  assert.equal(JSON.stringify(state.personalRoutes).includes('/photo.jpg'), false);
  const chosen = select(state, 'member'); assert.deepEqual(chosen.own.stops.map(stop => stop.placeId), ['b', 'c']);
  assert.equal(chosen.own.participation, 'MAYBE'); assert.deepEqual(chosen.missingMemberIds, ['owner', 'third']);
});

test('multiple members independently choose inclusive portions across stable DAYs without auto RSVP', () => {
  const state = fixture(); save(state); save(state, 'member', 1, 3); save(state, 'third', 2, 2);
  const selected = select(state);
  assert.deepEqual(selected.members.map(row => row.stops.map(stop => stop.placeId)), [['a', 'b', 'c', 'd'], ['b', 'c', 'd'], ['c']]);
  assert.equal(selected.members.find(row => row.userId === 'third').participation, 'DECLINED');
  assert.equal(selected.missingMemberIds.length, 0); assert.equal(state.activities[0].participants.third, 'DECLINED');
  selected.own.stops[0].name = 'changed'; selected.activity.title = 'changed';
  assert.equal(select(state).own.stops[0].name, 'a 식당'); assert.equal(state.activities[0].title, '여행');
});

test('same place on multiple visits or branches is never confused with the chosen visit', () => {
  const state = fixture(); state.activities[0].journey.days[0].places.push(p('a', 'visit-a-again'));
  const selected = select(state); assert.equal(new Set(selected.route.stops.map(row => row.key)).size, 5);
  save(state, 'member', 3, 3); assert.equal(select(state, 'member').own.stops[0].visitId, 'visit-a-again');
  state.activities[0].journey.days[0].places.splice(3, 1);
  const changed = select(state, 'member').own;
  assert.equal(changed.status, 'INVALID'); assert.equal(changed.needsReselect, true); assert.deepEqual(changed.stops, []);
  reject(state, () => previewPersonalRouteAcknowledgement(state, 'member', scope, places, at));
});

test('missing stable IDs, duplicates, malformed dates and huge routes never use ordinal fallback', () => {
  for (const mutate of [
    s => { delete s.activities[0].journey.days[0].dayId; },
    s => { delete s.activities[0].journey.days[0].places[1].visitId; },
    s => { s.activities[0].journey.days[0].places[1].visitId = 'visit-a'; },
    s => { s.activities[0].journey.days[1].dayId = 'day-1'; },
    s => { s.activities[0].journey.days[0].date = '2026-02-30'; },
    s => { s.activities[0].journey.days[0].places = Array.from({ length: 501 }, (_, index) => p(`p-${index}`)); },
  ]) {
    const state = fixture(); mutate(state); const selected = select(state);
    assert.ok(selected.route.issues.length); assert.equal(selected.writable, false);
    reject(state, () => savePersonalRoute(state, 'owner', scope, { startKey: selected.route.stops[0]?.key || 'x', endKey: selected.route.stops[0]?.key || 'x', expectedRevision: 0, routeVersion: selected.route.version }, places, at));
  }
});

test('exact group/activity/registered active membership and no trash guard protect reading and writing', () => {
  for (const mutate of [
    s => { s.groups[0].blockedMemberIds = ['owner']; }, s => { s.groups[0].memberIds = ['member']; },
    s => { s.members = s.members.filter(row => row.id !== 'owner'); },
    s => { s.groups[0].temporaryRoom = { purpose: 'DINNER', disposition: 'TRASH' }; },
    s => { s.activities[0].groupId = 'foreign'; },
  ]) { const state = fixture(); const draft = input(state); mutate(state); reject(state, () => select(state)); reject(state, () => savePersonalRoute(state, 'owner', scope, draft, places, at)); }
  const state = fixture(); reject(state, () => selectPersonalRoutes(state, 'owner', { ...scope, activityId: 'absent' }, places, at));
  reject(state, () => select(state, '', at));
});

test('past, completed, cancelled, archived and expired rooms remain readable but reject every mutation', () => {
  for (const mutate of [
    s => { s.groups[0].archived = true; }, s => { s.activities[0].status = 'COMPLETED'; }, s => { s.activities[0].status = 'CANCELLED'; },
    s => { s.activities[0].date = s.activities[0].endDate = '2026-11-11'; },
    s => { s.groups[0].temporaryRoom = { purpose: 'DINNER', expiresAt: '2026-11-12T03:00:00Z' }; },
    s => { s.groups[0].temporaryRoom = { purpose: 'DINNER', closedAt: '2026-11-12T01:00:00Z' }; },
  ]) {
    const state = fixture(); save(state); const draft = input(state); mutate(state);
    const selected = select(state); assert.equal(selected.writable, false); assert.ok(selected.own);
    reject(state, () => savePersonalRoute(state, 'owner', scope, draft, places, at));
    reject(state, () => removePersonalRoute(state, 'owner', scope, { expectedRevision: 1, routeVersion: selected.route.version }, places, at));
    reject(state, () => previewPersonalRouteAcknowledgement(state, 'owner', scope, places, at));
  }
  const state = fixture(); assert.equal(select(state, 'owner', new Date('2026-11-21T14:59:59Z')).writable, true);
  assert.equal(select(state, 'owner', new Date('2026-11-21T15:00:00Z')).writable, false);
});

test('unknown private origins, arbitrary personal info, invalid times, reverse ranges and forged actors fail atomically', () => {
  for (const change of [
    { originPlaceId: 'private' }, { originPlaceId: 'missing' }, { joinTime: '24:00' }, { joinTime: '오후 6시' },
    { startKey: 'missing' }, { endKey: 'missing' }, { startKey: JSON.stringify(['day-2', 'visit-d']), endKey: JSON.stringify(['day-1', 'visit-a']) },
    { privateAddress: '우리집' }, { gps: [35, 129] }, { userId: 'member' }, { expectedRevision: -1 }, { expectedRevision: 1 },
  ]) { const state = fixture(), draft = input(state); reject(state, () => savePersonalRoute(state, 'owner', scope, { ...draft, ...change }, places, at)); }
  const state = fixture(); reject(state, () => savePersonalRoute(state, 'owner', scope, input(state), places, new Date('invalid')));
});

test('another member response never invalidates my draft; own revision and canonical facts do', () => {
  const state = fixture(), original = input(state); save(state, 'member', 1, 3);
  savePersonalRoute(state, 'owner', scope, original, places, at);
  reject(state, () => savePersonalRoute(state, 'owner', scope, original, places, at));
  const newer = input(state); state.activities[0].journey.days[0].places[1].time = '13:00';
  reject(state, () => savePersonalRoute(state, 'owner', scope, newer, places, at));
  save(state); assert.equal(state.personalRoutes.find(row => row.userId === 'owner').revision, 2);
});

test('date, common meeting/time and venue changes affect every submitted member with actual old/new labels', () => {
  const state = fixture(); save(state); save(state, 'member', 1, 2);
  state.activities[0].date = '2026-11-22'; state.activities[0].endDate = '2026-11-23';
  state.activities[0].startTime = '11:00'; state.activities[0].meetingPoint = '부산역 4번 출구'; state.activities[0].venuePlaceId = 'b';
  for (const row of select(state).members) {
    assert.equal(row.status, 'CHANGED'); assert.equal(row.needsReselect, false);
    assert.deepEqual(row.changes.map(change => change.kind), ['DATE', 'TIME', 'MEETING', 'VENUE']);
    assert.equal(row.changes[1].before, '10:00'); assert.equal(row.changes[1].after, '11:00');
  }
});

test('inside segment place, branch, coordinates, time, duration and booking flag changes require a new check', () => {
  const state = fixture(); save(state, 'member', 1, 2);
  Object.assign(state.activities[0].journey.days[0].places[1], { id: 'new-branch', name: '다른 지점', address: '다른 주소', lat: 35.3, time: '14:00', duration: '2시간', bookingFixed: true });
  const own = select(state, 'member').own;
  assert.equal(own.status, 'CHANGED'); assert.deepEqual(own.changes.map(row => row.kind), ['PLACE', 'TIME', 'BOOKING']);
  assert.equal(own.stops[0].placeId, 'new-branch'); assert.equal(own.startKey, JSON.stringify(['day-1', 'visit-b']));
});

test('unrelated activity edits and stops outside my segment do not produce fake personal impact', () => {
  const state = fixture(); save(state, 'member', 1, 2);
  state.activities[1].meetingPoint = '다른 약속'; state.activities[0].title = '제목 수정'; state.activities[0].revision++;
  assert.equal(select(state, 'member').own.routeChanged, false);
  state.activities[0].journey.days[1].places[0].name = '구간 밖 장소';
  const own = select(state, 'member').own; assert.equal(own.routeChanged, true); assert.equal(own.status, 'CURRENT'); assert.equal(own.changes.length, 0);
});

test('insertions, deletions and reordered surviving visits inside a segment explain the actual impact', () => {
  const state = fixture(); save(state);
  state.activities[0].journey.days[0].places.splice(1, 0, p('new', 'new-visit'));
  let own = select(state).own; assert.equal(own.status, 'CHANGED'); assert.equal(own.changes[0].kind, 'ADDED');
  state.activities[0].journey.days[0].places.splice(2, 1);
  own = select(state).own; assert.ok(own.changes.some(change => change.kind === 'REMOVED' && change.stopKey === JSON.stringify(['day-1', 'visit-b']))); assert.equal(own.needsReselect, false);
  state.activities[0].journey.days[0].places = [places[2], places[0]];
  own = select(state).own; assert.ok(own.changes.some(change => change.kind === 'ORDER'));
});

test('deleted, moved DAY or reversed endpoints are invalid, never silently reassigned by place or ordinal', () => {
  for (const mutate of [
    s => { s.activities[0].journey.days[0].places.splice(1, 1); },
    s => { const moved = s.activities[0].journey.days[0].places.splice(1, 1)[0]; s.activities[0].journey.days[1].places.push(moved); },
    s => { s.activities[0].journey.days[0].places = [places[0], places[2], places[1]]; },
  ]) {
    const state = fixture(); save(state, 'member', 1, 2); mutate(state);
    const own = select(state, 'member').own; assert.equal(own.status, 'INVALID'); assert.equal(own.needsReselect, true); assert.deepEqual(own.stops, []);
    reject(state, () => previewPersonalRouteAcknowledgement(state, 'member', scope, places, at));
    save(state, 'member', 0, 0); assert.equal(select(state, 'member').own.status, 'CURRENT');
  }
});

test('reviewed acknowledgement updates only my snapshot and requires fresh actor, exact changes, own revision and route', () => {
  const state = fixture(); save(state); save(state, 'member', 1, 3); state.activities[0].startTime = '11:30';
  const original = structuredClone(state.activities), memberBefore = structuredClone(state.personalRoutes.find(row => row.userId === 'member'));
  const preview = previewPersonalRouteAcknowledgement(state, 'owner', scope, places, at);
  for (const change of [{ actorId: 'member' }, { expectedRevision: 8 }, { routeVersion: 'old' }, { key: 'forged' }, { changes: [] }, { activityId: 'sibling' }]) reject(state, () => acknowledgePersonalRoute(state, 'owner', { ...preview, ...change }, places, at));
  acknowledgePersonalRoute(state, 'owner', preview, places, at);
  assert.equal(select(state).own.status, 'CURRENT'); assert.equal(select(state).own.revision, 2);
  assert.equal(select(state, 'member').own.status, 'CHANGED'); assert.deepEqual(state.activities, original);
  assert.deepEqual(state.personalRoutes.find(row => row.userId === 'member'), memberBefore);
  reject(state, () => acknowledgePersonalRoute(state, 'owner', preview, places, at));
});

test('a new edit after preview or a new own response makes acknowledgement stale without partial updates', () => {
  for (const mutate of [s => { s.activities[0].startTime = '12:00'; }, s => save(s, 'owner', 1, 2)]) {
    const state = fixture(); save(state); state.activities[0].startTime = '11:00';
    const preview = previewPersonalRouteAcknowledgement(state, 'owner', scope, places, at); mutate(state);
    reject(state, () => acknowledgePersonalRoute(state, 'owner', preview, places, at));
  }
});

test('departed and blocked members never appear as current participants; their records are retained, not reassigned', () => {
  const state = fixture(); save(state); save(state, 'member'); save(state, 'third');
  state.groups[0].memberIds = ['owner', 'third']; state.groups[0].blockedMemberIds = ['third'];
  const selected = select(state); assert.deepEqual(selected.members.map(row => row.userId), ['owner']);
  assert.equal(state.personalRoutes.length, 3); assert.deepEqual(selected.missingMemberIds, []);
});

test('own segment may be removed with reviewed revision and current canonical route, keeping everyone else and RSVP', () => {
  const state = fixture(); save(state); save(state, 'member'); const rsvp = structuredClone(state.activities);
  const selected = select(state), request = { expectedRevision: selected.own.revision, routeVersion: selected.route.version };
  reject(state, () => removePersonalRoute(state, 'member', scope, { ...request, expectedRevision: 0 }, places, at));
  state.activities[0].startTime = '12:30'; reject(state, () => removePersonalRoute(state, 'owner', scope, request, places, at));
  removePersonalRoute(state, 'owner', scope, { expectedRevision: 1, routeVersion: select(state).route.version }, places, at);
  assert.equal(select(state).own, undefined); assert.equal(state.personalRoutes[0].userId, 'member');
  rsvp[0].startTime = '12:30'; assert.deepEqual(state.activities, rsvp);
});

test('a removed or malformed current route never prevents explicit removal of my old shared segment', () => {
  const state = fixture(); save(state); state.activities[0].journey.days = [];
  const selected = select(state); assert.equal(selected.own.status, 'INVALID'); assert.equal(selected.writable, false);
  removePersonalRoute(state, 'owner', scope, { expectedRevision: 1, routeVersion: selected.route.version }, places, at);
  assert.equal(state.personalRoutes.length, 0);
});

test('single venue without a journey has a stable venue identity and venue replacement cannot silently reassign it', () => {
  const state = fixture(); delete state.activities[0].journey; state.activities[0].venuePlaceId = 'a';
  save(state, 'member', 0, 0); const key = select(state, 'member').own.startKey;
  assert.equal(key, JSON.stringify(['meeting-venue', 'venue:a']));
  state.activities[0].venuePlaceId = 'b'; const own = select(state, 'member').own;
  assert.equal(own.status, 'INVALID'); assert.equal(own.startKey, key); assert.equal(own.stops.length, 0);
  save(state, 'member', 0, 0); assert.equal(select(state, 'member').own.stops[0].placeId, 'b');
});

test('strict stored allowlists reject private fields, duplicate scopes, malformed snapshots and foreign activity records', () => {
  const state = fixture(); save(state); const good = state.personalRoutes[0];
  for (const change of [{ gps: [35, 129] }, { privateReason: 'private' }, { userId: '' }, { revision: 0 }, { updatedAt: 'not-a-date' }, { joinTime: '25:00' }, { endKey: 'absent' }]) assert.equal(isTogetherPersonalRoute({ ...good, ...change }), false);
  assert.equal(isTogetherPersonalRoute({ ...good, snapshot: { ...good.snapshot, privateNote: 'private' } }), false);
  assert.equal(isTogetherPersonalRoute({ ...good, snapshot: { ...good.snapshot, stops: [{ ...good.snapshot.stops[0], image: '/private.jpg' }] } }), false);
  assert.equal(isPersonalRouteStateFields({ ...state, personalRoutes: [good, structuredClone(good)] }), false);
  assert.equal(isPersonalRouteStateFields({ ...state, personalRoutes: [{ ...good, activityId: 'missing' }] }), false);
  assert.equal(isPersonalRouteStateFields({ ...state, personalRoutes: 'invalid' }), false);
});

test('repository round trip preserves valid optional routes and rejects invalid additive records without writing', () => {
  const data = new Map(); const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const state = fixture(); save(state); assert.equal(isTogetherState(state), true);
  data.set(togetherStorageKey('owner'), JSON.stringify(state));
  const repository = createTogetherRepository('owner', '나', [], storage);
  assert.equal(repository.getSnapshot().personalRoutes[0].userId, 'owner');
  const before = data.get(togetherStorageKey('owner'));
  assert.equal(repository.update(draft => { draft.personalRoutes[0].privateAddress = 'private'; }), false);
  assert.equal(data.get(togetherStorageKey('owner')), before);
  assert.equal(repository.update(draft => { draft.personalRoutes[0].joinTime = '17:30'; }), true);
  const reloaded = createTogetherRepository('owner', '나', [], storage);
  assert.equal(reloaded.getSnapshot().personalRoutes[0].joinTime, '17:30');
});
