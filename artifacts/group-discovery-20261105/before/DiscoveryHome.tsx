import { useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, CalendarDays, ChevronDown, ChevronRight, Coffee, Compass, Footprints, MapPin, Palette, Search, SlidersHorizontal, Utensils, Users, X, Luggage, ImageOff, Sparkles } from 'lucide-react';
import type { Place } from '../data';
import type { HomePlaceFilters, HomeRegionReference } from '../homeDiscovery';
import { interestKindLabels } from '../interestCollectionStore';
import type { GroupDiscoveryFilters } from '../together/GroupDiscovery';
import type { TogetherState } from '../together/model';
import { discoveryPurposes, selectDiscoveryHome, type DiscoveryGroupCard, type DiscoveryHomeView, type DiscoveryPurpose } from './discoveryHomeModel';
import './discovery-home.css';

export interface DiscoveryHomeProps {
  places: ReadonlyArray<Place>;
  references?: ReadonlyArray<HomeRegionReference>;
  state: TogetherState;
  viewerId?: string;
  region: string;
  query: string;
  onRegionChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onOpenGroup: (groupId: string, activityId?: string) => void;
  onFindGroups: (filters?: GroupDiscoveryFilters) => void;
  onOpenPlace: (place: Place) => void;
  onOpenPlaces: (filters: HomePlaceFilters) => void;
  header?: ReactNode;
  headerActions?: ReactNode;
  travelContent?: ReactNode;
  onPlan?: () => void;
  view?: DiscoveryHomeView;
  onViewChange?: (view: DiscoveryHomeView) => void;
  purpose?: DiscoveryPurpose;
  onPurposeChange?: (purpose: DiscoveryPurpose | undefined) => void;
}

const emptyReferences: ReadonlyArray<HomeRegionReference> = [];
const purposeIcons = { FOOD: Utensils, CAFE: Coffee, WALK: Footprints, CULTURE: Palette, FAMILY: Users, TRAVEL: Luggage };
const groupIcons = { FOOD: Utensils, CAFE: Coffee, WALK: Footprints, CULTURE: Palette, FAMILY: Users, TRAVEL: Luggage };
const homeViews: Array<{ id: DiscoveryHomeView; label: string }> = [
  { id: 'recommended', label: '추천' }, { id: 'meetups', label: '만남' },
  { id: 'groups', label: '모임' }, { id: 'places', label: '장소' },
  { id: 'trips', label: '여행' },
];
const publicDate = (date: string) => new Date(`${date}T12:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
const groupArea = (group: DiscoveryGroupCard) => [group.region, group.district].filter(Boolean).join(' · ');

function PlaceThumbnail({ place }: { place: Place }) {
  const [failed, setFailed] = useState('');
  return place.image && failed !== place.image
    ? <img src={place.image} alt="" loading="lazy" onError={() => setFailed(place.image)} />
    : <span className="discovery-home__image-empty" aria-hidden="true"><ImageOff size={23}/></span>;
}

function GroupThumbnail({ group }: { group: DiscoveryGroupCard }) {
  const [failed, setFailed] = useState('');
  const Icon = groupIcons[group.topics[0] as keyof typeof groupIcons] || Users;
  return group.cover && failed !== group.cover
    ? <img src={group.cover} alt="" loading="lazy" onError={() => setFailed(group.cover)}/>
    : <span className="discovery-home__group-image-empty" aria-hidden="true"><Icon size={26}/></span>;
}

/** Public discovery only. Membership, RSVP, saves and publication remain explicit destination actions. */
export default function DiscoveryHome({ places, references = emptyReferences, state, viewerId = '', region, query, onRegionChange, onQueryChange, onOpenGroup, onFindGroups, onOpenPlace, onOpenPlaces, header, headerActions, travelContent, onPlan, view, onViewChange, purpose, onPurposeChange }: DiscoveryHomeProps) {
  const uid = useId();
  const [localView, setLocalView] = useState<DiscoveryHomeView>('recommended');
  const [localPurpose, setLocalPurpose] = useState<DiscoveryPurpose>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const currentView = view ?? localView;
  const currentPurpose = onPurposeChange ? purpose : localPurpose;
  const projection = useMemo(() => selectDiscoveryHome(state, places, references, { region, query, purpose: currentPurpose }, viewerId), [state, places, references, region, query, currentPurpose, viewerId]);
  const changeView = (next: DiscoveryHomeView) => {
    if (next === 'trips') { setLocalPurpose(undefined); onPurposeChange?.(undefined); }
    setLocalView(next); onViewChange?.(next);
  };
  const changePurpose = (next: DiscoveryPurpose) => {
    if (next === 'TRAVEL') { changeView('trips'); setFiltersOpen(false); return; }
    const selected = currentPurpose === next ? undefined : next;
    setLocalPurpose(selected); onPurposeChange?.(selected);
    if (currentView === 'trips') changeView('recommended');
  };
  const purposeLabel = discoveryPurposes.find(item => item.id === currentPurpose)?.label;
  const reset = () => { onRegionChange(''); onQueryChange(''); setLocalPurpose(undefined); onPurposeChange?.(undefined); };
  const hasFilters = Boolean(region || query.trim() || currentPurpose);
  const shownMeetups = projection.meetups.slice(0, currentView === 'recommended' ? 2 : 8);
  const shownGroups = projection.groups.slice(0, currentView === 'recommended' ? 3 : 8);
  const shownPlaces = projection.places.slice(0, 4);
  const findGroups = (mode: 'GROUPS' | 'MEETUPS') => onFindGroups({ ...projection.groupFilters, view: mode });
  const noResults = !projection.meetups.length && !projection.groups.length && !projection.places.length;
  const emptyRecommendation = currentView === 'recommended' && noResults;
  const searchControls = <div className="discovery-home__search-area">
        <label className="discovery-home__region"><MapPin size={18} aria-hidden="true"/><span className="discovery-home__sr-only">활동 지역</span><select aria-label="발견 활동 지역" value={region} onChange={event => onRegionChange(event.target.value)}><option value="">전체 지역</option>{projection.regions.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={16} aria-hidden="true"/></label>
        <label className="discovery-home__search"><Search size={18} aria-hidden="true"/><input aria-label="모임·만남·장소·여행 검색" type="search" value={query} onChange={event => onQueryChange(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.blur(); }} placeholder="관심사, 모임, 장소, 여행 코스"/>{query && <button type="button" aria-label="발견 검색어 지우기" onClick={() => onQueryChange('')}><X size={18}/></button>}</label>
      </div>;
  return <div className="discovery-home">
    {headerActions ? <header className="discovery-home__header"><h1 className="discovery-home__sr-only">발견 · 사람과 장소</h1>{searchControls}<div className="discovery-home__header-actions">{headerActions}</div></header> : header}
    <div className="discovery-home__content">
      {!header && !headerActions && <h1 className="discovery-home__sr-only">사람과 장소 발견</h1>}
      {!headerActions && searchControls}
      <div className="discovery-home__views" role="group" aria-label="발견에서 볼 내용">{homeViews.map(item => <button type="button" key={item.id} aria-pressed={currentView === item.id} onClick={() => changeView(item.id)}>{item.label}</button>)}</div>
      <div className="discovery-home__tools"><button type="button" className="discovery-home__filter-toggle" aria-expanded={filtersOpen} aria-controls={`${uid}-filters`} onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={17} aria-hidden="true"/><span>{purposeLabel || '활동 조건'}</span><ChevronDown size={15} aria-hidden="true"/></button>{hasFilters && <button type="button" className="discovery-home__reset" aria-label="발견 조건 초기화" onClick={reset}><X size={17}/></button>}{onPlan && currentView !== 'trips' && <button type="button" className="discovery-home__plan" onClick={onPlan}><Sparkles size={17} aria-hidden="true"/><span>AI로 계획</span></button>}</div>
      {filtersOpen && <div id={`${uid}-filters`} className="discovery-home__filter-panel"><div className="discovery-home__purposes" role="group" aria-label="함께할 일로 찾기">{discoveryPurposes.map(item => {
        const Icon = purposeIcons[item.id];
        const active = item.id === 'TRAVEL' ? currentView === 'trips' : currentPurpose === item.id;
        return <button type="button" key={item.id} aria-pressed={active} className={active ? 'is-active' : ''} onClick={() => changePurpose(item.id)}><Icon size={18} strokeWidth={1.7} aria-hidden="true"/><span>{item.label}</span></button>;
      })}</div><button type="button" className="discovery-home__filter-done" onClick={() => setFiltersOpen(false)}>선택한 조건으로 보기<ChevronRight size={16}/></button></div>}
      <div className="discovery-home__sections" aria-live="polite" aria-atomic="false">
        {!emptyRecommendation && (currentView === 'recommended' || currentView === 'meetups') && <section className="discovery-home__section" aria-labelledby={`${uid}-meetups`}><div className="discovery-home__section-title"><h2 id={`${uid}-meetups`}>{region ? `${region}에서 모집 중인 만남` : '모집 중인 만남'}</h2><button type="button" onClick={() => findGroups('MEETUPS')} aria-label="같은 조건의 만남 더 보기">더 보기<ChevronRight size={16}/></button></div>
          {shownMeetups.length ? <div className="discovery-home__meetups">{shownMeetups.map(({ group, activity }) => <article className="discovery-home__meetup" key={`${group.id}:${activity.id}`}><button type="button" onClick={() => onOpenGroup(group.id, activity.id)}><span className="discovery-home__date" aria-hidden="true"><small>{Number(activity.date.slice(5, 7))}월</small><strong>{Number(activity.date.slice(8, 10))}</strong></span><span className="discovery-home__meetup-copy"><span className="discovery-home__meta">{publicDate(activity.date)}{activity.endDate && activity.endDate !== activity.date ? `–${publicDate(activity.endDate)}` : ''}{activity.startTime ? ` · ${activity.startTime}` : ' · 시간 안내 확인'}</span><strong>{activity.title}</strong><span className="discovery-home__meta">{group.category} · {groupArea(group)}</span><span className="discovery-home__host">{group.name}{group.example ? ' · 모임 예시' : ''}</span></span><ChevronRight size={18} aria-hidden="true"/></button></article>)}</div> : <div className="discovery-home__empty"><CalendarDays size={22} aria-hidden="true"/><p>조건에 맞는 모집 중인 만남이 없어요.</p><button type="button" onClick={() => findGroups('MEETUPS')}>다른 만남 찾아보기<ArrowRight size={16}/></button></div>}
        </section>}
        {!emptyRecommendation && (currentView === 'recommended' || currentView === 'groups') && <section className="discovery-home__section" aria-labelledby={`${uid}-groups`}><div className="discovery-home__section-title"><h2 id={`${uid}-groups`}>{region ? `${region}의 모임` : '함께할 모임을 찾아보세요'}</h2><button type="button" onClick={() => findGroups('GROUPS')} aria-label="같은 조건의 모임 더 보기">모두 보기<ChevronRight size={16}/></button></div>
          {shownGroups.length ? <div className="discovery-home__groups">{shownGroups.map(group => {
            return <article className="discovery-home__group" key={group.id}><button type="button" onClick={() => onOpenGroup(group.id)}><span className="discovery-home__group-image"><GroupThumbnail group={group}/></span><span className="discovery-home__group-copy"><strong>{group.name}</strong><span className="discovery-home__welcome">{group.welcome}</span><span className="discovery-home__meta">{groupArea(group)} · {group.category} · {group.joined ? '가입 중' : '가입 신청'}{group.example ? ' · 예시' : ''}</span></span><ChevronRight size={17} aria-hidden="true"/></button></article>;
          })}</div> : <div className="discovery-home__empty"><Users size={22} aria-hidden="true"/><p>조건에 맞는 모집 모임이 없어요.</p><button type="button" onClick={() => findGroups('GROUPS')}>모임 찾기<ArrowRight size={16}/></button></div>}
        </section>}
        {!emptyRecommendation && (currentView === 'recommended' || currentView === 'places') && <section className="discovery-home__section" aria-labelledby={`${uid}-places`}><div className="discovery-home__section-title"><h2 id={`${uid}-places`}>함께 고를 장소</h2><button type="button" onClick={() => onOpenPlaces(projection.placeFilters)} aria-label="같은 조건의 장소 더 보기">더 보기<ChevronRight size={16}/></button></div>
          {shownPlaces.length ? <div className="discovery-home__places">{shownPlaces.map(place => <article className="discovery-home__place" key={place.id}><button type="button" className="discovery-home__place-open" onClick={() => onOpenPlace(place)}><span className="discovery-home__place-image"><PlaceThumbnail place={place}/></span><span className="discovery-home__place-copy"><span className="discovery-home__meta">{interestKindLabels[place.kind]} · {place.area}</span><strong>{place.name}</strong><span className="discovery-home__welcome">{place.hook || place.description}</span></span><ChevronRight size={17} aria-hidden="true"/></button></article>)}</div> : <div className="discovery-home__empty"><MapPin size={22} aria-hidden="true"/><p>조건에 맞는 공개 장소가 없어요.</p><button type="button" onClick={() => onOpenPlaces(projection.placeFilters)}>장소 둘러보기<ArrowRight size={16}/></button></div>}
        </section>}
      </div>
      {currentView === 'trips' && travelContent}
      {emptyRecommendation && <div className="discovery-home__no-results"><Compass size={24} aria-hidden="true"/><p>지역이나 검색 조건을 바꾸어 찾아보세요.</p><button type="button" onClick={reset}>전체 추천 보기</button></div>}
    </div>
  </div>;
}

