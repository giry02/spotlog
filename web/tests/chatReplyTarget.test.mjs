import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState, roomIdForGroup, roomIdForActivity } from '../src/together/model.ts';
import { canReplyToMessage, postTogetherMessage } from '../src/together/chatActions.ts';

function fixture() {
  const state = createEmptyState('viewer', '나');
  state.members.push({ id: 'friend', name: '친구' });
  state.groups.push({ id: 'group', name: '모임', kind: 'FRIENDS', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'viewer', memberIds: ['viewer', 'friend'], managerIds: [], archived: false, promotionPublished: false });
  state.activities.push({ id: 'activity', groupId: 'group', title: '약속', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'viewer', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.messages.push({ id: 'original', roomId: roomIdForActivity('activity'), authorId: 'friend', body: '원문', createdAt: '2026-11-10T00:00:00.000Z' });
  return state;
}

test('preparing a swipe reply is read-only and keeps the exact original room', () => {
  const state = fixture(), before = structuredClone(state);
  assert.equal(canReplyToMessage(state, 'viewer', roomIdForActivity('activity'), 'original'), true);
  assert.equal(canReplyToMessage(state, 'viewer', roomIdForGroup('group'), 'original'), false);
  assert.equal(canReplyToMessage(state, 'viewer', roomIdForActivity('missing'), 'original'), false);
  assert.equal(canReplyToMessage(state, 'viewer', roomIdForActivity('activity'), 'missing'), false);
  assert.deepEqual(state, before);
});

test('deleted original or current revoked/blocked/archived membership cancels reply preparation', () => {
  for (const change of [
    state => { state.messages[0].deleted = true; },
    state => { state.groups[0].memberIds = ['friend']; },
    state => { state.groups[0].blockedMemberIds = ['viewer']; },
    state => { state.groups[0].archived = true; },
  ]) {
    const state = fixture(); change(state); const before = structuredClone(state);
    assert.equal(canReplyToMessage(state, 'viewer', roomIdForActivity('activity'), 'original'), false);
    assert.deepEqual(state, before);
  }
});

test('send still rechecks a reply prepared before the original was deleted', () => {
  const state = fixture(), room = roomIdForActivity('activity');
  assert.equal(canReplyToMessage(state, 'viewer', room, 'original'), true);
  state.messages[0].deleted = true;
  const before = structuredClone(state);
  assert.throws(() => postTogetherMessage(state, 'viewer', room, '답장', undefined, 'original'));
  assert.deepEqual(state, before);
});
