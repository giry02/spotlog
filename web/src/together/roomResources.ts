import { roomIdForActivity, roomIdForGroup, type TogetherState } from './model.ts';

/** Read-only view. The room envelope is always rechecked; group rooms do not absorb activity records. */
export function selectRoomResources(state: TogetherState, userId: string, groupId: string, activityId?: string) {
  const group = state.groups.find(item => item.id === groupId);
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  if (!userId || !state.members.some(member => member.id === userId) || !group?.memberIds.includes(userId) || group.blockedMemberIds?.includes(userId)
    || activityId && !activity || group.spaceType === 'ACTIVITY' && !activity) return null;
  const scope = (item: { groupId: string; activityId?: string }) => item.groupId === groupId && item.activityId === activityId;
  const newest = <T extends { createdAt?: string }>(items: T[]) => items.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return { group, activity, roomId: activityId ? roomIdForActivity(activityId) : roomIdForGroup(groupId),
    media: newest(state.media.filter(scope)), notices: newest(state.notices.filter(scope)), polls: newest(state.polls.filter(scope)),
    tasks: state.tasks.filter(scope), games: newest((state.games || []).filter(scope)), challenges: (state.challenges || []).filter(scope),
    activities: activity ? [activity] : state.activities.filter(item => item.groupId === groupId), memberIds: [...group.memberIds] };
}
