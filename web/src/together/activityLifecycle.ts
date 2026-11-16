import { canEditActivity, unpublishActivityFromGroup, type ActivityStatus, type TogetherState } from './model.ts';

/** Every management action resolves its original again, including actions beside the main Save. */
export function assertCurrentActivityEditor(state: TogetherState, actorId: string, groupId: string, activityId: string, expectedRevision: number) {
  const activity = state.activities.find(item => item.id === activityId && item.groupId === groupId);
  const group = state.groups.find(item => item.id === groupId);
  if (!activity || !group || !state.members.some(item => item.id === actorId) || group.blockedMemberIds?.includes(actorId) || !canEditActivity(state, actorId, activity)) throw new Error('현재 이 일정을 관리할 수 있는 담당자만 변경할 수 있어요.');
  if (!Number.isInteger(expectedRevision) || activity.revision !== expectedRevision) throw new Error('다른 사람이 일정을 변경했어요. 최신 내용을 확인한 뒤 다시 선택해 주세요.');
  return activity;
}

/** Restoring a mistaken completion/cancellation keeps the original conversations and participation. */
export function changeActivityLifecycle(state: TogetherState, actorId: string, groupId: string, activityId: string, expectedRevision: number, status: ActivityStatus) {
  const activity = assertCurrentActivityEditor(state, actorId, groupId, activityId, expectedRevision);
  if (!['PLANNED', 'COMPLETED', 'CANCELLED'].includes(status) || activity.status === status || status === 'COMPLETED' && activity.status === 'CANCELLED') throw new Error('현재 일정 상태를 확인하고 다시 선택해 주세요.');
  activity.status = status;
  activity.revision += 1;
  // Restoring a private original is not approval to republish a previous public snapshot.
  unpublishActivityFromGroup(state, activity.id);
  return activity;
}
