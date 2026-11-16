import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CalendarPlus, ChevronDown, ChevronRight, Coffee, Compass, Footprints, MapPin, Palette, Search, SlidersHorizontal, Utensils, Users, X, Luggage, ImageOff } from 'lucide-react';
import type { Journey, Place } from '../data';
import type { HomeTripTemplate } from '../consumerPublicSeed';
import type { HomePlaceFilters, HomeRegionReference } from '../homeDiscovery';
import { interestKindLabels } from '../interestCollectionStore';
import type { GroupDiscoveryFilters } from '../together/GroupDiscovery';
import type { TogetherState } from '../together/model';
import { discoveryPurposes, selectDiscoveryHome, type DiscoveryHomeView, type DiscoveryPurpose } from './discoveryHomeModel';
import MemberReturnStrip from './MemberReturnStrip';
import TravelHomeSections from './TravelHomeSections';
import GroupDiscoveryHome, { GroupMeetupSchedule } from './GroupDiscoveryHome';
import { selectGroupDiscoveryHome, selectHomeSavedInterestGroups } from './groupDiscoveryHomeModel';
import GroupInterestSheet from '../GroupInterestSheet';
import { useGroupInterests } from '../useGroupInterests';
import { selectTravelHomeContent, type HomeTravelDuration } from './travelHomeModel';
import { selectHomeSharedActivity } from './homeSharedActivity';
import './discovery-home.css';

export interface DiscoveryHomeProps {
  mode?: 'home' | 'travel';
  places: ReadonlyArray<Place>;
  references?: ReadonlyArray<HomeRegionReference>;
  state: TogetherState;
  viewerId?: string;
  region: string;
  district?: string;
  myRegionLabel?: string;
  onManageMyRegions?: () => void;
  onUseMyRegion?: () => void;
  query: string;
  onRegionChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onOpenGroup: (groupId: string, activityId?: string) => void;
  onFindGroups: (filters?: GroupDiscoveryFilters) => void;
  onOpenPlace: (place: Place) => void;
  onOpenPlaces: (filters: HomePlaceFilters) => void;
  onOpenMyActivity?: (activityId: string) => void;
  onOpenMyChat?: (groupId: string, activityId?: string) => void;
  personalPlans?: ReadonlyArray<Journey>;
  onOpenMyPlan?: (journeyId: string) => void;
  header?: ReactNode;
  headerActions?: ReactNode;
  travelContent?: ReactNode;
  templates?: ReadonlyArray<HomeTripTemplate>;
  journals?: ReadonlyArray<Journey>;
  duration?: HomeTravelDuration;
  onDurationChange?: (duration: HomeTravelDuration) => void;
  onOpenTemplate?: (id: string) => void;
  onOpenJournal?: (id: string) => void;
  onMoreTravel?: (duration: HomeTravelDuration) => void;
  onMoreJournals?: (duration: HomeTravelDuration) => void;
  onPlan?: () => void;
  onStartTogether?: () => void; onTryCourse?: (id: string) => void;
  view?: DiscoveryHomeView;
  onViewChange?: (view: DiscoveryHomeView) => void;
  purpose?: DiscoveryPurpose;
  onPurposeChange?: (purpose: DiscoveryPurpose | undefined) => void;
}

const emptyReferences: ReadonlyArray<HomeRegionReference> = [];
const emptyTemplates: ReadonlyArray<HomeTripTemplate> = [];
const emptyJournals: ReadonlyArray<Journey> = [];
const purposeIcons = { FOOD: Utensils, CAFE: Coffee, WALK: Footprints, CULTURE: Palette, FAMILY: Users, TRAVEL: Luggage };
const homeViews: Array<{ id: DiscoveryHomeView; label: string }> = [
  { id: 'recommended', label: '추천' }, { id: 'meetups', label: '번개·정모' },
  { id: 'groups', label: '모임' }, { id: 'places', label: '장소 찾기' },
  { id: 'trips', label: '여행' },
];

function PlaceThumbnail({ place }: { place: Place }) {
  const [failed, setFailed] = useState('');
  return place.image && failed !== place.image
    ? <img src={place.image} alt="" loading="lazy" onError={() => setFailed(place.image)} />
    : <span className="discovery-home__image-empty" aria-hidden="true"><ImageOff size={23}/></span>;
}

/** Public recommendations and a separately gated member return strip; destinations own mutations. */
export default function DiscoveryHome({ mode = 'home', places, references = emptyReferences, state, viewerId = '', region, district, myRegionLabel, onManageMyRegions, onUseMyRegion, query, onRegionChange, onQueryChange, onOpenGroup, onFindGroups, onOpenPlace, onOpenPlaces, onOpenMyActivity, onOpenMyChat, personalPlans, onOpenMyPlan, header, headerActions, travelContent, templates = emptyTemplates, journals = emptyJournals, onDurationChange, onOpenTemplate, onOpenJournal, onMoreTravel, onMoreJournals, onPlan, onStartTogether, onTryCourse, view, onViewChange, purpose, onPurposeChange }: DiscoveryHomeProps) {
  const isTravel = mode === 'travel';
  const sharedActivity = useMemo(() => selectHomeSharedActivity(state, viewerId, places), [state, viewerId, places]);
  const uid = useId();
  const [localView, setLocalView] = useState<DiscoveryHomeView>('recommended');
  const [localPurpose, setLocalPurpose] = useState<DiscoveryPurpose>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(Boolean(query.trim()));
  const [interestsOpen, setInterestsOpen] = useState(false);
  const savedInterests = useGroupInterests(viewerId);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const restoreSearchFocus = useRef(false);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus({ preventScroll: true });
    else if (restoreSearchFocus.current) { searchToggle.current?.focus({ preventScroll: true }); restoreSearchFocus.current = false; }
  }, [searchOpen]);
  const closeSearch = () => { restoreSearchFocus.current = true; setSearchOpen(false); };
  const currentView = view ?? localView;
  const currentPurpose = onPurposeChange ? purpose : localPurpose;
  const projection = useMemo(() => selectDiscoveryHome(state, places, references, { region, district, query, purpose: currentPurpose }, viewerId), [state, places, references, region, district, query, currentPurpose, viewerId]);
  const groupProjection = useMemo(() => selectGroupDiscoveryHome(state, { region, district, query, purpose: currentPurpose }, viewerId), [state, region, district, query, currentPurpose, viewerId]);
  const savedInterestGroups = useMemo(() => savedInterests.status === 'ready' ? selectHomeSavedInterestGroups(state, { region, district, query, purpose: currentPurpose }, { topics: savedInterests.state.topics, subtopics: savedInterests.state.subtopics }, viewerId) : [], [state, region, district, query, currentPurpose, viewerId, savedInterests]);
  const travelProjection = useMemo(() => selectTravelHomeContent(templates, journals, places, references,
    { region, district, query, purpose: currentPurpose, duration: 'ALL' }), [templates, journals, places, references, region, district, query, currentPurpose]);
  const travelRegions = useMemo(() => {
    const content = selectTravelHomeContent(templates, journals, places, references, { region: '', query: '' });
    return [...content.courses.map(item => item.region), ...content.journals.map(item => item.region)];
  }, [templates, journals, places, references]);
  const regionOptions = useMemo(() => [...new Set([...projection.regions, ...travelRegions].filter(Boolean))], [projection.regions, travelRegions]);
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
  const reset = () => { onRegionChange(''); onQueryChange(''); setLocalPurpose(undefined); onPurposeChange?.(undefined); onDurationChange?.('ALL'); };
  const hasFilters = Boolean(region || query.trim() || currentPurpose);
  const shownPlaces = projection.places.slice(0, 4);
  const placeKinds = ['FOOD', 'CAFE', 'STAY', 'LANDMARK', 'LEISURE', 'SHOP'] as const;
  const noResults = !groupProjection.meetups.length && !groupProjection.groups.length && !projection.places.length && !travelProjection.courses.length && !travelProjection.journals.length;
  const emptyRecommendation = currentView === 'recommended' && noResults;
  const searchControls = <div className="discovery-home__search-area">
    {searchOpen ? <label className="discovery-home__search" id={`${uid}-search`}><Search size={18} aria-hidden="true"/><input ref={searchInput} aria-label={isTravel ? '여행 일정 검색' : '모임·약속·장소·여행 검색'} type="search" value={query} onChange={event => onQueryChange(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeSearch(); } }} placeholder={isTravel ? '여행·지역·장소 검색' : '여행·장소·모임 검색'}/>{query && <button type="button" aria-label={isTravel ? '여행 검색어 지우기' : '발견 검색어 지우기'} onClick={() => { onQueryChange(''); searchInput.current?.focus({ preventScroll: true }); }}><X size={18}/></button>}</label> : <>
      <strong className="discovery-home__wordmark" aria-hidden="true">{isTravel ? '여행' : 'spotlog'}</strong>
      <label className="discovery-home__region"><MapPin size={18} aria-hidden="true"/><span className="discovery-home__sr-only">{isTravel ? '여행 목적지' : '여행지·지역 선택'}</span><select aria-label={isTravel ? '여행 목적지' : '여행지·지역 선택'} value={region} onChange={event => onRegionChange(event.target.value)}><option value="">전체 지역</option>{regionOptions.map(value => <option key={value} value={value}>{value === region && district ? `${value} ${district}` : value}</option>)}</select><ChevronDown size={16} aria-hidden="true"/></label>
    </>}
    <button ref={searchToggle} type="button" className={`discovery-home__search-toggle${query.trim() ? ' has-query' : ''}`} aria-label={searchOpen ? `${isTravel ? '여행' : '발견'} 검색 닫기` : query.trim() ? `${isTravel ? '여행' : '발견'} 검색 열기 · 검색어 ${query}` : `${isTravel ? '여행' : '발견'} 검색 열기`} aria-expanded={searchOpen} aria-controls={`${uid}-search`} onClick={searchOpen ? closeSearch : () => setSearchOpen(true)}>{searchOpen ? <X size={20} aria-hidden="true"/> : <Search size={20} aria-hidden="true"/>}{query.trim() && !searchOpen && <span className="discovery-home__query-dot" aria-hidden="true"/>}</button>
  </div>;
  return <div className={`discovery-home${isTravel ? ' discovery-home--travel' : ''}`}>
    {headerActions ? <header className="discovery-home__header"><h1 className="discovery-home__sr-only">{isTravel ? '여행' : 'spotlog · 홈'}</h1>{searchControls}<div className="discovery-home__header-actions">{headerActions}</div></header> : header}
    <div className="discovery-home__content">
      {!header && !headerActions && <h1 className="discovery-home__sr-only">{isTravel ? '여행' : 'spotlog · 홈'}</h1>}
      {!headerActions && searchControls}
      {!isTravel && <>
        <div className="discovery-home__views" role="group" aria-label="발견에서 볼 내용">{homeViews.map(item => <button type="button" key={item.id} aria-pressed={currentView === item.id} onClick={() => changeView(item.id)}>{item.label}</button>)}</div>
        <div className="discovery-home__tools"><button type="button" className="discovery-home__filter-toggle" aria-expanded={filtersOpen} aria-controls={`${uid}-filters`} onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={17} aria-hidden="true"/><span>{purposeLabel || '활동 조건'}</span><ChevronDown size={15} aria-hidden="true"/></button>{hasFilters && <button type="button" className="discovery-home__reset" aria-label="발견 조건 초기화" onClick={reset}><X size={17}/></button>}{onPlan && currentView !== 'trips' && <button type="button" className="discovery-home__plan" onClick={onPlan}><CalendarPlus size={18} aria-hidden="true"/><span>계획 만들기</span></button>}</div>
        {currentView === 'recommended' && <MemberReturnStrip maxRows={1} state={state} viewerId={viewerId} onOpenMyActivity={onOpenMyActivity} onOpenMyChat={onOpenMyChat} personalPlans={personalPlans} onOpenMyPlan={onOpenMyPlan} activityRoute={sharedActivity}/>}
      {filtersOpen && <div id={`${uid}-filters`} className="discovery-home__filter-panel">{onManageMyRegions && <div className="discovery-home__temporary-region"><label>둘러볼 지역<select aria-label="발견 활동 지역" value={region} onChange={event => onRegionChange(event.target.value)}><option value="">전국</option>{regionOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>{onUseMyRegion && <button type="button" onClick={onUseMyRegion}>내 지역으로</button>}</div>}<div className="discovery-home__purposes" role="group" aria-label="함께할 일로 찾기">{discoveryPurposes.map(item => {
        const Icon = purposeIcons[item.id];
        const active = item.id === 'TRAVEL' ? currentView === 'trips' : currentPurpose === item.id;
        return <button type="button" key={item.id} aria-pressed={active} className={active ? 'is-active' : ''} onClick={() => changePurpose(item.id)}><Icon size={18} strokeWidth={1.7} aria-hidden="true"/><span>{item.label}</span></button>;
      })}</div>{onManageMyRegions && <button type="button" className="discovery-home__manage-region" onClick={onManageMyRegions}>내 지역 관리{myRegionLabel ? ` · ${myRegionLabel}` : ''}<ChevronRight size={16}/></button>}{hasFilters && <button type="button" className="discovery-home__manage-region" onClick={reset}>조건 초기화<X size={16}/></button>}<button type="button" className="discovery-home__filter-done" onClick={() => setFiltersOpen(false)}>선택한 조건으로 보기<ChevronRight size={16}/></button></div>}
      <div className="discovery-home__sections" aria-live="polite" aria-atomic="false">
        {currentView === 'meetups' && <GroupMeetupSchedule meetups={groupProjection.meetups} title={region ? `${district || region}의 번개·정모` : '모집 중인 번개·정모'} filters={groupProjection.filters} onOpenGroup={onOpenGroup} onFindGroups={onFindGroups} limit={8} showEmpty/>}
        {(currentView === 'groups' || currentView === 'recommended' && groupProjection.groups.length > 0) && <GroupDiscoveryHome key={viewerId ? `account:${viewerId}` : 'guest'} projection={groupProjection} variant={currentView === 'groups' ? 'full' : 'preview'} region={region} district={district} onOpenGroup={onOpenGroup} onFindGroups={onFindGroups} onBrowse={() => changeView('groups')} savedInterests={savedInterests} savedInterestGroups={savedInterestGroups} onManageInterests={() => setInterestsOpen(true)}/>}
        {currentView === 'recommended' && groupProjection.meetups.length > 0 && <GroupMeetupSchedule meetups={groupProjection.meetups} title={region ? `${district || region}의 다가오는 번개·정모` : '다가오는 번개·정모'} filters={groupProjection.filters} onOpenGroup={onOpenGroup} onFindGroups={onFindGroups} limit={2}/>}
        {currentView === 'recommended' && <TravelHomeSections onTryCourse={onTryCourse} courses={travelProjection.courses} journals={travelProjection.journals}
          onOpenCourse={id => onOpenTemplate?.(id)} onOpenJournal={id => onOpenJournal?.(id)}
          onMoreCourses={() => onMoreTravel ? onMoreTravel('ALL') : changeView('trips')} onMoreJournals={() => onMoreJournals?.('ALL')}/>}
        {(currentView === 'places' || (currentView === 'recommended' && shownPlaces.length > 0)) && <section className="discovery-home__section" aria-labelledby={`${uid}-places`}><div className="discovery-home__section-title"><h2 id={`${uid}-places`}>{region ? `${district || region}에서 가볼 장소` : '함께 가볼 장소'}</h2><button type="button" onClick={() => onOpenPlaces(projection.placeFilters)} aria-label="같은 조건의 장소 더 보기">더 보기<ChevronRight size={16}/></button></div>
          {currentView === 'places' && <nav className="discovery-home__place-kinds" aria-label="장소 종류별 둘러보기">{placeKinds.map(kind => <button key={kind} type="button" onClick={() => onOpenPlaces({ ...projection.placeFilters, kind })}>{interestKindLabels[kind]}<ChevronRight size={14} aria-hidden="true"/></button>)}</nav>}
          {shownPlaces.length ? <div className={`discovery-home__places${currentView === 'recommended' ? ' discovery-home__places--editorial' : ''}`}>{(currentView === 'recommended' ? shownPlaces.slice(0, 2) : shownPlaces).map(place => <article className="discovery-home__place" key={place.id}><button type="button" className="discovery-home__place-open" onClick={() => onOpenPlace(place)}><span className="discovery-home__place-image"><PlaceThumbnail place={place}/></span><span className="discovery-home__place-copy"><span className="discovery-home__meta">{interestKindLabels[place.kind]} · {place.area}</span><strong>{place.name}</strong><span className="discovery-home__welcome">{place.hook || place.description}</span></span><ChevronRight size={17} aria-hidden="true"/></button></article>)}</div> : <div className="discovery-home__empty"><MapPin size={22} aria-hidden="true"/><p>조건에 맞는 공개 장소가 없어요.</p><button type="button" onClick={() => onOpenPlaces(projection.placeFilters)}>장소 둘러보기<ArrowRight size={16}/></button></div>}
        </section>}
        {(currentView === 'recommended' || currentView === 'groups') && onStartTogether && <button type="button" className="discovery-home__route-entry" onClick={currentView === 'groups' && sharedActivity && onOpenMyActivity ? () => onOpenMyActivity(sharedActivity.activityId) : onStartTogether}><Users size={20} aria-hidden="true"/><span><strong>{currentView === 'groups' && sharedActivity ? sharedActivity.title : '장소와 코스를 우리 일정으로'}</strong><small>{currentView === 'groups' && sharedActivity ? `공동 동선 ${sharedActivity.stopCount}곳 · 내 합류 구간 확인` : '함께 갈 곳을 고르고 각자 합류할 구간을 정해요.'}</small></span><ChevronRight size={17} aria-hidden="true"/></button>}
      </div>
      {currentView === 'trips' && travelContent}
      {emptyRecommendation && <div className="discovery-home__no-results"><Compass size={24} aria-hidden="true"/><p>지역이나 검색 조건을 바꾸어 찾아보세요.</p><button type="button" onClick={reset}>전체 추천 보기</button></div>}
      </>}
      {isTravel && travelContent}
    </div>
    {!isTravel && interestsOpen && <GroupInterestSheet ownerId={viewerId} onClose={() => setInterestsOpen(false)} onSaved={() => setInterestsOpen(false)}/>}
  </div>;
}

