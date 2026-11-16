import { koreaDay } from './discovery.ts';
import { isSafeTogetherImageUrl } from './contentMedia.ts';
import type { TogetherState } from './model.ts';

export type ActivityWorkspacePhase = 'UNSCHEDULED' | 'UPCOMING' | 'TODAY' | 'PAST' | 'CANCELLED' | 'ARCHIVED';
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

/** Presentation only: a date boundary never completes a trip or changes participation. */
export function selectActivityWorkspace(state: TogetherState, userId: string, groupId: string, activityId: string, at = new Date()) {
  const group = state.groups.find(item => item.id === groupId);
  const activity = state.activities.find(item => item.id === activityId && item.groupId === groupId);
  if (!group || !activity || !state.members.some(item => item.id === userId) || !group.memberIds.includes(userId) || group.blockedMemberIds?.includes(userId)) return null;
  const today = koreaDay(at), start = validDay(activity.date) ? activity.date : '';
  const end = validDay(activity.endDate) && activity.endDate >= start ? activity.endDate : start;
  const phase: ActivityWorkspacePhase = activity.status === 'CANCELLED' ? 'CANCELLED' : group.archived ? 'ARCHIVED' : activity.status === 'COMPLETED' ? 'PAST' : !start ? 'UNSCHEDULED' : end < today ? 'PAST' : start <= today && today <= end ? 'TODAY' : 'UPCOMING';
  const scope = (item: { groupId: string; activityId?: string }) => item.groupId === groupId && item.activityId === activityId;
  const posts = state.posts.filter(scope).slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const media = state.media.filter(scope).slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const photos = [
    ...media.filter(item => item.kind === 'PHOTO' && isSafeTogetherImageUrl(item.url)).map(item => ({ id: 'media:' + item.id, recordId: item.id, source: 'MEDIA' as const, image: item.url, caption: item.caption, createdAt: item.createdAt })),
    ...posts.flatMap(post => (post.attachments || []).filter(photo => isSafeTogetherImageUrl(photo.url)).map(photo => ({ id: 'post:' + post.id + ':' + photo.id, recordId: post.id, source: 'POST' as const, image: photo.url, caption: photo.caption || post.title, createdAt: post.createdAt }))),
  ].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const seen = new Set<string>();
  const uniquePhotos = photos.filter(photo => { if (seen.has(photo.image)) return false; seen.add(photo.image); return true; });
  const tasks = state.tasks.filter(scope), pending = tasks.filter(task => !task.completed);
  const ownPending = pending.filter(task => task.assigneeId === userId), sharedPending = pending.filter(task => !task.assigneeId);
  const journals = state.sharedJournals.filter(scope).filter(item => !item.journey.trash && item.journey.purpose === 'JOURNAL' && item.journey.status === 'PUBLISHED');
  return { phase, date: start, endDate: end, ownParticipation: activity.participants[userId],
    photos: uniquePhotos.slice(0, 4), photoCount: uniquePhotos.length, mediaCount: media.length,
    postCount: posts.length, reviewCount: posts.filter(post => post.category === 'REVIEW').length, journalCount: journals.length,
    tasks, ownPending, sharedPending, pendingCount: pending.length,
    writable: !group.archived && activity.status === 'PLANNED' && ['UNSCHEDULED','UPCOMING','TODAY'].includes(phase),
    hasRecords: uniquePhotos.length > 0 || posts.length > 0 || media.length > 0 || journals.length > 0,
  };
}
export type ActivityWorkspaceModel = NonNullable<ReturnType<typeof selectActivityWorkspace>>;
