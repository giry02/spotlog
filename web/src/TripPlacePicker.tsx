import { useMemo, useState } from 'react';
import { ArrowLeft, BedDouble, Bookmark, Check, Coffee, MapPin, Search, ShoppingBag, SlidersHorizontal, Sparkles, Utensils, Activity } from 'lucide-react';
import type { Journey, Place, PlaceKind, PlanningSlot } from './data';
import { BottomSheet } from './BottomSheet';
import { candidatePhoto } from './tripCandidatePresentation';
import { usePublicReview } from './publicReview';
import { Button, Field } from './ui';
import { StayForm, type StayChoice } from './NearbyBusinessSheet';
import { tripPickerStaySelection } from './tripPickerStay';
import PlaceAssistantSheet from './PlaceAssistantSheet';
import { LandmarkGuideCard } from './LandmarkGuideCard';
import PublicPlaceFacts from './community/PublicPlaceFacts';
import { planningAiAvailable } from './planningAiAvailability';
import './trip-place-picker.css';

const kinds = [{value:'ALL',name:'전체',Icon:MapPin},{value:'LANDMARK',name:'랜드마크',Icon:MapPin},{value:'FOOD',name:'음식점',Icon:Utensils},{value:'CAFE',name:'카페',Icon:Coffee},{value:'STAY',name:'숙소',Icon:BedDouble},{value:'SHOP',name:'쇼핑',Icon:ShoppingBag},{value:'LEISURE',name:'레저',Icon:Activity}] as const;
function PlaceChoice({ place, added, label, onAdd }: {place:Place;added:boolean;label:string;onAdd:()=>void}) {
  const { state } = usePublicReview(), image = candidatePhoto(place, state.withdrawnImages), [failed,setFailed] = useState('');
  const Icon = place.kind === 'FOOD' ? Utensils : place.kind === 'CAFE' ? Coffee : place.kind === 'STAY' ? BedDouble : place.kind === 'LEISURE' ? Activity : MapPin;
  return <article className="trip-picker-place"><div className="trip-picker-main"><span className="trip-picker-photo">{image && failed !== image ? <img src={image} alt={place.name} onError={()=>setFailed(image)}/> : <Icon size={22}/>}</span><div className="trip-picker-copy"><strong>{place.name}</strong><small>{place.kind==='FOOD'?'음식점':place.kind==='CAFE'?'카페':place.kind==='STAY'?'숙소':place.kind==='SHOP'?'쇼핑':place.kind==='LEISURE'?'레저':'랜드마크'} · {place.area}</small>{place.description && <p>{place.description}</p>}{place.tags?.length ? <div className="trip-picker-tags">{place.tags.slice(0,3).map(tag=><span key={tag}>{tag}</span>)}</div> : null}</div><Button variant="secondary" size="compact" aria-label={`${place.name} · ${added ? '담김' : label}`} disabled={added} onClick={onAdd}>{added?<Check size={15}/>:null}{added?'담김':place.kind==='STAY'?'숙박일 선택':'담기'}</Button></div></article>;
}

export function TripPlacePicker({journey,dayId,catalog,savedPlaces,onAdd,onAddStay,onClose,initialKind='ALL',initialSlot,initialMode='MANUAL'}: {journey:Journey;dayId:string;catalog:Place[];savedPlaces:Place[];onAdd:(place:Place,slot?:PlanningSlot)=>string|null;onAddStay:(place:Place,choice:StayChoice)=>string|null;onClose:()=>void;initialKind?:'ALL'|PlaceKind;initialSlot?:PlanningSlot;initialMode?:'MANUAL'|'ASSISTANT'}) {
  const day = journey.days.find(item=>item.dayId===dayId);
  const available = useMemo(()=>[...new Map([...savedPlaces,...catalog].map(place=>[place.id,place])).values()],[catalog,savedPlaces]);
  const regions = [...new Set(available.map(place=>place.area.split(' ')[0]))];
  const firstRegion = day?.places[0]?.area.split(' ')[0] ?? journey.region;
  const [region,setRegion] = useState(regions.includes(firstRegion)?firstRegion:''), [kind,setKind] = useState<'ALL'|PlaceKind>(initialKind), [query,setQuery]=useState(''), [savedOnly,setSavedOnly]=useState(false), [slot,setSlot]=useState<'lunch'|'dinner'>(initialSlot==='dinner'?'dinner':'lunch'), [limit,setLimit]=useState(12), [error,setError]=useState(''), [notice,setNotice]=useState('');
  const [stayPlace,setStayPlace] = useState<Place|null>(null), [replacement,setReplacement] = useState<{choice:StayChoice;version:string}|null>(null);
  const [mode,setMode] = useState(initialMode), [assistantDetail,setAssistantDetail] = useState<Place|null>(null);
  const currentDetail=assistantDetail?available.find(place=>place.id===assistantDetail.id&&!place.personal):undefined;
  const selectedSlot = kind==='FOOD' ? slot : kind==='CAFE' ? 'afternoon' : undefined;
  const targetSlot = (place:Place):PlanningSlot|undefined => place.kind==='FOOD'?slot:place.kind==='CAFE'?'afternoon':undefined;
  const assistantActionLabel = (place:Place) => place.kind==='STAY'?'숙박일 선택':place.kind==='FOOD'?`DAY ${day?.day??''} · ${slot==='dinner'?'저녁':'점심'}에 담기`:`DAY ${day?.day??''}에 담기`;
  const isAdded = (place:Place) => place.kind!=='STAY' && Boolean(day?.places.some(visit=>visit.id===place.id&&(place.kind==='LANDMARK'||place.kind==='SHOP'||visit.planningSlot===targetSlot(place))));
  const results = available.filter(place=>(!region||place.area.split(' ')[0]===region)&&(kind==='ALL'||place.kind===kind)&&(!savedOnly||savedPlaces.some(saved=>saved.id===place.id))&&`${place.name} ${place.area} ${place.address} ${place.tags?.join(' ')??''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const add = (place:Place) => {if(place.kind==='STAY'){setStayPlace(place);setReplacement(null);setError('');return;}const problem=onAdd(place,targetSlot(place)); if(problem){setError(problem);return;}setError('');setNotice(`${place.name}을 DAY ${day?.day}에 담았어요.`);};
  const saveStay = (place:Place,choice:StayChoice):string|null => {
    try {
      const problem=onAddStay(place,choice);if(problem)return problem;
      setStayPlace(null);setReplacement(null);setError('');setNotice(`${place.name}을 선택한 ${choice.nights}박에 담았어요.`);return null;
    } catch(reason) { return reason instanceof Error?reason.message:'숙소를 담지 못했어요. 이전 일정은 그대로예요.'; }
  };
  const chooseStay = (choice:StayChoice):string|null => {
    if(!stayPlace)return '숙소를 다시 선택해 주세요.';
    try {
      const selection=tripPickerStaySelection(journey,stayPlace.id,choice);
      if(selection.conflicts.some(stay=>stay.fixed))return '예약한 숙소가 고정돼 있어요. 먼저 고정을 해제해 주세요.';
      if(selection.conflicts.length){setReplacement({choice,version:selection.version});setError('');return null;}
      return saveStay(stayPlace,choice);
    } catch(reason) { return reason instanceof Error?reason.message:'숙박일을 확인해 주세요.'; }
  };
  const selectAssistantPlace = (place:Place):string|null => {
    if (!day || !journey.isMine || journey.purpose!=='PLAN' || journey.visibility!=='PRIVATE' || journey.trash) return '현재 수정할 내 여행의 DAY를 다시 확인해 주세요.';
    const current=available.find(item=>item.id===place.id&&!item.personal);
    if (!current) return '현재 공개된 장소를 다시 확인해 주세요.';
    if (current.kind==='STAY') { setStayPlace(current);setReplacement(null);setError('');return null; }
    if (isAdded(current)) return null;
    try {
      const problem=onAdd(current,targetSlot(current));
      if (!problem) setNotice(`${current.name}을 DAY ${day.day}에 담았어요.`);
      return problem;
    } catch (cause) { return cause instanceof Error?cause.message:'담지 못했어요. 이전 일정은 그대로예요.'; }
  };
  let replacementSelection:ReturnType<typeof tripPickerStaySelection>|undefined;
  if(replacement&&stayPlace){try{replacementSelection=tripPickerStaySelection(journey,stayPlace.id,replacement.choice);}catch{/* Confirmation rechecks a removed or changed DAY before saving. */}}
  return <BottomSheet title={`DAY ${day?.day??''}에 장소 담기`} description="음식점·카페·숙소부터 담아도 돼요. 숙소는 숙박일과 박수를 선택해요." onClose={onClose}><div className="trip-place-picker">
    <div className="trip-picker-mode" role="group" aria-label="장소 찾는 방법"><button type="button" aria-pressed={mode==='MANUAL'} onClick={()=>setMode('MANUAL')}><Search size={17}/>직접 찾기</button><button type="button" aria-pressed={mode==='ASSISTANT'} onClick={()=>setMode('ASSISTANT')}>{planningAiAvailable ? <Sparkles size={17}/> : <SlidersHorizontal size={17}/>} {planningAiAvailable ? 'AI로 찾기' : '조건으로 찾기'}</button></div>
    <div className="trip-picker-manual" hidden={mode!=='MANUAL'}>
    <div className="trip-picker-kinds" role="tablist" aria-label="담을 장소 종류">{kinds.map(item=><button key={item.value} type="button" role="tab" aria-selected={kind===item.value} onClick={()=>{setKind(item.value);setLimit(12);}}><item.Icon size={15}/>{item.name}</button>)}</div>
    <div className="trip-picker-filter"><Field label="지역"><select value={region} onChange={event=>{setRegion(event.target.value);setLimit(12);}}><option value="">전체 지역</option>{regions.map(value=><option key={value}>{value}</option>)}</select></Field><button className={savedOnly?'active':''} type="button" aria-pressed={savedOnly} onClick={()=>{setSavedOnly(value=>!value);setLimit(12);}}><Bookmark size={16}/>저장한 장소</button></div>
    <label className="trip-picker-search"><Search size={18}/><input type="search" aria-label="장소 이름·지역 검색" placeholder="장소 이름·지역 검색" value={query} onChange={event=>{setQuery(event.target.value);setLimit(12);}}/></label>
    {kind==='FOOD'&&<div className="trip-picker-meal" aria-label="담을 식사 시간">{(['lunch','dinner'] as const).map(value=><button type="button" key={value} aria-pressed={slot===value} onClick={()=>setSlot(value)}>{value==='lunch'?'점심':'저녁'}</button>)}</div>}
    <p className="trip-picker-context">DAY {day?.day} · {selectedSlot==='lunch'?'점심':selectedSlot==='dinner'?'저녁':selectedSlot==='afternoon'?'오후 카페':'선택한 장소'} 담기</p>
    <div className="trip-picker-results">{results.slice(0,limit).map(place=><PlaceChoice key={place.id} place={place} label={place.kind==='FOOD'?(slot==='dinner'?'저녁에 담기':'점심에 담기'):place.kind==='CAFE'?'카페 담기':place.kind==='STAY'?'숙박일 선택':'장소 담기'} added={isAdded(place)} onAdd={()=>add(place)}/> )}</div>
    {!results.length && <div className="trip-picker-empty"><p className="plan-help">이 조건에 맞는 장소가 없어요.</p>
      <Button variant="secondary" onClick={() => { setRegion(''); setQuery(''); setKind('ALL'); setSavedOnly(false); setLimit(12); }}>검색 조건 초기화</Button>
    </div>}
    {results.length>limit&&<Button variant="secondary" onClick={()=>setLimit(value=>value+12)}>장소 더 보기</Button>}
    </div>
    {mode==='ASSISTANT' && <>
      {(!assistantDetail||currentDetail?.kind==='FOOD') && <div className="trip-picker-ai-meal"><small>음식점 담을 때</small><div className="trip-picker-meal" role="group" aria-label="추천 음식점 담을 식사 시간">{(['lunch','dinner'] as const).map(value=><button type="button" key={value} aria-pressed={slot===value} onClick={()=>setSlot(value)}>{value==='lunch'?'점심':'저녁'}</button>)}</div></div>}
      <PlaceAssistantSheet inline active={!assistantDetail} places={available} initialKind={kind} initialRegion={region||undefined} initialPrompt={query||undefined} initialOriginId={day?.places.find(place=>!place.personal&&Number.isFinite(place.lat)&&Number.isFinite(place.lng))?.id} onClose={()=>setMode('MANUAL')} onOpenPlace={setAssistantDetail}
        selection={{scopeKey:`trip:${journey.id}:${dayId}:${slot}`,contextLabel:`${journey.title} · DAY ${day?.day??''}${journey.startDate&&day?` · ${day.date}`:''}`,label:`DAY ${day?.day??''}에 담기`,selectedIds:available.filter(isAdded).map(place=>place.id),actionLabel:assistantActionLabel,onSelect:selectAssistantPlace}}/>
      {assistantDetail && <div className="trip-picker-detail"><button type="button" className="plan-back" onClick={()=>setAssistantDetail(null)}><ArrowLeft size={17}/>추천 결과로</button>{currentDetail?<LandmarkGuideCard place={currentDetail} variant="detail" showCredit facts={<PublicPlaceFacts place={currentDetail}/>} actions={<Button disabled={isAdded(currentDetail)} onClick={()=>{const problem=selectAssistantPlace(currentDetail);if(problem)setError(problem);else if(currentDetail.kind!=='STAY')setAssistantDetail(null);}}>{isAdded(currentDetail)?'담김':assistantActionLabel(currentDetail)}</Button>}/>:<p role="status">공개 정보가 바뀌었어요. 추천 결과에서 장소를 다시 확인해 주세요.</p>}</div>}
    </>}
    {error&&<p role="alert" className="ui-error">{error}</p>}{notice&&<p role="status" className="plan-help">{notice}</p>}
    <Button onClick={onClose}>일정으로 돌아가기</Button>
    {stayPlace&&<BottomSheet title={`${stayPlace.name} · 숙박일 선택`} onClose={()=>{setStayPlace(null);setReplacement(null);setError('');}}><div className="plan-form"><p className="plan-help">{stayPlace.address||stayPlace.area}</p>{replacement?<><h3>기존 숙소를 바꿀까요?</h3><p className="plan-help">DAY {journey.days.find(day=>day.dayId===replacement.choice.dayId)?.day}부터 {replacement.choice.nights}박을 {stayPlace.name}으로 바꿔요. 다른 날짜의 숙소는 유지돼요.</p><ul className="trip-picker-stay-conflicts">{(replacementSelection?.conflicts||[]).map(stay=><li key={`${stay.dayId}:${stay.placeId}`}>DAY {stay.day} · {stay.name}{stay.fixed?' · 예약 고정':''}</li>)}</ul><Button onClick={()=>{try{const current=tripPickerStaySelection(journey,stayPlace.id,replacement.choice);if(current.version!==replacement.version){setReplacement(null);setError('기존 숙소가 바뀌었어요. 숙박일과 현재 숙소를 다시 확인해 주세요.');return;}setError(saveStay(stayPlace,replacement.choice)||'');}catch(reason){setReplacement(null);setError(reason instanceof Error?reason.message:'숙박일을 다시 확인해 주세요.');}}}>확인한 숙소로 교체</Button><Button variant="secondary" onClick={()=>{setStayPlace(null);setReplacement(null);setError('');}}>원래 숙소 유지</Button><button type="button" className="plan-back" onClick={()=>{setReplacement(null);setError('');}}><ArrowLeft size={16}/>숙박일 다시 선택</button></>:<StayForm key={stayPlace.id} journey={journey} dayId={dayId} onSubmit={chooseStay}/>} {error&&<p role="alert" className="ui-error">{error}</p>}</div></BottomSheet>}
  </div></BottomSheet>;
}
