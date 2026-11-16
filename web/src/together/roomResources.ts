import { isMember, roomIdForActivity, roomIdForGroup, type TogetherState } from './model.ts';
import { isSafeTogetherImageUrl } from './contentMedia.ts';

/** Read-only view. The room envelope is always rechecked; group rooms do not absorb activity records. */
export function selectRoomResources(state: TogetherState, userId: string, groupId: string, activityId?: string) {
  const group = state.groups.find(item => item.id === groupId);
  const activity = activityId ? state.activities.find(item => item.id === activityId && item.groupId === groupId) : undefined;
  if (!userId || !state.members.some(member => member.id === userId) || !group || !isMember(state, userId, groupId) || group.blockedMemberIds?.includes(userId)
    || activityId && !activity || group.spaceType === 'ACTIVITY' && !activity) return null;
  const scope = (item: { groupId: string; activityId?: string }) => item.groupId === groupId && item.activityId === activityId;
  const newest = <T extends { createdAt?: string }>(items: T[]) => items.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const memberIds = [...new Set(group.memberIds)].filter(id => !group.blockedMemberIds?.includes(id) && state.members.some(member => member.id === id));
  const participantIds = activity ? memberIds.filter(id => activity.participants[id] === 'JOINED') : [];
  const media = newest(state.media.filter(scope)), posts = newest(state.posts.filter(scope));
  const photos = [
    ...media.filter(item => item.kind === 'PHOTO' && isSafeTogetherImageUrl(item.url)).map(item => ({ id: `media:${item.id}`, recordId: item.id, source: 'MEDIA' as const, url: item.url, caption: item.caption, createdAt: item.createdAt })),
    ...posts.flatMap(post => (post.attachments || []).filter(item => isSafeTogetherImageUrl(item.url)).map(item => ({ id: `post:${post.id}:${item.id}`, recordId: post.id, source: 'POST' as const, url: item.url, caption: item.caption || post.title, createdAt: post.createdAt }))),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seenPhotos = new Set<string>();
  const uniquePhotos = photos.filter(item => { if (seenPhotos.has(item.url)) return false; seenPhotos.add(item.url); return true; });
  return { group, activity, roomId: activityId ? roomIdForActivity(activityId) : roomIdForGroup(groupId),
    media, posts, photos: uniquePhotos, notices: newest(state.notices.filter(scope)), polls: newest(state.polls.filter(scope)),
    tasks: state.tasks.filter(scope), games: newest((state.games || []).filter(scope)), challenges: (state.challenges || []).filter(scope),
    activities: activity ? [activity] : state.activities.filter(item => item.groupId === groupId), memberIds, participantIds };
}
