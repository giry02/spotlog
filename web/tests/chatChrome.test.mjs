import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { chatComposerLayout, chatViewOptions, selectChatChromeContext } from '../src/together/chatChrome.ts';

function fixture() {
  const state = createEmptyState('me', '나');
  state.groups.push({ id: 'family', name: '가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'me', memberIds: ['me'], managerIds: [], archived: false, promotionPublished: false });
  state.activities.push({ id: 'trip', groupId: 'family', title: '가족 여행', kind: 'TRIP', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'me', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.notices.push({ id: 'group-notice', groupId: 'family', title: '모임 공지', body: 'GROUP', createdAt: '' }, { id: 'trip-notice', groupId: 'family', activityId: 'trip', title: '여행 공지', body: 'ACTIVITY', createdAt: '' });
  state.polls.push({ id: 'group-poll', groupId: 'family', question: '모임 투표', options: [], closed: false }, { id: 'trip-poll', groupId: 'family', activityId: 'trip', question: '여행 투표', options: [], closed: false });
  state.tasks.push({ id: 'group-task', groupId: 'family', title: '모임 준비', completed: false }, { id: 'trip-task', groupId: 'family', activityId: 'trip', title: '여행 준비', completed: false });
  for (const [type, id, roomId] of [['POLL', 'group-poll', 'group:family'], ['TASK', 'group-task', 'group:family'], ['POLL', 'trip-poll', 'activity:trip'], ['TASK', 'trip-task', 'activity:trip']]) state.messages.push({ id: `${id}-message`, roomId, authorId: 'me', body: '', createdAt: '', entity: { type, id } });
  return state;
}

test('room menu preserves group destinations and separate trip preparation/record destinations', () => {
  assert.deepEqual(chatViewOptions().map(item => item.id), ['home', 'activities', 'board', 'album', 'chat']);
  assert.deepEqual(chatViewOptions({ kind: 'TRIP' }).map(item => item.id), ['schedule', 'prep', 'record', 'chat']);
  assert.equal(chatViewOptions().find(item => item.id === 'activities').label, '약속·여행');
});

test('compact context never mixes whole-group notices/polls/tasks with an activity room', () => {
  const state = fixture(), before = structuredClone(state);
  const whole = selectChatChromeContext(state, 'me', 'family');
  const trip = selectChatChromeContext(state, 'me', 'family', 'trip');
  assert.deepEqual(whole.notices.map(item => item.id), ['group-notice']);
  assert.deepEqual(trip.notices.map(item => item.id), ['trip-notice']);
  assert.deepEqual(whole.messages.map(item => item.entity.id), ['group-poll', 'group-task']);
  assert.deepEqual(trip.messages.map(item => item.entity.id), ['trip-poll', 'trip-task']);
  assert.equal(whole.pollCount, 1); assert.equal(whole.taskCount, 1);
  assert.deepEqual(state, before, 'opening context never changes reading, votes, tasks or attendance');
});

test('counts follow current original objects, deduplicate refs and ignore missing/cross-room entities', () => {
  const state = fixture();
  state.messages.push({ ...state.messages[0], id: 'duplicate-ref' }, { ...state.messages[0], id: 'bad-room', roomId: 'activity:trip' });
  assert.equal(selectChatChromeContext(state, 'me', 'family').pollCount, 1);
  state.polls[0].closed = true; state.tasks[0].completed = true;
  const whole = selectChatChromeContext(state, 'me', 'family');
  assert.equal(whole.pollCount, 0); assert.equal(whole.taskCount, 0);
  assert.deepEqual(whole.messages, []);
  assert.equal(selectChatChromeContext(state, 'me', 'family', 'trip').pollCount, 1);
  state.polls = [];
  assert.equal(selectChatChromeContext(state, 'me', 'family', 'trip').pollCount, 0);
});

test('revoked/blocked membership, foreign activity and a standalone group room expose no context', () => {
  for (const mutate of [state => state.groups[0].memberIds = [], state => state.groups[0].blockedMemberIds = ['me']]) {
    const state = fixture(); mutate(state);
    const context = selectChatChromeContext(state, 'me', 'family');
    assert.deepEqual(context.notices, []); assert.deepEqual(context.messages, []);
  }
  const state = fixture();
  assert.deepEqual(selectChatChromeContext(state, 'me', 'family', 'missing').notices, []);
  state.groups[0].spaceType = 'ACTIVITY';
  assert.deepEqual(selectChatChromeContext(state, 'me', 'family').notices, []);
  assert.deepEqual(selectChatChromeContext(state, 'me', 'family', 'trip').notices.map(item => item.id), ['trip-notice']);
});

test('short keyboard-height viewports give the preview selectable space before reserving room for messages', () => {
  for (const height of [240, 260, 300]) {
    const layout = chatComposerLayout(height, 56, 76, true);
    assert.equal(layout.compactExtras, true);
    assert.ok(layout.previewHeight >= 96, `${height}px must fit the preview's controls`);
    assert.ok(layout.reserve < 92, `${height}px cannot keep a fixed 92px conversation reserve`);
    assert.ok(56 + layout.dockHeight + layout.reserve <= height);
  }
});

test('very small available heights preserve at least one 44px preview target whenever it can fit with the header and composer', () => {
  for (const height of [176, 200, 220]) {
    const layout = chatComposerLayout(height, 56, 76, true);
    assert.ok(layout.previewHeight >= 44);
    assert.ok(56 + layout.dockHeight <= height);
    assert.equal(layout.reserve, 0);
  }
});

test('ordinary chat heights keep the existing reserve and compact chrome returns after previews close', () => {
  const ordinary = chatComposerLayout(844, 56, 76, true);
  assert.equal(ordinary.reserve, 120); assert.equal(ordinary.compactExtras, false);
  const short = chatComposerLayout(400, 56, 76, true);
  assert.equal(short.reserve, 92); assert.equal(short.compactExtras, true);
  const closed = chatComposerLayout(240, 56, 76, false);
  assert.equal(closed.compactExtras, false); assert.equal(closed.previewHeight, 0);
});
