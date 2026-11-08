import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, MapPin, Plus, Search, Users, X } from 'lucide-react';
import type { GroupTopic, TogetherState } from './model';
import { topicOptions, type PublicDiscoveryActivity } from './discovery';
import { selectGroupDiscovery, type GroupDiscoveryFilters, type GroupDiscoverySection, type PublicGroupDiscoveryCard } from './groupDiscoveryModel';
import { getGroupSubtopic, groupSubtopicsFor } from './groupTaxonomy';
import { buildGroupDiscoverySections, groupDiscoveryMoreFilters, resolveGroupDiscoveryList, selectGroupDiscoverySectionPreviews } from './groupDiscoverySections';
import './group-discovery.css';

export type { GroupDiscoveryFilters } from './groupDiscoveryModel';
export interface GroupDiscoveryProps {
  state: TogetherState; viewerId: string; onOpenGroup: (id: string, activityId?: string) => void; onCreate: () => void;
  onJoinGroup?: (id: string) => void;
  showCreate?: boolean; initialFilters?: GroupDiscoveryFilters; onFiltersChange?: (filters: GroupDiscoveryFilters) => void;
  myRegionLabel?: string; onManageMyRegions?: () => void; onUseMyRegion?: () => void;
}
const normalized = (filters?: GroupDiscoveryFilters): GroupDiscoveryFilters => ({ ...filters,
  region: filters?.region || '', district: filters?.district || '', topic: filters?.topic, subtopic: filters?.subtopic,
  categoryTopics: filters?.categoryTopics ? [...filters.categoryTopics] : undefined, style: filters?.style || 'ALL',
  view: filters?.view || 'GROUPS', dateFilter: filters?.dateFilter || 'ALL', query: filters?.query || '', sort: filters?.sort || 'SOONEST',
  section: filters?.section || (filters?.view === 'MEETUPS' ? 'MEETUPS' : 'DISCOVER'), useMyRegion: filters?.useMyRegion,
});
const dateOptions = [{ id: 'ALL', label: '날짜 무관' }, { id: 'TODAY', label: '오늘' }, { id: 'WEEK', label: '7일 안에' }, { id: 'WEEKEND', label: '주말' }] as const;
const orderedTopics: GroupTopic[] = ['OUTDOOR', 'SOCIAL', 'FOOD', 'CAFE', 'SPORTS', 'BOOK', 'CULTURE', 'GAME', 'TRAVEL', 'PHOTO', 'WALK', 'MUSIC', 'LANGUAGE', 'CRAFT', 'PETS', 'FAMILY'];
const topics = orderedTopics.map(id => topicOptions.find(topic => topic.id === id)!);
const discoveryTabs: { id: GroupDiscoverySection; label: string }[] = [{ id: 'DISCOVER', label: '추천' }, { id: 'ALL', label: '전체 모임' }, { id: 'MEETUPS', label: '번개·정모' }, { id: 'NEW', label: '새 모임' }];
const publicDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }) : '날짜 미정';
const eventDate = (activity: PublicDiscoveryActivity) => `${publicDate(activity.date)}${activity.endDate && activity.endDate !== activity.date ? ` ~ ${publicDate(activity.endDate)}` : ''}${activity.startTime ? ` · ${activity.startTime}` : ' · 시각 미정'}`;

function CategoryPicker({ selected, subtopic, onChoose, onSubtopic }: { selected?: GroupTopic; subtopic?: string; onChoose: (topic?: GroupTopic) => void; onSubtopic: (id?: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [subtopicsOpen, setSubtopicsOpen] = useState(false);
  const parentStrip = useRef<HTMLDivElement>(null);
  useEffect(() => { setSubtopicsOpen(false); }, [selected]);
  useEffect(() => {
    const strip = parentStrip.current, button = strip?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!strip || !button) return;
    const bounds = strip.getBoundingClientRect(), selectedBounds = button.getBoundingClientRect();
    if (selectedBounds.left < bounds.left) strip.scrollLeft += selectedBounds.left - bounds.left;
    else if (selectedBounds.right > bounds.right) strip.scrollLeft += selectedBounds.right - bounds.right;
  }, [selected]);
  const children = groupSubtopicsFor(selected).filter(item => item.parent === selected);
  const chosen = children.find(item => item.id === subtopic);
  const firstChildren = children.slice(0, 4);
  if (chosen && !firstChildren.some(item => item.id === chosen.id)) firstChildren[firstChildren.length - 1] = chosen;
  return <div className="gd-category-picker">
    {selected ? <div ref={parentStrip} className="gd-topic-strip gd-parent-strip" aria-label="대분류 선택"><button type="button" aria-pressed={false} onClick={() => onChoose(undefined)}>전체</button>{topics.map(topic => <button type="button" key={topic.id} aria-pressed={selected === topic.id} onClick={() => onChoose(topic.id)}><span aria-hidden="true">{topic.emoji}</span>{topic.label}</button>)}</div>
      : <div className="gd-categories gd-visible-interests" aria-label="대분류로 모임 찾기">{(expanded ? topics : topics.slice(0, 9)).map(topic => <button type="button" className="gd-topic" key={topic.id} onClick={() => onChoose(topic.id)}><span className="gd-emoji" aria-hidden="true">{topic.emoji}</span><span>{topic.label}</span></button>)}<button type="button" className="gd-topic gd-topic-more" aria-expanded={expanded} aria-label={expanded ? '전체 대분류 접기' : '전체 대분류 16개 보기'} onClick={() => setExpanded(value => !value)}><span className="gd-emoji" aria-hidden="true">{expanded ? '⌃' : '···'}</span><span>{expanded ? '접기' : '전체 16'}</span></button></div>}
    {selected && children.length > 0 && <div className="gd-subtopics" role="group" aria-label={`${topics.find(topic => topic.id === selected)?.label} 세부 관심사`}><button type="button" aria-pressed={!subtopic || subtopic === 'ALL'} onClick={() => onSubtopic(undefined)}>전체</button>{(subtopicsOpen ? children : children.length > 5 ? firstChildren : children).map(item => <button type="button" key={item.id} aria-pressed={subtopic === item.id} onClick={() => onSubtopic(item.id)}><span aria-hidden="true">{item.emoji}</span>{item.label}</button>)}{children.length > 5 && <button type="button" className="gd-subtopic-more" aria-expanded={subtopicsOpen} onClick={() => setSubtopicsOpen(value => !value)}>{subtopicsOpen ? '접기' : `더 보기 ${children.length - firstChildren.length}`}<ChevronDown size={15}/></button>}</div>}
  </div>;
}

function RecruitmentCard({ group, onOpen, onJoin }: { group: PublicGroupDiscoveryCard; onOpen: (id: string) => void; onJoin?: (id: string) => void }) {
  const [failedImage, setFailedImage] = useState('');
  const topic = topics.find(item => item.id === group.topics[0]);
  const subtopic = group.subtopics?.map(id => getGroupSubtopic(id)).find(Boolean);
  const action = group.joined ? '가입 중' : group.pending && group.joinMode !== 'DIRECT' ? '승인 대기' : group.recruitment === 'PAUSED' ? '모집 휴식' : group.joinMode === 'DIRECT' ? '바로 가입' : '가입 신청';
  const disabled = !group.joined && (group.pending && group.joinMode !== 'DIRECT' || group.recruitment === 'PAUSED');
  return <article className="gd-group-card"><button type="button" className="gd-group-open" onClick={() => onOpen(group.id)}><span className="gd-group-photo">{group.cover && failedImage !== group.cover ? <img src={group.cover} alt="" loading="lazy" onError={() => setFailedImage(group.cover)}/> : <span className="gd-photo-fallback" aria-hidden="true">{topic?.emoji || '👥'}</span>}{group.example && <span className="gd-example-badge">예시</span>}</span><span className="gd-group-copy"><strong>{group.name}</strong><span className="gd-welcome">{group.welcome}</span><span className="gd-row-meta">{[[group.region, group.district].filter(Boolean).join(' '), subtopic?.label || topic?.label, `${group.memberCount}명`].filter(Boolean).join(' · ')}</span></span></button>{onJoin ? <button type="button" className={`gd-card-join ${group.joined ? 'is-joined' : ''}`} aria-label={`${group.name} ${action}`} disabled={disabled} onClick={() => group.joined ? onOpen(group.id) : onJoin(group.id)}>{action}</button> : <span className="gd-join-mode">{action}</span>}</article>;
}
function PublicActivityCard({ activity, group, onOpen }: { activity: PublicDiscoveryActivity; group: PublicGroupDiscoveryCard; onOpen: (id: string, activityId?: string) => void }) {
  return <button type="button" className="gd-event" onClick={() => onOpen(group.id, activity.id)}><span className="gd-event-date"><small>{Number(activity.date.slice(5, 7))}월</small><strong>{Number(activity.date.slice(8))}</strong></span><span className="gd-event-copy"><small>{group.name}{group.example ? ' · 예시' : ''}</small><strong>{activity.title}</strong><span>{eventDate(activity)} · {[group.region, group.district].filter(Boolean).join(' ')}</span><span>참석은 모임에서 따로 선택해요.</span></span><ChevronRight size={17}/></button>;
}

export default function GroupDiscovery({ state, viewerId, onOpenGroup, onCreate, onJoinGroup, showCreate = true, initialFilters, onFiltersChange, myRegionLabel, onManageMyRegions, onUseMyRegion }: GroupDiscoveryProps) {
  const contentRef = useRef<HTMLDivElement>(null); const filterId = useId(); const searchId = useId();
  const searchInput = useRef<HTMLInputElement>(null); const searchButton = useRef<HTMLButtonElement>(null);
  const [filters, setFilters] = useState<GroupDiscoveryFilters>(() => normalized(initialFilters));
  const [showSearch, setShowSearch] = useState(Boolean(initialFilters?.query)); const [filtersOpen, setFiltersOpen] = useState(false);
  const [categorySectionsOpen, setCategorySectionsOpen] = useState(false);
  const initialKey = JSON.stringify(initialFilters || {});
  useEffect(() => { setFilters(normalized(initialFilters)); if (initialFilters?.query) setShowSearch(true); }, [initialKey]);
  useEffect(() => { if (showSearch) searchInput.current?.focus({ preventScroll: true }); }, [showSearch]);
  const update = (patch: Partial<GroupDiscoveryFilters>) => { const next = { ...filters, ...patch }; setFilters(next); onFiltersChange?.(next); };
  const reset = () => { const next = normalized({ section: filters.section === 'MEETUPS' ? 'MEETUPS' : filters.section === 'DISCOVER' ? 'DISCOVER' : 'ALL', view: filters.view, useMyRegion: false }); setFilters(next); onFiltersChange?.(next); };
  const projection = useMemo(() => selectGroupDiscovery(state, filters, viewerId), [state, filters, viewerId]);
  const sections = useMemo(() => buildGroupDiscoverySections(projection, filters), [projection, filters]);
  const previews = useMemo(() => selectGroupDiscoverySectionPreviews(sections, categorySectionsOpen), [sections, categorySectionsOpen]);
  const result = resolveGroupDiscoveryList(projection, filters);
  const resetScroll = () => contentRef.current?.closest<HTMLElement>('.content')?.scrollTo({ top: 0, behavior: 'instant' });
  const section = filters.section || 'DISCOVER';
  const selectedSubtopic = filters.subtopic && filters.subtopic !== 'ALL' ? getGroupSubtopic(filters.subtopic) : undefined;
  const parent = filters.topic || selectedSubtopic?.parent;
  const activeTopic = topics.find(topic => topic.id === parent);
  const listing = section !== 'DISCOVER' || Boolean(filters.collectionId || filters.query?.trim() || parent || filters.categoryTopics?.length);
  const chooseTab = (next: GroupDiscoverySection) => { update({ section: next, view: next === 'MEETUPS' ? 'MEETUPS' : 'GROUPS', collectionId: undefined, ...(next === 'NEW' ? { sort: 'NEWEST' as const } : {}) }); resetScroll(); };
  const chooseTopic = (topic?: GroupTopic) => { update({ topic: filters.topic === topic ? undefined : topic, subtopic: undefined, categoryTopics: undefined, collectionId: undefined }); resetScroll(); };
  const more = (item: (typeof sections)[number]) => { const next = groupDiscoveryMoreFilters(filters, item); setFilters(next); onFiltersChange?.(next); resetScroll(); };
  const regionLabel = [filters.region, filters.district].filter(Boolean).join(' ') || (filters.useMyRegion ? myRegionLabel : '') || '전체 지역';
  const row = (group: PublicGroupDiscoveryCard) => <RecruitmentCard key={group.id} group={group} onOpen={onOpenGroup} onJoin={onJoinGroup}/>;
  const chips: Array<{ id: string; label: string; remove: Partial<GroupDiscoveryFilters> }> = [];
  if (filters.region) chips.push({ id: 'region', label: filters.region, remove: { region: '', district: '', useMyRegion: false, ...(filters.collectionId === 'area' ? { collectionId: undefined } : {}) } });
  if (filters.district) chips.push({ id: 'district', label: filters.district, remove: { district: '', useMyRegion: false } });
  if (activeTopic) chips.push({ id: 'topic', label: activeTopic.label, remove: { topic: undefined, subtopic: undefined, categoryTopics: undefined, collectionId: undefined } });
  if (filters.categoryTopics?.length) chips.push({ id: 'topics', label: filters.categoryTopics.map(id => topics.find(topic => topic.id === id)?.label || '').filter(Boolean).join('·'), remove: { categoryTopics: undefined } });
  if (filters.subtopic && filters.subtopic !== 'ALL') chips.push({ id: 'subtopic', label: selectedSubtopic?.label || '선택한 세부 관심사', remove: { subtopic: undefined } });
  if (filters.style && filters.style !== 'ALL') chips.push({ id: 'style', label: filters.style === 'NEIGHBORHOOD' ? '동네 중심' : '다른 지역도 함께', remove: { style: 'ALL' } });
  if (filters.dateFilter && filters.dateFilter !== 'ALL') chips.push({ id: 'date', label: dateOptions.find(item => item.id === filters.dateFilter)?.label || filters.dateFilter, remove: { dateFilter: 'ALL' } });
  if (filters.query?.trim()) chips.push({ id: 'query', label: `검색: ${filters.query.trim()}`, remove: { query: '' } });
  if (filters.collectionId) chips.push({ id: 'collection', label: result.title, remove: { collectionId: undefined, section: result.kind === 'MEETUPS' ? 'MEETUPS' : 'ALL' } });
  const title = filters.collectionId ? result.title : section === 'NEW' || section === 'MEETUPS' || section === 'RECOMMENDED' ? result.title : activeTopic ? `${activeTopic.label}${selectedSubtopic ? ` · ${selectedSubtopic.label}` : ''} 모임` : filters.query?.trim() ? '검색한 모임' : '전체 모임';
  return <div className="gd gd-discovery gd-browse" ref={contentRef}>
    <div className="gd-browse-top"><button type="button" className="gd-area-button" aria-label={`모임 지역 선택 · ${regionLabel}`} aria-expanded={filtersOpen} aria-controls={filterId} onClick={() => setFiltersOpen(value => !value)}><MapPin size={17}/><span>{regionLabel}</span><ChevronDown size={15}/></button>{onUseMyRegion && myRegionLabel && <button type="button" className="gd-my-region" onClick={onUseMyRegion}>내 지역</button>}<button ref={searchButton} type="button" className="gd-icon" aria-label={showSearch ? '모임 검색 닫기' : '모임 검색'} aria-expanded={showSearch} aria-controls={searchId} onClick={() => setShowSearch(value => !value)}><Search size={20}/></button>{showCreate && <button type="button" className="gd-icon" aria-label="모임 만들기" onClick={onCreate}><Plus size={20}/></button>}</div>
    {showSearch && <label id={searchId} className="gd-search"><Search size={18}/><input ref={searchInput} type="search" aria-label="모임 이름·관심사 검색" placeholder="모임 이름, 관심사, 동네 검색" value={filters.query || ''} onChange={event => update({ query: event.target.value })} onKeyDown={event => { if (event.key === 'Escape') { setShowSearch(false); searchButton.current?.focus({ preventScroll: true }); } }}/>{filters.query && <button type="button" aria-label="검색어 지우기" onClick={() => { update({ query: '' }); searchInput.current?.focus({ preventScroll: true }); }}><X size={17}/></button>}</label>}
    <nav className="gd-discover-nav" aria-label="모임 둘러보기">{discoveryTabs.map(tab => <button type="button" key={tab.id} aria-pressed={tab.id === 'ALL' ? section === 'ALL' || section === 'RECOMMENDED' : section === tab.id} onClick={() => chooseTab(tab.id)}>{tab.label}</button>)}</nav>
    {filtersOpen && <div id={filterId} className="gd-condition-panel"><fieldset className="gd-area-fields"><legend>둘러볼 지역</legend><div className="gd-location-select"><MapPin size={17}/><label><span className="gd-sr-only">시·도</span><select aria-label="모임 지역" value={filters.region || ''} onChange={event => update({ region: event.target.value, district: '', useMyRegion: false })}><option value="">전체 지역</option>{projection.regions.map(region => <option key={region}>{region}</option>)}</select></label><label><span className="gd-sr-only">시·군·구</span><select aria-label="모임 시·군·구" disabled={!filters.region} value={filters.district || ''} onChange={event => update({ district: event.target.value, useMyRegion: false })}><option value="">전체 시·군·구</option>{projection.districts.map(district => <option key={district}>{district}</option>)}</select></label></div>{(onUseMyRegion || onManageMyRegions) && <div className="gd-region-actions">{onUseMyRegion && myRegionLabel && <button type="button" onClick={onUseMyRegion}>내 지역 사용 · {myRegionLabel}</button>}{onManageMyRegions && <button type="button" onClick={onManageMyRegions}>내 지역 관리<ChevronRight size={15}/></button>}</div>}</fieldset><label className="gd-style-field">활동 범위<select aria-label="모임 활동 범위" value={filters.style || 'ALL'} onChange={event => update({ style: event.target.value as GroupDiscoveryFilters['style'] })}><option value="ALL">전체</option><option value="NEIGHBORHOOD">동네 중심</option><option value="DESTINATION">다른 지역도 함께</option></select></label><fieldset className="gd-date-options"><legend>공개 약속 날짜</legend><div className="gd-date-filters" aria-label="모임 일정 날짜">{dateOptions.map(date => <button type="button" key={date.id} aria-pressed={filters.dateFilter === date.id} className={filters.dateFilter === date.id ? 'is-active' : ''} onClick={() => update({ dateFilter: date.id })}>{date.label}</button>)}</div></fieldset><div className="gd-condition-actions"><button type="button" onClick={reset}>조건 초기화</button><button type="button" className="gd-primary" onClick={() => setFiltersOpen(false)}>선택한 조건으로 보기</button></div></div>}
    <CategoryPicker selected={parent} subtopic={filters.subtopic} onChoose={chooseTopic} onSubtopic={id => { update({ subtopic: filters.subtopic === id ? undefined : id }); resetScroll(); }}/>
    {chips.length > 0 && <div className="gd-active-conditions" role="group" aria-label="현재 모임 찾기 조건">{chips.map(chip => <button type="button" key={chip.id} aria-label={`${chip.label} 조건 해제`} onClick={() => update(chip.remove)}><span>{chip.label}</span><X size={14}/></button>)}<button type="button" className="gd-clear-all" onClick={reset}>전체 해제</button></div>}
    {!listing ? <><div className="gd-browse-sections">{previews.sections.map((item, index) => <section className="gd-browse-section" key={item.id}><header><h2><span aria-hidden="true">{item.emoji}</span>{item.title}</h2><button type="button" aria-label={`${item.title} 더 보기`} onClick={() => more(item)}>더 보기<ChevronRight size={15}/></button></header><div className={item.kind === 'MEETUPS' ? 'gd-meetup-list' : 'gd-result-list'}>{item.kind === 'MEETUPS' ? item.events?.slice(0, 2).map(({ activity, group }) => <PublicActivityCard key={`${group.id}:${activity.id}`} activity={activity} group={group} onOpen={onOpenGroup}/>) : (item.previewGroups || item.groups.slice(0, 2)).map(row)}</div>{item.topics?.length && !previews.sections[index + 1]?.topics?.length && previews.categoryCount > 4 && <button type="button" className="gd-expand-categories" aria-expanded={categorySectionsOpen} onClick={() => setCategorySectionsOpen(value => !value)}>{categorySectionsOpen ? '관심사별 모임 접기' : `관심사별 모임 더 보기 · ${previews.hiddenCategories}개`}<ChevronDown size={16}/></button>}</section>)}</div>{!projection.groups.length && <div className="gd-empty"><Users size={28}/><h3>이 조건의 공개 모임을 기다리고 있어요</h3><p>지역이나 관심사를 바꾸어 살펴보세요.</p><button type="button" onClick={reset}>조건 초기화</button>{showCreate && <button type="button" onClick={onCreate}>모임 만들기</button>}</div>}<button type="button" className="gd-view-all" onClick={() => chooseTab('ALL')}>현재 조건의 전체 모임 보기<ArrowRight size={17}/></button></> : <>
      {filters.collectionId && <button type="button" className="gd-back-to-browse" onClick={() => { update({ section: 'DISCOVER', view: 'GROUPS', collectionId: undefined }); resetScroll(); }}>추천 모임으로<ChevronRight size={16}/></button>}
      <div className="gd-results-heading"><h2>{title}<span>{result.kind === 'MEETUPS' ? result.events?.length || 0 : result.groups.length}</span></h2>{result.kind !== 'MEETUPS' && section !== 'NEW' && <select aria-label="모임 정렬" value={filters.sort || 'SOONEST'} onChange={event => update({ sort: event.target.value as GroupDiscoveryFilters['sort'] })}><option value="SOONEST">다음 약속순</option><option value="NEWEST">최신 등록순</option><option value="NAME">이름순</option></select>}</div>
      {section === 'NEW' && <p className="gd-section-basis">등록일이 확인된 최근 30일 모임이에요.</p>}
      <div className={result.kind === 'MEETUPS' ? 'gd-meetup-list' : 'gd-result-list'}>{result.kind === 'MEETUPS' ? result.events?.map(({ activity, group }) => <PublicActivityCard key={`${group.id}:${activity.id}`} activity={activity} group={group} onOpen={onOpenGroup}/>) : result.groups.map(row)}</div>
      {!(result.kind === 'MEETUPS' ? result.events?.length : result.groups.length) && <div className="gd-empty"><Search size={26}/><h3>{section === 'NEW' ? '최근 등록일이 확인된 모임이 없어요' : '조건에 맞는 모임이 없어요'}</h3><p>현재 조건을 하나씩 해제하거나 다른 지역을 찾아보세요.</p><button type="button" onClick={reset}>조건 초기화</button></div>}
    </>}
  </div>;
}

export interface PublicGroupHomeProps {
  state: TogetherState;
  onExplore: (filters?: GroupDiscoveryFilters) => void;
  onOpenGroup: (id: string, activityId?: string) => void;
  regionMemory?: { value: string };
  filters?: GroupDiscoveryFilters;
  onFiltersChange?: (filters: GroupDiscoveryFilters) => void;
}
export function PublicGroupHome({ state, onExplore, onOpenGroup, regionMemory, filters: suppliedFilters, onFiltersChange }: PublicGroupHomeProps) {
  const [localFilters, setLocalFilters] = useState<GroupDiscoveryFilters>({ region: regionMemory?.value || '' });
  const filters = suppliedFilters ?? localFilters;
  const update = (patch: Partial<GroupDiscoveryFilters>) => { const next = { ...filters, ...patch }; setLocalFilters(next); onFiltersChange?.(next); if (regionMemory) regionMemory.value = next.region || ''; };
  const projection = selectGroupDiscovery(state, filters);
  const parent = filters.topic || getGroupSubtopic(filters.subtopic || '')?.parent;
  return <section className="gd gd-home gd-browse"><div className="gd-home-title"><h2>취향이 맞는 모임</h2><button type="button" className="gd-icon" aria-label="공개 모임 전체 보기" onClick={() => onExplore({ ...filters, section: 'ALL', view: 'GROUPS' })}><ArrowRight size={20}/></button></div><div className="gd-location-select"><MapPin size={16}/><label><span className="gd-sr-only">홈 공개 모임 지역</span><select aria-label="홈 공개 모임 지역" value={filters.region || ''} onChange={event => update({ region: event.target.value, district: '', useMyRegion: false })}><option value="">전체 지역</option>{projection.regions.map(item => <option key={item}>{item}</option>)}</select></label><label><span className="gd-sr-only">홈 공개 모임 시·군·구</span><select aria-label="홈 공개 모임 시·군·구" value={filters.district || ''} disabled={!filters.region} onChange={event => update({ district: event.target.value, useMyRegion: false })}><option value="">전체 시·군·구</option>{projection.districts.map(item => <option key={item}>{item}</option>)}</select></label></div><CategoryPicker selected={parent} subtopic={filters.subtopic} onChoose={topic => update({ topic: filters.topic === topic ? undefined : topic, subtopic: undefined, categoryTopics: undefined })} onSubtopic={id => update({ subtopic: filters.subtopic === id ? undefined : id })}/><div className="gd-result-list">{projection.recommended.slice(0, 3).map(group => <RecruitmentCard key={group.id} group={group} onOpen={onOpenGroup}/>)}</div>{!projection.recommended.length && <p className="gd-section-basis">이 지역·관심사에 맞는 모집 모임이 없어요.</p>}{projection.events[0] && <div className="gd-home-next"><h3>다가오는 번개·정모</h3><PublicActivityCard activity={projection.events[0].activity} group={projection.events[0].group} onOpen={onOpenGroup}/></div>}<button type="button" className="gd-view-all" onClick={() => onExplore({ ...filters, section: 'ALL', view: 'GROUPS' })}>현재 조건의 모임 더 보기<ChevronRight size={17}/></button></section>;
}
