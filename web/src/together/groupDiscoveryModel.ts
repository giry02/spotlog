import type { GroupTopic, PublicActivityIntent, TogetherState } from './model';
import { discoveryProfile, filterDiscoveryGroups, isDiscoverableGroup, koreaDay, publicActivityTimeKey, shiftDay, upcomingPublicActivities, type PublicDiscoveryActivity } from './discovery.ts';

export type GroupDiscoverySection = 'DISCOVER' | 'RECOMMENDED' | 'MEETUPS' | 'NEW';
export interface GroupDiscoveryFilters {
  publicActivityIntent?: PublicActivityIntent;
  region?: string; district?: string; topic?: GroupTopic; categoryTopics?: GroupTopic[];
  style?: 'ALL' | 'NEIGHBORHOOD' | 'DESTINATION'; view?: 'GROUPS' | 'MEETUPS';
  dateFilter?: 'ALL' | 'TODAY' | 'WEEKEND' | 'WEEK'; query?: string; sort?: 'SOONEST' | 'NAME';
  section?: GroupDiscoverySection; useMyRegion?: boolean;
}
/** Allowlisted public discovery fields only; no member IDs, internal chat or meeting points. */
export interface PublicGroupDiscoveryCard {
  id: string; name: string; cover: string; region: string; district: string;
  introduction: string; welcome: string; topics: GroupTopic[]; example: boolean;
  memberCount: number; joined: boolean; pending: boolean; recruitment: 'OPEN' | 'PAUSED';
  joinMode: 'DIRECT' | 'APPROVAL'; createdAt?: string; nextActivity?: PublicDiscoveryActivity;
}
export interface GroupDiscoveryCollection {
  id: string; title: string; emoji: string; topics?: GroupTopic[]; mode?: 'RECOMMENDED' | 'UPCOMING' | 'NEW';
}
export const groupDiscoveryCollections: GroupDiscoveryCollection[] = [
  { id: 'recommended', title: '추천 베스트 모임', emoji: '⭐', mode: 'RECOMMENDED' },
  { id: 'upcoming', title: '활동이 이어지는 모임', emoji: '💬', mode: 'UPCOMING' },
  { id: 'new', title: '새로 생긴 모임', emoji: '🌱', mode: 'NEW' },
  { id: 'outdoor', title: '아웃도어·여행', emoji: '🧳', topics: ['OUTDOOR', 'TRAVEL', 'WALK'] },
  { id: 'social', title: '동네 친구·친목', emoji: '👋', topics: ['SOCIAL'] },
  { id: 'food', title: '맛집·카페', emoji: '☕', topics: ['FOOD', 'CAFE'] },
  { id: 'sports', title: '운동을 함께', emoji: '🏸', topics: ['SPORTS'] },
  { id: 'culture', title: '문화·전시·사진', emoji: '🎨', topics: ['CULTURE', 'PHOTO'] },
  { id: 'books', title: '책과 이야기', emoji: '📚', topics: ['BOOK'] },
  { id: 'games', title: '함께 즐기는 보드게임', emoji: '🎲', topics: ['GAME'] },
  { id: 'music', title: '음악·악기', emoji: '🎵', topics: ['MUSIC'] },
  { id: 'craft', title: '손으로 만드는 취미', emoji: '🧶', topics: ['CRAFT'] },
  { id: 'language', title: '언어를 배우며', emoji: '💬', topics: ['LANGUAGE'] },
  { id: 'pets', title: '반려동물과 함께', emoji: '🐾', topics: ['PETS'] },
  { id: 'family', title: '가족과 보내는 시간', emoji: '👨‍👩‍👧', topics: ['FAMILY'] },
];
export function matchesDiscoveryDate(activity: PublicDiscoveryActivity, filter: GroupDiscoveryFilters['dateFilter'], at = new Date()): boolean {
  if (!filter || filter === 'ALL') return true;
  const today = koreaDay(at); let from = today, to = today;
  if (filter === 'WEEK') to = shiftDay(today, 6);
  if (filter === 'WEEKEND') {
    const weekday = new Date(`${today}T12:00:00+09:00`).getUTCDay();
    from = shiftDay(today, weekday === 0 ? -1 : (6 - weekday + 7) % 7); to = shiftDay(from, 1);
  }
  return activity.date <= to && (activity.endDate || activity.date) >= from;
}
function publicCreatedAt(value: unknown, at: Date): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= at.getTime() ? value : undefined;
}

export function selectGroupDiscovery(state: TogetherState, filters: GroupDiscoveryFilters, viewerId = '', at = new Date()) {
  const publicGroups = state.groups.filter(group => isDiscoverableGroup(group) && (!viewerId || !group.blockedMemberIds?.includes(viewerId)));
  const regions = [...new Set(publicGroups.map(group => group.region).filter(Boolean))];
  const districts = [...new Set(publicGroups.filter(group => !filters.region || group.region === filters.region).map(group => discoveryProfile(group).district).filter(Boolean))];
  if (filters.region && !regions.includes(filters.region)) regions.push(filters.region);
  if (filters.district && !districts.includes(filters.district)) districts.push(filters.district);
  const allowed = new Set(publicGroups.map(group => group.id));
  const selectedTopics = [...new Set(filters.categoryTopics ?? [])];
  const matching = filterDiscoveryGroups(state, { ...filters, recruitment: 'ALL', style: 'ALL', sort: 'EDITORIAL' }, at)
    .filter(group => allowed.has(group.id) && (!selectedTopics.length || selectedTopics.some(topic => discoveryProfile(group).topics.includes(topic))));
  const groups: PublicGroupDiscoveryCard[] = matching.map(group => {
    const profile = discoveryProfile(group);
    const createdAt = publicCreatedAt(group.createdAt, at);
    const nextActivity = upcomingPublicActivities(state, group, at).find(activity => matchesDiscoveryDate(activity, filters.dateFilter, at));
    return { id: group.id, name: group.name, cover: group.cover, region: group.region, district: profile.district,
      introduction: group.introduction, welcome: profile.welcome, topics: [...profile.topics], example: group.sourceKind === 'EXAMPLE',
      memberCount: group.memberIds.length, joined: Boolean(viewerId && group.memberIds.includes(viewerId)),
      pending: Boolean(viewerId && state.applications.some(item => item.groupId === group.id && item.userId === viewerId && item.status === 'PENDING')),
      recruitment: profile.recruitment, joinMode: profile.joinMode === 'DIRECT' ? 'DIRECT' : 'APPROVAL',
      ...(createdAt ? { createdAt } : {}), ...(nextActivity ? { nextActivity } : {}) };
  });
  const publicGroupsById = new Map(matching.map(group => [group.id, group]));
  const events = groups.flatMap(group => upcomingPublicActivities(state, publicGroupsById.get(group.id)!, at)
    .filter(activity => matchesDiscoveryDate(activity, filters.dateFilter, at)).map(activity => ({ group, activity })))
    .sort((a, b) => publicActivityTimeKey(a.activity.date, a.activity.startTime).localeCompare(publicActivityTimeKey(b.activity.date, b.activity.startTime)));
  const byTime = (a: PublicGroupDiscoveryCard, b: PublicGroupDiscoveryCard) => publicActivityTimeKey(a.nextActivity?.date ?? '', a.nextActivity?.startTime).localeCompare(publicActivityTimeKey(b.nextActivity?.date ?? '', b.nextActivity?.startTime));
  const recommended = groups.filter(group => group.recruitment === 'OPEN').sort(filters.sort === 'NAME' ? (a, b) => a.name.localeCompare(b.name, 'ko') : byTime);
  const recent = groups.filter(group => group.createdAt && Date.parse(group.createdAt) >= at.getTime() - 30 * 86400000)
    .sort((a, b) => Date.parse(b.createdAt!) - Date.parse(a.createdAt!));
  const upcoming = recommended.filter(group => group.nextActivity);
  const bestPreviewIds = new Set(recommended.slice(0, 3).map(group => group.id));
  const upcomingPreview = upcoming.filter(group => !bestPreviewIds.has(group.id));
  const listed = [...groups].sort(filters.sort === 'NAME' ? (a, b) => a.name.localeCompare(b.name, 'ko') : byTime);
  const sections = groupDiscoveryCollections.map(collection => ({ ...collection, groups: collection.mode === 'RECOMMENDED' ? recommended : collection.mode === 'UPCOMING' ? upcomingPreview : collection.mode === 'NEW' ? recent
    : recommended.filter(group => collection.topics?.some(topic => group.topics.includes(topic))) })).filter(section => section.groups.length > 0);
  if (!sections.length && groups.length) sections.push({ id: 'all', title: '모집을 쉬고 있는 모임', emoji: '👥', groups, topics: undefined, mode: undefined });
  return { regions, districts, groups: listed, recommended, recent, upcoming, events, sections };
}
