import type { Place } from '../data';
import { isSafeTogetherImageUrl } from './contentMedia.ts';
import { selectGroupMembers } from './groupContent.ts';
import { koreaDay } from './discovery.ts';
import { isPollClosed } from './polls.ts';
import { memberName, type TogetherState } from './model.ts';
import { selectGroupTasteMemory } from './groupTasteMemory.ts';

const image = (value?: string) => value && isSafeTogetherImageUrl(value) ? value : '';
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
function currentGroup(state: TogetherState, viewerId: string, groupId: string) {
  const group = state.groups.find(item => item.id === groupId);
  if (!viewerId || !state.members.some(item => item.id === viewerId) || !group || group.spaceType === 'ACTIVITY' || !group.memberIds.includes(viewerId) || group.blockedMemberIds?.includes(viewerId)) return null;
  return group;
}

/** A member activity hub, never a public discovery projection or personal-library query. */
export function selectGroupHomeDashboard(state: TogetherState, viewerId: string, groupId: string, catalog: Place[], at = new Date()) {
  const group = currentGroup(state, viewerId, groupId);
  if (!group) return null;
  const today = koreaDay(at), activities = state.activities.filter(item => item.groupId === groupId);
  const activityIds = new Set(activities.map(item => item.id));
  const scope = (item: { groupId: string; activityId?: string }) => item.groupId === groupId && (!item.activityId || activityIds.has(item.activityId));
  const activeMembers = new Set(group.memberIds.filter(id => !group.blockedMemberIds?.includes(id) && state.members.some(item => item.id === id)));
  const members = (selectGroupMembers(state, viewerId, groupId) || []).map(({ id, name, avatar, role }) => ({ id, name, avatar, role }));
  const upcoming = activities.filter(item => item.status === 'PLANNED' && (!validDay(item.date) || (validDay(item.endDate) && item.endDate >= item.date ? item.endDate : item.date) >= today))
    .slice().sort((a, b) => `${validDay(a.date) ? a.date : '9999'}T${a.startTime || '99:99'}`.localeCompare(`${validDay(b.date) ? b.date : '9999'}T${b.startTime || '99:99'}`))
    .map(item => ({ id: item.id, title: item.title, date: validDay(item.date) ? item.date : '', endDate: validDay(item.endDate) ? item.endDate : '', startTime: item.startTime || '',
      kind: item.kind || (item.journey ? 'TRIP' as const : 'MEETUP' as const), cover: image(item.cover) || image(item.journey?.cover), venue: item.meetingPoint,
      participantCount: Object.entries(item.participants).filter(([id, value]) => value === 'JOINED' && activeMembers.has(id)).length,
      ownParticipation: item.participants[viewerId], capacity: item.capacity, routeCount: item.journey?.days.reduce((count, day) => count + day.places.length, 0) || 0 }));
  const posts = state.posts.filter(scope).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const media = state.media.filter(scope).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const photos = [
    ...media.filter(item => item.kind === 'PHOTO' && image(item.url)).map(item => ({ id: `media:${item.id}`, recordId: item.id, image: item.url, caption: item.caption, activityId: item.activityId, source: 'MEDIA' as const, createdAt: item.createdAt })),
    ...posts.flatMap(post => (post.attachments || []).filter(photo => image(photo.url)).map(photo => ({ id: `post:${post.id}:${photo.id}`, recordId: post.id, image: photo.url, caption: photo.caption || post.title, activityId: post.activityId, source: 'POST' as const, createdAt: post.createdAt }))),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seenPhotos = new Set<string>();
  const uniquePhotos = photos.filter(photo => { if (seenPhotos.has(photo.image)) return false; seenPhotos.add(photo.image); return true; });
  const placeIds = new Set(group.interestPlaceIds || []);
  const publicPlaces = new Map(catalog.filter(place => !place.personal).map(place => [place.id, place]));
  const places = [...placeIds].flatMap(id => { const place = publicPlaces.get(id); return place ? [place] : []; })
    .map(place => ({ id: place.id, name: place.name, kind: place.kind, area: place.area, image: image(place.image) }));
  const notices = state.notices.filter(item => item.groupId === groupId && !item.activityId).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const polls = state.polls.filter(item => item.groupId === groupId && !item.activityId);
  const challenges = (state.challenges || []).filter(item => item.groupId === groupId && !item.activityId && !item.closed && item.endDate >= today);
  const journalCount = state.sharedJournals.filter(scope).filter(item => !item.journey.trash && item.journey.purpose === 'JOURNAL' && item.journey.status === 'PUBLISHED').length;
  const taste = selectGroupTasteMemory(state, viewerId, groupId, catalog, {}, at);
  const pastActivityCount = activities.filter(item => item.status !== 'CANCELLED' && (item.status === 'COMPLETED' || validDay(item.endDate || item.date) && (item.endDate || item.date) < today)).length;
  const hasRecords = pastActivityCount > 0 || posts.length > 0 || media.length > 0 || journalCount > 0 || taste.totalRecordCount > 0;
  const lifecycle = group.archived ? 'ARCHIVED' as const : upcoming.length ? 'UPCOMING' as const : hasRecords ? 'RECORDS' as const : 'START' as const;
  return {
    group: { id: group.id, name: group.name, kind: group.kind, region: [group.region, group.discovery?.district].filter(Boolean).join(' · '), cover: image(group.cover), archived: group.archived, example: group.sourceKind === 'EXAMPLE' },
    canWrite: !group.archived, canManage: !group.archived && (group.ownerId === viewerId || group.managerIds.includes(viewerId)),
    memberCount: members.length, members: members.slice(0, 7),
    nextActivity: upcoming[0], upcoming: upcoming.slice(1, 4), upcomingCount: upcoming.length,
    lifecycle, pastActivityCount, hasRecords,
    taste: { placeCount: taste.totalPlaceCount, recordCount: taste.totalRecordCount },
    notice: notices[0] ? { id: notices[0].id, title: notices[0].title } : undefined,
    places: places.slice(0, 3), placeCount: places.length,
    recentPosts: posts.slice(0, 3).map(post => ({ id: post.id, activityId: post.activityId, activityTitle: activities.find(item => item.id === post.activityId)?.title || '',
      title: post.title, preview: post.body.replace(/\s+/g, ' ').slice(0, 120), category: post.category, author: memberName(state, post.authorId, groupId), createdAt: post.createdAt,
      photo: image(post.attachments?.find(photo => image(photo.url))?.url), commentCount: post.comments.length, likeCount: post.likes.length })),
    postCount: posts.length, photos: uniquePhotos.slice(0, 5), photoCount: uniquePhotos.length, mediaCount: media.length,
    journalCount,
    pendingApplicationCount: !group.archived && (group.ownerId === viewerId || group.managerIds.includes(viewerId)) ? state.applications.filter(item => item.groupId === groupId && item.status === 'PENDING').length : 0,
    tools: { openPolls: polls.filter(poll => !isPollClosed(poll, at)).length, challenges: challenges.length, challenge: challenges[0] ? { id: challenges[0].id, title: challenges[0].title } : undefined },
  };
}
export type GroupHomeDashboardModel = NonNullable<ReturnType<typeof selectGroupHomeDashboard>>;

/** Resolve again on click, keeping an appointment record in its own record tab. */
export function groupDashboardRecordDestination(state: TogetherState, viewerId: string, groupId: string, type: 'POST' | 'MEDIA' | 'JOURNAL', recordId: string) {
  const group = state.groups.find(item => item.id === groupId);
  if (!viewerId || !state.members.some(member => member.id === viewerId) || !group?.memberIds.includes(viewerId) || group.blockedMemberIds?.includes(viewerId)) return null;
  const item = type === 'POST' ? state.posts.find(post => post.id === recordId) : type === 'MEDIA' ? state.media.find(media => media.id === recordId) : state.sharedJournals.find(journal => journal.id === recordId && !journal.journey.trash && journal.journey.purpose === 'JOURNAL' && journal.journey.status === 'PUBLISHED');
  if (!item || item.groupId !== groupId || group.spaceType === 'ACTIVITY' && !item.activityId || item.activityId && !state.activities.some(activity => activity.id === item.activityId && activity.groupId === groupId)) return null;
  return { route: item.activityId ? `activity-${item.activityId}` : `group-${groupId}`, activityId: item.activityId,
    view: item.activityId ? 'record' : type === 'MEDIA' ? 'album' : 'board', recordView: type === 'MEDIA' ? 'media' as const : 'posts' as const,
    elementId: type === 'POST' ? `tg-post-${item.id}` : type === 'MEDIA' ? `tg-media-${item.id}` : `tg-journal-${item.id}` };
}
