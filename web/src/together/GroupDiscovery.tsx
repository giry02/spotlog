import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronDown, ChevronRight, MapPin, Plus, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import type { GroupTopic, TogetherState } from './model';
import { topicOptions } from './discovery';
import { groupDiscoveryCollections, selectGroupDiscovery, type GroupDiscoveryCollection, type GroupDiscoveryFilters, type GroupDiscoverySection, type PublicGroupDiscoveryCard } from './groupDiscoveryModel';
import type { PublicDiscoveryActivity } from './discovery';
import './group-discovery.css';

export type { GroupDiscoveryFilters } from './groupDiscoveryModel';
export interface GroupDiscoveryProps {
  state: TogetherState; viewerId: string; onOpenGroup: (id: string, activityId?: string) => void; onCreate: () => void;
  onJoinGroup?: (id: string) => void;
  showCreate?: boolean; initialFilters?: GroupDiscoveryFilters; onFiltersChange?: (filters: GroupDiscoveryFilters) => void;
  myRegionLabel?: string; onManageMyRegions?: () => void; onUseMyRegion?: () => void;
}
const normalized = (filters?: GroupDiscoveryFilters): GroupDiscoveryFilters => ({
  ...filters, region: filters?.region || '', district: filters?.district || '', topic: filters?.topic,
  categoryTopics: filters?.categoryTopics ? [...filters.categoryTopics] : undefined,
  view: filters?.view || 'GROUPS', dateFilter: filters?.dateFilter || 'ALL', query: filters?.query || '', sort: filters?.sort || 'SOONEST',
  section: filters?.section || (filters?.view === 'MEETUPS' ? 'MEETUPS' : 'DISCOVER'), useMyRegion: filters?.useMyRegion,
});
const dateOptions = [{ id: 'ALL', label: '날짜 무관' }, { id: 'TODAY', label: '오늘' }, { id: 'WEEK', label: '7일 안에' }, { id: 'WEEKEND', label: '주말' }] as const;
const orderedTopics: GroupTopic[] = ['OUTDOOR', 'SOCIAL', 'FOOD', 'CAFE', 'SPORTS', 'BOOK', 'CULTURE', 'GAME', 'TRAVEL', 'PHOTO', 'WALK', 'MUSIC', 'LANGUAGE', 'CRAFT', 'PETS', 'FAMILY'];
const topics = orderedTopics.map(id => topicOptions.find(topic => topic.id === id)!);
const discoveryTabs: { id: GroupDiscoverySection; label: string }[] = [{ id: 'DISCOVER', label: '발견' }, { id: 'RECOMMENDED', label: '추천 모임' }, { id: 'MEETUPS', label: '약속 일정' }, { id: 'NEW', label: '새 모임' }];
const publicDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }) : '날짜 미정';
const eventDate = (activity: PublicDiscoveryActivity) => `${publicDate(activity.date)}${activity.endDate && activity.endDate !== activity.date ? ` ~ ${publicDate(activity.endDate)}` : ''}${activity.startTime ? ` · ${activity.startTime}` : ' · 시각 미정'}`;

function CategoryGrid({ selected, onChoose }: { selected?: GroupTopic; onChoose: (topic: GroupTopic) => void }) {
  const [expanded, setExpanded] = useState(Boolean(selected && orderedTopics.indexOf(selected) >= 9));
  useEffect(() => { if (selected && orderedTopics.indexOf(selected) >= 9) setExpanded(true); }, [selected]);
  return <div className="gd-category-picker"><div className="gd-categories gd-visible-interests" aria-label="관심사로 모임 찾기">{(expanded ? topics : topics.slice(0, 9)).map(topic => <button type="button" className={`gd-topic ${selected === topic.id ? 'is-active' : ''}`} key={topic.id} aria-pressed={selected === topic.id} onClick={() => onChoose(topic.id)}><span className="gd-emoji" aria-hidden="true">{topic.emoji}</span><span>{topic.label}</span></button>)}<button type="button" className="gd-topic gd-topic-more" aria-expanded={expanded} aria-label={expanded ? '전체 관심사 접기' : '전체 관심사 16개 보기'} onClick={() => setExpanded(value => !value)}><span className="gd-emoji" aria-hidden="true">{expanded ? '⌃' : '···'}</span><span>{expanded ? '접기' : '전체 16'}</span></button></div></div>;
}
function RecruitmentCard({ group, onOpen, onJoin }: { group: PublicGroupDiscoveryCard; onOpen: (id: string) => void; onJoin?: (id: string) => void }) {
  const topic = topics.find(item => item.id === group.topics[0]);
  const action = group.joined ? '가입 중' : group.pending && group.joinMode !== 'DIRECT' ? '승인 대기' : group.recruitment === 'PAUSED' ? '모집 휴식' : group.joinMode === 'DIRECT' ? '바로 가입' : '가입 신청';
  const disabled = !group.joined && (group.pending && group.joinMode !== 'DIRECT' || group.recruitment === 'PAUSED');
  return <article className="gd-group-card"><button type="button" className="gd-group-open" onClick={() => onOpen(group.id)}><span className="gd-group-photo">{group.cover ? <img src={group.cover} alt="" loading="lazy"/> : <span className="gd-photo-fallback" aria-hidden="true">{topic?.emoji || '👥'}</span>}{group.example && <span className="gd-example-badge">예시</span>}</span><span className="gd-group-copy"><strong>{group.name}</strong><span className="gd-welcome">{group.welcome}</span><span className="gd-row-meta">{[group.region, group.district, topic?.label, `${group.memberCount}명`].filter(Boolean).join(' · ')}</span></span></button>{onJoin ? <button type="button" className={`gd-card-join ${group.joined ? 'is-joined' : ''}`} aria-label={`${group.name} ${action}`} disabled={disabled} onClick={() => group.joined ? onOpen(group.id) : onJoin(group.id)}>{action}</button> : <span className="gd-join-mode">{action}</span>}</article>;
}
function PublicActivityCard({ activity, group, onOpen }: { activity: PublicDiscoveryActivity; group: PublicGroupDiscoveryCard; onOpen: (id: string, activityId?: string) => void }) {
  return <button type="button" className="gd-event" onClick={() => onOpen(group.id, activity.id)}><span className="gd-event-date"><small>{Number(activity.date.slice(5, 7))}월</small><strong>{Number(activity.date.slice(8))}</strong></span><span className="gd-event-copy"><small>{group.name}{group.example ? ' · 예시' : ''}</small><strong>{activity.title}</strong><span>{eventDate(activity)} · {[group.region, group.district].filter(Boolean).join(' ')}</span><span>참석은 모임에서 따로 선택해요.</span></span><ChevronRight size={17}/></button>;
}

export default function GroupDiscovery({ state, viewerId, onOpenGroup, onCreate, onJoinGroup, showCreate = true, initialFilters, onFiltersChange, myRegionLabel, onManageMyRegions, onUseMyRegion }: GroupDiscoveryProps) {
  const contentRef = useRef<HTMLDivElement>(null); const filterId = useId(); const [filters, setFilters] = useState<GroupDiscoveryFilters>(() => normalized(initialFilters));
  const [showSearch, setShowSearch] = useState(Boolean(initialFilters?.query)); const [filtersOpen, setFiltersOpen] = useState(false);
  const initialKey = JSON.stringify(initialFilters || {});
  useEffect(() => { setFilters(normalized(initialFilters)); if (initialFilters?.query) setShowSearch(true); }, [initialKey]);
  const update = (patch: Partial<GroupDiscoveryFilters>) => { const next = { ...filters, ...patch }; setFilters(next); onFiltersChange?.(next); };
  const reset = () => { const next = normalized({ section: filters.section, view: filters.view, useMyRegion: false }); setFilters(next); onFiltersChange?.(next); };
  const projection = useMemo(() => selectGroupDiscovery(state, filters, viewerId), [state, filters, viewerId]);
  const resetScroll = () => contentRef.current?.closest<HTMLElement>('.content')?.scrollTo({ top: 0, behavior: 'instant' });
  const section = filters.section || 'DISCOVER';
  const category = filters.categoryTopics?.length ? groupDiscoveryCollections.find(item => item.topics?.join('|') === filters.categoryTopics?.join('|')) : undefined;
  const activeTopic = topics.find(topic => topic.id === filters.topic);
  const listing = section !== 'DISCOVER' || Boolean(filters.topic || filters.categoryTopics !== undefined || filters.query?.trim());
  const list = section === 'RECOMMENDED' ? projection.recommended : section === 'NEW' ? projection.recent : projection.groups;
  const chooseTab = (next: GroupDiscoverySection) => { update({ section: next, view: next === 'MEETUPS' ? 'MEETUPS' : 'GROUPS', topic: undefined, categoryTopics: undefined }); resetScroll(); };
  const chooseTopic = (topic: GroupTopic) => { update({ section: 'DISCOVER', view: 'GROUPS', topic: filters.topic === topic ? undefined : topic, categoryTopics: undefined }); resetScroll(); };
  const more = (item: GroupDiscoveryCollection) => {
    update(item.mode === 'NEW' ? { section: 'NEW', view: 'GROUPS', topic: undefined, categoryTopics: undefined } : item.mode === 'UPCOMING' || item.mode === 'RECOMMENDED' ? { section: 'RECOMMENDED', view: 'GROUPS', topic: undefined, categoryTopics: undefined } : { section: 'DISCOVER', view: 'GROUPS', topic: undefined, categoryTopics: item.topics ?? [] }); resetScroll();
  };
  const regionLabel = [filters.region, filters.district].filter(Boolean).join(' ') || (filters.useMyRegion ? myRegionLabel : '') || '전체 지역';
  const row = (group: PublicGroupDiscoveryCard) => <RecruitmentCard key={group.id} group={group} onOpen={onOpenGroup} onJoin={onJoinGroup}/>;
  return <div className="gd gd-discovery gd-browse" ref={contentRef}>
    <div className="gd-browse-top"><button type="button" className="gd-area-button" onClick={onManageMyRegions || (() => setFiltersOpen(value => !value))}><MapPin size={17}/><span>{regionLabel}</span><ChevronDown size={15}/></button>{onUseMyRegion && myRegionLabel && filters.useMyRegion === false && <button type="button" className="gd-my-region" onClick={onUseMyRegion}>내 지역</button>}<button type="button" className="gd-icon" aria-label="모임 검색" aria-expanded={showSearch} onClick={() => setShowSearch(value => !value)}><Search size={20}/></button><button type="button" className="gd-icon" aria-label="모임 찾기 조건" aria-expanded={filtersOpen} aria-controls={filterId} onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={19}/></button>{showCreate && <button type="button" className="gd-icon" aria-label="모임 만들기" onClick={onCreate}><Plus size={20}/></button>}</div>
    {showSearch && <label className="gd-search"><Search size={18}/><input type="search" aria-label="모임 이름·관심사 검색" placeholder="모임 이름, 관심사, 동네 검색" value={filters.query || ''} onChange={event => update({ query: event.target.value })}/>{filters.query && <button type="button" aria-label="검색어 지우기" onClick={() => update({ query: '' })}><X size={17}/></button>}</label>}
    <nav className="gd-discover-nav" aria-label="모임 둘러보기">{discoveryTabs.map(tab => <button type="button" key={tab.id} aria-pressed={section === tab.id} onClick={() => chooseTab(tab.id)}>{tab.label}</button>)}</nav>
    {filtersOpen && <div id={filterId} className="gd-condition-panel"><div className="gd-location-select"><MapPin size={17}/><label><span className="gd-sr-only">지역</span><select aria-label="모임 지역" value={filters.region || ''} onChange={event => update({ region: event.target.value, district: '', useMyRegion: false })}><option value="">전체 지역</option>{projection.regions.map(region => <option key={region}>{region}</option>)}</select></label><label><span className="gd-sr-only">동네</span><select aria-label="동네" value={filters.district || ''} onChange={event => update({ district: event.target.value, useMyRegion: false })}><option value="">전체 동네</option>{projection.districts.map(district => <option key={district}>{district}</option>)}</select></label></div><div className="gd-date-filters" aria-label="모임 일정 날짜">{dateOptions.map(date => <button type="button" key={date.id} aria-pressed={filters.dateFilter === date.id} className={filters.dateFilter === date.id ? 'is-active' : ''} onClick={() => update({ dateFilter: date.id })}>{date.label}</button>)}</div><div className="gd-condition-actions"><button type="button" onClick={reset}>조건 초기화</button><button type="button" className="gd-primary" onClick={() => setFiltersOpen(false)}>선택한 조건으로 보기</button></div></div>}
    {!listing ? <><CategoryGrid selected={filters.topic} onChoose={chooseTopic}/><div className="gd-browse-sections">{projection.sections.map(item => <section className="gd-browse-section" key={item.id}><header><h2><span aria-hidden="true">{item.emoji}</span>{item.title}</h2><button type="button" aria-label={`${item.title} 더 보기`} onClick={() => more(item)}>더 보기<ChevronRight size={15}/></button></header>{item.mode === 'RECOMMENDED' && <p className="gd-section-basis">지역·관심사와 공개 예정 정모 기준이에요. 인기 순위와 달라요.</p>}{item.mode === 'UPCOMING' && <p className="gd-section-basis">공개된 다음 정모가 있는 모임이에요.</p>}<div className="gd-result-list">{item.groups.slice(0, 3).map(row)}</div></section>)}</div>{!projection.groups.length && <div className="gd-empty"><Users size={28}/><h3>이 지역의 공개 모임을 기다리고 있어요</h3><p>다른 지역을 살펴보거나 함께할 모임을 만들어보세요.</p><button type="button" onClick={() => setFiltersOpen(true)}>다른 지역 찾기</button><button type="button" onClick={onCreate}>모임 만들기</button></div>}</> : <>
      <div className="gd-topic-strip" aria-label="관심사 선택"><button type="button" aria-pressed={!filters.topic && !filters.categoryTopics?.length} onClick={() => update({ topic: undefined, categoryTopics: undefined })}>전체</button>{topics.map(topic => <button type="button" key={topic.id} aria-pressed={filters.topic === topic.id} onClick={() => update({ topic: topic.id, categoryTopics: undefined })}><span aria-hidden="true">{topic.emoji}</span>{topic.label}</button>)}</div>
      <div className="gd-results-heading"><h2>{section === 'MEETUPS' ? '다가오는 약속' : section === 'NEW' ? '새로 생긴 모임' : section === 'RECOMMENDED' ? '조건에 맞는 추천 모임' : activeTopic ? `${activeTopic.label} 모임` : category?.title || (filters.query?.trim() ? '검색한 모임' : '전체 모임')}<span>{section === 'MEETUPS' ? projection.events.length : list.length}</span></h2>{section !== 'MEETUPS' && section !== 'NEW' && <select aria-label="모임 정렬" value={filters.sort || 'SOONEST'} onChange={event => update({ sort: event.target.value as 'SOONEST' | 'NAME' })}><option value="SOONEST">다음 정모순</option><option value="NAME">이름순</option></select>}</div>
      {section === 'RECOMMENDED' && <p className="gd-section-basis">선택한 지역·관심사에 맞는 모집 모임을 {filters.sort === 'NAME' ? '이름순' : '다음 정모순'}으로 보여드려요. 인기 순위와 달라요.</p>}{section === 'NEW' && <p className="gd-section-basis">등록일이 확인된 최근 30일 모임이에요.</p>}
      <div className={section === 'MEETUPS' ? 'gd-meetup-list' : 'gd-result-list'}>{section === 'MEETUPS' ? projection.events.map(({ activity, group }) => <PublicActivityCard key={activity.id} activity={activity} group={group} onOpen={onOpenGroup}/>) : list.map(row)}</div>
      {!(section === 'MEETUPS' ? projection.events.length : list.length) && <div className="gd-empty"><Search size={26}/><h3>{section === 'NEW' ? '최근 등록일이 확인된 모임이 없어요' : '조건에 맞는 모임이 없어요'}</h3><p>지역과 관심사를 바꾸어 찾아보세요.</p><button type="button" onClick={reset}>조건 초기화</button></div>}
    </>}
  </div>;
}

export function PublicGroupHome({ state, onExplore, onOpenGroup, regionMemory }: { state: TogetherState; onExplore: (filters?: GroupDiscoveryFilters) => void; onOpenGroup: (id: string, activityId?: string) => void; regionMemory?: { value: string } }) {
  const [region, setRegion] = useState(regionMemory?.value || '');
  const projection = selectGroupDiscovery(state, { region });
  return <section className="gd gd-home gd-browse"><div className="gd-home-title"><h2>취향이 맞는 모임</h2><button type="button" className="gd-icon" aria-label="공개 모임 전체 보기" onClick={() => onExplore({ region })}><ArrowRight size={20}/></button></div><label className="gd-home-region"><MapPin size={16}/><select aria-label="홈 공개 모임 지역" value={region} onChange={event => { if (regionMemory) regionMemory.value = event.target.value; setRegion(event.target.value); }}><option value="">전체 지역</option>{projection.regions.map(item => <option key={item}>{item}</option>)}</select></label><CategoryGrid onChoose={topic => onExplore({ region, topic })}/><div className="gd-result-list">{projection.recommended.slice(0, 3).map(group => <RecruitmentCard key={group.id} group={group} onOpen={onOpenGroup}/>)}</div>{!projection.recommended.length && <p className="gd-section-basis">이 지역에서 모집 중인 모임을 찾아보세요.</p>}{projection.events[0] && <div className="gd-home-next"><h3>다가오는 약속</h3><PublicActivityCard activity={projection.events[0].activity} group={projection.events[0].group} onOpen={onOpenGroup}/></div>}<button type="button" className="gd-view-all" onClick={() => onExplore({ region })}>모집 중인 모임 더 보기<ChevronRight size={17}/></button></section>;
}
