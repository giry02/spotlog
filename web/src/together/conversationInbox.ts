import { isMember, roomIdForActivity, roomIdForGroup, type TogetherState } from './model.ts';

export interface ConversationInboxItem {
  roomId: string; route: string; groupId: string; groupName: string; title: string;
  cover: string; type: 'GROUP' | 'ACTIVITY'; preview: string; updatedAt: string; unread: number; archived: boolean;
}
const entityLabels = { POLL: '투표를 공유했어요', TASK: '준비할 일을 공유했어요', ACTIVITY: '약속을 공유했어요', NOTICE: '공지를 공유했어요', GAME: '놀이를 공유했어요', CHALLENGE: '챌린지를 공유했어요' };

/** The inbox is an index into existing nested rooms, never a new public room or a read operation. */
export function selectConversationInbox(state: TogetherState, userId: string, at = Date.now()): ConversationInboxItem[] {
  if (!userId || !state.members.some(member => member.id === userId)) return [];
  const rooms: ConversationInboxItem[] = [];
  for (const group of state.groups) {
    if (!isMember(state, userId, group.id) || group.blockedMemberIds?.includes(userId)) continue;
    const activities = state.activities.filter(activity => activity.groupId === group.id);
    const candidates = [
      ...(group.spaceType !== 'ACTIVITY' ? [{ roomId: roomIdForGroup(group.id), route: `groupchat-${group.id}`, title: group.name, cover: group.cover, type: 'GROUP' as const }] : []),
      ...activities.map(activity => ({ roomId: roomIdForActivity(activity.id), route: `activitychat-${activity.id}`, title: activity.title, cover: activity.cover || group.cover, type: 'ACTIVITY' as const })),
    ];
    for (const room of candidates) {
      const messages = state.messages.filter(message => message.roomId === room.roomId && !message.deleted && Number.isFinite(Date.parse(message.createdAt)) && Date.parse(message.createdAt) <= at)
        .slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
      const last = messages.at(-1), cursor = state.readCursors[room.roomId];
      const cutoff = cursor === undefined ? -Infinity : Date.parse(cursor);
      const unread = Number.isNaN(cutoff) ? 0 : messages.filter(message => message.authorId !== userId && Date.parse(message.createdAt) > cutoff).length;
      rooms.push({ ...room, groupId: group.id, groupName: group.name, preview: last ? last.entity ? entityLabels[last.entity.type] : last.stickerId && !last.body ? '이모티콘' : last.body : '첫 대화를 나눠보세요', updatedAt: last?.createdAt || '', unread, archived: group.archived });
    }
  }
  return rooms.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0) || a.groupName.localeCompare(b.groupName, 'ko') || Number(a.type === 'ACTIVITY') - Number(b.type === 'ACTIVITY') || a.roomId.localeCompare(b.roomId));
}
