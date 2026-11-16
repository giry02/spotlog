import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyState } from '../src/together/model.ts';
import { createTogetherRepository, isTogetherState, togetherStorageKey } from '../src/together/repository.ts';
import { selectAssignedTasks, toggleAssignedTask } from '../src/together/assignedTasks.ts';

function fixture() {
  const state = createEmptyState('owner', '운영자'); state.discoveryCatalogVersion = 3;
  state.members.push({ id: 'me', name: '내 계정' }, { id: 'other', name: '다른 멤버' });
  state.groups.push({ id: 'g', name: '가족 모임', kind: 'FAMILY', region: '부산', introduction: '', cover: '', ownerId: 'owner', memberIds: ['owner', 'me', 'other'], managerIds: [], archived: false, visibility: 'PRIVATE', promotionPublished: false });
  state.activities.push({ id: 'a', groupId: 'g', title: '함께할 약속', date: '2999-01-01', endDate: '', meetingPoint: '', description: '', status: 'PLANNED', leadId: 'owner', editorIds: [], participants: {}, arrivedIds: [], revision: 1 });
  state.tasks.push({ id: 'mine', groupId: 'g', activityId: 'a', title: '식당 확인', assigneeId: 'me', completed: false },
    { id: 'whole', groupId: 'g', title: '모임 안내', assigneeId: 'me', completed: false },
    { id: 'other-task', groupId: 'g', title: '다른 사람 준비', assigneeId: 'other', completed: false });
  return state;
}
const reject = (state, actor, id) => { const before = structuredClone(state); assert.throws(() => toggleAssignedTask(state, actor, id)); assert.deepEqual(state, before); };

test('assigned task index preserves exact room destination and only changes the current actor task without a chat card', () => {
  const state = fixture(), before = structuredClone(state), rows = selectAssignedTasks(state, 'me');
  assert.deepEqual(rows.map(row => [row.task.id, row.roomId, row.route, row.canInteract]), [['mine', 'activity:a', 'activity-a', true], ['whole', 'group:g', 'group-g', true]]);
  assert.deepEqual(state, before);
  toggleAssignedTask(state, 'me', 'mine'); before.tasks[0].completed = true;
  assert.deepEqual(state, before); assert.deepEqual(state.messages, []);
});

test('global task writes reject completed, cancelled and past appointments even through the real repository', () => {
  for (const change of [state => state.activities[0].status = 'COMPLETED', state => state.activities[0].status = 'CANCELLED', state => state.activities[0].date = '2000-01-01']) {
    const state = fixture(); change(state);
    assert.equal(isTogetherState(state), true);
    const memory = new Map([[togetherStorageKey('me'), JSON.stringify(state)]]);
    const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
    const repository = createTogetherRepository('me', '내 계정', [], storage);
    const before = structuredClone(repository.getSnapshot());
    assert.equal(selectAssignedTasks(before, 'me').find(row => row.task.id === 'mine').canInteract, false);
    assert.equal(repository.update(draft => toggleAssignedTask(draft, 'me', 'mine')), false);
    assert.deepEqual(repository.getSnapshot(), before);
    assert.equal(JSON.parse(memory.get(togetherStorageKey('me'))).tasks[0].completed, false);
  }
});

test('archive is readable and blocked, missing or revoked identities do not receive global task rows', () => {
  const archived = fixture(); archived.groups[0].archived = true;
  assert.equal(selectAssignedTasks(archived, 'me').every(row => !row.canInteract), true); reject(archived, 'me', 'mine');
  for (const change of [state => state.groups[0].blockedMemberIds = ['me'], state => state.groups[0].memberIds = ['owner'], state => state.members = state.members.filter(member => member.id !== 'me'), state => state.activities = []]) {
    const state = fixture(); change(state);
    assert.equal(selectAssignedTasks(state, 'me').some(row => row.task.id === 'mine'), false); reject(state, 'me', 'mine');
  }
  assert.deepEqual(selectAssignedTasks(fixture(), ''), []);
});

test('a rendered global row cannot preserve a revoked assignment or a newly closed appointment', () => {
  for (const change of [state => state.tasks[0].assigneeId = 'other', state => state.activities[0].status = 'COMPLETED', state => state.groups[0].archived = true]) {
    const state = fixture(); assert.equal(selectAssignedTasks(state, 'me')[0].canInteract, true);
    change(state); reject(state, 'me', 'mine');
  }
  reject(fixture(), 'owner', 'mine'); reject(fixture(), 'me', 'other-task');
});
