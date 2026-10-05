import { Bookmark, Check, ChevronRight, Plus, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { LandmarkGuideCard } from './LandmarkGuideCard';
import { Button } from './ui';
import { placeKindLabel, type Journey, type Place } from './data';
import './saved-places.css';

interface SavedPlacesProps {
  places: Place[];
  journeys: Journey[];
  onToggleSaved: (id: string) => boolean;
  onShare: (place: Place) => void;
  onRequestAdd: (place: Place) => void;
  onRequestCreate: (places: Place[]) => void;
  onRequestAi: (places: Place[]) => void;
  onGoDiscover: () => void;
}

interface SavedView { region: string; query: string; limit: number }
const viewKey = 'spotlog-saved-places-view-v1';
const batchSize = 3;
const regionOf = (place: Place) => place.area.trim().split(/\s+/)[0] || '기타';

function initialView(): SavedView {
  const fallback = { region: '', query: '', limit: batchSize };
  try {
    const value = JSON.parse(sessionStorage.getItem(viewKey) || 'null') as Partial<SavedView> | null;
    if (!value) return fallback;
    return {
      region: typeof value.region === 'string' ? value.region : '',
      query: typeof value.query === 'string' ? value.query : '',
      limit: Number.isInteger(value.limit) ? Math.max(batchSize, Number(value.limit)) : batchSize,
    };
  } catch { return fallback; }
}

/** Saved contains discovery and entry actions only. Journey/date decisions belong to My Trips. */
export function SavedPlaces({ places, journeys, onToggleSaved, onShare, onRequestAdd, onRequestCreate, onRequestAi, onGoDiscover }: SavedPlacesProps) {
  const [view, setView] = useState(initialView);
  const [unsavePlace, setUnsavePlace] = useState<Place | null>(null);
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const regions = useMemo(() => [...new Set(places.map(regionOf))].sort((a, b) => a.localeCompare(b, 'ko')).map((name) => ({ name, count: places.filter((place) => regionOf(place) === name).length })), [places]);
  const filteredPlaces = useMemo(() => {
    const query = view.query.trim().toLocaleLowerCase();
    return places.filter((place) => (!view.region || regionOf(place) === view.region) && (!query || `${place.name} ${place.area} ${placeKindLabel[place.kind]}`.toLocaleLowerCase().includes(query)));
  }, [places, view.region, view.query]);
  const memberships = useMemo(() => {
    const result = new Map<string, { journey: Journey; days: number[] }[]>();
    journeys.filter((journey) => journey.isMine).forEach((journey) => {
      const byPlace = new Map<string, number[]>();
      journey.days.forEach((day) => day.places.forEach((place) => {
        const days = byPlace.get(place.id) || [];
        if (!days.includes(day.day)) days.push(day.day);
        byPlace.set(place.id, days);
      }));
      byPlace.forEach((days, id) => result.set(id, [...(result.get(id) || []), { journey, days }]));
    });
    return result;
  }, [journeys]);

  useEffect(() => { try { sessionStorage.setItem(viewKey, JSON.stringify(view)); } catch { /* View preferences must not block saving content. */ } }, [view]);
  useEffect(() => {
    if (view.region && !regions.some((region) => region.name === view.region)) setView((current) => ({ ...current, region: '', limit: batchSize }));
  }, [regions, view.region]);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || view.limit >= filteredPlaces.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setView((current) => ({ ...current, limit: Math.min(current.limit + batchSize, filteredPlaces.length) }));
    }, { root: element.closest('.content'), rootMargin: '0px 0px 180px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [view.limit, filteredPlaces.length]);

  const requestUnsave = (place: Place) => { setError(''); setUnsavePlace(place); };
  const closeUnsave = () => { setUnsavePlace(null); setError(''); };

  return <section className="saved-places page">
    <header className="app-header saved-places-header"><div><small>{places.length}곳 저장</small><h1>저장한 장소</h1></div></header>
    <div className="saved-trip-entries">
      <Button className="saved-create-entry" onClick={() => onRequestCreate(filteredPlaces)}><Plus size={18} />여행 만들기<ChevronRight size={18} /></Button>
      <Button variant="secondary" className="saved-ai-entry" onClick={() => onRequestAi(filteredPlaces)} disabled={!filteredPlaces.length}>
        <span className="saved-ai-symbol"><Sparkles size={20} /></span><span><strong>저장한 장소로 AI 여행 만들기</strong><small>내 여행에서 기간을 정하고 만들어요</small></span><ChevronRight size={18} />
      </Button>
    </div>

    <div className="saved-place-filters">
      <label className="saved-place-search"><Search size={18} /><input aria-label="저장한 장소 검색" placeholder="저장한 장소 검색" value={view.query} onChange={(event) => setView((current) => ({ ...current, query: event.target.value, limit: batchSize }))} /></label>
      <div className="saved-region-strip" role="group" aria-label="저장한 장소 지역"><Button size="compact" variant={!view.region ? 'primary' : 'secondary'} aria-pressed={!view.region} onClick={() => setView((current) => ({ ...current, region: '', limit: batchSize }))}>전체 <span>{places.length}</span></Button>{regions.map((region) => <Button size="compact" variant={view.region === region.name ? 'primary' : 'secondary'} key={region.name} aria-pressed={view.region === region.name} onClick={() => setView((current) => ({ ...current, region: region.name, limit: batchSize }))}>{region.name} <span>{region.count}</span></Button>)}</div>
      {(view.region || view.query) && <p className="saved-filter-note">현재 목록 {filteredPlaces.length}곳으로 여행을 만들 수 있어요.</p>}
    </div>
    <div className="saved-place-list">{filteredPlaces.slice(0, view.limit).map((place) => {
      const included = memberships.get(place.id) || [];
      return <LandmarkGuideCard key={place.id} place={place} saved onToggle={() => requestUnsave(place)} onShare={() => onShare(place)}
        primaryAction={<Button size="card" onClick={() => onRequestAdd(place)}><Plus size={16} />내 여행에 담기</Button>}
        footer={<div className="saved-card-footer">{included.length > 0 && <div className="saved-memberships" aria-label={`${place.name} 담긴 여행`}>{included.map(({ journey, days }) => <p key={journey.id}><Check size={14} /><span>{journey.title} · {days.map((day) => `DAY ${day}`).join(', ')}</span></p>)}</div>}<Button variant="ghost" size="compact" className="saved-unsave" onClick={() => requestUnsave(place)}><Bookmark size={16} fill="currentColor" />저장 해제</Button></div>}
      />;
    })}</div>
    {!filteredPlaces.length && <div className="saved-empty"><Bookmark size={28} /><h3>{places.length ? '조건에 맞는 장소가 없어요' : '가고 싶은 장소를 저장해 보세요'}</h3><p>{places.length ? '검색어나 지역을 바꿔 확인해 보세요.' : '장소를 모은 뒤 내 여행으로 담거나, 새로운 여행을 만들 수 있어요.'}</p><Button onClick={places.length ? () => setView((current) => ({ ...current, query: '', region: '', limit: batchSize })) : onGoDiscover}>{places.length ? '전체 저장 장소 보기' : '장소 둘러보기'}</Button></div>}
    {view.limit < filteredPlaces.length && <div ref={sentinel} className="saved-list-sentinel" role="status">다음 장소를 불러오는 중</div>}

    {unsavePlace && <BottomSheet title="이 장소의 저장을 해제할까요?" onClose={closeUnsave}>
      <div className="saved-unsave-confirm"><p><strong>{unsavePlace.name}</strong>을 저장한 장소에서만 지웁니다.<br />이미 내 여행에 담은 장소와 기록은 그대로 남습니다.</p><Button onClick={() => { if (onToggleSaved(unsavePlace.id)) closeUnsave(); else setError('저장을 해제하지 못했습니다. 저장 상태 안내를 확인해 주세요.'); }}>저장 해제</Button></div>
      {error && <p className="saved-action-error" role="alert">{error}</p>}
    </BottomSheet>}
  </section>;
}
