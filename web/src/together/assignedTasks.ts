import { roomIdForActivity, roomIdForGroup, type TogetherState } from './model.ts';
import { readRoomTask, toggleRoomTask } from './chatEntities.ts';

/** A private index of existing assigned tasks, using the owning room's current access rules. */
export function selectAssignedTasks(state: TogetherState, actorId: string) {
  return state.tasks.flatMap(task => {
    if (!actorId || task.assigneeId !== actorId) return [];
    const roomId = task.activityId ? roomIdForActivity(task.activityId) : roomIdForGroup(task.groupId);
    const projection = readRoomTask(state, actorId, roomId, task.id);
    if (!projection) return [];
    return [{ task: projection.value, roomId, canInteract: projection.canInteract,
      groupName: state.groups.find(group => group.id === task.groupId)?.name || '',
      route: task.activityId ? `activity-${task.activityId}` : `group-${task.groupId}` }];
  });
}

/** The global list must not retain old assignment or lifecycle permissions across a repository write. */
export function toggleAssignedTask(state: TogetherState, actorId: string, taskId: string) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!actorId || !task || task.assigneeId !== actorId) throw new Error('현재 내가 맡은 준비 항목만 바꿀 수 있어요.');
  return toggleRoomTask(state, actorId, task.activityId ? roomIdForActivity(task.activityId) : roomIdForGroup(task.groupId), taskId);
}
