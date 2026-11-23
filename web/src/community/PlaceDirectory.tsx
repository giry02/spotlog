import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, Check, ChevronRight, Image, ImageOff, List, MapPin, Search, SlidersHorizontal, Sparkles, Video, X } from 'lucide-react';
import type { Place, PlaceKind } from '../data';
import { AppMenuButton } from '../AppMenu';
import { BottomSheet } from '../BottomSheet';
import { filterHomePlaces, publicPlaceRegion, type HomeRegionReference } from '../homeDiscovery';
import { interestKindLabels } from '../interestCollectionStore';
import { LandmarkGuideCard } from '../LandmarkGuideCard';
import { ScreenHeader } from '../ScreenHeader';
import { placeSearchActionLabel, planningAiAvailable } from '../planningAiAvailability';
import PublicPlaceFacts from './PublicPlaceFacts';
import './place-directory.css';

export interface PlaceDirectorySearch { region: string; district?: string; query: string }
export interface PlaceDirectoryProps {
  places: Place[];
  references?: ReadonlyArray<HomeRegionReference>;
  search: PlaceDirectorySearch;
  kind: PlaceKind | 'ALL';
  savedIds: string[];
  onSearchChange: (search: PlaceDirectorySearch) => void;
  onKindChange: (kind: PlaceKind | 'ALL') => void;
  onApplyFilters?: (search: PlaceDirectorySearch, kind: PlaceKind | 'ALL') => void;
  onReset: () => void;
  onToggle: (id: string) => void;
  onShare: (place: Place) => void;
  onUsePlace?: (place: Place) => void;
  onOpenAiSearch?: () => void;
  onBack: () => void;
  onViewChange: (view: 'GUIDE' | 'PHOTO' | 'VIDEO') => void;
}
const emptyReferences: ReadonlyArray<HomeRegionReference> = [];
const placeKinds: Array<PlaceKind | 'ALL'> = ['ALL', 'LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP', 'LEISURE'];
const kindName = (kind: PlaceKind | 'ALL') => kind === 'ALL' ? '전체 종류' : interestKindLabels[kind];
const pageSize = 12;

function Thumbnail({ place }: { place: Place }) {
  const [failed, setFailed] = useState('');
  return place.image && failed !== place.image ? <img src={place.image} alt="" loading="lazy" onError={() => setFailed(place.image)}/>
    : <span className="community-place-directory__image-empty" aria-hidden="true"><ImageOff size={24}/></span>;
}

/** Compact public list. Rich photos, attribution and existing actions belong to one detail sheet. */
export default function PlaceDirectory({ places, references = emptyReferences, search, kind, savedIds, onSearchChange, onKindChange, onApplyFilters, onReset, onToggle, onShare, onUsePlace, onOpenAiSearch, onBack, onViewChange }: PlaceDirectoryProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftRegion, setDraftRegion] = useState(search.region);
  const [draftKind, setDraftKind] = useState<PlaceKind | 'ALL'>(kind);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = places.find(place => place.id === selectedId);
  const results = useMemo(() => filterHomePlaces(places, { ...search, kind }, references), [places, references, search.region, search.district, search.query, kind]);
  const regions = [...new Set(places.map(place => publicPlaceRegion(place, references)))].filter(region => region && region !== '지역 미정');
  if (search.region && !regions.includes(search.region)) regions.push(search.region);
  const hasFilters = Boolean(search.region || search.district || search.query.trim() || kind !== 'ALL');
  useEffect(() => { setVisibleCount(pageSize); }, [search.region, search.district, search.query, kind]);
  const openFilters = () => { setDraftRegion(search.region); setDraftKind(kind); setFiltersOpen(true); };
  const applyFilters = () => {
    const next = { region: draftRegion, ...(draftRegion === search.region && search.district ? { district: search.district } : {}), query: search.query };
    if (onApplyFilters) onApplyFilters(next, draftKind);
    else { onSearchChange(next); onKindChange(draftKind); }
    setFiltersOpen(false);
  };
  return <div className="community-place-directory">
    <ScreenHeader title="장소 찾기" leading={<button type="button" aria-label="장소 찾기 이전 화면" onClick={onBack}><ArrowLeft size={22}/></button>} actions={<AppMenuButton/>}/>
    <div className="community-place-directory__content">
      <label className="community-place-directory__search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="장소 이름·지역 검색" placeholder="가고 싶은 곳을 검색하세요" value={search.query} onChange={event => onSearchChange({ ...search, query: event.target.value })}/>{search.query && <button type="button" aria-label="장소 검색어 지우기" onClick={() => onSearchChange({ ...search, query: '' })}><X size={18}/></button>}</label>
      {onOpenAiSearch && <button type="button" className="place-assistant-entry" onClick={onOpenAiSearch}>{planningAiAvailable ? <Sparkles size={18} aria-hidden="true"/> : <SlidersHorizontal size={18} aria-hidden="true"/>}<span><strong>{placeSearchActionLabel}</strong><small>지역과 원하는 분위기를 문장으로 말해요</small></span><ChevronRight size={17} aria-hidden="true"/></button>}
      <div className="community-place-directory__toolbar"><button type="button" className="community-place-directory__filter" aria-haspopup="dialog" onClick={openFilters}><SlidersHorizontal size={17}/><span>{[search.region, search.district].filter(Boolean).join(' ') || '전체 지역'} · {kindName(kind)}</span></button><div className="community-place-directory__views" role="group" aria-label="장소 보는 방식"><button type="button" aria-label="장소 목록" aria-pressed="true" onClick={() => onViewChange('GUIDE')}><List size={19}/></button><button type="button" aria-label="장소 사진 둘러보기" aria-pressed="false" onClick={() => onViewChange('PHOTO')}><Image size={19}/></button><button type="button" aria-label="장소 영상 둘러보기" aria-pressed="false" onClick={() => onViewChange('VIDEO')}><Video size={19}/></button></div></div>
      <div className="community-place-directory__results-title"><h2>{search.query.trim() ? `“${search.query.trim()}” 검색 결과` : search.region ? `${search.region} ${kind === 'ALL' ? '장소' : kindName(kind)}` : kind === 'ALL' ? '모든 장소' : kindName(kind)}<span>{results.length}곳</span></h2>{hasFilters && <button type="button" onClick={onReset}>초기화</button>}</div>
      {results.length ? <><div className="community-place-directory__list" aria-label="공개 장소 목록">{results.slice(0, visibleCount).map(place => {
        const saved = savedIds.includes(place.id);
        return <article className="community-place-directory__row" key={place.id}><button type="button" className="community-place-directory__open" onClick={() => setSelectedId(place.id)} aria-label={`${place.name} 상세 보기`}><span className="community-place-directory__image"><Thumbnail place={place}/></span><span className="community-place-directory__copy"><span className="community-place-directory__meta">{interestKindLabels[place.kind]} · {place.area}</span><strong>{place.name}</strong><span className="community-place-directory__description">{place.hook || place.description}</span></span></button><button type="button" className="community-place-directory__save" aria-label={`${place.name} ${saved ? '저장 해제' : '저장'}`} aria-pressed={saved} onClick={() => onToggle(place.id)}><Bookmark size={22} fill={saved ? 'currentColor' : 'none'}/></button></article>;
      })}</div>{visibleCount < results.length && <button type="button" className="community-place-directory__load" onClick={() => setVisibleCount(current => current + pageSize)}>장소 더 불러오기<ChevronRight size={17}/><span>{Math.min(visibleCount, results.length)} / {results.length}</span></button>}</> : <section className="community-place-directory__empty">
        <MapPin size={26} aria-hidden="true"/><h3>조건에 맞는 장소가 없어요</h3>
        <div className="community-place-directory__empty-actions">
          {search.query.trim() && <button type="button" onClick={() => onSearchChange({ ...search, query: '' })}>검색어 지우기</button>}
          {search.region && search.district && <button type="button" onClick={() => onSearchChange({ region: search.region, query: search.query })}>{search.region} 전체 보기</button>}
          {hasFilters && <button type="button" onClick={onReset}>조건 초기화</button>}
        </div>
      </section>}
    </div>
    {filtersOpen && <BottomSheet title="장소 찾기 조건" onClose={() => setFiltersOpen(false)}><div className="community-place-directory-filters"><label><span>활동 지역</span><select aria-label="장소 필터 지역" value={draftRegion} onChange={event => setDraftRegion(event.target.value)}><option value="">전체 지역</option>{regions.map(region => <option key={region} value={region}>{region}</option>)}</select></label>{search.district && draftRegion === search.region && <button type="button" onClick={() => { onSearchChange({ region: search.region, query: search.query }); setFiltersOpen(false); }}>{search.district} 동네 조건 해제<X size={16}/></button>}<fieldset><legend>장소 종류</legend><div className="community-place-directory-filters__kinds">{placeKinds.map(value => <button type="button" key={value} aria-pressed={draftKind === value} onClick={() => setDraftKind(value)}><span>{kindName(value)}</span>{draftKind === value && <Check size={16}/>}</button>)}</div></fieldset><button type="button" className="community-place-directory-filters__apply" onClick={applyFilters}>이 조건으로 보기</button></div></BottomSheet>}
    {selected && <BottomSheet title="장소 상세" onClose={() => setSelectedId(null)}><LandmarkGuideCard place={selected} variant="detail" facts={<PublicPlaceFacts key={selected.id} place={selected}/>} saved={savedIds.includes(selected.id)} onToggle={() => onToggle(selected.id)} onShare={() => onShare(selected)} showCredit/>{onUsePlace && <button type="button" className="primary wide place-use-action" onClick={() => { setSelectedId(null); onUsePlace(selected); }}><MapPin size={18}/>여행·약속에 담기</button>}</BottomSheet>}
  </div>;
}
