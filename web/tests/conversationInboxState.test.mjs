import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { selectConversationInbox } from '../src/together/conversationInbox.ts';
import { createConversationInboxView, resolveConversationInboxView, acceptConversationInboxView, filterConversationInbox } from '../src/together/conversationInboxState.ts';

function fixture() {
  const state = createEmptyState('me', '나'); state.members.push({ id: 'other', name: '멤버' });
  state.groups.push({ id: 'family', name: '부산 가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', ownerId: 'me', memberIds: ['me', 'other'], managerIds: [], archived: false });
  state.activities.push({ id: 'trip', groupId: 'family', title: '바다 여행', kind: 'TRIP', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'me', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.messages.push({ id: 'm', roomId: 'activity:trip', authorId: 'other', body: '안 읽은 대화', createdAt: '2026-11-15T00:00:00Z' });
  return state;
}

test('same actor room round-trip keeps query, selected room kind and scroll without persisting or marking read', () => {
  const state = fixture(), before = structuredClone(state);
  const retained = acceptConversationInboxView(createConversationInboxView('me'), 'me', { actorId: 'me', query: '가족', filter: 'ACTIVITY', scrollTop: 438 });
  const returned = resolveConversationInboxView(structuredClone(retained), 'me');
  assert.deepEqual(returned, retained);
  const rooms = filterConversationInbox(selectConversationInbox(state, 'me'), returned);
  assert.deepEqual(rooms.map(room => room.route), ['activitychat-trip']); assert.deepEqual(state, before);
});

test('logout and actor changes synchronously hide previous search, filter and scroll', () => {
  const previous = { actorId: 'me', query: '내 비공개 검색', filter: 'UNREAD', scrollTop: 420 };
  assert.deepEqual(resolveConversationInboxView(previous, 'other'), createConversationInboxView('other'));
  const loggedOut = resolveConversationInboxView(previous, '');
  assert.deepEqual(loggedOut, createConversationInboxView(''));
  assert.deepEqual(resolveConversationInboxView(loggedOut, 'me'), createConversationInboxView('me'));
  assert.equal(previous.query, '내 비공개 검색', 'the input snapshot was not mutated');
});

test('late search or scroll updates cannot revive the prior actor session', () => {
  const current = { actorId: 'other', query: '새 검색', filter: 'GROUP', scrollTop: 18 };
  const stale = { actorId: 'me', query: '이전 계정', filter: 'UNREAD', scrollTop: 800 };
  assert.deepEqual(acceptConversationInboxView(current, 'other', stale), current);
  assert.deepEqual(acceptConversationInboxView(current, '', stale), createConversationInboxView(''));
});

test('clear conditions returns existing rooms, including when unread results become empty after explicit reading', () => {
  const state = fixture();
  const search = { actorId: 'me', query: '없는 방', filter: 'ACTIVITY', scrollTop: 200 };
  assert.equal(filterConversationInbox(selectConversationInbox(state, 'me'), search).length, 0);
  assert.equal(filterConversationInbox(selectConversationInbox(state, 'me'), createConversationInboxView('me')).length, 2);
  const unread = { ...search, query: '', filter: 'UNREAD' };
  assert.equal(filterConversationInbox(selectConversationInbox(state, 'me'), unread).length, 1);
  state.readCursors['activity:trip'] = '2026-11-15T00:00:00Z';
  assert.equal(filterConversationInbox(selectConversationInbox(state, 'me'), unread).length, 0);
  assert.equal(filterConversationInbox(selectConversationInbox(state, 'me'), createConversationInboxView('me')).length, 2);
});

test('invalid restored view values do not create invalid filters or off-screen scroll positions', () => {
  assert.deepEqual(resolveConversationInboxView({ actorId: 'me', query: null, filter: 'INVALID', scrollTop: Infinity }, 'me'), createConversationInboxView('me'));
  assert.equal(resolveConversationInboxView({ actorId: 'me', query: '가족', filter: 'ALL', scrollTop: -32 }, 'me').scrollTop, 0);
});
