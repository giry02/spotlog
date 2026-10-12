import { useMemo, useState } from 'react';
import { Bookmark, Check, Coffee, MapPin, Search, ShoppingBag, Utensils } from 'lucide-react';
import type { Journey, Place, PlaceKind, PlanningSlot } from './data';
import { BottomSheet } from './BottomSheet';
import { PhotoCredit } from './PublicTourismCredit';
import { candidatePhoto } from './tripCandidatePresentation';
import { usePublicReview } from './publicReview';
import { Button, Field } from './ui';
import './trip-place-picker.css';

const kinds = [{value:'ALL',name:'전체',Icon:MapPin},{value:'LANDMARK',name:'랜드마크',Icon:MapPin},{value:'FOOD',name:'음식점',Icon:Utensils},{value:'CAFE',name:'카페',Icon:Coffee},{value:'SHOP',name:'쇼핑',Icon:ShoppingBag}] as const;
function PlaceChoice({ place, added, label, onAdd }: {place:Place;added:boolean;label:string;onAdd:()=>void}) {
  const { state } = usePublicReview(), image = candidatePhoto(place, state.withdrawnImages), [failed,setFailed] = useState('');
  const Icon = place.kind === 'FOOD' ? Utensils : place.kind === 'CAFE' ? Coffee : MapPin;
  return <article className="trip-picker-place"><div className="trip-picker-main"><span className="trip-picker-photo">{image && failed !== image ? <img src={image} alt={place.name} onError={()=>setFailed(image)}/> : <Icon size={22}/>}</span><div className="trip-picker-copy"><strong>{place.name}</strong><small>{place.kind==='FOOD'?'음식점':place.kind==='CAFE'?'카페':place.kind==='SHOP'?'쇼핑':'랜드마크'} · {place.area}</small>{place.description && <p>{place.description}</p>}{place.tags?.length ? <div className="trip-picker-tags">{place.tags.slice(0,3).map(tag=><span key={tag}>{tag}</span>)}</div> : null}</div><Button variant="secondary" size="compact" aria-label={`${place.name} · ${added ? '담김' : label}`} disabled={added} onClick={onAdd}>{added?<Check size={15}/>:null}{added?'담김':'담기'}</Button></div>{image && <PhotoCredit image={image}/>}</article>;
}

export function TripPlacePicker({journey,dayId,catalog,savedPlaces,onAdd,onClose,initialKind='ALL',initialSlot}: {journey:Journey;dayId:string;catalog:Place[];savedPlaces:Place[];onAdd:(place:Place,slot?:PlanningSlot)=>string|null;onClose:()=>void;initialKind?:'ALL'|PlaceKind;initialSlot?:PlanningSlot}) {
  const day = journey.days.find(item=>item.dayId===dayId);
  const available = useMemo(()=>[...new Map([...savedPlaces,...catalog].filter(place=>place.kind!=='STAY').map(place=>[place.id,place])).values()],[catalog,savedPlaces]);
  const regions = [...new Set(available.map(place=>place.area.split(' ')[0]))];
  const firstRegion = day?.places[0]?.area.split(' ')[0] ?? journey.region;
  const [region,setRegion] = useState(regions.includes(firstRegion)?firstRegion:''), [kind,setKind] = useState<'ALL'|PlaceKind>(initialKind), [query,setQuery]=useState(''), [savedOnly,setSavedOnly]=useState(false), [slot,setSlot]=useState<'lunch'|'dinner'>(initialSlot==='dinner'?'dinner':'lunch'), [limit,setLimit]=useState(12), [error,setError]=useState(''), [notice,setNotice]=useState('');
  const selectedSlot = kind==='FOOD' ? slot : kind==='CAFE' ? 'afternoon' : undefined;
  const targetSlot = (place:Place):PlanningSlot|undefined => place.kind==='FOOD'?slot:place.kind==='CAFE'?'afternoon':undefined;
  const results = available.filter(place=>(!region||place.area.split(' ')[0]===region)&&(kind==='ALL'||place.kind===kind)&&(!savedOnly||savedPlaces.some(saved=>saved.id===place.id))&&`${place.name} ${place.area} ${place.address} ${place.tags?.join(' ')??''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const add = (place:Place) => {const problem=onAdd(place,targetSlot(place)); if(problem){setError(problem);return;}setError('');setNotice(`${place.name}을 DAY ${day?.day}에 담았어요.`);};
  return <BottomSheet title={`DAY ${day?.day??''}에 장소 담기`} description="음식점·카페부터 담아도 돼요. 선택한 순서로 일정에 들어가요." onClose={onClose}><div className="trip-place-picker">
    <div className="trip-picker-kinds" role="tablist" aria-label="담을 장소 종류">{kinds.map(item=><button key={item.value} type="button" role="tab" aria-selected={kind===item.value} onClick={()=>{setKind(item.value);setLimit(12);}}><item.Icon size={15}/>{item.name}</button>)}</div>
    <div className="trip-picker-filter"><Field label="지역"><select value={region} onChange={event=>{setRegion(event.target.value);setLimit(12);}}><option value="">전체 지역</option>{regions.map(value=><option key={value}>{value}</option>)}</select></Field><button className={savedOnly?'active':''} type="button" aria-pressed={savedOnly} onClick={()=>{setSavedOnly(value=>!value);setLimit(12);}}><Bookmark size={16}/>저장한 장소</button></div>
    <label className="trip-picker-search"><Search size={18}/><input type="search" aria-label="장소 이름·지역 검색" placeholder="장소 이름·지역 검색" value={query} onChange={event=>{setQuery(event.target.value);setLimit(12);}}/></label>
    {kind==='FOOD'&&<div className="trip-picker-meal" aria-label="담을 식사 시간">{(['lunch','dinner'] as const).map(value=><button type="button" key={value} aria-pressed={slot===value} onClick={()=>setSlot(value)}>{value==='lunch'?'점심':'저녁'}</button>)}</div>}
    <p className="trip-picker-context">DAY {day?.day} · {selectedSlot==='lunch'?'점심':selectedSlot==='dinner'?'저녁':selectedSlot==='afternoon'?'오후 카페':'선택한 장소'} 담기</p>
    <div className="trip-picker-results">{results.slice(0,limit).map(place=><PlaceChoice key={place.id} place={place} label={place.kind==='FOOD'?(slot==='dinner'?'저녁에 담기':'점심에 담기'):place.kind==='CAFE'?'카페 담기':'장소 담기'} added={Boolean(day?.places.some(visit=>visit.id===place.id&&(place.kind==='LANDMARK'||place.kind==='SHOP'||visit.planningSlot===targetSlot(place))))} onAdd={()=>add(place)}/> )}</div>
    {!results.length && <p className="plan-help">이 조건에 맞는 장소가 없어요. 지역이나 검색어를 바꿔보세요.</p>}
    {results.length>limit&&<Button variant="secondary" onClick={()=>setLimit(value=>value+12)}>장소 더 보기</Button>}
    {error&&<p role="alert" className="ui-error">{error}</p>}{notice&&<p role="status" className="plan-help">{notice}</p>}
    <Button onClick={onClose}>일정으로 돌아가기</Button>
  </div></BottomSheet>;
}
