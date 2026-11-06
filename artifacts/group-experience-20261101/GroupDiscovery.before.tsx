import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, CalendarDays, ChevronDown, ChevronRight, MapPin, Plus, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import { PhotoCredit } from '../PublicTourismCredit';
import type { GroupTopic, PublicActivityIntent, TogetherGroup, TogetherState } from './model';
import { discoveryProfile, filterDiscoveryGroups, isDiscoverableGroup, koreaDay, publicActivityTimeKey, shiftDay, topicOptions, upcomingPublicActivities, type DiscoveryFilters, type PublicDiscoveryActivity } from './discovery';
import './group-discovery.css';

export interface GroupDiscoveryFilters {
  /** Public-only card context restored with navigation; not a membership or RSVP command. */
  publicActivityIntent?: PublicActivityIntent;
  region?: string; district?: string; topic?: GroupTopic; style?: 'ALL' | 'NEIGHBORHOOD' | 'DESTINATION'; view?: 'GROUPS' | 'MEETUPS';
  dateFilter?: 'ALL' | 'TODAY' | 'WEEKEND' | 'WEEK'; query?: string; sort?: 'SOONEST' | 'NAME';
}
export interface GroupDiscoveryProps {
  state: TogetherState; viewerId: string; onOpenGroup: (id: string, activityId?: string) => void; onCreate: () => void;
  initialFilters?: GroupDiscoveryFilters; onFiltersChange?: (filters: GroupDiscoveryFilters) => void;
}
const normalized = (filters?: GroupDiscoveryFilters): GroupDiscoveryFilters => ({
  region: filters?.region || '', district: filters?.district || '', topic: filters?.topic,
  style: filters?.style, view: filters?.view || 'GROUPS', dateFilter: filters?.dateFilter || 'ALL', publicActivityIntent: filters?.publicActivityIntent, query: filters?.query || '', sort: filters?.sort || 'SOONEST',
});
const dateOptions = [{ id: 'ALL', label: '날짜 무관' }, { id: 'TODAY', label: '오늘' }, { id: 'WEEK', label: '7일 안에' }, { id: 'WEEKEND', label: '주말' }] as const;
const orderedTopics = ['SOCIAL', 'FOOD', 'CAFE', 'WALK', 'SPORTS', 'BOOK', 'CULTURE', 'GAME', 'PHOTO', 'OUTDOOR', 'MUSIC', 'LANGUAGE', 'CRAFT', 'PETS', 'FAMILY', 'TRAVEL'] as const;
const topics = orderedTopics.map(id => topicOptions.find(topic => topic.id === id)).filter((topic): topic is (typeof topicOptions)[number] => Boolean(topic));
const publicDate = (value: string): string => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? new Date(`${value}T12:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }) : '날짜 미정';
const eventDate = (activity: PublicDiscoveryActivity) => `${publicDate(activity.date)}${activity.endDate && activity.endDate !== activity.date ? ` ~ ${publicDate(activity.endDate)}` : ''}${activity.startTime ? ` · ${activity.startTime}` : ''}`;

function matchesDate(activity: PublicDiscoveryActivity, filter?: GroupDiscoveryFilters['dateFilter']): boolean {
  if (!filter || filter === 'ALL') return true;
  const today = koreaDay();
  let from = today, to = today;
  if (filter === 'WEEK') to = shiftDay(today, 6);
  if (filter === 'WEEKEND') {
    const weekday = new Date(`${today}T12:00:00+09:00`).getUTCDay();
    from = shiftDay(today, weekday === 0 ? -1 : (6 - weekday + 7) % 7);
    to = shiftDay(from, 1);
  }
  return activity.date <= to && (activity.endDate || activity.date) >= from;
}

function CategoryGrid({ selected, onChoose, compact = false, extra }: { selected?: GroupTopic; onChoose: (topic: GroupTopic) => void; compact?: boolean; extra?: ReactNode }) {
  const [expanded, setExpanded] = useState(() => Boolean(selected && topics.findIndex(topic => topic.id === selected) >= 8));
  useEffect(() => { if (selected && topics.findIndex(topic => topic.id === selected) >= 8) setExpanded(true); }, [selected]);
  const visible = expanded ? topics : topics.slice(0, 8);
  return <div className="gd-category-picker"><div className="gd-categories" aria-label="관심사로 모임 찾기">{visible.map(topic => <button className={`gd-topic ${selected === topic.id ? 'is-active' : ''}`} key={topic.id} onClick={() => onChoose(topic.id)} aria-pressed={selected === topic.id}><span className="gd-emoji" aria-hidden="true">{topic.emoji}</span><span>{topic.label}</span></button>)}{compact && topics.length > 8 && <button className="gd-topic gd-topic-more" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}><span className="gd-emoji" aria-hidden="true">{expanded ? '⌃' : '···'}</span><span>{expanded ? '접기' : '더보기'}</span></button>}</div>{!compact && <div className="gd-category-tools">{topics.length > 8 && <button onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? '관심사 접기' : '관심사 더보기'}<ChevronDown className={expanded ? 'is-open' : ''} size={15} /></button>}{extra}</div>}</div>;
}

function RecruitmentCard({ state, group, viewerId = '', onOpen, showcase = false, dateFilter }: { state: TogetherState; group: TogetherGroup; viewerId?: string; onOpen: (id: string) => void; showcase?: boolean; dateFilter?: GroupDiscoveryFilters['dateFilter'] }) {
  const profile = discoveryProfile(group);
  const next = upcomingPublicActivities(state, group).find(activity => matchesDate(activity, dateFilter));
  const mainTopic = topicOptions.find(topic => topic.id === profile.topics[0]);
  const joined = Boolean(viewerId && group.memberIds.includes(viewerId));
  return <article className={`gd-group-card ${showcase ? 'gd-group-card--showcase' : ''}`}>
    <button className="gd-group-open" onClick={() => onOpen(group.id)}>
      <div className="gd-group-photo">{group.cover ? <img src={group.cover} alt="" loading="lazy" /> : <span className="gd-photo-fallback" aria-hidden="true">{mainTopic?.emoji || '👥'}</span>}<span className="gd-recruitment">{joined ? '가입 중' : profile.recruitment === 'OPEN' ? '모집 중' : '모집 마감'}</span></div>
      <div className="gd-group-copy"><div className="gd-card-topline"><span>{mainTopic?.label || '함께하기'}</span>{group.sourceKind === 'EXAMPLE' && <small>모임 예시</small>}</div><h3>{group.name}</h3><div className="gd-location"><MapPin size={13} /><span>{[group.region, profile.district].filter(Boolean).join(' · ')}</span></div><p>{profile.welcome}</p><div className="gd-card-bottom"><span><Users size={13} />{group.memberIds.length}명</span><span>{joined ? '우리 모임' : '가입 승인제'}</span></div>{next && <div className="gd-next-date"><CalendarDays size={13} />{eventDate(next)}</div>}</div>
      {!showcase && <ChevronRight className="gd-card-arrow" size={16} />}
    </button>
    {group.cover && <div className="gd-photo-credit"><PhotoCredit image={group.cover} /></div>}
  </article>;
}

function PublicActivityCard({ activity, group, onOpen }: { activity: PublicDiscoveryActivity; group: TogetherGroup; onOpen: (id: string, activityId?: string) => void }) {
  const profile = discoveryProfile(group);
  return <button className="gd-event" onClick={() => onOpen(group.id, activity.id)}>
    <span className="gd-event-date"><small>{Number(activity.date.slice(5, 7))}월</small><strong>{Number(activity.date.slice(8))}</strong></span>
    <span className="gd-event-copy"><small>{group.name}{group.sourceKind === 'EXAMPLE' ? ' · 모임 예시' : ''}</small><strong>{activity.title}</strong><span>{eventDate(activity)} · {[group.region, profile.district].filter(Boolean).join(' ')}</span></span><ChevronRight size={17} />
  </button>;
}

export default function GroupDiscovery({ state, viewerId, onOpenGroup, onCreate, initialFilters, onFiltersChange }: GroupDiscoveryProps) {
  const [filters, setFilters] = useState<GroupDiscoveryFilters>(() => normalized(initialFilters));
  const sort = filters.sort || 'SOONEST';
  const [showSearch, setShowSearch] = useState(Boolean(initialFilters?.query));
  const [showDates, setShowDates] = useState(initialFilters?.dateFilter && initialFilters.dateFilter !== 'ALL' ? true : false);
  const initialKey = JSON.stringify(initialFilters || {});
  useEffect(() => { setFilters(normalized(initialFilters)); if (initialFilters?.query) setShowSearch(true); }, [initialKey]);
  const update = (patch: Partial<GroupDiscoveryFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next); onFiltersChange?.(next);
  };
  const reset = () => { const next = normalized({ view: filters.view }); setFilters(next); onFiltersChange?.(next); };
  const publicGroups = useMemo(() => state.groups.filter(isDiscoverableGroup), [state.groups]);
  const regions = [...new Set(publicGroups.map(group => group.region).filter(Boolean))];
  const districts = [...new Set(publicGroups.filter(group => !filters.region || group.region === filters.region).map(group => discoveryProfile(group).district).filter(Boolean))];
  // Legacy style values remain readable in old links, but never hide ordinary groups.
  const found = filterDiscoveryGroups(state, { ...filters, style: 'ALL', sort } as DiscoveryFilters);
  if (sort === 'SOONEST') found.sort((a, b) => { const left = upcomingPublicActivities(state, a).find(activity => matchesDate(activity, filters.dateFilter)); const right = upcomingPublicActivities(state, b).find(activity => matchesDate(activity, filters.dateFilter)); return publicActivityTimeKey(left?.date || '', left?.startTime).localeCompare(publicActivityTimeKey(right?.date || '', right?.startTime)); });
  const events = found.flatMap(group => upcomingPublicActivities(state, group).filter(activity => matchesDate(activity, filters.dateFilter)).map(activity => ({ activity, group }))).sort((a, b) => publicActivityTimeKey(a.activity.date, a.activity.startTime).localeCompare(publicActivityTimeKey(b.activity.date, b.activity.startTime)));
  const activeFilters = Boolean(filters.region || filters.district || filters.topic || filters.query || filters.dateFilter !== 'ALL');
  const meetupMode = filters.view === 'MEETUPS';
  return <div className="gd gd-discovery">
    <div className="gd-view-tabs" aria-label="찾을 내용"><button className={!meetupMode ? 'is-active' : ''} aria-pressed={!meetupMode} onClick={() => update({ view: 'GROUPS' })}>모임</button><button className={meetupMode ? 'is-active' : ''} aria-pressed={meetupMode} onClick={() => update({ view: 'MEETUPS' })}><CalendarDays size={16} />번개·정모</button><button className="gd-mode-create" aria-label="모임 만들기" onClick={onCreate}><Plus size={19} /></button></div>
    <div className="gd-location-select"><MapPin size={18} /><label><span className="gd-sr-only">지역</span><select aria-label="모임 지역" value={filters.region || ''} onChange={event => update({ region: event.target.value, district: '' })}><option value="">전체 지역</option>{regions.map(region => <option key={region}>{region}</option>)}</select></label><span className="gd-select-divider" /><label><span className="gd-sr-only">동네</span><select aria-label="동네" value={filters.district || ''} onChange={event => update({ district: event.target.value })}><option value="">전체 동네</option>{districts.map(district => <option key={district}>{district}</option>)}</select></label></div>
    <CategoryGrid selected={filters.topic} onChoose={topic => update({ topic: filters.topic === topic ? undefined : topic })} extra={<div className="gd-category-extra"><button className={filters.dateFilter !== 'ALL' ? 'has-filter' : ''} onClick={() => setShowDates(value => !value)} aria-expanded={showDates}><CalendarDays size={15} />{dateOptions.find(item => item.id === filters.dateFilter && item.id !== 'ALL')?.label || '날짜 선택'}<ChevronDown className={showDates ? 'is-open' : ''} size={15} /></button><button className="gd-search-toggle" aria-label={showSearch ? '검색창 접기' : '검색창 열기'} aria-expanded={showSearch} onClick={() => setShowSearch(value => !value)}><Search size={18} /></button></div>} />
    {showDates && <div className="gd-date-filters" aria-label="모임 일정 날짜">{dateOptions.map(date => <button key={date.id} className={filters.dateFilter === date.id ? 'is-active' : ''} onClick={() => update({ dateFilter: date.id })} aria-pressed={filters.dateFilter === date.id}>{date.label}</button>)}</div>}
    {showSearch && <label className="gd-search"><Search size={18} /><input aria-label="모임 이름·관심사 검색" placeholder="모임 이름, 관심사, 동네 검색" value={filters.query || ''} onChange={event => update({ query: event.target.value })} />{filters.query && <button aria-label="검색어 지우기" onClick={() => update({ query: '' })}><X size={17} /></button>}</label>}
    {activeFilters && <div className="gd-filter-summary"><span>{[filters.region, filters.district, topics.find(topic => topic.id === filters.topic)?.label, dateOptions.find(item => item.id === filters.dateFilter && item.id !== 'ALL')?.label].filter(Boolean).join(' · ') || '검색 조건 적용 중'}</span><button onClick={reset}><X size={14} />초기화</button></div>}
    <section className="gd-results"><div className="gd-results-heading"><h2>{meetupMode ? '다가오는 번개·정모' : '모집 중인 모임'} <span>{meetupMode ? events.length : found.length}</span></h2>{!meetupMode && <label><SlidersHorizontal size={14} /><select aria-label="모임 정렬" value={sort} onChange={event => update({ sort: event.target.value as 'SOONEST' | 'NAME' })}><option value="SOONEST">일정 가까운 순</option><option value="NAME">이름순</option></select></label>}</div><div className={meetupMode ? 'gd-meetup-list' : 'gd-result-list'}>{meetupMode ? events.map(({ activity, group }) => <PublicActivityCard key={activity.id} activity={activity} group={group} onOpen={onOpenGroup} />) : found.map(group => <RecruitmentCard state={state} group={group} viewerId={viewerId} onOpen={onOpenGroup} dateFilter={filters.dateFilter} key={group.id} />)}</div>{(meetupMode ? !events.length : !found.length) && <div className="gd-empty"><span aria-hidden="true">🧭</span><h3>{meetupMode ? '조건에 맞는 번개·정모가 없어요' : '조건에 맞는 모임이 없어요'}</h3><p>다른 동네나 관심사로 찾아보세요.<br />직접 함께할 사람을 모아도 좋아요.</p><button className="gd-primary" onClick={reset}>조건 초기화</button><button onClick={onCreate}><Plus size={16} />새 모임 만들기</button></div>}</section>
  </div>;
}

export function PublicGroupHome({ state, onExplore, onOpenGroup, regionMemory }: { state: TogetherState; onExplore: (filters?: GroupDiscoveryFilters) => void; onOpenGroup: (id: string, activityId?: string) => void; regionMemory?: { value: string } }) {
  const [region, setRegion] = useState(() => regionMemory?.value ?? '');
  const regions = [...new Set(state.groups.filter(isDiscoverableGroup).map(group => group.region).filter(Boolean))];
  const filters: GroupDiscoveryFilters = { region, view: 'GROUPS', dateFilter: 'ALL' };
  const matchingGroups = filterDiscoveryGroups(state, { ...filters, sort: 'EDITORIAL' });
  const ordered = [...matchingGroups].sort((a, b) => {
    const rank = (group: TogetherGroup) => { const index = topics.findIndex(topic => topic.id === discoveryProfile(group).topics[0]); return index < 0 ? topics.length : index; };
    return rank(a) - rank(b);
  });
  const groups: TogetherGroup[] = [];
  const represented = new Set<GroupTopic | undefined>();
  for (const group of ordered) {
    const topic = discoveryProfile(group).topics[0];
    if (!represented.has(topic)) { groups.push(group); represented.add(topic); }
    if (groups.length === 3) break;
  }
  for (const group of ordered) { if (groups.length === 3) break; if (!groups.some(item => item.id === group.id)) groups.push(group); }
  const nextEvent = matchingGroups.flatMap(group => upcomingPublicActivities(state, group).map(activity => ({ activity, group }))).sort((a, b) => publicActivityTimeKey(a.activity.date, a.activity.startTime).localeCompare(publicActivityTimeKey(b.activity.date, b.activity.startTime)))[0];
  return <section className="gd gd-home" aria-labelledby="public-group-home-title"><div className="gd-home-title"><div><span className="gd-eyebrow">같은 취향, 새로운 만남</span><h2 id="public-group-home-title">취향이 맞는 모임</h2><p>좋아하는 일을 함께해요.</p></div><button className="gd-icon" aria-label="공개 모임 전체 보기" onClick={() => onExplore(filters)}><ArrowRight size={20} /></button></div>
    <div className="gd-home-switch"><label className="gd-home-region"><MapPin size={14} /><select aria-label="홈 공개 모임 지역" value={region} onChange={event => { const next = event.target.value; if (regionMemory) regionMemory.value = next; setRegion(next); }}><option value="">전체 지역</option>{regions.map(item => <option key={item}>{item}</option>)}</select></label><button className="gd-home-meetups" onClick={() => onExplore({ ...filters, view: 'MEETUPS' })}><CalendarDays size={16} />번개·정모<ChevronRight size={14} /></button></div>
    <CategoryGrid compact onChoose={topic => onExplore({ ...filters, topic })} />
    {groups.length ? <div className="gd-home-showcase">{groups.map(group => <RecruitmentCard key={group.id} state={state} group={group} onOpen={onOpenGroup} showcase />)}</div> : <div className="gd-home-empty"><span aria-hidden="true">🌿</span><p>이 지역에서 함께할 모임을 찾아보세요.</p><button onClick={() => onExplore(filters)}>모임 찾기 <ArrowRight size={16} /></button></div>}
    {nextEvent && <div className="gd-home-next"><span className="gd-eyebrow">다가오는 번개·정모</span><PublicActivityCard activity={nextEvent.activity} group={nextEvent.group} onOpen={onOpenGroup} /></div>}
    <button className="gd-view-all" onClick={() => onExplore(filters)}>{region ? `${region}의 모임` : '모집 중인 모임'} 더 보기 <ArrowRight size={17} /></button>
  </section>;
}
