import { useUiCopy } from './frontendCopy';
import { useLocale } from './locale';
import { useMemo, useRef, useState } from 'react';
import { ExternalPlaceSearch } from './ExternalPlaceSearch';
import { ExternalLink } from 'lucide-react';
import './frontend-completion.css';
import { ArrowLeft, Bookmark, MapPin, Plus, Search, X, Coffee, Utensils, BedDouble, RefreshCw } from 'lucide-react';
import type { Journey, Place, PlaceKind } from './data';
import { BottomSheet, useBottomSheetDetail } from './BottomSheet';
import { PhotoCredit } from './PublicTourismCredit';
import { Button, Field } from './ui';
import { distanceBetween, nearbyCandidates } from './tripPlan';
import { plannerBusinessSourceById } from './plannerBusinessCatalog';

export type StayChoice = { dayId: string; nights: number; fixed: boolean };
type Props = { journey: Journey; dayId: string; anchor: Place; catalog: Place[]; savedPlaces: Place[]; initialKind?:PlaceKind; slotLabel?:string; replacing?:Place; closerTo?:Place; onClose: () => void; onAdd: (place: Place, stay?: StayChoice) => string | null };
function Distance({ anchor, place }: { anchor: Place; place: Place }) {
  const copy=useUiCopy();
  const distance = distanceBetween(anchor, place);
  return <>{distance === null ? copy("위치 미확인") : distance < 1 ? `${copy("직선")} ${Math.round(distance * 1000)}m` : `${copy("직선")} ${distance.toFixed(1)}km`}</>;
}
function CandidateDetail({ place, anchor, added, journey, dayId, onAdd, replacing }: {place:Place;anchor:Place;added:boolean;journey:Journey;dayId:string;onAdd:Props['onAdd'];replacing?:Place}) {
  const copy=useUiCopy();
  const [error,setError]=useState('');
  const [stay,setStay]=useState(false);
  const source = plannerBusinessSourceById.get(place.id);
  return <div className="plan-form">{replacing&&<p className="plan-help">{copy("DAY·순서·방문 시각은 유지해요. 이전 업체의 메모와 방문 상태는 초기화해요.")}</p>}{place.image&&<img className="nearby-detail-image" src={place.image} alt={place.name}/>}<p>{place.description||copy("등록된 상세 설명이 없어요.")}</p><p className="plan-help">{place.address||copy("주소 확인 필요")} · <Distance anchor={anchor} place={place}/></p><p className="plan-help">{copy("방문 전 운영 정보를 확인해 주세요.")}</p>{source&&<a className="nearby-source-link" href={source.sourceUrl} target="_blank" rel="noopener noreferrer">{copy("장소 정보 출처")} · {source.provider}<ExternalLink size={14}/></a>}{stay?<StayForm journey={journey} dayId={dayId} onSubmit={choice=>onAdd(place,choice)}/>:<Button disabled={added} onClick={()=>{if(place.kind==='STAY')setStay(true);else setError(onAdd(place)||'');}}>{added?copy("담긴 장소"):place.kind==='STAY'?copy("숙박일 선택"):replacing?copy("이곳으로 교체"):copy("이 장소 담기")}</Button>}{error&&<p className="ui-error" role="alert">{error}</p>}</div>;
}
export function StayForm({journey,dayId,onSubmit}:{journey:Journey;dayId:string;onSubmit:(choice:StayChoice)=>string|null}) {
  const copy=useUiCopy();
  const [start,setStart]=useState(journey.days.slice(0,-1).some(day=>day.dayId===dayId)?dayId:'');
  const [nights,setNights]=useState(1),[fixed,setFixed]=useState(false),[error,setError]=useState('');
  const index=journey.days.findIndex(day=>day.dayId===start),max=index<0?0:journey.days.length-index-1;
  return <>{journey.days.length<2?<p>{copy("당일 여행이에요. 숙박이 필요하면 내 여행에서 DAY를 추가해 주세요.")}</p>:<><Field label={copy("숙박 시작일")}><select value={start} onChange={event=>{setStart(event.target.value);setNights(1);}}><option value="">{copy("숙박할 DAY 선택")}</option>{journey.days.slice(0,-1).map(day=><option key={day.dayId} value={day.dayId}>DAY {day.day}{' '}{copy("숙박")}</option>)}</select></Field><Field label={copy("숙박 기간")}><select value={nights} disabled={!max} onChange={event=>setNights(Number(event.target.value))}>{Array.from({length:max||1},(_,i)=><option key={i} value={i+1}>{i+1}{copy("박")}</option>)}</select></Field><label className="plan-check"><input type="checkbox" checked={fixed} onChange={event=>setFixed(event.target.checked)}/>{copy("예약한 숙소로 고정")}</label><p className="plan-help">{copy("선택한 날의 마지막 장소와 다음 날의 출발지로 보여요. 같은 날의 기존 숙소는 교체돼요.")}</p><Button disabled={!max||nights>max} onClick={()=>setError(onSubmit({dayId:start,nights,fixed})||'')}>{copy("숙소 담기")}</Button>{error&&<p className="ui-error" role="alert">{error}</p>}</>}</>;
}
function Candidate({ place, anchor, added, onChoose,journey,dayId,onAdd,replacing }: { place: Place; anchor: Place; added: boolean; onChoose: (place: Place) => void;journey:Journey;dayId:string;onAdd:Props['onAdd'];replacing?:Place }) {
  const copy=useUiCopy();
  const detail = useBottomSheetDetail();
  const KindIcon = place.kind==='FOOD'?Utensils:place.kind==='CAFE'?Coffee:place.kind==='STAY'?BedDouble:MapPin;
  return <article className="nearby-business">
    <div className="nearby-row"><button className="nearby-open" aria-label={`${place.name} · ${copy("상세 보기")}`} onClick={() => detail?.({ title: place.name, children: <CandidateDetail place={place} anchor={anchor} added={added} journey={journey} dayId={dayId} onAdd={onAdd} replacing={replacing}/> })}>{place.image ? <img src={place.image} alt="" /> : <span className="plan-image-empty"><KindIcon size={22} /></span>}<span><strong>{place.name}</strong><small><Distance anchor={anchor} place={place} /></small><small>{place.address || copy("주소 확인 필요")}</small></span></button><button className="outline" aria-label={`${place.name} · ${added ? replacing?.id===place.id?copy("현재 장소"):copy("이 DAY에 담김") : replacing?copy("선택"):copy("담기")}`} disabled={added} onClick={() => onChoose(place)}>{added ? replacing?.id===place.id?copy("현재 장소"):copy("이 DAY에 담김") : replacing?copy("선택"):copy("담기")}</button></div>
    <PhotoCredit image={place.image} />
  </article>;
}
export function NearbyBusinessSheet({ journey, dayId, anchor, catalog, savedPlaces, initialKind='FOOD', slotLabel, replacing, closerTo, onClose, onAdd }: Props) {
  const copy=useUiCopy();
  const {locale}=useLocale(),en=locale==='en';
  const [replacementChoice,setReplacementChoice]=useState<Place|null>(null);
  const [kind, setKind] = useState<PlaceKind>(initialKind);
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const [expandedRange, setExpandedRange] = useState(false);
  const clearQuery = () => { setQuery(''); searchInput.current?.focus(); };
  const [source, setSource] = useState<'nearby'|'saved'>('nearby');
  const [manual, setManual] = useState(false);
  const [external, setExternal] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [stayPlace, setStayPlace] = useState<Place | null>(null);
  const [stayDay, setStayDay] = useState(journey.days.findIndex(day => day.dayId === dayId) < journey.days.length - 1 ? dayId : '');
  const [nights, setNights] = useState(1);
  const [fixed, setFixed] = useState(false);
  const [error, setError] = useState('');
  const day = journey.days.find(day => day.dayId === dayId);
  const results = useMemo(() => {
    const candidates = source === 'saved' ? savedPlaces.filter(place => place.kind === kind) : query.trim()
      ? [...new Map(catalog.filter(place => place.kind === kind && place.area.split(' ')[0] === anchor.area.split(' ')[0]).map(place => [place.id, place])).values()]
      : nearbyCandidates(anchor, catalog, kind, expandedRange ? 15 : 3);
    const term = query.trim().toLocaleLowerCase();
    return candidates.filter(place => (!term || `${place.name} ${place.address}`.toLocaleLowerCase().includes(term))
      && (!replacing || place.area.split(' ')[0]===replacing.area.split(' ')[0])
      && (!closerTo || place.id===replacing?.id || (distanceBetween(closerTo,place)!==null && distanceBetween(closerTo,replacing!)!==null && distanceBetween(closerTo,place)!<distanceBetween(closerTo,replacing!)!)));
  }, [anchor, catalog, kind, query, source, savedPlaces, expandedRange,replacing,closerTo]);
  const hasWiderResults = source==='nearby' && !query.trim() && !expandedRange && nearbyCandidates(anchor,catalog,kind).length>results.length;
  const submit = (place: Place, stay?: StayChoice) => { const problem = onAdd(place, stay); if (problem) setError(problem); };
  const choose = (place: Place) => { setError(''); if(replacing)setReplacementChoice(place);else if (place.kind === 'STAY') setStayPlace(place); else submit(place); };
  const stayStart = journey.days.findIndex(day => day.dayId === stayDay);
  const maxNights = stayStart < 0 ? 0 : journey.days.length - stayStart - 1;
  return <BottomSheet title={replacing ? en?'Replace one place':'한 곳만 교체' : stayPlace ? copy("숙박일에 숙소 담기") : manual ? copy("내 일정에 업체 등록") : `${anchor.name} · ${copy("주변 업체")}`} description={`DAY ${day?.day ?? ''}${slotLabel?` · ${slotLabel}`:''} · ${replacing?.name??anchor.name}`} onClose={onClose}>
    <div className="plan-form">
      {replacementChoice ? <>
        <button className="plan-back" onClick={()=>{setReplacementChoice(null);setError('');}}><ArrowLeft size={16}/>{en?'Back to candidates':copy("업체 목록으로")}</button>
        {replacementChoice.image&&<img className="nearby-detail-image" src={replacementChoice.image} alt={replacementChoice.name}/>}
        <h3>{replacementChoice.name}</h3><p className="plan-help">{replacementChoice.address} · <Distance anchor={anchor} place={replacementChoice}/></p>
        <p className="plan-help">{en?'Keep the DAY, order and visit time. Clear the old business’s note and visit status.':'DAY·순서·방문 시각은 유지해요. 이전 업체의 메모와 방문 상태는 초기화해요.'}</p>
        <Button onClick={()=>submit(replacementChoice)}><RefreshCw size={16}/>{en?'Replace with this place':'이곳으로 교체'}</Button>
        <Button variant="secondary" onClick={onClose}>{en?'Keep original itinerary':'원래 일정 유지'}</Button>
      </> : external ? <ExternalPlaceSearch region={anchor.area} initialQuery={query} onBack={()=>setExternal(false)}/> : stayPlace ? <>
        <button className="plan-back" onClick={() => { setStayPlace(null); setError(''); }}><ArrowLeft size={16} />{copy("업체 목록으로")}</button><h3>{stayPlace.name}</h3>
        {journey.days.length < 2 ? <p>{copy("당일 여행이에요. 숙박이 필요하면 내 여행에서 DAY를 추가해 주세요.")}</p> : <>
          <Field label={copy("숙박 시작일")}><select value={stayDay} onChange={event => { setStayDay(event.target.value); setNights(1); }}><option value="">{copy("숙박할 DAY 선택")}</option>{journey.days.slice(0,-1).map(day => <option key={day.dayId} value={day.dayId}>DAY {day.day}{' '}{copy("밤")}</option>)}</select></Field>
          <Field label={copy("숙박 기간")}><select value={nights} disabled={!maxNights} onChange={event => setNights(Number(event.target.value))}>{Array.from({length:Math.max(1,maxNights)},(_,i)=>i+1).map(night=><option key={night} value={night}>{night}{copy("박")}</option>)}</select></Field>
          <label className="plan-check"><input type="checkbox" checked={fixed} onChange={event=>setFixed(event.target.checked)} />{copy("예약한 숙소로 고정")}</label>
          <p className="plan-help">{copy("해당 밤의 숙소만 바뀌어요. 예약한 숙소가 고정돼 있으면 먼저 고정을 해제해 주세요.")}</p>
          <Button disabled={!maxNights} onClick={()=>submit(stayPlace,{dayId:stayDay,nights,fixed})}>{copy("이 숙소 담기")}</Button>
        </>}
      </> : manual ? <>
        <button className="plan-back" onClick={()=>{setManual(false);setError('');}}><ArrowLeft size={16}/>{copy("업체 목록으로")}</button>
        <Field label={copy("업체명")}><input value={name} maxLength={80} onChange={event=>setName(event.target.value)} placeholder={copy("예: 바다 앞 식당")} /></Field>
        <Field label={copy("주소")}><input value={address} maxLength={200} onChange={event=>setAddress(event.target.value)} placeholder={copy("알고 있는 주소를 적어주세요")} /></Field>
        <p className="plan-help">{copy("내 여행에만 담겨요. 위치가 확인되기 전에는 지도와 거리가 표시되지 않아요.")}</p>
        <Button disabled={!name.trim() || !address.trim()} onClick={()=>choose({id:`personal-${crypto.randomUUID()}`,kind,name:name.trim(),address:address.trim(),area:anchor.area,lat:NaN,lng:NaN,locationVerified:false,personal:true,image:'',photos:[],description:'',note:'',duration:''})}>{copy("내 일정에 담기")}</Button>
      </> : <>
        {!replacing&&<div className="saved-region-chips" role="group" aria-label={copy("주변 업체 종류")}>{(['FOOD','CAFE','STAY'] as const).map(value=><button key={value} aria-pressed={kind===value} className={kind===value?'active':''} onClick={()=>{setKind(value);setError('');}}>{value==='FOOD'?copy("맛집"):value==='CAFE'?copy("카페"):copy("숙소")}</button>)}</div>}
        {replacing&&<p className="plan-help">{en?`Replace only this ${replacing.kind==='FOOD'?'restaurant':'cafe'}. Keep other stops.`:`${replacing.kind==='FOOD'?'음식점':'카페'} 한 곳만 바꿔요. 다른 일정은 유지해요.`}{closerTo&&(en?' Closer by straight-line distance; actual travel needs checking.':' 직선거리상 가까운 후보예요. 실제 이동은 별도 확인이 필요해요.')}</p>}
        <div className="nearby-search"><Search size={17}/><input ref={searchInput} aria-label={copy("주변 업체 검색")} value={query} onChange={event=>setQuery(event.target.value)} placeholder={copy("업체명 검색")} />{query&&<button type="button" className="nearby-search-clear" aria-label={copy("검색어 지우기")} onClick={clearQuery}><X size={16}/></button>}</div>
        <p className="plan-help">{source==='saved'?copy("저장한 업체에서 고르기"):query.trim()?copy("지역 내 검색 · 직선거리 기준"):copy(expandedRange?"직선 15km 이내 · 이동 거리와 달라요":"직선 3km 이내 · 가까운 순")}</p>
        {results.length>0&&<div className="nearby-results">{results.map(place=><Candidate key={place.id} place={place} anchor={anchor} journey={journey} dayId={dayId} onAdd={onAdd} replacing={replacing} added={place.kind!=='STAY' && Boolean(day?.places.some(visit=>visit.id===place.id && (replacing || visit.anchorVisitId===anchor.visitId)))} onChoose={choose}/>)}</div>}
        {!results.length && <div className="empty nearby-empty"><MapPin size={24}/><strong>{query.trim()?copy("검색한 업체가 없어요"):source==='saved'?copy("저장한 업체가 없어요"):copy("가까운 업체가 아직 없어요")}</strong><p>{query.trim()?copy("검색어를 지우거나 아는 곳을 직접 담아보세요."):copy("다른 이름으로 찾거나 아는 곳을 직접 담아보세요.")}</p>{query.trim()&&<button className="outline nearby-saved-button" onClick={clearQuery}>{copy("검색어 지우고 다시 보기")}</button>}</div>}
        {hasWiderResults&&<button className="outline nearby-saved-button" onClick={()=>setExpandedRange(true)}><Search size={14}/>{copy("더 넓게 찾기 · 15km")}</button>}
        {source==='nearby'&&!query.trim()&&expandedRange&&<button className="plan-text-button nearby-register-button" onClick={()=>setExpandedRange(false)}>{copy("가까운 곳만 보기 · 3km")}</button>}
        <button className="outline nearby-saved-button" onClick={()=>{setSource(source==='nearby'?'saved':'nearby');setError('');}}><Bookmark size={14}/>{source==='nearby'?copy("저장한 장소에서 고르기"):copy("주변 추천으로 돌아가기")}</button>
        <button className="plan-text-button nearby-register-button" onClick={()=>{setManual(true);setName(query);setError('');}}><Plus size={14}/>{copy("찾는 곳이 없나요? 직접 등록")}</button>
        <button className="outline nearby-external-button" onClick={()=>{setExternal(true);setError('');}}><ExternalLink size={14}/>{copy("네이버에서 찾아보기")}</button>
      </>}
      {error && <p className="ui-error" role="alert">{error}</p>}
    </div>
  </BottomSheet>;
}
