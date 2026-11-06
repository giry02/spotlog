import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, roomIdForActivity, roomIdForGroup } from '../src/together/model.ts';
import { buildMyGroupDirectory } from '../src/together/myGroupDirectory.ts';

const at = new Date('2026-11-04T12:00:00+09:00');
const group = (id, kind = 'FAMILY', extra = {}) => ({ id, name: id, kind, region: '부산', introduction: '', cover: '', visibility: 'PRIVATE',
  ownerId: 'owner', memberIds: ['me', 'owner'], managerIds: [], archived: false, promotionPublished: false, ...extra });
const activity = (id, groupId, date, extra = {}) => ({ id, groupId, title: id, date, endDate: date, meetingPoint: '', description: '',
  status: 'PLANNED', leadId: 'owner', editorIds: [], participants: {}, arrivedIds: [], revision: 1, ...extra });
const message = (id, roomId, extra = {}) => ({ id, roomId, authorId: 'owner', body: '공개하지 않은 원문', createdAt: '2026-11-04T02:00:00Z', ...extra });
const ids = result => result.groups.map(item => item.group.id);

test('only current persistent memberships are listed and counted, independently of public status or owner role', () => {
  const state = createEmptyState('me', '나');
  state.groups = [group('family'), group('friends', 'FRIENDS', { visibility: 'PUBLIC', promotionPublished: true }),
    group('hobby', 'HOBBY'), group('guide', 'GUIDE'), group('legacy', 'FUTURE_KIND'),
    group('stranger', 'FAMILY', { memberIds: ['owner'], visibility: 'PUBLIC', promotionPublished: true }),
    group('former-owner', 'FAMILY', { ownerId: 'me', memberIds: ['owner'] }),
    group('blocked', 'FAMILY', { blockedMemberIds: ['me'] }), group('archived', 'FAMILY', { archived: true }),
    group('one-off', 'FRIENDS', { spaceType: 'ACTIVITY' })];
  const result = buildMyGroupDirectory(state, 'me', {}, at);
  assert.deepEqual(ids(result), ['family', 'friends', 'hobby', 'guide', 'legacy']);
  assert.deepEqual(result.counts, { ALL: 5, FAMILY: 1, FRIENDS: 1, HOBBY: 1, GUIDE: 1 });
  assert.deepEqual(buildMyGroupDirectory(state, '', {}, at), { groups: [], counts: { ALL: 0, FAMILY: 0, FRIENDS: 0, HOBBY: 0, GUIDE: 0 } });
  assert.equal(buildMyGroupDirectory(state, 'owner', {}, at).groups.some(item => item.group.id === 'blocked'), true);
});

test('kind and normalized query filter only the visible list while counts remain eligible membership totals', () => {
  const state = createEmptyState('me', '나');
  state.groups = [group('a', 'FAMILY', { name: '부산 가족', introduction: '주말 나들이' }),
    group('b', 'FRIENDS', { name: 'ＣＡＦＥ Friends', region: '서울' }), group('c', 'HOBBY', { name: '부산 독서' })];
  const counts = { ALL: 3, FAMILY: 1, FRIENDS: 1, HOBBY: 1, GUIDE: 0 };
  assert.deepEqual(ids(buildMyGroupDirectory(state, 'me', { kind: 'FRIENDS', query: '  cafe  ' }, at)), ['b']);
  assert.deepEqual(ids(buildMyGroupDirectory(state, 'me', { kind: 'FAMILY', query: '나들이' }, at)), ['a']);
  assert.deepEqual(ids(buildMyGroupDirectory(state, 'me', { query: '서울' }, at)), ['b']);
  const empty = buildMyGroupDirectory(state, 'me', { kind: 'GUIDE', query: '부산' }, at);
  assert.deepEqual(empty.groups, []);
  assert.deepEqual(empty.counts, counts);
});

test('next activity includes ongoing multi-day travel through its last KST calendar day', () => {
  const state = createEmptyState('me', '나'); state.groups = [group('family')];
  state.activities = [activity('future', 'family', '2026-11-06'), activity('cancelled', 'family', '2026-11-01', { endDate: '2026-11-09', status: 'CANCELLED' }),
    activity('completed', 'family', '2026-11-02', { endDate: '2026-11-09', status: 'COMPLETED' }),
    activity('ongoing-trip', 'family', '2026-11-03', { endDate: '2026-11-04', kind: 'TRIP' }),
    activity('invalid', 'family', '2026-02-30', { endDate: '2026-11-10' }), activity('undated', 'family', '')];
  assert.equal(buildMyGroupDirectory(state, 'me', {}, new Date('2026-11-04T14:59:59Z')).groups[0].nextActivity.id, 'ongoing-trip');
  assert.equal(buildMyGroupDirectory(state, 'me', {}, new Date('2026-11-04T15:00:00Z')).groups[0].nextActivity.id, 'future');
  assert.equal(state.activities[3].participants.me, undefined);
});

test('same-day times determine the next activity and invalid/reversed end dates cannot prolong expired plans', () => {
  const state = createEmptyState('me', '나'); state.groups = [group('family')];
  state.activities = [activity('no-time', 'family', '2026-11-04'), activity('later', 'family', '2026-11-04', { startTime: '16:00' }),
    activity('earlier', 'family', '2026-11-04', { startTime: '09:30' }),
    activity('bad-end', 'family', '2026-11-01', { endDate: '2026-11-00' }),
    activity('reversed-end', 'family', '2026-11-02', { endDate: '2026-11-01' }),
    activity('unrelated', 'private-other-group', '2026-11-01', { endDate: '2026-11-10' })];
  assert.equal(buildMyGroupDirectory(state, 'me', {}, at).groups[0].nextActivity.id, 'earlier');
  assert.equal(buildMyGroupDirectory(state, 'me', {}, new Date('2026-11-05T00:00:00+09:00')).groups[0].nextActivity, null);
});

test('unread counts exact group/activity rooms, excluding self, deletion, before/equal cursor, future and invalid timestamps', () => {
  const state = createEmptyState('me', '나'); state.groups = [group('family'), group('friends', 'FRIENDS')];
  state.activities = [activity('trip', 'family', '2026-11-03', { status: 'COMPLETED' }), activity('other', 'private-other-group', '2026-11-04')];
  const room = roomIdForGroup('family'); const child = roomIdForActivity('trip');
  state.readCursors[room] = '2026-11-04T10:00:00+09:00';
  state.messages = [message('after', room), message('self', room, { authorId: 'me' }), message('deleted', room, { deleted: true }),
    message('before', room, { createdAt: '2026-11-04T00:59:59Z' }), message('equal', room, { createdAt: '2026-11-04T01:00:00Z' }),
    message('future', room, { createdAt: '2026-11-04T04:00:00Z' }), message('bad', room, { createdAt: 'bad' }),
    message('child', child), message('friend', roomIdForGroup('friends')), message('wrong-room', 'group:family-extra'),
    message('unknown-activity', 'activity:unknown'), message('private-activity', roomIdForActivity('other'))];
  const result = buildMyGroupDirectory(state, 'me', {}, at);
  assert.deepEqual(result.groups.map(item => [item.group.id, item.unreadCount]), [['family', 2], ['friends', 1]]);
  assert.equal('messages' in result, false);
  assert.equal(result.groups[0].nextActivity, null);
  state.readCursors[child] = 'bad';
  assert.equal(buildMyGroupDirectory(state, 'me', {}, at).groups[0].unreadCount, 1);
});

test('kind sections differ from global upcoming/unread/name sorting, with deterministic ties', () => {
  const state = createEmptyState('me', '나');
  state.groups = [group('family', 'FAMILY', { name: '가족' }), group('friends', 'FRIENDS', { name: '친구' }),
    group('hobby', 'HOBBY', { name: '취미' }), group('guide', 'GUIDE', { name: '가이드' })];
  state.activities = [activity('far', 'family', '2026-11-20'), activity('near', 'friends', '2026-11-05')];
  state.messages = [message('h1', roomIdForGroup('hobby')), message('h2', roomIdForGroup('hobby')), message('f1', roomIdForGroup('friends'))];
  assert.deepEqual(ids(buildMyGroupDirectory(state, 'me', {}, at)), ['family', 'friends', 'hobby', 'guide']);
  assert.deepEqual(ids(buildMyGroupDirectory(state, 'me', { sort: 'UPCOMING' }, at)), ['friends', 'family', 'guide', 'hobby']);
  assert.deepEqual(ids(buildMyGroupDirectory(state, 'me', { sort: 'UNREAD' }, at)), ['hobby', 'friends', 'family', 'guide']);
  assert.deepEqual(ids(buildMyGroupDirectory(state, 'me', { sort: 'NAME' }, at)), ['guide', 'family', 'hobby', 'friends']);
  const reversed = { ...state, groups: [...state.groups].reverse(), activities: [...state.activities].reverse() };
  for (const sort of ['KIND', 'UPCOMING', 'UNREAD', 'NAME']) assert.deepEqual(ids(buildMyGroupDirectory(reversed, 'me', { sort }, at)), ids(buildMyGroupDirectory(state, 'me', { sort }, at)));
  state.groups = [group('z', 'HOBBY', { name: '같은 이름' }), group('a', 'HOBBY', { name: '같은 이름' })];
  assert.deepEqual(ids(buildMyGroupDirectory(state, 'me', {}, at)), ['a', 'z']);
});

test('membership removal or blocking immediately removes private plans and unread contributions without mutating any source', () => {
  const state = createEmptyState('me', '나'); state.groups = [group('family')];
  state.activities = [activity('trip', 'family', '2026-11-05')]; state.messages = [message('private', roomIdForActivity('trip'))];
  state.readCursors[roomIdForGroup('family')] = '2026-11-03T00:00:00Z';
  const before = JSON.stringify(state);
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  freeze(state);
  assert.equal(buildMyGroupDirectory(state, 'me', {}, at).groups[0].unreadCount, 1);
  assert.equal(JSON.stringify(state), before);
  const blocked = structuredClone(state); blocked.groups[0].blockedMemberIds = ['me'];
  assert.deepEqual(buildMyGroupDirectory(blocked, 'me', {}, at).groups, []);
  assert.equal(buildMyGroupDirectory(blocked, 'me', {}, at).counts.ALL, 0);
  const removed = structuredClone(state); removed.groups[0].memberIds = ['owner'];
  assert.deepEqual(buildMyGroupDirectory(removed, 'me', {}, at).groups, []);
  assert.equal(state.activities[0].participants.me, undefined);
});
