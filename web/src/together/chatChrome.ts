import { readChatEntity } from './chatEntities.ts';
import { isMember, roomIdForActivity, roomIdForGroup, type TogetherActivity, type TogetherMessage, type TogetherState } from './model.ts';
import { isPollClosed } from './polls.ts';

/** Reserve conversation space only after the header, composer and selectable preview can fit. */
export function chatComposerLayout(availableHeight: number, headerHeight: number, composerHeight: number, hasExtras: boolean) {
  const dimension = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
  const height = dimension(availableHeight), header = dimension(headerHeight), composer = dimension(composerHeight);
  const compactExtras = hasExtras && height < 500;
  const preferredReserve = compactExtras ? 92 : 120;
  const reserve = hasExtras ? Math.min(preferredReserve, Math.max(0, height - header - composer - 96)) : preferredReserve;
  const dockHeight = Math.max(composer, height - header - reserve);
  return { compactExtras, reserve, dockHeight, previewHeight: hasExtras ? Math.max(0, dockHeight - composer) : 0 };
}

/** Navigation stays inside the current persistent group or its own private appointment. */
export function chatViewOptions(activity?: TogetherActivity) {
  return activity
    ? [{ id: 'schedule', label: '일정' }, { id: 'prep', label: '준비' }, { id: 'record', label: '기록' }, { id: 'chat', label: '대화' }]
    : [{ id: 'home', label: '모임 홈' }, { id: 'activities', label: '약속·여행' }, { id: 'board', label: '게시판' }, { id: 'album', label: '앨범' }, { id: 'chat', label: '대화' }];
}

/** Resolve the compact context strip from current room data, never copied text or another room's objects. */
export function selectChatChromeContext(state: TogetherState, userId: string, groupId: string, activityId?: string) {
  const empty = { notices: [] as TogetherState['notices'], messages: [] as TogetherMessage[], pollCount: 0, taskCount: 0, challengeCount: 0 };
  const group = state.groups.find(item => item.id === groupId);
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  if (!group || !userId || !isMember(state, userId, groupId) || group.blockedMemberIds?.includes(userId) || activityId && !activity) return empty;
  // Standalone spaces never acquire a second, group-wide room.
  if (group.spaceType === 'ACTIVITY' && !activity) return empty;
  const roomId = activity ? roomIdForActivity(activity.id) : roomIdForGroup(group.id);
  const notices = state.notices.filter(item => item.groupId === groupId && (activity ? item.activityId === activity.id : !item.activityId)).slice().reverse();
  const seen = new Set<string>();
  let pollCount = 0, taskCount = 0, challengeCount = 0;
  const messages = state.messages.filter(message => {
    const entity = readChatEntity(state, userId, roomId, message);
    if (!(entity?.type === 'POLL' && !isPollClosed(entity.value) || entity?.type === 'TASK' && !entity.value.completed || entity?.type === 'CHALLENGE' && !entity.value.closed && entity.value.endDate >= new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()))) return false;
    const key = `${entity.type}:${entity.value.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (entity.type === 'POLL') pollCount++; else if (entity.type === 'CHALLENGE') challengeCount++; else taskCount++;
    return true;
  });
  return { notices, messages, pollCount, taskCount, challengeCount };
}
