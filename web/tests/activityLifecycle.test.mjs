import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { assertCurrentActivityEditor, changeActivityLifecycle } from '../src/together/activityLifecycle.ts';

function fixture() {
  const state = createEmptyState('owner', '나');
  state.members.push({ id: 'editor', name: '담당자' }, { id: 'member', name: '멤버' });
  state.groups.push({ id: 'group', name: '가족', kind: 'FAMILY', region: '부산', introduction: '', cover: '', visibility: 'PRIVATE', ownerId: 'owner', memberIds: ['owner', 'editor', 'member'], managerIds: [], archived: false, promotionPublished: false, promotionActivityIds: ['activity'], promotionActivitySnapshots: [] });
  state.activities.push({ id: 'activity', groupId: 'group', title: '약속', date: '', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'owner', editorIds: ['editor'], participants: { member: 'JOINED' }, arrivedIds: ['member'], revision: 3 });
  state.messages.push({ id: 'message', roomId: 'activity:activity', authorId: 'member', body: '유지할 대화', createdAt: '' });
  state.tasks.push({ id: 'task', groupId: 'group', activityId: 'activity', title: '준비', completed: true });
  return state;
}

test('completion and explicit restore retain the same participation, chats and preparation records', () => {
  const state = fixture(), before = structuredClone(state);
  changeActivityLifecycle(state, 'editor', 'group', 'activity', 3, 'COMPLETED');
  assert.equal(state.activities[0].status, 'COMPLETED');
  assert.equal(state.activities[0].revision, 4);
  assert.deepEqual(state.groups[0].promotionActivityIds, []);
  changeActivityLifecycle(state, 'owner', 'group', 'activity', 4, 'PLANNED');
  assert.equal(state.activities[0].status, 'PLANNED');
  assert.deepEqual(state.activities[0].participants, before.activities[0].participants);
  assert.deepEqual(state.activities[0].arrivedIds, before.activities[0].arrivedIds);
  assert.deepEqual(state.messages, before.messages);
  assert.deepEqual(state.tasks, before.tasks);
  assert.deepEqual(state.groups[0].promotionActivityIds, [], 'restoring never republishes a previous approval');
});

test('cancelled originals may be explicitly restored without copying an appointment or its records', () => {
  const state = fixture();
  changeActivityLifecycle(state, 'owner', 'group', 'activity', 3, 'CANCELLED');
  changeActivityLifecycle(state, 'owner', 'group', 'activity', 4, 'PLANNED');
  assert.equal(state.activities.length, 1);
  assert.equal(state.activities[0].id, 'activity');
  assert.equal(state.activities[0].revision, 5);
  assert.equal(state.messages[0].roomId, 'activity:activity');
});

test('a form opened before a revision update cannot change status or resolve an old copy source', () => {
  const state = fixture(); state.activities[0].revision = 4;
  const before = structuredClone(state);
  assert.throws(() => changeActivityLifecycle(state, 'owner', 'group', 'activity', 3, 'CANCELLED'));
  assert.throws(() => assertCurrentActivityEditor(state, 'owner', 'group', 'activity', 3));
  assert.deepEqual(state, before);
});

test('revoked editor, blocked member, archived group and foreign group fail without changes', () => {
  for (const change of [
    state => { state.activities[0].editorIds = []; },
    state => { state.groups[0].blockedMemberIds = ['editor']; },
    state => { state.groups[0].memberIds = ['owner', 'member']; },
    state => { state.groups[0].archived = true; },
    state => { state.members = state.members.filter(x => x.id !== 'editor'); },
  ]) {
    const state = fixture(); change(state); const before = structuredClone(state);
    assert.throws(() => changeActivityLifecycle(state, 'editor', 'group', 'activity', 3, 'COMPLETED'));
    assert.deepEqual(state, before);
  }
  const state = fixture();
  assert.throws(() => changeActivityLifecycle(state, 'owner', 'foreign', 'activity', 3, 'CANCELLED'));
  assert.throws(() => changeActivityLifecycle(state, 'member', 'group', 'activity', 3, 'CANCELLED'));
});

test('unknown statuses, repeated transitions and cancelled-to-completed are rejected without mutation', () => {
  for (const status of ['DRAFT', 'PLANNED', null]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => changeActivityLifecycle(state, 'owner', 'group', 'activity', 3, status));
    assert.deepEqual(state, before);
  }
  const state = fixture(); state.activities[0].status = 'CANCELLED'; const before = structuredClone(state);
  assert.throws(() => changeActivityLifecycle(state, 'owner', 'group', 'activity', 3, 'COMPLETED'));
  assert.deepEqual(state, before);
});

test('malformed expected revisions cannot bypass current-source checks', () => {
  const state = fixture();
  for (const revision of [undefined, NaN, Infinity, '3', 3.1]) assert.throws(() => assertCurrentActivityEditor(state, 'owner', 'group', 'activity', revision));
  assert.equal(assertCurrentActivityEditor(state, 'owner', 'group', 'activity', 3), state.activities[0]);
});
