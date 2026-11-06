import { readChatEntity } from './chatEntities.ts';
import { roomIdForActivity, roomIdForGroup, type TogetherActivity, type TogetherMessage, type TogetherState } from './model.ts';

/** Navigation stays inside the current persistent group or its own private appointment. */
export function chatViewOptions(activity?: TogetherActivity) {
  return activity
    ? [{ id: 'schedule', label: '일정' }, { id: 'prep', label: '준비' }, { id: 'record', label: '기록' }, { id: 'chat', label: '대화' }]
    : [{ id: 'home', label: '모임 홈' }, { id: 'activities', label: '약속·여행' }, { id: 'board', label: '게시판' }, { id: 'album', label: '앨범' }, { id: 'chat', label: '대화' }];
}

/** Resolve the compact context strip from current room data, never copied text or another room's objects. */
export function selectChatChromeContext(state: TogetherState, userId: string, groupId: string, activityId?: string) {
  const empty = { notices: [] as TogetherState['notices'], messages: [] as TogetherMessage[], pollCount: 0, taskCount: 0 };
  const group = state.groups.find(item => item.id === groupId);
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  if (!group || !userId || !group.memberIds.includes(userId) || group.blockedMemberIds?.includes(userId) || activityId && !activity) return empty;
  // Standalone spaces never acquire a second, group-wide room.
  if (group.spaceType === 'ACTIVITY' && !activity) return empty;
  const roomId = activity ? roomIdForActivity(activity.id) : roomIdForGroup(group.id);
  const notices = state.notices.filter(item => item.groupId === groupId && (activity ? item.activityId === activity.id : !item.activityId)).slice().reverse();
  const seen = new Set<string>();
  let pollCount = 0, taskCount = 0;
  const messages = state.messages.filter(message => {
    const entity = readChatEntity(state, userId, roomId, message);
    if (!(entity?.type === 'POLL' && !entity.value.closed || entity?.type === 'TASK' && !entity.value.completed)) return false;
    const key = `${entity.type}:${entity.value.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (entity.type === 'POLL') pollCount++; else taskCount++;
    return true;
  });
  return { notices, messages, pollCount, taskCount };
}
