import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { readRoomTask, toggleRoomTask, shareChatEntity, toggleChatTask } from '../src/together/chatEntities.ts';
import { createSeedState, TOGETHER_REVIEW_MEMBER_ID } from '../src/together/seed.ts';

function fixture() {
  const state = createEmptyState('owner', '운영자');
  for (const id of ['manager', 'lead', 'editor', 'assignee', 'member', 'outsider']) state.members.push({ id, name: id });
  state.groups.push({ id: 'g', name: '검수 모임', kind: 'FRIENDS', region: '', introduction: '', cover: '', ownerId: 'owner', memberIds: ['owner', 'manager', 'lead', 'editor', 'assignee', 'member'], managerIds: ['manager'], archived: false });
  state.groups.push({ ...structuredClone(state.groups[0]), id: 'other', ownerId: 'outsider', memberIds: ['outsider', 'owner'], managerIds: [] });
  state.activities.push({ id: 'a', groupId: 'g', title: '약속', date: '2999-01-01', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'lead', editorIds: ['editor'], participants: {}, arrivedIds: [], revision: 1 });
  state.activities.push({ ...structuredClone(state.activities[0]), id: 'sibling' });
  state.tasks.push({ id: 'group-task', groupId: 'g', title: '모임 준비', assigneeId: 'assignee', completed: false },
    { id: 'activity-task', groupId: 'g', activityId: 'a', title: '원문에서 확인한 준비', assigneeId: 'assignee', completed: false, sourceMessageIds: ['source'] });
  state.messages.push({ id: 'source', roomId: 'activity:a', authorId: 'assignee', body: '제가 확인할게요.', createdAt: '2026-11-10T00:00:00Z' });
  return state;
}
function rejected(state, actor, roomId, taskId) {
  const before = structuredClone(state);
  assert.throws(() => toggleRoomTask(state, actor, roomId, taskId));
  assert.deepEqual(state, before);
}
function onlyCompletionChanged(state, actor, roomId, taskId) {
  const before = structuredClone(state), original = state.tasks.find(item => item.id === taskId);
  const projection = readRoomTask(state, actor, roomId, taskId);
  assert.equal(projection.type, 'TASK'); assert.equal(projection.value, original); assert.equal(projection.canInteract, true);
  assert.deepEqual(state, before);
  assert.equal(toggleRoomTask(state, actor, roomId, taskId), original);
  before.tasks.find(item => item.id === taskId).completed = !before.tasks.find(item => item.id === taskId).completed;
  assert.deepEqual(state, before);
}

test('legacy group tasks need no chat card and only the assignee or current group operators can update them', () => {
  for (const actor of ['owner', 'manager', 'assignee']) onlyCompletionChanged(fixture(), actor, 'group:g', 'group-task');
  for (const actor of ['lead', 'editor', 'member']) {
    const state = fixture(); assert.equal(readRoomTask(state, actor, 'group:g', 'group-task').canInteract, false);
    rejected(state, actor, 'group:g', 'group-task');
  }
});

test('source-linked preparation tasks saved without an entity card retain their source and accept exact-scope editors', () => {
  for (const actor of ['owner', 'manager', 'lead', 'editor', 'assignee']) onlyCompletionChanged(fixture(), actor, 'activity:a', 'activity-task');
  const state = fixture();
  assert.equal(state.messages.some(item => item.entity), false);
  assert.equal(readRoomTask(state, 'member', 'activity:a', 'activity-task').canInteract, false);
  rejected(state, 'member', 'activity:a', 'activity-task');
  delete state.tasks[1].assigneeId;
  rejected(state, 'assignee', 'activity:a', 'activity-task');
  onlyCompletionChanged(state, 'editor', 'activity:a', 'activity-task');
});

test('seed preparation assigned to the current owner works without adding synthetic messages', () => {
  const state = createSeedState(TOGETHER_REVIEW_MEMBER_ID, '검수', []);
  assert.equal(state.messages.some(item => item.entity?.type === 'TASK' && item.entity.id === 'family-task-reservation'), false);
  onlyCompletionChanged(state, TOGETHER_REVIEW_MEMBER_ID, 'activity:family-next', 'family-task-reservation');
});

test('guest, foreign, unregistered, blocked and revoked viewers never receive a task projection or change state', () => {
  const cases = [
    { actor: '' }, { actor: 'outsider' },
    { actor: 'ghost', change: state => { state.groups[0].memberIds.push('ghost'); state.tasks[1].assigneeId = 'ghost'; } },
    { actor: 'assignee', change: state => state.groups[0].blockedMemberIds = ['assignee'] },
    { actor: 'assignee', change: state => state.groups[0].memberIds = state.groups[0].memberIds.filter(id => id !== 'assignee') },
    { actor: 'owner', change: state => state.members = state.members.filter(item => item.id !== 'owner') },
  ];
  for (const { actor, change } of cases) {
    const state = fixture(); change?.(state); const before = structuredClone(state);
    assert.equal(readRoomTask(state, actor, 'activity:a', 'activity-task'), null); assert.deepEqual(state, before);
    rejected(state, actor, 'activity:a', 'activity-task');
  }
});

test('foreign, sibling, fabricated root and missing activity scopes are rejected even for an operator of both groups', () => {
  for (const roomId of ['group:g', 'group:other', 'activity:sibling', 'activity:missing', 'a', '']) {
    const state = fixture(); assert.equal(readRoomTask(state, 'owner', roomId, 'activity-task'), null);
    rejected(state, 'owner', roomId, 'activity-task');
  }
  const state = fixture();
  assert.equal(readRoomTask(state, 'owner', 'activity:a', 'group-task'), null);
  rejected(state, 'owner', 'activity:a', 'group-task');
  rejected(state, 'owner', 'activity:a', 'missing-task');
  for (const change of [s => s.activities = s.activities.filter(item => item.id !== 'a'), s => s.activities[0].groupId = 'other', s => s.tasks[1].activityId = '']) {
    const copy = fixture(); change(copy); assert.equal(readRoomTask(copy, 'owner', 'activity:a', 'activity-task'), null);
    rejected(copy, 'owner', 'activity:a', 'activity-task');
  }
});

test('standalone appointment backing spaces expose only their exact activity tasks', () => {
  const state = fixture(); state.groups[0].spaceType = 'ACTIVITY';
  assert.equal(readRoomTask(state, 'owner', 'group:g', 'group-task'), null);
  rejected(state, 'owner', 'group:g', 'group-task');
  rejected(state, 'owner', 'group:g', 'activity-task');
  onlyCompletionChanged(state, 'owner', 'activity:a', 'activity-task');
});

test('archived, completed, cancelled and past tasks stay readable but cannot change; KST end date governs ongoing plans', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-10T00:00:00+09:00').getTime() });
  for (const change of [s => s.groups[0].archived = true, s => s.activities[0].status = 'COMPLETED', s => s.activities[0].status = 'CANCELLED', s => s.activities[0].date = '2026-11-09', s => { s.activities[0].date = '2026-11-08'; s.activities[0].endDate = '2026-11-09'; }]) {
    const state = fixture(); change(state); const before = structuredClone(state);
    assert.equal(readRoomTask(state, 'owner', 'activity:a', 'activity-task').canInteract, false); assert.deepEqual(state, before);
    rejected(state, 'owner', 'activity:a', 'activity-task');
  }
  const archivedGroup = fixture(); archivedGroup.groups[0].archived = true;
  assert.equal(readRoomTask(archivedGroup, 'owner', 'group:g', 'group-task').canInteract, false);
  rejected(archivedGroup, 'owner', 'group:g', 'group-task');
  for (const dates of [{ date: '' }, { date: '2026-11-10' }, { date: '2026-11-08', endDate: '2026-11-10' }]) {
    const state = fixture(); Object.assign(state.activities[0], dates);
    onlyCompletionChanged(state, 'assignee', 'activity:a', 'activity-task');
  }
});

test('a prior readable projection does not preserve permissions after membership, assignment, status or scope changes', () => {
  for (const change of [s => s.groups[0].memberIds = ['owner'], s => s.groups[0].blockedMemberIds = ['assignee'], s => s.tasks[1].assigneeId = 'member', s => s.activities[0].status = 'COMPLETED', s => s.tasks[1].activityId = 'sibling']) {
    const state = fixture(); assert.equal(readRoomTask(state, 'assignee', 'activity:a', 'activity-task').canInteract, true);
    change(state); rejected(state, 'assignee', 'activity:a', 'activity-task');
  }
  const state = fixture(); assert.equal(readRoomTask(state, 'manager', 'group:g', 'group-task').canInteract, true);
  state.groups[0].managerIds = []; rejected(state, 'manager', 'group:g', 'group-task');
});

test('chat task updates still require a live exact-room card; list updates never recreate a missing or deleted card', () => {
  const state = fixture(), before = structuredClone(state);
  assert.throws(() => toggleChatTask(state, 'assignee', 'activity:a', 'activity-task')); assert.deepEqual(state, before);
  onlyCompletionChanged(state, 'assignee', 'activity:a', 'activity-task');
  const card = shareChatEntity(state, 'assignee', { type: 'TASK', id: 'activity-task' });
  assert.equal(toggleChatTask(state, 'assignee', 'activity:a', 'activity-task').completed, false);
  card.deleted = true; const deleted = structuredClone(state);
  assert.throws(() => toggleChatTask(state, 'assignee', 'activity:a', 'activity-task')); assert.deepEqual(state, deleted);
  onlyCompletionChanged(state, 'assignee', 'activity:a', 'activity-task');
  assert.equal(card.deleted, true); assert.equal(state.messages.length, deleted.messages.length);
});
