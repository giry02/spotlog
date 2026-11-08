import type { GroupDiscoveryProfile, GroupPublicActivitySnapshot, GroupTopic, TogetherGroup, TogetherState } from './model';
import { getGroupSubtopic, normalizeGroupSubtopics } from './groupTaxonomy.ts';

export const topicOptions: { id: GroupTopic; label: string; emoji: string; description: string }[] = [
  { id: 'SOCIAL', label: '이웃·친목', emoji: '👋', description: '동네에서 편하게 만나 이야기 나누기' },
  { id: 'SPORTS', label: '운동', emoji: '🏸', description: '실력보다 함께 움직이는 즐거움' },
  { id: 'BOOK', label: '독서', emoji: '📚', description: '각자의 책과 감상을 나누기' },
  { id: 'GAME', label: '보드게임', emoji: '🎲', description: '규칙부터 함께 배우는 즐거운 시간' },
  { id: 'MUSIC', label: '음악', emoji: '🎵', description: '좋아하는 음악과 연주 이야기' },
  { id: 'LANGUAGE', label: '언어', emoji: '💬', description: '서로 배우며 편하게 대화하기' },
  { id: 'CRAFT', label: '공예', emoji: '🧶', description: '손으로 만드는 취미와 작품 나누기' },
  { id: 'PETS', label: '반려동물', emoji: '🐾', description: '반려 생활 이야기와 배려 있는 만남' },
  { id: 'TRAVEL', label: '여행', emoji: '🧳', description: '다른 지역에서 함께하는 여행' },
  { id: 'FOOD', label: '맛집', emoji: '🍚', description: '한 끼를 함께 즐기는 시간' },
  { id: 'CAFE', label: '카페', emoji: '☕', description: '커피와 이야기, 잠깐의 쉼' },
  { id: 'WALK', label: '산책', emoji: '🚶', description: '동네와 풍경을 천천히 걷기' },
  { id: 'PHOTO', label: '사진', emoji: '📷', description: '기억하고 싶은 장면 나누기' },
  { id: 'OUTDOOR', label: '아웃도어', emoji: '🌿', description: '야외 활동과 가벼운 도전' },
  { id: 'CULTURE', label: '문화', emoji: '🎨', description: '전시·공연·동네 문화 즐기기' },
  { id: 'FAMILY', label: '가족', emoji: '👨‍👩‍👧', description: '함께 쉬고 함께 준비하는 가족 여행' },
];
const topicIds = new Set(topicOptions.map(option => option.id));
export type DiscoveryDateFilter = 'ALL' | 'TODAY' | 'WEEK' | 'THISWEEK' | 'WEEKEND' | 'UPCOMING' | 'THIS_MONTH';
export interface DiscoveryFilters {
  query?: string; region?: string; district?: string; topic?: GroupTopic | 'ALL'; subtopic?: string | 'ALL'; style?: 'ALL' | 'NEIGHBORHOOD' | 'DESTINATION';
  recruitment?: 'OPEN' | 'ALL'; dateFilter?: DiscoveryDateFilter; sort?: 'EDITORIAL' | 'SOONEST' | 'NAME' | 'NEWEST';
}
export type PublicDiscoveryActivity = GroupPublicActivitySnapshot;

/** Never makes a legacy group public, and never derives its privacy from group kind. */
export function discoveryProfile(group: TogetherGroup): GroupDiscoveryProfile {
  const profile = group.discovery;
  const joinMode = profile?.joinMode === 'DIRECT' ? 'DIRECT' : 'APPROVAL';
  const topics = profile?.topics?.filter(topic => topicIds.has(topic)) || [];
  return {
    topics, ...(profile?.subtopics !== undefined ? { subtopics: normalizeGroupSubtopics(topics, profile.subtopics) } : {}), district: profile?.district ?? '',
    style: profile?.style === 'DESTINATION' ? 'DESTINATION' : 'NEIGHBORHOOD',
    recruitment: profile?.recruitment === 'PAUSED' ? 'PAUSED' : 'OPEN',
    joinMode,
    welcome: profile?.welcome || '관심 있는 일정과 모임 소개를 먼저 확인해 주세요.',
    joinGuide: profile?.joinGuide || (joinMode === 'DIRECT' ? '모임 안내를 확인하고 가입하면 함께할 수 있어요. 일정 참가는 별도로 선택해요.' : '가입 신청 후 운영진의 승인을 기다려 주세요. 일정 참가는 별도로 선택해요.'),
  };
}
export function isDiscoverableGroup(group: TogetherGroup): boolean {
  return group.spaceType !== 'ACTIVITY' && group.visibility === 'PUBLIC' && group.promotionPublished && !group.archived;
}
export function publicActivities(state: TogetherState, group: TogetherGroup): PublicDiscoveryActivity[] {
  const current = state.groups.find(item => item.id === group.id);
  if (!current || !isDiscoverableGroup(current)) return [];
  const selected = new Set(current.promotionActivityIds ?? []);
  return state.activities.filter(activity => activity.groupId === group.id && selected.has(activity.id) && activity.status !== 'CANCELLED')
    .flatMap(activity => {
      const approved = current.promotionActivitySnapshots === undefined ? activity
        : current.promotionActivitySnapshots.find(snapshot => snapshot.id === activity.id && snapshot.groupId === current.id);
      if (!approved) return [];
      const { id, groupId, title, date, endDate, description, kind, startTime } = approved;
      return [{ id, groupId, title, date, endDate, description, status: activity.status, ...(kind ? { kind } : {}), ...(startTime ? { startTime } : {}) }];
    });
}
export function koreaDay(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date);
}
export function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00+09:00`); date.setUTCDate(date.getUTCDate() + offset); return koreaDay(date);
}
function validDay(day: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00+09:00`)) && koreaDay(new Date(`${day}T12:00:00+09:00`)) === day; }
export function publicActivityTimeKey(date: string, startTime?: string): string {
  return `${validDay(date) ? date : '9999-12-31'}T${startTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ? startTime : '23:59:59'}`;
}
function overlaps(activity: PublicDiscoveryActivity, from: string, to: string): boolean {
  if (!validDay(activity.date)) return false;
  const end = validDay(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity.date;
  return activity.date <= to && end >= from;
}
export function upcomingPublicActivities(state: TogetherState, group: TogetherGroup, at = new Date()): PublicDiscoveryActivity[] {
  const today = koreaDay(at);
  return publicActivities(state, group).filter(activity => activity.status === 'PLANNED' && validDay(activity.date) && (validDay(activity.endDate) && activity.endDate >= activity.date ? activity.endDate : activity.date) >= today)
    .sort((a, b) => publicActivityTimeKey(a.date, a.startTime).localeCompare(publicActivityTimeKey(b.date, b.startTime)));
}
function dateRange(filter: DiscoveryDateFilter | undefined, at: Date): [string, string] | null {
  const today = koreaDay(at);
  if (filter === 'TODAY') return [today, today];
  if (filter === 'WEEK' || filter === 'THISWEEK') return [today, shiftDay(today, 6)];
  if (filter === 'WEEKEND') {
    const weekday = new Date(`${today}T12:00:00+09:00`).getUTCDay();
    const saturday = shiftDay(today, weekday === 0 ? -1 : (6 - weekday + 7) % 7);
    return [saturday, shiftDay(saturday, 1)];
  }
  if (filter === 'THIS_MONTH') {
    const nextMonth = new Date(`${today.slice(0, 7)}-01T12:00:00+09:00`); nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    return [today, shiftDay(koreaDay(nextMonth), -1)];
  }
  return null;
}
export function filterDiscoveryGroups(state: TogetherState, filters: DiscoveryFilters = {}, at = new Date()): TogetherGroup[] {
  const query = (filters.query ?? '').trim().toLocaleLowerCase('ko-KR');
  const range = dateRange(filters.dateFilter, at);
  const groups = state.groups.filter(group => {
    if (!isDiscoverableGroup(group)) return false;
    const profile = discoveryProfile(group);
    if (filters.recruitment !== 'ALL' && profile.recruitment !== 'OPEN') return false;
    if (filters.region && !['ALL', '전체', '전체 지역'].includes(filters.region) && group.region !== filters.region) return false;
    if (filters.district && !['ALL', '전체', '전체 동네'].includes(filters.district) && profile.district !== filters.district) return false;
    if (filters.topic && filters.topic !== 'ALL' && !profile.topics.includes(filters.topic)) return false;
    if (filters.subtopic && filters.subtopic !== 'ALL') {
      const subtopic = getGroupSubtopic(filters.subtopic);
      if (!subtopic || filters.topic && filters.topic !== 'ALL' && subtopic.parent !== filters.topic || !profile.subtopics?.includes(subtopic.id)) return false;
    }
    if (filters.style && filters.style !== 'ALL' && profile.style !== filters.style) return false;
    const subtopicText = profile.subtopics?.flatMap(id => { const item = getGroupSubtopic(id); return item ? [item.label, ...item.keywords] : []; }).join(' ') || '';
    if (query && !`${group.name} ${group.region} ${group.introduction} ${profile.district} ${profile.welcome} ${profile.topics.map(topic => topicOptions.find(option => option.id === topic)?.label).join(' ')} ${subtopicText}`.toLocaleLowerCase('ko-KR').includes(query)) return false;
    if (range && !upcomingPublicActivities(state, group, at).some(activity => overlaps(activity, range[0], range[1]))) return false;
    if (filters.dateFilter === 'UPCOMING' && !upcomingPublicActivities(state, group, at).length) return false;
    return true;
  });
  if (filters.sort === 'NAME') return groups.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  if (filters.sort === 'NEWEST') return groups.sort((a, b) => {
    const known = (value?: string) => value && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= at.getTime() ? Date.parse(value) : null;
    const left = known(a.createdAt), right = known(b.createdAt);
    return left === null ? right === null ? 0 : 1 : right === null ? -1 : right - left;
  });
  if (filters.sort === 'SOONEST') return groups.sort((a, b) => {
    const left = upcomingPublicActivities(state, a, at)[0], right = upcomingPublicActivities(state, b, at)[0];
    return publicActivityTimeKey(left?.date ?? '', left?.startTime).localeCompare(publicActivityTimeKey(right?.date ?? '', right?.startTime));
  });
  // Existing array order is the explicit display order. No derived popularity score or invented metrics.
  return groups;
}
