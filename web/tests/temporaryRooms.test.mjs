import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptInvite, canEditActivity, createEmptyState, isMember, setGroupParticipation } from '../src/together/model.ts';
import { closeTemporaryRoom, createTemporaryRoom, expireTemporaryRooms, isTemporaryRoomSettings, restoreTemporaryRoom } from '../src/together/temporaryRooms.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';
import { selectConversationInbox } from '../src/together/conversationInbox.ts';
import { memberAppointments } from '../src/community/platformModel.ts';
import { selectMemberRecords } from '../src/together/memberRecords.ts';
import { selectMemberProfile } from '../src/together/memberProfile.ts';
import { selectRoomResources } from '../src/together/roomResources.ts';
import { selectChatChromeContext } from '../src/together/chatChrome.ts';
import { readChatEntity } from '../src/together/chatEntities.ts';
import { getActivityPlacesContext } from '../src/together/activityPlaces.ts';
import { postTogetherMessage } from '../src/together/chatActions.ts';
import { canReadChatDigest } from '../src/together/chatDigest.ts';
import { getRoomGameContext } from '../src/together/roomGames.ts';
import { getChallengeContext } from '../src/together/challenges.ts';
import { getAssistantContext } from '../src/together/activityAssistant.ts';

const at = new Date('2099-04-10T00:00:00Z'), expiry = '2099-04-11T00:00:00.000Z';
function fixture(options = {}) {
  const state = createEmptyState('owner', '만든 사람');
  state.members.push({ id: 'manager', name: '매니저' }, { id: 'member', name: '참여자' }, { id: 'outsider', name: '외부인' });
  const ids = createTemporaryRoom(state, 'owner', { title: '금요일 회식', purpose: 'DINNER', expiresAt: expiry, ...options }, at);
  const group = state.groups[0], activity = state.activities[0];
  group.memberIds.push('manager', 'member'); group.managerIds.push('manager');
  activity.participants.member = 'JOINED'; activity.arrivedIds.push('member');
  state.messages.push({ id: 'message', roomId: `activity:${activity.id}`, authorId: 'member', body: '기록으로 보존할 대화', createdAt: at.toISOString() });
  state.tasks.push({ id: 'task', groupId: group.id, activityId: activity.id, title: '메뉴 고르기', completed: true });
  state.invites.push({ id: 'invite', intentId: 'intent', groupId: group.id, senderId: 'owner', name: group.name, kind: group.kind, region: '', acceptedBy: [], expiresAt: '2099-04-30T00:00:00Z', revoked: false });
  return { state, group, activity, ...ids };
}
function disk(initial) {
  const values = new Map(initial ? [[togetherStorageKey('owner'), JSON.stringify(initial)]] : []);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('one-off creation owns one private room without a public club, auto RSVP or invented participants', () => {
  const state = createEmptyState('owner', '나');
  const ids = createTemporaryRoom(state, 'owner', { title: '  거래처 식사  ', purpose: 'BUSINESS', region: ' 부산 ', date: '2099-04-12', startTime: '18:30' }, at);
  assert.equal(state.groups.length, 1); assert.equal(state.activities.length, 1);
  assert.equal(state.groups[0].spaceType, 'ACTIVITY'); assert.equal(state.groups[0].visibility, 'PRIVATE');
  assert.equal(state.groups[0].promotionPublished, false); assert.deepEqual(state.groups[0].memberIds, ['owner']);
  assert.equal(state.groups[0].temporaryRoom.purpose, 'BUSINESS'); assert.equal(state.groups[0].temporaryRoom.expiresAt, undefined);
  assert.equal(state.activities[0].groupId, ids.groupId); assert.equal(state.activities[0].id, ids.activityId);
  assert.equal(state.activities[0].title, '거래처 식사'); assert.deepEqual(state.activities[0].participants, {});
  assert.equal(isTogetherState(state), true);
});

test('invalid creation never leaves a partial backing group', () => {
  for (const input of [
    { title: '', purpose: 'DINNER' }, { title: '모임', purpose: 'UNKNOWN' }, { title: '모임', purpose: 'DINNER', date: '2099-02-30' },
    { title: '모임', purpose: 'DINNER', startTime: '18:00' }, { title: '모임', purpose: 'DINNER', date: '2099-04-12', startTime: '25:00' },
    { title: '모임', purpose: 'DINNER', expiresAt: at.toISOString() }, { title: '모임', purpose: 'DINNER', expiresAt: '2099-02-30T10:00:00Z' },
    { title: '모임', purpose: 'DINNER', date: '2099-04-12', startTime: '18:00', expiresAt: expiry },
  ]) {
    const state = createEmptyState('owner', '나'), before = structuredClone(state);
    assert.throws(() => createTemporaryRoom(state, 'owner', input, at)); assert.deepEqual(state, before);
  }
  const state = createEmptyState('owner', '나');
  assert.throws(() => createTemporaryRoom(state, 'unknown', { title: '모임', purpose: 'GATHERING' }, at));
});

test('owner or current manager can archive the exact one-off room, preserving all content and original attendance', () => {
  for (const actor of ['owner', 'manager']) {
    const { state, groupId, activityId } = fixture(), before = structuredClone(state);
    closeTemporaryRoom(state, actor, groupId, activityId, 1, 'ARCHIVE', at);
    assert.equal(state.groups[0].archived, true); assert.equal(state.groups[0].temporaryRoom.disposition, 'ARCHIVE');
    assert.equal(state.activities[0].status, 'COMPLETED'); assert.equal(state.activities[0].revision, 2);
    assert.equal(state.invites[0].revoked, true);
    assert.deepEqual(state.messages, before.messages); assert.deepEqual(state.tasks, before.tasks);
    assert.deepEqual(state.activities[0].participants, before.activities[0].participants); assert.deepEqual(state.activities[0].arrivedIds, before.activities[0].arrivedIds);
    assert.equal(isTogetherState(state), true); assert.equal(isMember(state, 'member', groupId), true);
    assert.equal(selectConversationInbox(state, 'member').length, 1);
    assert.equal(memberAppointments(state, 'member', 'past').length, 1);
    assert.throws(() => postTogetherMessage(state, 'member', `activity:${activityId}`, '추가 쓰기'));
    assert.throws(() => setGroupParticipation(state, activityId, 'member', 'DECLINED'));
    assert.throws(() => acceptInvite(state, 'invite', 'outsider'));
  }
});

test('stale, foreign, removed, blocked, ordinary member and unknown identities cannot close or discard a room', () => {
  for (const mutate of [
    value => { value.activity.revision = 2; }, value => { value.group.managerIds = []; },
    value => { value.group.memberIds = ['owner', 'member']; }, value => { value.group.blockedMemberIds = ['manager']; },
    value => { value.state.members = value.state.members.filter(item => item.id !== 'manager'); },
    value => { value.group.spaceType = 'GROUP'; },
  ]) {
    const value = fixture(); mutate(value); const before = structuredClone(value.state);
    assert.throws(() => closeTemporaryRoom(value.state, 'manager', value.groupId, value.activityId, 1, 'ARCHIVE', at));
    assert.deepEqual(value.state, before);
  }
  for (const actor of ['member', 'outsider', '']) {
    const { state, groupId, activityId } = fixture(), before = structuredClone(state);
    assert.throws(() => closeTemporaryRoom(state, actor, groupId, activityId, 1, 'ARCHIVE', at)); assert.deepEqual(state, before);
  }
  const { state, groupId, activityId } = fixture();
  assert.throws(() => closeTemporaryRoom(state, 'owner', 'foreign', activityId, 1, 'ARCHIVE', at));
  assert.throws(() => closeTemporaryRoom(state, 'owner', groupId, 'foreign', 1, 'ARCHIVE', at));
});

test('only the creator chooses Trash, retained bytes stay in storage and every member loses room/profile/resource access', () => {
  const { state, groupId, activityId } = fixture(), before = structuredClone(state);
  assert.throws(() => closeTemporaryRoom(state, 'manager', groupId, activityId, 1, 'TRASH', at));
  assert.deepEqual(state, before);
  closeTemporaryRoom(state, 'owner', groupId, activityId, 1, 'TRASH', at);
  const roomId = `activity:${activityId}`;
  for (const actorId of ['owner', 'manager', 'member']) {
    assert.equal(isMember(state, actorId, groupId), false);
    assert.equal(canEditActivity(state, actorId, state.activities[0]), false);
    assert.deepEqual(selectConversationInbox(state, actorId), []);
    assert.deepEqual(memberAppointments(state, actorId, 'past'), []);
    assert.equal(selectMemberRecords(state, actorId, groupId, actorId, activityId), null);
    assert.equal(selectMemberProfile(state, actorId, groupId, actorId, activityId), null);
    assert.equal(selectRoomResources(state, actorId, groupId, activityId), null);
    assert.deepEqual(selectChatChromeContext(state, actorId, groupId, activityId).notices, []);
    assert.equal(readChatEntity(state, actorId, roomId, { ...state.messages[0], entity: { type: 'TASK', id: 'task' } }), null);
    assert.equal(canReadChatDigest({ state, userId: actorId, groupId, roomId }), false);
    assert.throws(() => getActivityPlacesContext(state, actorId, { groupId, activityId }));
    assert.throws(() => getRoomGameContext(state, actorId, { groupId, activityId }));
    assert.throws(() => getChallengeContext(state, actorId, { groupId, activityId }));
    assert.throws(() => getAssistantContext(state, actorId, { groupId, activityId }));
  }
  assert.deepEqual(state.messages, before.messages); assert.deepEqual(state.tasks, before.tasks);
  assert.equal(state.groups[0].temporaryRoom.trashedAt, at.toISOString()); assert.equal(isTogetherState(state), true);
});

test('creator restores Trash as read-only archived history; invitations, RSVP, closed time and content never revive or change', () => {
  const { state, groupId, activityId } = fixture(); closeTemporaryRoom(state, 'owner', groupId, activityId, 1, 'TRASH', at);
  const before = structuredClone(state), later = new Date(at.getTime() + 1000);
  assert.throws(() => restoreTemporaryRoom(state, 'manager', groupId, activityId, 2, later));
  assert.throws(() => restoreTemporaryRoom(state, 'owner', groupId, activityId, 1, later));
  assert.deepEqual(state, before);
  restoreTemporaryRoom(state, 'owner', groupId, activityId, 2, later);
  assert.equal(state.groups[0].temporaryRoom.disposition, 'ARCHIVE'); assert.equal(state.groups[0].temporaryRoom.trashedAt, undefined);
  assert.equal(state.groups[0].temporaryRoom.closedAt, before.groups[0].temporaryRoom.closedAt);
  assert.equal(state.groups[0].archived, true); assert.equal(state.activities[0].status, 'COMPLETED');
  assert.equal(state.activities[0].revision, 3); assert.equal(state.invites[0].revoked, true);
  assert.deepEqual(state.messages, before.messages); assert.deepEqual(state.activities[0].participants, before.activities[0].participants);
  assert.equal(isMember(state, 'member', groupId), true); assert.equal(selectConversationInbox(state, 'member').length, 1);
  assert.throws(() => postTogetherMessage(state, 'owner', `activity:${activityId}`, '재개 불가'));
  assert.equal(isTogetherState(state), true);
});

test('configured expiry archives only explicit one-off spaces, without deleting ordinary groups or guessing a deadline', () => {
  const { state, groupId, activityId } = fixture();
  createTemporaryRoom(state, 'owner', { title: '직접 종료할 모임', purpose: 'GATHERING' }, at);
  const ordinary = { ...structuredClone(state.groups[0]), id: 'ordinary', spaceType: 'GROUP', temporaryRoom: undefined };
  state.groups.push(ordinary);
  assert.equal(expireTemporaryRooms(state, new Date(Date.parse(expiry) - 1)), 0);
  assert.equal(expireTemporaryRooms(state, new Date(expiry)), 1);
  assert.equal(state.groups[0].temporaryRoom.closeReason, 'EXPIRED'); assert.equal(state.groups[0].temporaryRoom.closedBy, undefined);
  assert.equal(state.groups[0].temporaryRoom.disposition, 'ARCHIVE'); assert.equal(state.groups[1].archived, false); assert.equal(ordinary.archived, false);
  const before = structuredClone(state); assert.equal(expireTemporaryRooms(state, new Date(Date.parse(expiry) + 1000)), 0); assert.deepEqual(state, before);
  closeTemporaryRoom(state, 'owner', groupId, activityId, 2, 'TRASH', new Date(Date.parse(expiry) + 2000));
  assert.equal(state.groups[0].temporaryRoom.closedAt, expiry); assert.equal(state.groups[0].temporaryRoom.closeReason, 'EXPIRED');
});

test('legacy schema-v1 remains valid while malformed or misplaced one-off metadata is rejected', () => {
  assert.equal(isTogetherState(createEmptyState('owner', '나')), true);
  for (const value of [null, {}, { purpose: 'UNKNOWN' }, { purpose: 'DINNER', expiresAt: 'invalid' },
    { purpose: 'DINNER', closedAt: at.toISOString() }, { purpose: 'DINNER', disposition: 'TRASH' },
    { purpose: 'DINNER', closedAt: at.toISOString(), closeReason: 'MANUAL', closedBy: 'owner', disposition: 'TRASH' },
    { purpose: 'DINNER', closedAt: at.toISOString(), closeReason: 'EXPIRED' },
  ]) assert.equal(isTemporaryRoomSettings(value), false);
  const { state } = fixture(); state.groups[0].spaceType = 'GROUP'; assert.equal(isTogetherState(state), false);
  state.groups[0].spaceType = 'ACTIVITY'; state.activities = []; assert.equal(isTogetherState(state), false);
});

test('repository reload persists expired room closure once and keeps stable frozen snapshots', () => {
  const { state } = fixture({ expiresAt: undefined });
  state.groups[0].temporaryRoom.expiresAt = '2000-01-01T00:00:00.000Z';
  const storage = disk(state), repo = createTogetherRepository('owner', '만든 사람', [], storage);
  const snapshot = repo.getSnapshot(); assert.equal(snapshot.groups[0].archived, true); assert.equal(snapshot.invites[0].revoked, true);
  assert.equal(snapshot.groups[0].temporaryRoom.closeReason, 'EXPIRED'); assert.ok(Object.isFrozen(snapshot));
  const bytes = storage.getItem(togetherStorageKey('owner'));
  assert.equal(repo.refreshTemporaryRooms(), true); assert.equal(repo.getSnapshot(), snapshot); assert.equal(storage.getItem(togetherStorageKey('owner')), bytes);
  const reopened = createTogetherRepository('owner', '만든 사람', [], storage);
  assert.deepEqual(reopened.getSnapshot(), snapshot);
});

test('expiry refresh preserves the last good snapshot and bytes if persistence fails', () => {
  const { state } = fixture(), storage = disk(state), repo = createTogetherRepository('owner', '만든 사람', [], storage);
  const before = repo.getSnapshot(), bytes = storage.getItem(togetherStorageKey('owner'));
  storage.setItem = () => { throw new Error('quota'); };
  assert.equal(repo.refreshTemporaryRooms(new Date(expiry)), false);
  assert.equal(repo.getSnapshot(), before); assert.equal(storage.getItem(togetherStorageKey('owner')), bytes);
  assert.match(repo.getError(), /종료 상태를 저장하지 못/);
});

test('a failed stale-tab expiry refresh loads newer records instead of overwriting them', () => {
  const { state } = fixture(), storage = disk(state), first = createTogetherRepository('owner', '만든 사람', [], storage), second = createTogetherRepository('owner', '만든 사람', [], storage);
  assert.equal(first.update(draft => { draft.activities[0].title = '다른 창의 변경'; draft.activities[0].revision++; }), true);
  assert.equal(second.refreshTemporaryRooms(new Date(expiry)), false);
  assert.equal(second.getSnapshot().activities[0].title, '다른 창의 변경'); assert.equal(second.getSnapshot().groups[0].archived, false);
  assert.equal(second.refreshTemporaryRooms(new Date(expiry)), true); assert.equal(second.getSnapshot().groups[0].archived, true);
});

test('direct invitation acceptance rejects an elapsed temporary deadline even before repository refresh', () => {
  const { state } = fixture(); state.groups[0].temporaryRoom.expiresAt = '2000-01-01T00:00:00Z';
  const before = structuredClone(state); assert.throws(() => acceptInvite(state, 'invite', 'outsider')); assert.deepEqual(state, before);
});

test('repository writes refresh a deadline first so a previously open composer cannot post after expiry', () => {
  const OriginalDate = globalThis.Date;
  let now = OriginalDate.now();
  class ReviewDate extends OriginalDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  globalThis.Date = ReviewDate;
  try {
    const state = createEmptyState('owner', '나');
    const { groupId, activityId } = createTemporaryRoom(state, 'owner', { title: '곧 닫힐 방', purpose: 'GATHERING', expiresAt: new Date(now + 1000).toISOString() });
    const storage = disk(state), repo = createTogetherRepository('owner', '나', [], storage);
    now += 1001;
    assert.equal(repo.update(draft => postTogetherMessage(draft, 'owner', `activity:${activityId}`, '기한 후 전송')), false);
    assert.equal(repo.getSnapshot().groups.find(item => item.id === groupId).archived, true);
    assert.equal(repo.getSnapshot().messages.length, 0);
    assert.equal(JSON.parse(storage.getItem(togetherStorageKey('owner'))).groups.find(item => item.id === groupId).temporaryRoom.disposition, 'ARCHIVE');
  } finally { globalThis.Date = OriginalDate; }
});
