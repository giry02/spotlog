import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, roomIdForActivity, roomIdForGroup } from '../src/together/model.ts';
import { selectMemberHomeReturn } from '../src/community/memberHomeReturn.ts';

const at = new Date('2026-11-06T12:00:00+09:00');
const group = (id, extra = {}) => ({ id, name: `비공개 ${id}`, kind: 'FAMILY', region: '부산', introduction: '비공개 소개',
  cover: '/private-family.jpg', visibility: 'PRIVATE', ownerId: 'owner', memberIds: ['me', 'owner'], managerIds: [],
  archived: false, promotionPublished: false, ...extra });
const activity = (id, groupId, date = '2026-11-07', extra = {}) => ({ id, groupId, title: `내 약속 ${id}`, date, endDate: date,
  meetingPoint: '비공개 상세 주소', description: '개인 메모', status: 'PLANNED', leadId: 'owner', editorIds: [],
  participants: {}, arrivedIds: [], revision: 1, journey: { secret: '개인 동선' }, ...extra });
const message = (id, roomId, extra = {}) => ({ id, roomId, authorId: 'owner', body: '비공개 대화 원문', createdAt: '2026-11-06T02:00:00Z', ...extra });
const fixture = () => {
  const state = createEmptyState('me', '나');
  state.groups = [group('family')];
  state.activities = [activity('trip', 'family')];
  state.messages = [message('hello', roomIdForGroup('family'))];
  return state;
};
const empty = { nextActivity: null, unreadChat: null };

test('guest, unknown viewer and former owner receive no private return data', () => {
  const state = fixture();
  assert.deepEqual(selectMemberHomeReturn(state, '', at), empty);
  assert.deepEqual(selectMemberHomeReturn(state, undefined, at), empty);
  assert.deepEqual(selectMemberHomeReturn(state, 'stranger', at), empty);
  state.groups[0].ownerId = 'me'; state.groups[0].memberIds = ['owner'];
  assert.deepEqual(selectMemberHomeReturn(state, 'me', at), empty);
  state.groups[0].memberIds.push('unknown-account');
  assert.deepEqual(selectMemberHomeReturn(state, 'unknown-account', at), empty);
});

test('current private membership is sufficient without public promotion, and output is an explicit small allowlist', () => {
  const state = fixture(); const selected = selectMemberHomeReturn(state, 'me', at);
  assert.deepEqual(selected.nextActivity, { id: 'trip', groupId: 'family', groupName: '비공개 family', title: '내 약속 trip', date: '2026-11-07', endDate: '2026-11-07' });
  assert.deepEqual(selected.unreadChat, { groupId: 'family', groupName: '비공개 family', unreadCount: 1 });
  const serialized = JSON.stringify(selected);
  for (const secret of ['비공개 대화 원문', '비공개 상세 주소', '개인 메모', '개인 동선', '/private-family.jpg', 'memberIds', 'participants', 'ownerId', 'authorId']) assert.equal(serialized.includes(secret), false, secret);
});

test('archiving, blocking and membership removal immediately remove both private links', () => {
  const source = fixture();
  for (const change of [state => { state.groups[0].archived = true; }, state => { state.groups[0].blockedMemberIds = ['me']; }, state => { state.groups[0].memberIds = ['owner']; }]) {
    const state = structuredClone(source); change(state);
    assert.deepEqual(selectMemberHomeReturn(state, 'me', at), empty);
  }
});

test('nearest next activity includes ongoing travel and standalone appointments, but not declined, cancelled, completed or malformed dates', () => {
  const state = fixture(); state.groups.push(group('standalone', { spaceType: 'ACTIVITY' }));
  state.activities = [activity('future', 'family', '2026-11-10'),
    activity('declined', 'family', '2026-11-06', { participants: { me: 'DECLINED' } }),
    activity('cancelled', 'family', '2026-11-02', { endDate: '2026-11-12', status: 'CANCELLED' }),
    activity('completed', 'family', '2026-11-02', { endDate: '2026-11-12', status: 'COMPLETED' }),
    activity('bad-date', 'family', '2026-02-30', { endDate: '2026-11-12' }),
    activity('undated', 'family', ''), activity('ended', 'family', '2026-11-05'),
    activity('ongoing', 'standalone', '2026-11-04', { endDate: '2026-11-06' })];
  assert.equal(selectMemberHomeReturn(state, 'me', at).nextActivity.id, 'ongoing');
  assert.equal(selectMemberHomeReturn(state, 'me', new Date('2026-11-06T15:00:00Z')).nextActivity.id, 'future');
});

test('valid times sort the nearest calendar day and malformed/reversed end dates cannot prolong an expired plan', () => {
  const state = fixture();
  state.activities = [activity('no-time', 'family'), activity('later', 'family', '2026-11-07', { startTime: '18:00' }),
    activity('earlier', 'family', '2026-11-07', { startTime: '09:30' }),
    activity('bad-end', 'family', '2026-11-04', { endDate: '2026-11-40' }),
    activity('reverse-end', 'family', '2026-11-04', { endDate: '2026-11-03' })];
  const selected = selectMemberHomeReturn(state, 'me', at);
  assert.equal(selected.nextActivity.id, 'earlier'); assert.equal(selected.nextActivity.startTime, '09:30');
  state.activities = [activity('bad-time', 'family', '2026-11-07', { startTime: '32:14' })];
  assert.equal('startTime' in selectMemberHomeReturn(state, 'me', at).nextActivity, false);
});

test('unread destinations are exact eligible rooms and cancelled/declined/completed or foreign activity rooms are excluded', () => {
  const state = fixture(); state.groups.push(group('other', { memberIds: ['owner'] }), group('one-off', { spaceType: 'ACTIVITY' }));
  state.activities.push(activity('cancelled', 'family', '2026-11-07', { status: 'CANCELLED' }),
    activity('done', 'family', '2026-11-07', { status: 'COMPLETED' }),
    activity('declined', 'family', '2026-11-07', { participants: { me: 'DECLINED' } }),
    activity('foreign', 'other'), activity('one-off-activity', 'one-off'));
  state.messages = [message('eligible', roomIdForActivity('trip')),
    ...['cancelled', 'done', 'declined', 'foreign', 'one-off-activity', 'unknown'].map(id => message(id, roomIdForActivity(id), { createdAt: '2026-11-06T02:30:00Z' })),
    message('prefix-match', 'group:family-extra', { createdAt: '2026-11-06T02:50:00Z' })];
  assert.deepEqual(selectMemberHomeReturn(state, 'me', at).unreadChat, { groupId: 'family', groupName: '비공개 family', activityId: 'trip', activityTitle: '내 약속 trip', unreadCount: 1 });
  state.activities[0].status = 'CANCELLED';
  assert.equal(selectMemberHomeReturn(state, 'me', at).unreadChat, null);
});

test('unread respects current cursor, deletion, self, invalid dates and future timestamps; invalid cursors fail closed', () => {
  const state = fixture(); const room = roomIdForGroup('family');
  state.readCursors[room] = '2026-11-06T01:00:00Z';
  state.messages.push(message('self', room, { authorId: 'me' }), message('deleted', room, { deleted: true }),
    message('before', room, { createdAt: '2026-11-06T00:59:59Z' }), message('equal', room, { createdAt: '2026-11-06T01:00:00Z' }),
    message('future', room, { createdAt: '2026-11-06T03:00:01Z' }), message('invalid', room, { createdAt: 'bad' }));
  assert.equal(selectMemberHomeReturn(state, 'me', at).unreadChat.unreadCount, 1);
  state.readCursors[room] = 'bad';
  assert.equal(selectMemberHomeReturn(state, 'me', at).unreadChat, null);
});

test('the most recently unread eligible room wins deterministically, independently of source order', () => {
  const state = fixture(); state.groups.push(group('hobby'));
  state.messages.push(message('newer', roomIdForGroup('hobby'), { createdAt: '2026-11-06T02:30:00Z' }));
  assert.equal(selectMemberHomeReturn(state, 'me', at).unreadChat.groupId, 'hobby');
  state.messages[0].createdAt = '2026-11-06T02:30:00Z';
  const result = selectMemberHomeReturn(state, 'me', at);
  state.groups.reverse(); state.messages.reverse();
  assert.deepEqual(selectMemberHomeReturn(state, 'me', at), result);
});

test('deeply frozen source is unchanged, including read cursors, participation and message content', () => {
  const state = fixture(); state.readCursors[roomIdForGroup('family')] = '2026-11-05T00:00:00Z';
  const before = JSON.stringify(state);
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  freeze(state); assert.ok(selectMemberHomeReturn(state, 'me', at).unreadChat);
  assert.equal(JSON.stringify(state), before);
  assert.throws(() => selectMemberHomeReturn(state, 'me', new Date('bad')), RangeError);
});
