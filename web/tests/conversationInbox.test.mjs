import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectConversationInbox } from '../src/together/conversationInbox.ts';

const at = Date.parse('2026-11-09T03:00:00Z');
const timestamp = offset => new Date(at + offset).toISOString();
const group = (id, overrides = {}) => ({ id, name: `모임 ${id}`, kind: 'FAMILY', region: '부산', introduction: '', cover: `${id}-cover`, visibility: 'PRIVATE', ownerId: 'me', memberIds: ['me', 'other'], managerIds: [], archived: false, promotionPublished: false, ...overrides });
const activity = (id, groupId = 'family', overrides = {}) => ({ id, groupId, title: `약속 ${id}`, kind: 'TRIP', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'me', editorIds: [], participants: { me: 'DECLINED' }, arrivedIds: [], revision: 1, ...overrides });
const message = (id, roomId = 'group:family', overrides = {}) => ({ id, roomId, authorId: 'other', body: `원문 ${id}`, createdAt: timestamp(-1000), ...overrides });
function fixture() {
  const state = createEmptyState('me', '나');
  state.members.push({ id: 'other', name: '다른 참여자' });
  state.groups.push(group('family'), group('friends'), group('outsider', { memberIds: ['other'] }));
  state.activities.push(activity('trip'), activity('coffee', 'family', { kind: 'MEETUP', status: 'COMPLETED' }), activity('friends-trip', 'friends'), activity('outsider-trip', 'outsider'), activity('orphan', 'missing-group'));
  return state;
}
const byRoom = state => new Map(selectConversationInbox(state, 'me', at).map(item => [item.roomId, item]));
const deepFreeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; };

test('only known current unblocked members see their group and exact nested activity rooms', () => {
  const state = fixture(), rooms = byRoom(state);
  assert.deepEqual([...rooms.keys()].sort(), ['activity:coffee', 'activity:friends-trip', 'activity:trip', 'group:family', 'group:friends']);
  assert.equal(rooms.has('group:outsider'), false); assert.equal(rooms.has('activity:outsider-trip'), false); assert.equal(rooms.has('activity:orphan'), false);
  for (const userId of ['', 'unknown', 'not-a-user']) assert.deepEqual(selectConversationInbox(state, userId, at), []);
  state.groups[0].memberIds.push('unknown');
  assert.deepEqual(selectConversationInbox(state, 'unknown', at), [], 'a group-only unknown identity does not become a valid account');
});

test('removed or blocked memberships immediately hide both whole-group and activity room indexes', () => {
  for (const revoke of [state => { state.groups[0].memberIds = ['other']; }, state => { state.groups[0].blockedMemberIds = ['me']; }]) {
    const state = fixture(); revoke(state);
    const rows = selectConversationInbox(state, 'me', at);
    assert.equal(rows.some(item => item.groupId === 'family'), false);
    assert.equal(rows.some(item => item.groupId === 'friends'), true);
  }
});

test('group and activity destinations preserve exact routes, titles, scopes and cover fallbacks without requiring RSVP', () => {
  const state = fixture(); state.activities[0].cover = 'trip-own-cover';
  const rooms = byRoom(state), whole = rooms.get('group:family'), trip = rooms.get('activity:trip'), coffee = rooms.get('activity:coffee');
  assert.deepEqual({ route: whole.route, groupId: whole.groupId, groupName: whole.groupName, title: whole.title, type: whole.type, cover: whole.cover }, { route: 'groupchat-family', groupId: 'family', groupName: '모임 family', title: '모임 family', type: 'GROUP', cover: 'family-cover' });
  assert.deepEqual({ route: trip.route, groupId: trip.groupId, title: trip.title, type: trip.type, cover: trip.cover }, { route: 'activitychat-trip', groupId: 'family', title: '약속 trip', type: 'ACTIVITY', cover: 'trip-own-cover' });
  assert.equal(coffee.cover, 'family-cover'); assert.equal(coffee.type, 'ACTIVITY');
  assert.equal(state.activities[0].participants.me, 'DECLINED', 'inbox visibility does not join the activity');
});

test('standalone ACTIVITY spaces expose their activity chat and suppress the otherwise plausible group chat', () => {
  const state = fixture(); state.groups[0].spaceType = 'ACTIVITY';
  state.messages.push(message('standalone-group', 'group:family', { body: '숨겨야 하는 전체방', createdAt: timestamp(0) }));
  const rooms = byRoom(state);
  assert.equal(rooms.has('group:family'), false); assert.equal(rooms.has('activity:trip'), true); assert.equal(rooms.has('activity:coffee'), true);
  assert.equal([...rooms.values()].some(item => item.preview === '숨겨야 하는 전체방'), false);
});

test('preview and unread selection use exact room IDs rather than a shared group or a string prefix', () => {
  const state = fixture();
  state.messages.push(message('group-only'), message('trip-only', 'activity:trip'), message('coffee-only', 'activity:coffee'), message('similar-prefix', 'activity:trip-extra', { createdAt: timestamp(0), body: '다른 방' }), message('not-a-member', 'group:outsider', { createdAt: timestamp(0), body: '비공개 다른 모임' }));
  const rooms = byRoom(state);
  assert.equal(rooms.get('group:family').preview, '원문 group-only');
  assert.equal(rooms.get('activity:trip').preview, '원문 trip-only');
  assert.equal(rooms.get('activity:coffee').preview, '원문 coffee-only');
  assert.equal(rooms.get('group:family').unread, 1); assert.equal(rooms.get('activity:trip').unread, 1); assert.equal(rooms.get('activity:coffee').unread, 1);
  assert.equal([...rooms.values()].some(item => /다른 방|비공개 다른 모임/.test(item.preview)), false);
});

test('unread excludes own, deleted, future, malformed-time and already-read messages but includes the cutoff instant', () => {
  const state = fixture(); state.readCursors['group:family'] = timestamp(-5000);
  state.messages.push(
    message('before', undefined, { createdAt: timestamp(-6000) }), message('cursor-equal', undefined, { createdAt: timestamp(-5000) }),
    message('unread'), message('cutoff-included', undefined, { createdAt: timestamp(0) }),
    message('own', undefined, { authorId: 'me', createdAt: timestamp(-10) }), message('deleted', undefined, { deleted: true, createdAt: timestamp(-2) }),
    message('future', undefined, { createdAt: timestamp(1) }), message('invalid', undefined, { createdAt: 'not-an-instant' }),
  );
  const row = byRoom(state).get('group:family');
  assert.equal(row.unread, 2); assert.equal(row.preview, '원문 cutoff-included'); assert.equal(row.updatedAt, timestamp(0));
  assert.equal(byRoom(state).get('activity:trip').unread, 0);
});

test('a malformed stored read cursor yields zero unread instead of widening the unread range', () => {
  const state = fixture(); state.messages.push(message('new'));
  for (const cursor of ['not-a-time', '', ' ', '2026-99-99T00:00:00Z']) {
    state.readCursors['group:family'] = cursor;
    const row = byRoom(state).get('group:family');
    assert.equal(row.unread, 0, `malformed cursor ${JSON.stringify(cursor)}`);
    assert.equal(row.preview, '원문 new', 'cursor corruption does not hide the authorized latest preview');
  }
  delete state.readCursors['group:family'];
  assert.equal(byRoom(state).get('group:family').unread, 1, 'an absent cursor is different from a corrupted stored cursor');
});

test('valid future read cursors give zero unread and changing one room cursor never marks another room read', () => {
  const state = fixture(); state.messages.push(message('group'), message('trip', 'activity:trip'));
  state.readCursors['group:family'] = timestamp(1000);
  const rooms = byRoom(state);
  assert.equal(rooms.get('group:family').unread, 0); assert.equal(rooms.get('activity:trip').unread, 1);
  assert.equal(state.readCursors['activity:trip'], undefined);
});

test('archived groups and completed or cancelled activities remain readable history without state changes', () => {
  const state = fixture(); state.groups[0].archived = true; state.activities[0].status = 'CANCELLED';
  state.messages.push(message('past', 'activity:coffee'), message('cancelled', 'activity:trip'));
  const before = structuredClone(state), rooms = byRoom(state);
  for (const id of ['group:family', 'activity:trip', 'activity:coffee']) assert.equal(rooms.get(id).archived, true);
  assert.equal(rooms.get('activity:trip').preview, '원문 cancelled'); assert.equal(rooms.get('activity:coffee').preview, '원문 past');
  assert.deepEqual(state, before);
});

test('previews preserve literal text, label sticker-only messages and use an empty-room invitation', () => {
  const state = fixture();
  state.messages.push(message('literal', 'group:family', { body: '  원문 그대로\n둘째 줄  ' }), message('sticker', 'activity:trip', { body: '', stickerId: 'bunny-hi' }), message('text-and-sticker', 'activity:coffee', { body: '함께 보낸 글', stickerId: 'bunny-hi' }));
  const rooms = byRoom(state);
  assert.equal(rooms.get('group:family').preview, '  원문 그대로\n둘째 줄  ');
  assert.equal(rooms.get('activity:trip').preview, '이모티콘'); assert.equal(rooms.get('activity:coffee').preview, '함께 보낸 글');
  assert.equal(rooms.get('group:friends').preview, '첫 대화를 나눠보세요'); assert.equal(rooms.get('group:friends').updatedAt, ''); assert.equal(rooms.get('group:friends').unread, 0);
});

test('entity previews describe the shared tool without leaking its body or requiring another room entity lookup', () => {
  const expected = { POLL: '투표를 공유했어요', TASK: '준비할 일을 공유했어요', ACTIVITY: '약속을 공유했어요', NOTICE: '공지를 공유했어요', GAME: '놀이를 공유했어요', CHALLENGE: '챌린지를 공유했어요' };
  for (const [type, preview] of Object.entries(expected)) {
    const state = fixture(); state.messages.push(message('entity', 'group:family', { body: '표시하지 않는 참조 본문', entity: { type, id: 'referenced-entity' } }));
    const row = byRoom(state).get('group:family');
    assert.equal(row.preview, preview); assert.equal(row.unread, 1);
  }
});

test('latest visible timestamps sort first while invalid or future messages cannot promote a room', () => {
  const state = fixture();
  state.messages.push(message('earlier', 'group:family', { createdAt: timestamp(-9000) }), message('latest', 'activity:coffee', { createdAt: timestamp(-100) }), message('middle', 'activity:trip', { createdAt: timestamp(-2000) }), message('future', 'group:friends', { createdAt: timestamp(1000) }), message('bad', 'activity:friends-trip', { createdAt: 'bad' }));
  const rooms = selectConversationInbox(state, 'me', at);
  assert.deepEqual(rooms.slice(0, 3).map(item => item.roomId), ['activity:coffee', 'activity:trip', 'group:family']);
  assert.equal(rooms.find(item => item.roomId === 'group:friends').updatedAt, '');
  assert.equal(rooms.find(item => item.roomId === 'activity:friends-trip').updatedAt, '');
});

test('equal-time messages and room rows remain deterministic after source arrays are reordered', () => {
  const state = fixture();
  state.groups[1].name = state.groups[0].name;
  state.messages.push(message('same-a', 'group:family', { body: '앞 ID 원문' }), message('same-z', 'group:family', { body: '뒤 ID 원문' }), message('trip', 'activity:trip'), message('coffee', 'activity:coffee'), message('friends', 'group:friends'), message('friends-trip', 'activity:friends-trip'));
  const expected = selectConversationInbox(state, 'me', at);
  const reordered = structuredClone(state); reordered.groups.reverse(); reordered.activities.reverse(); reordered.messages.reverse();
  assert.deepEqual(selectConversationInbox(reordered, 'me', at), expected);
  assert.equal(expected.find(item => item.roomId === 'group:family').preview, '뒤 ID 원문');
  assert.equal(expected.filter(item => item.groupId === 'family').find(item => item.type === 'GROUP').roomId, 'group:family');
});

test('selecting an inbox is read-only even with frozen state and detached output changes', () => {
  const state = fixture(); state.messages.push(message('group'), message('trip', 'activity:trip'));
  state.readCursors['group:family'] = timestamp(-10000);
  const before = structuredClone(state); deepFreeze(state);
  const rows = selectConversationInbox(state, 'me', at);
  rows.reverse(); rows[0].preview = '호출자만 바꾸는 미리보기'; rows[0].unread = 99;
  assert.deepEqual(state, before);
  assert.equal(selectConversationInbox(state, 'me', at).some(item => item.preview === '호출자만 바꾸는 미리보기' || item.unread === 99), false);
});
