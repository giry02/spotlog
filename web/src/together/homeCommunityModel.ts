import type { GroupDiscoveryFilters } from './GroupDiscovery';
import type { ParticipationStatus, TogetherGroup, TogetherState } from './model';
import { roomIdForActivity, roomIdForGroup } from './model.ts';
import { discoveryProfile, filterDiscoveryGroups, isDiscoverableGroup, koreaDay, publicActivityTimeKey, topicOptions, upcomingPublicActivities, type PublicDiscoveryActivity } from './discovery.ts';

export interface HomePublicGroup {
  id: string; name: string; cover: string; region: string; district: string;
  category: string; emoji: string; welcome: string; example: boolean;
}
export interface HomePublicMeetup { group: HomePublicGroup; activity: PublicDiscoveryActivity }
export interface HomeMemberChat {
  groupId: string; groupName: string; activityId?: string; label: string;
  route: string; summaryRoute: string; unreadCount: number;
}
export interface HomeContinuation {
  groupId: string; groupName: string;
  activity?: { id: string; title: string; date: string; endDate: string; startTime?: string; participation?: ParticipationStatus };
  chat?: HomeMemberChat;
}

/** Region names are selected manually; no distance or GPS inference is made. */
export function homeCommunityFilters(state: TogetherState, region: string, query = ''): GroupDiscoveryFilters {
  const selected = region.trim().replace(/\s+/g, ' ');
  const filters: GroupDiscoveryFilters = { view: 'GROUPS', dateFilter: 'ALL', sort: 'SOONEST', ...(query.trim() ? { query: query.trim() } : {}) };
  if (!selected || ['ALL', '전체', '전체 지역', '국내'].includes(selected)) return filters;
  const groups = state.groups.filter(isDiscoverableGroup);
  if (groups.some(group => group.region === selected)) return { ...filters, region: selected };
  const compound = groups.find(group => {
    const district = discoveryProfile(group).district;
    return district && [group.region + ' ' + district, group.region + ' · ' + district].includes(selected);
  });
  if (compound) return { ...filters, region: compound.region, district: discoveryProfile(compound).district };
  const districtGroups = groups.filter(group => discoveryProfile(group).district === selected);
  if (districtGroups.length && new Set(districtGroups.map(group => group.region)).size === 1) return { ...filters, region: districtGroups[0].region, district: selected };
  // Unknown/ambiguous names remain exact filters, never silently widen to all regions.
  return { ...filters, region: selected };
}

export function canOpenHomeMemberTarget(state: TogetherState, userId: string, groupId: string, activityId?: string): boolean {
  const group = state.groups.find(item => item.id === groupId);
  if (!userId || !group || group.archived || !group.memberIds.includes(userId) || group.blockedMemberIds?.includes(userId)) return false;
  return !activityId || state.activities.some(item => item.id === activityId && item.groupId === groupId && item.status !== 'CANCELLED');
}

const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00+09:00')) && koreaDay(new Date(value + 'T12:00:00+09:00')) === value;
const publicGroup = (group: TogetherGroup): HomePublicGroup => {
  const profile = discoveryProfile(group);
  const topic = topicOptions.find(item => item.id === profile.topics[0]);
  return { id: group.id, name: group.name, cover: group.cover, region: group.region, district: profile.district, category: topic?.label || '모임', emoji: topic?.emoji || '👥', welcome: profile.welcome, example: group.sourceKind === 'EXAMPLE' };
};

/** Public discovery and the member-only continuation are projected separately. Never returns message text. */
export function selectHomeCommunity(state: TogetherState, userId: string, region: string, query = '', at = new Date()) {
  const filters = homeCommunityFilters(state, region, query);
  const publicGroups = filterDiscoveryGroups(state, { ...filters, sort: 'SOONEST' }, at);
  const meetups = publicGroups.flatMap(group => upcomingPublicActivities(state, group, at).map(activity => ({ group: publicGroup(group), activity })))
    .sort((a, b) => publicActivityTimeKey(a.activity.date, a.activity.startTime).localeCompare(publicActivityTimeKey(b.activity.date, b.activity.startTime)));
  const visibleGroups: TogetherGroup[] = [];
  const represented = new Set<string>();
  for (const group of publicGroups) {
    const category = discoveryProfile(group).topics[0] || '';
    if (!represented.has(category)) { visibleGroups.push(group); represented.add(category); }
    if (visibleGroups.length === 3) break;
  }
  for (const group of publicGroups) { if (visibleGroups.length === 3) break; if (!visibleGroups.includes(group)) visibleGroups.push(group); }
  let continuation: HomeContinuation | null = null;
  if (userId) {
    const joined = state.groups.filter(group => canOpenHomeMemberTarget(state, userId, group.id));
    const joinedIds = new Set(joined.map(group => group.id));
    const activities = state.activities.filter(activity => joinedIds.has(activity.groupId) && activity.status !== 'CANCELLED');
    const next = activities.filter(activity => activity.status === 'PLANNED' && activity.participants[userId] !== 'DECLINED' && validDay(activity.date)
      && (validDay(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity.date) >= koreaDay(at))
      .sort((a, b) => publicActivityTimeKey(a.date, a.startTime).localeCompare(publicActivityTimeKey(b.date, b.startTime)))[0];
    const rooms = joined.flatMap(group => [{ group, activityId: undefined as string | undefined, label: '전체 채팅', roomId: roomIdForGroup(group.id) },
      ...activities.filter(activity => activity.groupId === group.id).map(activity => ({ group, activityId: activity.id as string | undefined, label: activity.title, roomId: roomIdForActivity(activity.id) }))]);
    const unread = rooms.map(room => {
      const cursor = state.readCursors[room.roomId];
      const after = cursor ? Date.parse(cursor) : -Infinity;
      const messages = Number.isNaN(after) ? [] : state.messages.filter(message => message.roomId === room.roomId && !message.deleted && message.authorId !== userId
        && Number.isFinite(Date.parse(message.createdAt)) && Date.parse(message.createdAt) > after && Date.parse(message.createdAt) <= at.getTime());
      return { ...room, count: messages.length, latest: Math.max(-Infinity, ...messages.map(message => Date.parse(message.createdAt))) };
    }).filter(room => room.count).sort((a, b) => b.latest - a.latest);
    const chosenChat = unread[0];
    const group = next ? joined.find(item => item.id === next.groupId) : chosenChat?.group;
    if (group) continuation = {
      groupId: group.id, groupName: group.name,
      ...(next ? { activity: { id: next.id, title: next.title, date: next.date, endDate: next.endDate, ...(next.startTime ? { startTime: next.startTime } : {}), ...(next.participants[userId] ? { participation: next.participants[userId] } : {}) } } : {}),
      ...(chosenChat ? { chat: { groupId: chosenChat.group.id, groupName: chosenChat.group.name, activityId: chosenChat.activityId, label: chosenChat.label,
        route: chosenChat.activityId ? `activitychat-${chosenChat.activityId}` : `groupchat-${chosenChat.group.id}`,
        summaryRoute: chosenChat.activityId ? `activitysummary-${chosenChat.activityId}` : `groupsummary-${chosenChat.group.id}`, unreadCount: chosenChat.count } } : {}),
    };
  }
  return { filters, meetups: meetups.slice(0, 2), groups: visibleGroups.map(publicGroup), meetupCount: meetups.length, groupCount: publicGroups.length, continuation };
}
