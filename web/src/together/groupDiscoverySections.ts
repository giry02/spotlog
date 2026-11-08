import { groupDiscoveryCollections, type GroupDiscoveryFilters, type PublicGroupDiscoveryCard, type selectGroupDiscovery } from './groupDiscoveryModel.ts';
import type { GroupTopic } from './model.ts';

type Projection = ReturnType<typeof selectGroupDiscovery>;
export interface GroupDiscoveryBrowseSection {
  id: string;
  title: string;
  emoji: string;
  groups: PublicGroupDiscoveryCard[];
  events?: Projection['events'];
  topics?: GroupTopic[];
  region?: string;
  district?: string;
  kind: 'GROUPS' | 'MEETUPS';
  previewGroups?: PublicGroupDiscoveryCard[];
}
const open = (groups: PublicGroupDiscoveryCard[]) => groups.filter(group => group.recruitment === 'OPEN');
const direct = (groups: PublicGroupDiscoveryCard[]) => open(groups).filter(group => group.joinMode === 'DIRECT' && !group.joined);
/** Explicit public first-participation guidance; it is not a promise that everyone may join. */
const welcoming = (groups: PublicGroupDiscoveryCard[]) => open(groups).filter(group => /처음|초보|입문|환영|누구나|새\s?친구/u.test(`${group.welcome} ${group.introduction}`));

/** Comparable public rows, not a popularity ranking. Every More destination retains its exact section. */
export function buildGroupDiscoverySections(projection: Projection, filters: GroupDiscoveryFilters): GroupDiscoveryBrowseSection[] {
  const rows: GroupDiscoveryBrowseSection[] = [];
  const add = (section: GroupDiscoveryBrowseSection) => { if (section.groups.length || section.events?.length) rows.push(section); };
  add({ id: 'direct', title: '마음에 들면 바로 가입', emoji: '👋', kind: 'GROUPS', groups: direct(projection.groups) });
  add({ id: 'welcome', title: '첫 참여 안내가 있는 모임', emoji: '🌱', kind: 'GROUPS', groups: welcoming(projection.groups) });
  const recommended = groupDiscoveryCollections.find(section => section.id === 'recommended');
  add({ id: 'recommended', title: recommended?.title || '지역·관심사에 맞는 모임', emoji: '✨', kind: 'GROUPS', groups: projection.recommended });
  if (filters.region) add({ id: 'area', title: `${filters.district || filters.region}에서 만나요`, emoji: '📍', kind: 'GROUPS',
    region: filters.region, district: filters.district, groups: open(projection.groups).filter(group => group.region === filters.region && (!filters.district || group.district === filters.district)) });
  for (const section of groupDiscoveryCollections) {
    if (!section.topics?.length || filters.topic && !section.topics.includes(filters.topic)) continue;
    add({ id: section.id, title: section.title, emoji: section.emoji, kind: 'GROUPS', topics: [...section.topics],
      groups: projection.recommended.filter(group => section.topics!.some(topic => group.topics.includes(topic))) });
  }
  add({ id: 'upcoming', title: '다가오는 번개·정모', emoji: '📅', kind: 'MEETUPS', groups: [], events: projection.events });
  add({ id: 'new', title: '새로 생긴 모임', emoji: '🆕', kind: 'GROUPS', groups: projection.recent });
  if (!rows.length && projection.groups.length) add({ id: 'paused', title: '모집을 쉬고 있는 모임', emoji: '👥', kind: 'GROUPS', groups: projection.groups });
  return rows;
}

export function groupDiscoveryMoreFilters(filters: GroupDiscoveryFilters, section: GroupDiscoveryBrowseSection): GroupDiscoveryFilters {
  return { ...filters, section: section.kind === 'MEETUPS' ? 'MEETUPS' : section.id === 'new' ? 'NEW' : 'ALL',
    view: section.kind === 'MEETUPS' ? 'MEETUPS' : 'GROUPS', collectionId: section.id,
    ...(filters.categoryTopics ? { categoryTopics: [...filters.categoryTopics] } : {}),
    ...(section.region ? { region: section.region, district: section.district || '' } : {}),
    ...(section.id === 'new' ? { sort: 'NEWEST' } : {}) };
}

export function resolveGroupDiscoveryList(projection: Projection, filters: GroupDiscoveryFilters): GroupDiscoveryBrowseSection {
  const collectionId = filters.collectionId;
  const base: GroupDiscoveryBrowseSection = { id: collectionId || 'all', title: '전체 모임', emoji: '👥', kind: 'GROUPS', groups: projection.groups };
  if (!collectionId) {
    if (filters.section === 'MEETUPS') return { ...base, kind: 'MEETUPS', title: '다가오는 번개·정모', groups: [], events: projection.events };
    if (filters.section === 'NEW') return { ...base, title: '새로 생긴 모임', groups: projection.recent };
    if (filters.section === 'RECOMMENDED') return { ...base, title: '조건에 맞는 추천 모임', groups: projection.recommended };
    return base;
  }
  if (collectionId === 'direct') return { ...base, title: '마음에 들면 바로 가입', groups: direct(projection.groups) };
  if (collectionId === 'welcome') return { ...base, title: '첫 참여 안내가 있는 모임', groups: welcoming(projection.groups) };
  if (collectionId === 'recommended') return { ...base, title: '지역·관심사에 맞는 모임', groups: projection.recommended };
  if (collectionId === 'area') return { ...base, title: `${filters.district || filters.region || '선택한 지역'}에서 만나요`, groups: filters.region
    ? open(projection.groups).filter(group => group.region === filters.region && (!filters.district || group.district === filters.district)) : [] };
  if (collectionId === 'new') return { ...base, title: '새로 생긴 모임', groups: projection.recent };
  if (collectionId === 'upcoming') return { ...base, kind: 'MEETUPS', title: '다가오는 번개·정모', groups: [], events: projection.events };
  if (collectionId === 'paused') return { ...base, title: '모집을 쉬고 있는 모임', groups: projection.groups.filter(group => group.recruitment === 'PAUSED') };
  const collection = groupDiscoveryCollections.find(section => section.id === collectionId && section.topics?.length);
  if (collection) return { ...base, title: collection.title, topics: collection.topics, groups: projection.recommended.filter(group => collection.topics!.some(topic => group.topics.includes(topic))) };
  // Old/unknown links never silently widen to unrelated recommendations.
  return { ...base, title: '현재 조건의 모임', groups: [] };
}

/** Keep each full More list intact while reducing repeated rows on the browse home. */
export function selectGroupDiscoverySectionPreviews(sections: ReadonlyArray<GroupDiscoveryBrowseSection>, expanded = false) {
  const visible: GroupDiscoveryBrowseSection[] = [];
  const commonSeen = new Set<string>();
  const recommended = sections.find(section => section.id === 'recommended');
  if (recommended) {
    const previewGroups = recommended.groups.slice(0, 4);
    previewGroups.forEach(group => commonSeen.add(group.id));
    visible.push({ ...recommended, previewGroups });
  }
  for (const id of ['direct', 'welcome', 'area']) {
    const section = sections.find(item => item.id === id);
    if (!section) continue;
    const previewGroups = section.groups.filter(group => !commonSeen.has(group.id)).slice(0, 2);
    if (previewGroups.length < 2) continue;
    previewGroups.forEach(group => commonSeen.add(group.id));
    visible.push({ ...section, previewGroups });
  }
  const categories = sections.filter(section => section.topics?.length);
  const pending = [...categories];
  const categorySeen = new Set<string>();
  const orderedCategories: GroupDiscoveryBrowseSection[] = [];
  while (pending.length) {
    // This is diversity of available categories, never an inferred popularity score.
    let next = 0;
    for (let index = 1; index < pending.length; index++) {
      if (pending[index].groups.filter(group => !categorySeen.has(group.id)).length > pending[next].groups.filter(group => !categorySeen.has(group.id)).length) next = index;
    }
    const [section] = pending.splice(next, 1);
    const distinct = section.groups.filter(group => !categorySeen.has(group.id));
    const previewGroups = distinct.length ? distinct.slice(0, 2) : section.groups.slice(0, 1);
    previewGroups.forEach(group => categorySeen.add(group.id));
    orderedCategories.push({ ...section, previewGroups });
  }
  const shownCategories = expanded ? orderedCategories : orderedCategories.slice(0, 4);
  const visibleCategoryIds = new Set(shownCategories.flatMap(section => section.previewGroups!.map(group => group.id)));
  visible.push(...shownCategories);
  const upcoming = sections.find(section => section.kind === 'MEETUPS');
  if (upcoming) visible.push(upcoming);
  const recent = sections.find(section => section.id === 'new');
  if (recent) {
    const previewGroups = recent.groups.filter(group => !commonSeen.has(group.id) && !visibleCategoryIds.has(group.id)).slice(0, 2);
    if (previewGroups.length >= 2) visible.push({ ...recent, previewGroups });
  }
  if (!visible.length) for (const section of sections) visible.push({ ...section, previewGroups: section.groups.slice(0, 2) });
  return { sections: visible, categoryCount: categories.length, hiddenCategories: Math.max(0, categories.length - (expanded ? categories.length : 4)) };
}
