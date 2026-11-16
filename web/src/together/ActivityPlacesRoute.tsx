import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, ExternalLink, MapPin, Plus, Route, Search, Trash2, X } from 'lucide-react';
import type { Place, PlaceKind } from '../data';
import { naverDirectionsUrl } from '../placeDirections';
import { BottomSheet } from '../BottomSheet';
import { getPlacePhotos } from '../PhotoPlaceCard';
import { PhotoCredit } from '../PublicTourismCredit';
import { getPhotoSource } from '../photoSources';
import type { TogetherState } from './model';
import { activityDayKey, selectActivityPlaces, type ActivityPlaceAction } from './activityPlaces';
import './activity-places-route.css';

const RouteMap = lazy(() => import('../RouteMap'));
const InterestPlacesMap = lazy(() => import('../InterestPlacesMap'));
const kindNames: Record<PlaceKind, string> = { LANDMARK: '명소', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
export interface ActivityPlacesRouteProps {
  state: TogetherState; userId: string; groupId: string; activityId: string; places: Place[];
  onAction?: (action: ActivityPlaceAction) => boolean | Promise<boolean>;
  onOpenPlace?: (place: Place) => void;
  onSavePlace?: (place: Place) => void;
  renderPlaceDetail?: (place: Place) => ReactNode;
  /** The host already shows the date and meeting point; put the live route first. */
  compactContext?: boolean;
}

/** Shared venue facts only. Can be hosted in a room sheet without changing room navigation. */
export function ActivityPlaceDetail({ place, onSavePlace }: { place: Place; onSavePlace?: (place: Place) => void }) {
  const photo = getPlacePhotos(place, true)[0];
  const source = photo ? getPhotoSource(photo.image) : undefined;
  const illustrative = !source || source.placeId !== place.id;
  return <article className="activity-place-detail" data-place-id={place.id}>
    {photo && <><img src={photo.image} alt={illustrative ? `${place.name} 설명용 참고 사진` : photo.alt || place.name} loading="lazy"/>{illustrative ? <p className="activity-place-muted">설명용 사진 · 해당 장소의 실제 모습과 다를 수 있어요.</p> : photo.caption && <p className="activity-place-muted">{photo.caption}</p>}<PhotoCredit image={photo.image} sourceId={photo.sourceId}/></>}
    <small>{kindNames[place.kind]} · {place.area}</small><h3>{place.name}</h3>
    <p className="activity-place-address"><MapPin size={16}/><span>{place.address || '주소 확인 전'}</span></p>
    {place.description && <p>{place.description}</p>}
    {place.duration && <p className="activity-place-muted">머무는 시간 참고 · {place.duration}</p>}
    <div className="activity-place-actions"><a href={naverDirectionsUrl(place)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>네이버 길찾기</a>{onSavePlace && <button type="button" onClick={() => onSavePlace(place)}>내 장소에 저장</button>}</div>
    <p className="activity-place-muted">영업·예약 가능 여부와 실제 이동 시간은 길찾기 및 장소 안내에서 확인해 주세요.</p>
  </article>;
}

export default function ActivityPlacesRoute(props: ActivityPlacesRouteProps) {
  return <ActivityPlacesBody key={`${props.userId}:${props.groupId}:${props.activityId}`} {...props}/>;
}
function ActivityPlacesBody({ state, userId, groupId, activityId, places, onAction, onOpenPlace, onSavePlace, renderPlaceDetail, compactContext = false }: ActivityPlacesRouteProps) {
  const [view, setView] = useState<'route' | 'candidates'>('route');
  const [picker, setPicker] = useState(false), [query, setQuery] = useState(''), [kind, setKind] = useState<PlaceKind | 'ALL'>('ALL');
  const [dayId, setDayId] = useState(''), [detail, setDetail] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const pending = useRef(false);
  let context;
  try { context = selectActivityPlaces(state, userId, { groupId, activityId }, places); }
  catch { return <p className="activity-place-muted">현재 이 약속의 장소를 볼 수 없어요.</p>; }
  const { activity, group, candidates, days, venue, writable, canEdit, missingCandidateCount } = context;
  const venueTitle = activity.meetingPoint || (writable ? '함께 정할 수 있어요' : '등록된 만나는 장소가 없어요');
  const venueHint = activity.venuePlaceId ? '선택한 장소의 현재 정보를 찾지 못했어요.' : writable ? '후보를 고른 뒤 만날 곳을 확정해요.' : activity.meetingPoint ? '이 약속에 등록한 만나는 장소예요.' : '남겨 둔 장소와 동선은 아래에서 볼 수 있어요.';
  const routeCount = days.reduce((count, day) => count + day.places.length, 0);
  const routeOnly = compactContext && routeCount > 0 && candidates.length === 0 && missingCandidateCount === 0;
  const activeView = routeCount ? routeOnly ? 'route' : view : 'candidates';
  const openPlace = (place: Place) => onOpenPlace ? onOpenPlace(place) : setDetail(place);
  const base = { groupId, activityId, expectedRevision: activity.revision };
  const run = async (input: ActivityPlaceAction, success: string) => {
    if (!onAction || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setStatus('');
    try { if (await onAction(input)) setStatus(success); else setError('변경하지 못했어요. 현재 장소를 확인하고 다시 선택해 주세요.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '장소를 변경하지 못했어요.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const currentDayId = days.some((day, index) => activityDayKey(day, index) === dayId) ? dayId : days[0] ? activityDayKey(days[0], 0) : undefined;
  const catalog = [...new Map(places.filter(place => !place.personal).map(place => [place.id, place])).values()];
  const search = query.trim().toLocaleLowerCase('ko-KR');
  const matching = catalog.filter(place => (kind === 'ALL' || place.kind === kind) && (!search || [place.name, place.address, place.area].join(' ').toLocaleLowerCase('ko-KR').includes(search)));
  const region = group.region.trim().split(/\s+/)[0];
  const results = [...matching].sort((a, b) => Number(Boolean(region && `${b.area} ${b.address}`.includes(region))) - Number(Boolean(region && `${a.area} ${a.address}`.includes(region)))).slice(0, 12);
  const pins = [...new Map([...(venue ? [venue] : []), ...candidates].map(place => [place.id, place])).values()];
  const venueInformation = <div className="activity-venue"><MapPin size={19}/><div><small>만나는 장소</small>{venue ? <button type="button" onClick={() => openPlace(venue)}><strong>{venue.name}</strong><span>{venue.address || venue.area}</span></button> : <><strong>{venueTitle}</strong><span>{venueHint}</span></>}</div>{venue && <a href={naverDirectionsUrl(venue)} target="_blank" rel="noopener noreferrer" aria-label={`${venue.name} 길찾기`}><ExternalLink size={18}/></a>}</div>;
  return <section className={`activity-places${compactContext ? ' activity-places--compact-context' : ''}`} aria-label="약속 장소와 동선">
    <header className="activity-places-heading"><div>{!compactContext && <small>{writable ? '함께 갈 곳' : '약속 장소 기록'}</small>}<h2>장소와 동선{compactContext && routeCount > 0 && <span className="activity-route-total"> {routeCount}곳</span>}</h2></div>{writable && onAction && <button type="button" className="activity-place-add" aria-expanded={picker} onClick={() => setPicker(value => !value)}><Plus size={17}/>장소 담기</button>}</header>
    {compactContext ? <details className="activity-venue-details"><summary><MapPin size={16} aria-hidden="true"/><span>{venue ? '만나는 장소 안내·길찾기' : '만나는 장소 안내'}</span><ChevronDown size={16} aria-hidden="true"/></summary>{venueInformation}</details> : venueInformation}
    {picker && <section className="activity-place-picker" aria-label="이 약속에 장소 담기">
      <div className="activity-picker-title"><h3>어디에 갈까요?</h3><button type="button" aria-label="장소 찾기 닫기" onClick={() => setPicker(false)}><X size={18}/></button></div>
      <label className="activity-place-search"><Search size={17}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="장소 이름·지역·주소 검색" aria-label="장소 검색"/></label>
      <div className="activity-kind-filter" role="group" aria-label="장소 종류">{(['ALL', 'FOOD', 'CAFE', 'STAY', 'LANDMARK', 'SHOP', 'LEISURE'] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{value === 'ALL' ? '전체' : kindNames[value]}</button>)}</div>
      <p className="activity-place-muted">음식점·카페·숙소만으로도 약속을 만들 수 있어요.</p>
      <div className="activity-picker-results">{results.map(place => { const added = activity.placeCandidateIds?.includes(place.id); return <div className="activity-picker-result" key={place.id}><button type="button" className="activity-result-info" onClick={() => openPlace(place)}><small>{kindNames[place.kind]}</small><strong>{place.name}</strong><span>{place.address || place.area}</span></button><button type="button" className="activity-result-add" disabled={busy || added} onClick={() => void run({ ...base, type: 'ADD_CANDIDATE', placeId: place.id }, `${place.name}을 이 약속의 후보에 담았어요.`)} aria-label={`${place.name} ${added ? '담은 후보' : '후보에 담기'}`}>{added ? <Check size={18}/> : <Plus size={18}/>}</button></div>; })}</div>
      {!results.length && <p className="activity-place-muted">조건에 맞는 공개 장소가 없어요. 다른 이름이나 지역을 검색해 주세요.</p>}
      {matching.length > results.length && <p className="activity-place-muted">{matching.length}곳 중 12곳 · 지역이나 지점명으로 좁혀 주세요.</p>}
    </section>}
    {!routeOnly && <div className="activity-place-tabs" role="group" aria-label="장소 보기"><button type="button" aria-pressed={activeView === 'route'} disabled={!routeCount} onClick={() => setView('route')}><Route size={16}/>방문 동선 <span>{routeCount}</span></button><button type="button" aria-pressed={activeView === 'candidates'} onClick={() => setView('candidates')}><MapPin size={16}/>후보 장소 <span>{candidates.length}</span></button></div>}
    {activeView === 'route' ? <div className="activity-route-days">{days.map((day, index) => <section key={activityDayKey(day, index)} className="activity-route-day"><div className="activity-day-heading"><h3>DAY {day.day}</h3><span>{/^\d{4}-\d{2}-\d{2}$/.test(day.date) ? day.date : '날짜 미정'} · {day.places.length}곳</span></div>{day.places.length > 0 && <Suspense fallback={<p className="activity-map-loading">동선 지도를 불러오는 중…</p>}><RouteMap places={day.places} onSelectVisit={id => { const place = day.places.find(item => item.visitId === id); if (place) openPlace(place); }}/></Suspense>}<ol className="activity-route-list">{day.places.map((place, placeIndex) => <li key={place.visitId || `${place.id}:${placeIndex}`}><span className="activity-stop-number">{placeIndex + 1}</span><div className="activity-stop-body"><button type="button" className="activity-stop-info" onClick={() => openPlace(place)}><small>{place.time || '시각 미정'} · {kindNames[place.kind]}{place.bookingFixed ? ' · 고정 방문' : ''}</small><strong>{place.name}</strong><span>{place.address || place.area}</span></button><div className="activity-stop-actions"><a href={naverDirectionsUrl(place)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>길찾기</a>{canEdit && onAction && place.visitId && <><button type="button" disabled={busy || placeIndex === 0 || place.bookingFixed || day.places[placeIndex - 1]?.bookingFixed} aria-label={`${place.name} 방문 순서 앞으로`} onClick={() => void run({ ...base, type: 'MOVE_STOP', dayId: activityDayKey(day, index), visitId: place.visitId!, direction: -1 }, '방문 순서를 바꿨어요.')}><ArrowUp size={15}/></button><button type="button" disabled={busy || placeIndex === day.places.length - 1 || place.bookingFixed || day.places[placeIndex + 1]?.bookingFixed} aria-label={`${place.name} 방문 순서 뒤로`} onClick={() => void run({ ...base, type: 'MOVE_STOP', dayId: activityDayKey(day, index), visitId: place.visitId!, direction: 1 }, '방문 순서를 바꿨어요.')}><ArrowDown size={15}/></button><button type="button" disabled={busy || place.bookingFixed} aria-label={`${place.name} 방문에서 제외`} onClick={() => void run({ ...base, type: 'REMOVE_STOP', dayId: activityDayKey(day, index), visitId: place.visitId! }, '이 방문을 동선에서 제외했어요.')}><Trash2 size={15}/></button></>}</div></div></li>)}</ol></section>)}</div> : <div className="activity-candidates"><Suspense fallback={<p className="activity-map-loading">장소 지도를 불러오는 중…</p>}>{pins.length > 0 && <InterestPlacesMap places={pins} onSelectPlace={openPlace}/>}</Suspense>{!candidates.length && <div className="activity-place-empty"><MapPin size={24}/><strong>{writable ? '함께 가고 싶은 곳을 담아요' : '이 약속에 저장된 후보 장소가 없어요'}</strong><p>{writable ? '음식점, 카페, 숙소를 찾아 이 약속의 후보로 모아보세요.' : '등록된 만나는 장소나 방문 동선이 있으면 해당 항목에서 확인할 수 있어요.'}</p>{writable && onAction && <button type="button" onClick={() => setPicker(true)}>장소 찾아 담기<ChevronRight size={16}/></button>}</div>}{canEdit && candidates.length > 0 && days.length > 1 && <label className="activity-target-day">방문에 추가할 DAY<select value={currentDayId} onChange={event => setDayId(event.target.value)}>{days.map((day, index) => <option key={activityDayKey(day, index)} value={activityDayKey(day, index)}>DAY {day.day} · {day.date || '날짜 미정'}</option>)}</select></label>}{candidates.map(place => <article className="activity-candidate" key={place.id}><button type="button" className="activity-candidate-info" onClick={() => openPlace(place)}>{place.image && <img src={place.image} alt="" loading="lazy"/>}<span><small>{kindNames[place.kind]}{activity.venuePlaceId === place.id ? ' · 만나는 장소' : ' · 후보'}</small><strong>{place.name}</strong><span>{place.address || place.area}</span></span><ChevronRight size={17}/></button><div className="activity-candidate-actions"><a href={naverDirectionsUrl(place)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>길찾기</a>{canEdit && onAction && <><button type="button" disabled={busy || activity.venuePlaceId === place.id} onClick={() => void run({ ...base, type: 'SET_VENUE', placeId: place.id }, '만나는 장소를 확정했어요.')}>{activity.venuePlaceId === place.id ? '만날 곳 확정' : '만날 곳으로'}</button><button type="button" disabled={busy} onClick={() => { void run({ ...base, type: 'ADD_STOP', placeId: place.id, dayId: currentDayId }, '방문 동선에 추가했어요.'); setView('route'); }}>방문에 추가</button><button type="button" disabled={busy} aria-label={`${place.name} 후보에서 제외`} onClick={() => void run({ ...base, type: 'REMOVE_CANDIDATE', placeId: place.id }, '이 약속의 후보에서 제외했어요.')}><X size={15}/></button></>}</div></article>)}{missingCandidateCount > 0 && <p className="activity-place-muted">현재 정보를 찾을 수 없는 후보 {missingCandidateCount}곳이 있어요.</p>}</div>}
    {detail && <BottomSheet title={detail.name} onClose={() => setDetail(null)}><div className="activity-inline-detail">{renderPlaceDetail ? renderPlaceDetail(detail) : <ActivityPlaceDetail place={detail} onSavePlace={onSavePlace}/>}</div></BottomSheet>}
    {error && <p className="activity-place-error" role="alert">{error}</p>}{status && <p className="activity-place-status" role="status">{status}</p>}
  </section>;
}
