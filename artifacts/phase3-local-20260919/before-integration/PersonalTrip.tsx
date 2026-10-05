import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowLeft, MapPin, Plus, Trash2, MoreHorizontal, Copy, Undo2, Map as MapIcon } from 'lucide-react';
import type { Journey, Place } from './data';
import { DayNavigation } from './DayNavigation';
import { BottomSheet } from './BottomSheet';
import { PhotoCredit } from './PublicTourismCredit';
import { Button, Field } from './ui';
import { NearbyBusinessSheet,StayForm } from './NearbyBusinessSheet';
import { addPlanDay, appendPlanLandmark, copyPlanDay, hasLocation, insertNearby, normalizePlan, removePlanDay, removePlanVisit, reorderPlanVisit, setPlanDates, setPlanStay, transferVisit } from './tripPlan';
import './trip-plan.css';
import './personal-trip-refinement.css';

type Props = { journey: Journey; initialDay?: number; catalog: Place[]; savedPlaces: Place[]; onBack: () => void; onChange: (next: Journey) => boolean; onAddLandmark: () => void;
  onSaveBusiness:(place:Place)=>boolean;
  onCopy: () => void; onJournal: () => void; renderMap: (places: Place[], selected: string | undefined, onSelect: (id: string) => void) => ReactNode };
export function PersonalTrip({ journey: input, initialDay = 1, catalog, savedPlaces, onBack, onChange, onAddLandmark, onCopy, onJournal, renderMap,onSaveBusiness }: Props) {
  const journey = normalizePlan(input);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Place | null>(null);
  const [addingLandmark, setAddingLandmark] = useState(false);
  const [menu, setMenu] = useState<'trip'|'day'|null>(null);
  const [tripSettings, setTripSettings] = useState<{title:string;startDate:string}|null>(null);
  const [editing, setEditing] = useState<Place | null>(null);
  const [stayEditing,setStayEditing]=useState<Place|null>(null);
  const [transferring, setTransferring] = useState<Place | null>(null);
  const [targetDay, setTargetDay] = useState('');
  const [copy, setCopy] = useState(false);
  const [linked, setLinked] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<string>();
  const [undo, setUndo] = useState<{ previous: Journey; after: string;previousDay:number } | null>(null);
  const day = journey.days.find(day => day.day === selectedDay) ?? journey.days[0];
  const anchor = day?.places.find(place => place.visitId === anchorId);
  const save = (value: Journey) => {
    const next=normalizePlan(value);
    const saved = onChange(next);
    if (saved) { setUndo({ previous: structuredClone(journey), after: JSON.stringify(next),previousDay:day?.day??1 }); setError(''); }
    else setError('저장하지 못했어요. 이전 일정은 그대로예요.');
    setStatus(saved ? '변경한 일정을 저장했어요' : '');
    return saved;
  };
  const attempt = (operation: () => Journey, close?: () => void) => { try { if (save(operation())) close?.(); } catch (error) { setError(error instanceof Error ? error.message : '변경하지 못했어요.'); } };
  if (!day) return <div className="page"><button onClick={onBack}>내 여행으로</button><p>일정을 확인할 수 없어요.</p></div>;
  const remove = (related: boolean) => { if (removing?.visitId) attempt(()=>removePlanVisit(journey,removing.visitId!,related),()=>setRemoving(null)); };
  const previousStay = journey.days.find(item=>item.day===day.day-1)?.places.find(place=>place.kind==='STAY');
  const routePlaces = previousStay ? [previousStay,...day.places] : day.places;
  const chooseVisit = (visitId: string) => { setSelectedVisit(visitId); document.getElementById(`plan-visit-${visitId}`)?.scrollIntoView({behavior:'smooth',block:'center'}); };
  const closeMenu = () => { setMenu(null);setError(''); };
  const openMapVisit=(place:Place)=>{if(!hasLocation(place)){setEditing(structuredClone(place));return;}setSelectedVisit(place.visitId);setMapOpen(true);requestAnimationFrame(()=>document.getElementById('personal-route')?.scrollIntoView({behavior:'smooth',block:'start'}));};
  return <div className="personal-trip">
    <header className="editor-topbar"><button onClick={onBack} aria-label="내 여행 목록"><ArrowLeft size={20}/></button><div><small>나를 위한 동선</small><strong>{journey.title}</strong></div><button aria-label="여행 메뉴" onClick={()=>setMenu('trip')}><MoreHorizontal size={20}/></button></header>
    {journey.cover && <div className="plan-cover"><img src={journey.cover} alt=""/><div><span>{journey.region} · 비공개</span><h1>{journey.title}</h1><p>{journey.duration} · {journey.days.reduce((n,day)=>n+day.places.length,0)}곳</p></div></div>}
    <DayNavigation days={journey.days} selectedDay={day.day} onSelect={next=>{setSelectedDay(next);setAnchorId(null);setSelectedVisit(undefined);}} onBack={onBack}/>
    <section className="plan-day"><div className="section-heading"><div><h2>DAY {day.day}</h2><p>가고 싶은 곳과 주변 업체를 하나씩 채워보세요.</p></div><button className="plan-icon" aria-label={`DAY ${day.day} 메뉴`} onClick={()=>setMenu('day')}><MoreHorizontal size={20}/></button></div>
      <button className="outline wide plan-map-toggle" aria-expanded={mapOpen} onClick={()=>setMapOpen(!mapOpen)}><MapIcon size={17}/>{mapOpen?'지도 접기':'이날의 동선 지도'}</button>
      {mapOpen && <div className="plan-route" id="personal-route">{renderMap(routePlaces,selectedVisit,chooseVisit)}</div>}
      {previousStay && <button id={`plan-visit-${previousStay.visitId}`} className="plan-departure" onClick={()=>{setSelectedVisit(previousStay.visitId);setMapOpen(true);}}>1 · {previousStay.name}에서 출발</button>}
      <div className="plan-stops">{day.places.map((place,index)=><article key={place.visitId} id={`plan-visit-${place.visitId}`} className={`plan-stop ${place.anchorVisitId?'plan-stop-related':''} ${selectedVisit===place.visitId?'plan-stop-selected':''}`}>
        <button className="plan-stop-main plan-select-stop" onClick={()=>openMapVisit(place)} aria-label={`${place.name} ${hasLocation(place)?'지도에서 보기':'장소 정보'}`}><span className="plan-stop-number">{index+1+(previousStay?1:0)}</span>{place.image?<img src={place.image} alt=""/>:<span className="plan-image-empty"><MapPin size={22}/></span>}<span className="plan-stop-copy"><small>{place.kind==='STAY'?`DAY ${day.day} 숙소${place.bookingFixed?' · 예약 고정':''}`:place.anchorVisitId?'함께 담은 곳':place.kind==='LANDMARK'?'랜드마크':'방문 장소'}</small><strong>{place.name}</strong><small>{place.address||'주소 확인 필요'}{!hasLocation(place)&&' · 위치 미확인'}</small></span></button>
        <PhotoCredit image={place.image}/>
        {(place.time||place.note) && <p className="plan-help">{place.time && `${place.time} · `}{place.note}</p>}
        <div className="plan-stop-actions">{place.kind==='LANDMARK' && <button className="outline" onClick={()=>setAnchorId(place.visitId!)}><Plus size={16}/>주변 업체</button>}<span/>{!place.anchorVisitId && place.kind!=='STAY' && <><button aria-label={`${place.name} 위로 이동`} disabled={index===0} onClick={()=>attempt(()=>reorderPlanVisit(journey,day.dayId!,place.visitId!,-1))}><ArrowUp size={16}/></button><button aria-label={`${place.name} 아래로 이동`} disabled={day.places.slice(index+1).every(next=>next.anchorVisitId===place.visitId||next.kind==='STAY')} onClick={()=>attempt(()=>reorderPlanVisit(journey,day.dayId!,place.visitId!,1))}><ArrowDown size={16}/></button></>}<button aria-label={`${place.name} 장소 메뉴`} onClick={()=>{setEditing(structuredClone(place));setError('');}}><MoreHorizontal size={18}/></button></div>
      </article>)}</div>
      {!day.places.length && <div className="empty"><MapPin size={24}/><strong>이날 가고 싶은 곳을 담아보세요</strong><p>글을 작성하지 않아도 여행을 만들 수 있어요.</p></div>}
      <button className="outline wide" onClick={()=>setAddingLandmark(true)}><Plus size={17}/>저장한 랜드마크 담기</button>
      {undo && <button className="plan-undo" onClick={()=>{ if(JSON.stringify(journey)!==undo.after){setError('이후 변경된 내용이 있어요. 현재 일정을 유지할게요.');return;} if(onChange(undo.previous)){setSelectedDay(undo.previousDay);setUndo(null);setStatus('마지막 변경을 취소했어요.');setError('');}else setError('취소 내용을 저장하지 못했어요.'); }}><Undo2 size={16}/>마지막 변경 취소</button>}
      {status && <p className="plan-help" role="status">{status}</p>}{error && <p className="ui-error" role="alert">{error}</p>}
      <button className="plan-journal-link" onClick={onJournal}>이 여행을 여행기로 남기기</button>
    </section>
    {anchor && <NearbyBusinessSheet journey={journey} dayId={day.dayId!} anchor={anchor} catalog={catalog} savedPlaces={savedPlaces} onClose={()=>setAnchorId(null)} onAdd={(place,stay)=>{try{const next=stay?setPlanStay(journey,place,stay.dayId,stay.nights,stay.fixed):insertNearby(journey,day.dayId!,anchor.visitId!,place);if(!save(next))return '담지 못했어요. 다시 시도해 주세요.';setAnchorId(null);return null;}catch(error){return error instanceof Error?error.message:'담지 못했어요.';}}}/>}
    {removing && <BottomSheet title="일정에서 빼기" description={`${removing.name}을 일정에서 뺄까요? 저장한 장소는 유지돼요.`} onClose={()=>setRemoving(null)}><div className="plan-form"><Button onClick={()=>remove(false)}>이 장소만 빼기</Button>{day.places.some(place=>place.anchorVisitId===removing.visitId) && <Button variant="secondary" onClick={()=>remove(true)}>함께 담은 업체도 빼기</Button>}{error && <p role="alert">{error}</p>}</div></BottomSheet>}
    {addingLandmark && <BottomSheet title={`DAY ${day.day}에 장소 담기`} description="저장한 랜드마크에서 고르세요." onClose={()=>setAddingLandmark(false)}><div className="plan-form plan-place-choices">{savedPlaces.filter(place=>place.kind==='LANDMARK').map(place=><button key={place.id} disabled={day.places.some(visit=>visit.id===place.id)} onClick={()=>attempt(()=>appendPlanLandmark(journey,day.dayId!,place),()=>setAddingLandmark(false))}>{place.image && <img src={place.image} alt=""/>}<span>{place.name}</span>{day.places.some(visit=>visit.id===place.id)?'담김':'담기'}</button>)}{!savedPlaces.some(place=>place.kind==='LANDMARK') && <><p className="plan-help">장소를 먼저 저장하면 여기서 바로 담을 수 있어요.</p><button className="outline" onClick={onAddLandmark}>장소 둘러보기</button></>}{error && <p role="alert">{error}</p>}</div></BottomSheet>}
    {tripSettings && <BottomSheet title="여행 이름과 날짜" onClose={()=>setTripSettings(null)}><div className="plan-form"><Field label="여행 이름"><input value={tripSettings.title} onChange={event=>setTripSettings({...tripSettings,title:event.target.value})}/></Field><Field label="출발 날짜 (선택)"><input type="date" value={tripSettings.startDate} onChange={event=>setTripSettings({...tripSettings,startDate:event.target.value})}/></Field><Button disabled={!tripSettings.title.trim()} onClick={()=>attempt(()=>setPlanDates({...journey,title:tripSettings.title.trim()},tripSettings.startDate),()=>setTripSettings(null))}>변경 저장</Button>{error&&<p role="alert">{error}</p>}</div></BottomSheet>}
    {menu && <BottomSheet title={menu==='trip'?'내 여행 관리':`DAY ${day.day} 관리`} onClose={closeMenu}><div className="plan-form">{menu==='trip'?<><Button variant="secondary" onClick={()=>{closeMenu();setTripSettings({title:journey.title,startDate:journey.startDate??''});}}>여행 이름 · 날짜</Button><Button variant="secondary" onClick={onCopy}><Copy size={17}/>내 여행 복사</Button><Button variant="secondary" onClick={onJournal}>여행기로 남기기</Button></>:<>
      <Button variant="secondary" disabled={journey.days.length>=30} onClick={()=>attempt(()=>addPlanDay(journey),()=>{setSelectedDay(journey.days.length+1);closeMenu();})}>DAY 추가</Button>
      {day.places.some(place=>place.kind==='STAY')&&<p className="plan-help">이 DAY를 복사하면 숙박 다음 날도 함께 추가해요. 새 숙박일의 예약 여부는 다시 확인해 주세요.</p>}
      <Button variant="secondary" disabled={journey.days.length>=30} onClick={()=>attempt(()=>copyPlanDay(journey,day.dayId!),()=>{setSelectedDay(journey.days.length+1);closeMenu();})}>이 DAY 복사</Button>
      <p className="plan-help">DAY를 삭제하면 이 날짜의 장소도 빠져요. 현재 화면에서 마지막 변경 취소로 되돌릴 수 있어요.</p>
      <Button variant="danger" disabled={journey.days.length<=1} onClick={()=>attempt(()=>removePlanDay(journey,day.dayId!),()=>{setSelectedDay(Math.max(1,day.day-1));closeMenu();})}>이 DAY 삭제</Button>
    </>}{error && <p className="ui-error" role="alert">{error}</p>}</div></BottomSheet>}
    {stayEditing&&<BottomSheet title={`${stayEditing.name} 숙박일 추가`} onClose={()=>setStayEditing(null)}><div className="plan-form"><p className="plan-help">기존 숙박일은 유지하고, 선택한 날에도 이 숙소를 담아요.</p><StayForm journey={journey} dayId={day.dayId!} onSubmit={choice=>{try{if(!save(setPlanStay(journey,stayEditing,choice.dayId,choice.nights,choice.fixed)))return '저장하지 못했어요.';setStayEditing(null);return null;}catch(error){return error instanceof Error?error.message:'숙박일을 확인해 주세요.';}}}/></div></BottomSheet>}
    {editing && <BottomSheet title={editing.name} onClose={()=>setEditing(null)}><div className="plan-form">
      <p className="plan-help">{editing.address||'주소 확인 필요'}{!hasLocation(editing)&&' · 위치 미확인'}</p>
      <Field label="메모 (선택)"><textarea value={editing.note} onChange={event=>setEditing({...editing,note:event.target.value})} placeholder="나중에 기억할 내용만 적어두세요." rows={3}/></Field>
      <Field label="방문 시각 (선택)"><input type="time" value={editing.time??''} onChange={event=>setEditing({...editing,time:event.target.value})}/></Field>
      {editing.kind==='STAY' && <label className="plan-check"><input type="checkbox" checked={editing.bookingFixed??false} onChange={event=>setEditing({...editing,bookingFixed:event.target.checked})}/>예약한 숙소로 고정</label>}
      <Button onClick={()=>attempt(()=>({...journey,days:journey.days.map(item=>({...item,places:item.places.map(place=>place.visitId===editing.visitId?editing:place)}))}),()=>setEditing(null))}>변경 저장</Button>
      <Button variant="secondary" disabled={savedPlaces.some(place=>place.id===editing.id)} onClick={()=>{if(!onSaveBusiness(editing))setError('장소를 저장하지 못했어요. 다시 시도해 주세요.');}}>{savedPlaces.some(place=>place.id===editing.id)?'저장한 장소':'장소 저장'}</Button>
      {editing.anchorVisitId&&<Button variant="secondary" onClick={()=>attempt(()=>({...journey,days:journey.days.map(item=>({...item,places:item.places.map(place=>place.visitId===editing.visitId?{...place,anchorVisitId:undefined}:place)}))}),()=>setEditing(null))}>연결을 풀고 독립 방문으로</Button>}
      {editing.kind==='STAY'&&<Button variant="secondary" onClick={()=>{setStayEditing(editing);setEditing(null);}}>다른 숙박일에도 담기</Button>}
      {editing.kind!=='STAY' && <Button variant="secondary" onClick={()=>{setTransferring(editing);setTargetDay(journey.days.find(item=>item.dayId!==day.dayId)?.dayId??day.dayId!);setCopy(false);setLinked(true);setEditing(null);}}>다른 DAY로 이동 · 복사</Button>}
      <Button variant="danger" onClick={()=>{setRemoving(editing);setEditing(null);}}>일정에서 빼기</Button>
      {error && <p className="ui-error" role="alert">{error}</p>}
    </div></BottomSheet>}
    {transferring && <BottomSheet title={`${transferring.name} 이동·복사`} onClose={()=>setTransferring(null)}><div className="plan-form">
      <Field label="대상 DAY"><select value={targetDay} onChange={event=>setTargetDay(event.target.value)}>{journey.days.map(day=><option key={day.dayId} value={day.dayId}>DAY {day.day}</option>)}</select></Field>
      <label className="plan-check"><input type="checkbox" checked={copy} onChange={event=>setCopy(event.target.checked)}/>원본을 남기고 복사</label>
      {day.places.some(place=>place.anchorVisitId===transferring.visitId) && <label className="plan-check"><input type="checkbox" checked={linked} onChange={event=>setLinked(event.target.checked)}/>함께 담은 업체도 이동·복사</label>}
      <p className="plan-help">장소에 연결한 기록도 함께 처리해요. 업체만 따로 옮기면 독립된 방문으로 남아요.</p>
      <Button disabled={!copy&&targetDay===day.dayId} onClick={()=>attempt(()=>transferVisit(journey,day.dayId!,transferring.visitId!,targetDay,copy,linked),()=>{setSelectedDay(journey.days.find(item=>item.dayId===targetDay)?.day??day.day);setTransferring(null);})}>{copy?'이 DAY에 복사':'이 DAY로 이동'}</Button>
      {error && <p className="ui-error" role="alert">{error}</p>}
    </div></BottomSheet>}
  </div>;
}
