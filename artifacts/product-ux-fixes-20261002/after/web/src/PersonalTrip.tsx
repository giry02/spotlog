import { useUiCopy } from './frontendCopy';
import { useLocale } from './locale';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight, MapPin, Plus, Sparkles, Trash2, MoreHorizontal, Copy, Undo2, CheckCircle2, SkipForward, RefreshCw, Clock3, Navigation, Map as MapIcon, Utensils, Coffee, BedDouble, Store } from 'lucide-react';
import type { Journey, Place, PlanningSlot } from './data';
import { plannerTimeline, planningSlotLabel, planningGapLabel, plannerVisitContext } from './plannerTimeline';
import { applyPlannerSelections } from './aiPlannerSelections';
import { DayNavigation } from './DayNavigation';
import { BottomSheet } from './BottomSheet';
import { PhotoCredit } from './PublicTourismCredit';
import { Button, Field } from './ui';
import { NearbyBusinessSheet,StayForm } from './NearbyBusinessSheet';
import { addPlanDay, appendPlanLandmark, copyPlanDay, distanceBetween, hasLocation, insertNearby, normalizePlan, removePlanDay, removePlanVisit, reorderPlanVisit, replacePlanBusiness, setPlanDates, setPlanStay, transferVisit } from './tripPlan';
import { nextPendingInDay, nextPendingDay, rememberTravelPosition, setVisitProgress, tripChangeIdentity, visitProgress } from './tripProgress';
import { naverDirectionsUrl } from './placeDirections';
import { parseDurationMinutes } from './routeData';
import type { RouteWarning } from './routeWarnings';
import './trip-plan.css';
import './personal-trip-refinement.css';
import './trip-usability.css';

type Props = { journey: Journey; initialDay?: number; catalog: Place[]; savedPlaces: Place[]; onBack: () => void; onChange: (next: Journey) => boolean; onAddLandmark: () => void;
  onGuide?: (day: number) => void; onRefine?: (day: number) => void; onTrash?: () => void;
  onSaveBusiness:(place:Place)=>boolean;
  onCopy: () => void; onJournal: () => void; renderMap: (places: Place[], selected: string | undefined, onSelect: (id: string) => void, onResolveWarning?: (warning: RouteWarning) => void) => ReactNode };
export function PersonalTrip({ journey: input, initialDay = 1, catalog, savedPlaces, onBack, onChange, onAddLandmark, onCopy, onJournal, renderMap,onSaveBusiness,onGuide,onRefine,onTrash }: Props) {
  const copy=useUiCopy();
  const { locale, t } = useLocale();
  const en = locale === 'en';
  const journey = normalizePlan(input);
  const [selectedDay, setSelectedDay] = useState(() => journey.days.find(day => day.dayId === journey.travelProgress?.dayId)?.day ?? initialDay);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [planningSlot,setPlanningSlot]=useState<PlanningSlot|undefined>();
  const [removing, setRemoving] = useState<Place | null>(null);
  const [addingLandmark, setAddingLandmark] = useState(false);
  const [menu, setMenu] = useState<'trip'|'day'|null>(null);
  const [tripSettings, setTripSettings] = useState<{title:string;startDate:string}|null>(null);
  const [editing, setEditing] = useState<Place | null>(null);
  const [stayEditing,setStayEditing]=useState<Place|null>(null);
  const [transferring, setTransferring] = useState<Place | null>(null);
  const [targetDay, setTargetDay] = useState('');
  const [copyVisit, setCopy] = useState(false);
  const [linked, setLinked] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<string | undefined>(journey.travelProgress?.visitId);
  const [replacing, setReplacing] = useState<{ dayId: string; visitId: string; closerTo?: Place } | null>(null);
  const [warning, setWarning] = useState<RouteWarning | null>(null);
  const [undo, setUndo] = useState<{ previous: Journey; after: string;previousDay:number } | null>(null);
  const day = journey.days.find(day => day.day === selectedDay) ?? journey.days[0];
  const anchor = day?.places.find(place => place.visitId === anchorId);
  const replacementDay = journey.days.find(day => day.dayId === replacing?.dayId);
  const replacementTarget = replacementDay?.places.find(place => place.visitId === replacing?.visitId);
  const replacementIndex = replacementDay?.places.indexOf(replacementTarget!) ?? -1;
  const replacementAnchor = replacementDay?.places.find(place => place.visitId === replacementTarget?.anchorVisitId)
    ?? replacementDay?.places.slice(0, replacementIndex).reverse().find(place => place.kind === 'LANDMARK')
    ?? replacementDay?.places.find(place => place.kind === 'LANDMARK') ?? replacementTarget;
  const nextVisit = day && nextPendingInDay(journey, day);
  const nextDay = day && !nextVisit ? nextPendingDay(journey, day.dayId!) : undefined;
  const resolvedCount = day?.places.filter(place => visitProgress(journey, place.visitId) !== 'pending').length ?? 0;
  const warningVisit = journey.days.flatMap(day => day.places).find(place => place.visitId === warning?.visitId);
  const warningFrom = journey.days.flatMap(day => day.places).find(place => place.visitId === warning?.fromVisitId);
  useEffect(() => {
    const visitId = input.travelProgress?.visitId;
    if (!visitId) return;
    const frame = requestAnimationFrame(() => document.getElementById(`plan-visit-${visitId}`)?.scrollIntoView({ block: 'center' }));
    return () => cancelAnimationFrame(frame);
  }, [input.id]);
  const save = (value: Journey) => {
    const next=normalizePlan(value);
    const saved = onChange(next);
    if (saved) { setUndo({ previous: structuredClone(journey), after: tripChangeIdentity(next),previousDay:day?.day??1 }); setError(''); }
    else setError(copy("저장하지 못했어요. 이전 일정은 그대로예요."));
    setStatus(saved ? copy("변경한 일정을 저장했어요") : '');
    return saved;
  };
  const attempt = (operation: () => Journey, close?: () => void, focusDay?: string | number) => { try { let next=operation(); if(focusDay!==undefined){const target=next.days.find(item=>typeof focusDay==='number'?item.day===focusDay:item.dayId===focusDay);if(target)next=rememberTravelPosition(next,target.dayId!,nextPendingInDay(next,target)?.visitId);} if(save(next)){if(focusDay!==undefined)setSelectedVisit(next.travelProgress?.visitId);close?.();} } catch (error) { setError(error instanceof Error ? error.message : copy("변경하지 못했어요.")); } };
  if (!day) return <div className="page"><button onClick={onBack}>{copy("내 여행으로")}</button><p>{copy("일정을 확인할 수 없어요.")}</p></div>;
  const remove = (related: boolean) => { if (removing?.visitId) attempt(()=>removePlanVisit(journey,removing.visitId!,related),()=>setRemoving(null)); };
  const previousStay = journey.days.find(item=>item.day===day.day-1)?.places.find(place=>place.kind==='STAY');
  const routePlaces = previousStay ? [previousStay,...day.places] : day.places;
  const rememberPosition = (targetDay: typeof day, visitId?: string) => {
    try {
      if (!onChange(normalizePlan(rememberTravelPosition(journey, targetDay.dayId!, visitId)))) { setError(en ? 'Could not save your position.' : '진행 위치를 저장하지 못했어요.'); return false; }
      setSelectedDay(targetDay.day); setSelectedVisit(visitId); setError(''); return true;
    } catch { setError(en ? 'This stop has changed. Check your itinerary.' : '방문 위치가 바뀌었어요. 일정을 확인해 주세요.'); return false; }
  };
  const chooseVisit = (visitId: string) => { if (day.places.some(place => place.visitId === visitId) && !rememberPosition(day, visitId)) return; setSelectedVisit(visitId); document.getElementById(`plan-visit-${visitId}`)?.scrollIntoView({behavior:'smooth',block:'center'}); };
  const changeProgress = (place: Place, value: 'done' | 'skipped' | 'pending') => {
    try {
      const next = setVisitProgress(journey, day.dayId!, place.visitId!, value);
      if (!save(next)) return;
      setSelectedVisit(next.travelProgress?.visitId); setEditing(null);
      setStatus(en ? value === 'done' ? 'Visit completed.' : value === 'skipped' ? 'Visit skipped. You can restore it in the place menu.' : 'Visit restored.' : value === 'done' ? '방문 완료로 표시했어요.' : value === 'skipped' ? '건너뛰었어요. 장소 메뉴에서 되돌릴 수 있어요.' : '미방문으로 되돌렸어요.');
    } catch (error) { setError(error instanceof Error ? error.message : '진행을 저장하지 못했어요.'); }
  };
  const startReplacement = (place: Place, closerTo?: Place) => {
    const sourceDay = journey.days.find(item => item.places.some(visit => visit.visitId === place.visitId));
    if (!sourceDay) return;
    setEditing(null); setWarning(null); setReplacing({ dayId: sourceDay.dayId!, visitId: place.visitId!, closerTo }); setError('');
  };
  const openTransfer = (place: Place) => { setTransferring(place); setTargetDay(journey.days.find(item => item.dayId !== day.dayId)?.dayId ?? day.dayId!); setCopy(false); setLinked(true); setEditing(null); setWarning(null); };
  const closeMenu = () => { setMenu(null);setError(''); };
  const openMapVisit=(place:Place)=>{if(!rememberPosition(day, place.visitId))return;if(!hasLocation(place)){setEditing(structuredClone(place));return;}setSelectedVisit(place.visitId);setMapOpen(true);requestAnimationFrame(()=>document.getElementById('personal-route')?.scrollIntoView({behavior:'smooth',block:'start'}));};
  return <div className="personal-trip">
    <header className="editor-topbar"><button onClick={onBack} aria-label={copy("뒤로")}><ArrowLeft size={20}/></button><div><small>{t('personalPlan')}</small><strong>{journey.title}</strong></div><button aria-label={t('tripMenu')} onClick={()=>setMenu('trip')}><MoreHorizontal size={20}/></button></header>
    {journey.cover && <div className="plan-cover"><img src={journey.cover} alt=""/><div><span>{journey.region} · {t('private')}</span><h1>{journey.title}</h1><p>{journey.duration} · {journey.days.reduce((n,day)=>n+day.places.length,0)}{copy("곳")}</p></div></div>}
    <DayNavigation compact days={journey.days} selectedDay={day.day} onSelect={next=>{const target=journey.days.find(item=>item.day===next);if(target&&rememberPosition(target,nextPendingInDay(journey,target)?.visitId)){setAnchorId(null);}}} onBack={onBack}/>
    <section className="plan-day"><div className="section-heading"><div><h2>DAY {day.day}</h2>{!day.places.length && <p>{en ? 'Add places and nearby businesses to your day.' : copy("가고 싶은 곳과 주변 업체를 하나씩 채워보세요.")}</p>}</div><button className="plan-icon" aria-label={`DAY ${day.day} ${en?'menu':'메뉴'}`} onClick={()=>setMenu('day')}><MoreHorizontal size={20}/></button></div>
      <div className="phase-three-trip-tools">{onGuide && <button aria-label={t('guide')} onClick={() => onGuide(day.day)}><MapPin size={15}/>{en?'Guide':'여행 안내'}</button>}{onRefine && <button onClick={() => onRefine(day.day)}><Sparkles size={15}/>{t('reviseTrip')}</button>}<button className="plan-map-toggle" aria-label={en ? (mapOpen ? 'Hide map' : 'View route map') : (mapOpen?copy("지도 접기"):copy("이날의 동선 지도"))} aria-expanded={mapOpen} onClick={()=>setMapOpen(!mapOpen)}><MapIcon size={15}/>{en?(mapOpen?'Hide map':'Map'):(mapOpen?'지도 접기':'동선 지도')}</button></div>
      {journey.travelProgress && day.places.length > 0 && <div className="plan-travel-next">
        <p className="plan-help">{en ? `${resolvedCount}/${day.places.length} stops checked` : `${resolvedCount}/${day.places.length}곳 확인`}</p>
        {nextVisit ? <div><button className="outline" onClick={()=>chooseVisit(nextVisit.visitId!)}><ArrowRight size={14}/><span>{en ? 'Continue' : '이어서 방문'} · {nextVisit.name}</span></button><Button size="compact" variant="secondary" className="plan-next-complete" aria-label={`${nextVisit.name} · ${en?'Mark visited':'방문 완료'}`} onClick={()=>changeProgress(nextVisit,'done')}><CheckCircle2 size={14}/>{en?'Done':'완료'}</Button><a className="plan-directions-link" href={naverDirectionsUrl(nextVisit)} target="_blank" rel="noopener noreferrer" onClick={event=>{if(!rememberPosition(day,nextVisit.visitId))event.preventDefault();}} aria-label={`${nextVisit.name} · ${en ? 'Naver directions' : '네이버 길찾기'}`}><Navigation size={14}/>{en ? 'Directions' : '길찾기'}</a></div> : nextDay ? <button className="outline" onClick={()=>rememberPosition(nextDay,nextPendingInDay(journey,nextDay)?.visitId)}><ArrowRight size={14}/>{en ? `This day is checked · Continue DAY ${nextDay.day}` : `이 DAY 확인 끝 · DAY ${nextDay.day} 이어가기`}</button> : <p className="plan-help">{en ? 'All planned stops have been checked. You can restore visits from their menus.' : '모든 일정의 방문을 확인했어요. 장소 메뉴에서 미방문으로 되돌릴 수 있어요.'}</p>}
      </div>}
      {mapOpen && <div className="plan-route" id="personal-route">{renderMap(routePlaces,selectedVisit,chooseVisit,setWarning)}</div>}
      {previousStay && <button id={`plan-visit-${previousStay.visitId}`} className="plan-departure" onClick={()=>{setSelectedVisit(previousStay.visitId);setMapOpen(true);}}>1 · {previousStay.name}{copy("에서 출발")}</button>}
      <div className="plan-stops">{plannerTimeline(day).map(entry=>{
        if(entry.type==='gap')return <article className="plan-stop plan-timeline-gap" key={entry.gap.id}><small>{planningSlotLabel(entry.gap.slot,en)}</small><strong>{planningGapLabel(entry.gap,en)}</strong><p>{plannerVisitContext(day,entry,en)}</p><Button size="compact" variant="secondary" className="plan-local-action" onClick={()=>{const target=day.places.find(p=>p.visitId===(entry.gap.afterVisitId??entry.gap.beforeVisitId))??day.places.find(p=>p.kind==='LANDMARK');if(target){setPlanningSlot(entry.gap.slot);setAnchorId(target.visitId!);}else setAddingLandmark(true);}}><Plus size={14}/>{en?'Add a place':copy("장소 담기")}</Button></article>;
        const {place}=entry,index=day.places.indexOf(place);
        const KindIcon=place.kind==='FOOD'?Utensils:place.kind==='CAFE'?Coffee:place.kind==='STAY'?BedDouble:place.kind==='SHOP'?Store:MapPin;
        return <article key={place.visitId} id={`plan-visit-${place.visitId}`} className={`plan-stop ${place.anchorVisitId?'plan-stop-related':''} ${selectedVisit===place.visitId?'plan-stop-selected':''}`}>
        <button className="plan-stop-main plan-select-stop" onClick={()=>openMapVisit(place)} aria-label={`${place.name} ${hasLocation(place)?copy("지도에서 보기"):copy("장소 정보")}`}><span className="plan-stop-number">{index+1+(previousStay?1:0)}</span>{place.image?<img src={place.image} alt=""/>:<span className="plan-image-empty"><KindIcon size={22}/></span>}<span className="plan-stop-copy"><small className="ai-planner-kind" data-kind={place.kind}><KindIcon size={13} aria-hidden="true"/>{place.kind==='STAY'?`${copy("숙소")}${place.bookingFixed?copy(" · 예약 고정"):''}`:copy(place.kind==='FOOD'?"음식점":place.kind==='CAFE'?"카페":place.kind==='SHOP'?"로컬숍":"랜드마크")}</small><strong>{place.name}</strong><small>{place.address||copy("주소 확인 필요")}{!hasLocation(place)&&(en?' · Location unverified':' · 위치 미확인')}</small></span></button>
        <PhotoCredit image={place.image}/>
        {visitProgress(journey,place.visitId)!=='pending'&&<p className="plan-help plan-visit-state">{visitProgress(journey,place.visitId)==='done'?<CheckCircle2 size={14}/>:<SkipForward size={14}/>} {en ? visitProgress(journey,place.visitId)==='done'?'Visited':'Skipped' : visitProgress(journey,place.visitId)==='done'?'방문 완료':'건너뜀'}</p>}
        {place.planningSlot&&<p className="plan-help plan-timeline-context">{planningSlotLabel(place.planningSlot,en)}{place.kind!=='LANDMARK'&&plannerVisitContext(day,entry,en)?` · ${plannerVisitContext(day,entry,en)}`:''}</p>}
        {(place.time||place.note) && <p className="plan-help">{place.time && `${place.time} · `}{place.note}</p>}
        <div className="plan-stop-actions">{place.kind==='LANDMARK' && <button className="outline" onClick={()=>setAnchorId(place.visitId!)}><Plus size={16}/>{t('nearby')}</button>}<span/>{!place.anchorVisitId && place.kind!=='STAY' && <><button aria-label={`${place.name} · ${en?'Move up':'위로 이동'}`} disabled={index===0} onClick={()=>attempt(()=>reorderPlanVisit(journey,day.dayId!,place.visitId!,-1))}><ArrowUp size={16}/></button><button aria-label={`${place.name} · ${en?'Move down':'아래로 이동'}`} disabled={day.places.slice(index+1).every(next=>next.anchorVisitId===place.visitId||next.kind==='STAY')} onClick={()=>attempt(()=>reorderPlanVisit(journey,day.dayId!,place.visitId!,1))}><ArrowDown size={16}/></button></>}<button aria-label={`${place.name} · ${en?'Place menu':'장소 메뉴'}`} onClick={()=>{setEditing(structuredClone(place));setError('');}}><MoreHorizontal size={18}/></button></div>
      </article>})}</div>
      {!day.places.length && <div className="empty"><MapPin size={24}/><strong>{copy("이날 가고 싶은 곳을 담아보세요")}</strong><p>{copy("글을 작성하지 않아도 여행을 만들 수 있어요.")}</p></div>}
      <button className="outline wide" onClick={()=>setAddingLandmark(true)}><Plus size={17}/>{t('addLandmark')}</button>
      {undo && <button className="plan-undo" onClick={()=>{ if(tripChangeIdentity(journey)!==undo.after){setError(copy("이후 변경된 내용이 있어요. 현재 일정을 유지할게요."));return;} if(onChange(undo.previous)){setSelectedDay(undo.previousDay);setSelectedVisit(undo.previous.travelProgress?.visitId);setUndo(null);setStatus(copy("마지막 변경을 취소했어요."));setError('');}else setError(copy("취소 내용을 저장하지 못했어요.")); }}><Undo2 size={16}/>{copy("마지막 변경 취소")}</button>}
      {status && <p className="plan-help" role="status">{status}</p>}{error && <p className="ui-error" role="alert">{error}</p>}
      <button className="plan-journal-link" onClick={onJournal}>{t('writeJournal')}</button>
    </section>
    {anchor && <NearbyBusinessSheet journey={journey} dayId={day.dayId!} anchor={anchor} catalog={catalog} savedPlaces={savedPlaces} initialKind={planningSlot==='stay'?'STAY':planningSlot==='afternoon'?'CAFE':'FOOD'} slotLabel={planningSlot?planningSlotLabel(planningSlot,en):undefined} onClose={()=>{setAnchorId(null);setPlanningSlot(undefined);}} onAdd={(place,stay)=>{try{const next=stay?setPlanStay(journey,{...place,planningSlot:'stay'},stay.dayId,stay.nights,stay.fixed):planningSlot?applyPlannerSelections(journey,[],[{dayId:day.dayId!,anchorId:anchor.visitId!,place:{...place,planningSlot:place.kind==='FOOD'&&(planningSlot==='lunch'||planningSlot==='dinner')?planningSlot:place.kind==='CAFE'?'afternoon':undefined},nights:1}]):insertNearby(journey,day.dayId!,anchor.visitId!,place);if(!save(next))return en?'Could not add this place. Please try again.':'담지 못했어요. 다시 시도해 주세요.';setAnchorId(null);setPlanningSlot(undefined);return null;}catch(error){return error instanceof Error?error.message:copy("담지 못했어요.");}}}/>}
    {removing && <BottomSheet title={copy("일정에서 빼기")} description={en?`Remove ${removing.name} from this itinerary? Your saved place is kept.`:`${removing.name}을 일정에서 뺄까요? 저장한 장소는 유지돼요.`} onClose={()=>setRemoving(null)}><div className="plan-form"><Button onClick={()=>remove(false)}>{copy("이 장소만 빼기")}</Button>{day.places.some(place=>place.anchorVisitId===removing.visitId) && <Button variant="secondary" onClick={()=>remove(true)}>{copy("함께 담은 업체도 빼기")}</Button>}{error && <p role="alert">{error}</p>}</div></BottomSheet>}
    {addingLandmark && <BottomSheet title={en?`Add places to DAY ${day.day}`:`DAY ${day.day}에 장소 담기`} description={copy("저장한 랜드마크에서 고르세요.")} onClose={()=>setAddingLandmark(false)}><div className="plan-form plan-place-choices">{savedPlaces.filter(place=>place.kind==='LANDMARK').map(place=><button key={place.id} disabled={day.places.some(visit=>visit.id===place.id)} onClick={()=>attempt(()=>appendPlanLandmark(journey,day.dayId!,place),()=>setAddingLandmark(false))}>{place.image && <img src={place.image} alt=""/>}<span>{place.name}</span>{day.places.some(visit=>visit.id===place.id)?copy("담김"):copy("담기")}</button>)}{!savedPlaces.some(place=>place.kind==='LANDMARK') && <><p className="plan-help">{copy("장소를 먼저 저장하면 여기서 바로 담을 수 있어요.")}</p><button className="outline" onClick={onAddLandmark}>{copy("장소 둘러보기")}</button></>}{error && <p role="alert">{error}</p>}</div></BottomSheet>}
    {tripSettings && <BottomSheet title={copy("여행 이름과 날짜")} onClose={()=>setTripSettings(null)}><div className="plan-form"><Field label={copy("여행 이름")}><input value={tripSettings.title} onChange={event=>setTripSettings({...tripSettings,title:event.target.value})}/></Field><Field label={copy("출발 날짜 (선택)")}><input type="date" value={tripSettings.startDate} onInput={event=>setTripSettings({...tripSettings,startDate:event.currentTarget.value})} onChange={event=>setTripSettings({...tripSettings,startDate:event.target.value})}/></Field><Button disabled={!tripSettings.title.trim()} onClick={()=>attempt(()=>setPlanDates({...journey,title:tripSettings.title.trim()},tripSettings.startDate),()=>setTripSettings(null))}>{en ? 'Save changes' : copy("변경 저장")}</Button>{error&&<p role="alert">{error}</p>}</div></BottomSheet>}
    {menu && <BottomSheet title={menu==='trip'?(en ? 'Manage trip' : copy("내 여행 관리")):`DAY ${day.day} ${en ? 'settings' : copy("관리")}`} onClose={closeMenu}><div className="plan-form">{menu==='trip'?<><Button variant="secondary" onClick={()=>{closeMenu();setTripSettings({title:journey.title,startDate:journey.startDate??''});}}>{en ? 'Trip name and dates' : copy("여행 이름 · 날짜")}</Button><Button variant="secondary" onClick={onCopy}><Copy size={17}/>{en ? 'Copy trip' : copy("내 여행 복사")}</Button><Button variant="secondary" onClick={onJournal}>{en ? 'Write a journal' : copy("여행기로 남기기")}</Button>{onTrash && <Button variant="danger" onClick={() => {closeMenu();onTrash();}}><Trash2 size={16}/>{en ? 'Move to Trash' : copy("휴지통으로 이동")}</Button>}</>:<>
      <Button variant="secondary" disabled={journey.days.length>=30} onClick={()=>attempt(()=>addPlanDay(journey),()=>{setSelectedDay(journey.days.length+1);closeMenu();},journey.days.length+1)}>{en ? 'Add a day' : copy("DAY 추가")}</Button>
      {day.places.some(place=>place.kind==='STAY')&&<p className="plan-help">{copy("이 DAY를 복사하면 숙박 다음 날도 함께 추가해요. 새 숙박일의 예약 여부는 다시 확인해 주세요.")}</p>}
      <Button variant="secondary" disabled={journey.days.length>=30} onClick={()=>attempt(()=>copyPlanDay(journey,day.dayId!),()=>{setSelectedDay(journey.days.length+1);closeMenu();},journey.days.length+1)}>{en ? 'Copy this day' : copy("이 DAY 복사")}</Button>
      <p className="plan-help">{copy("DAY를 삭제하면 이 날짜의 장소도 빠져요. 현재 화면에서 마지막 변경 취소로 되돌릴 수 있어요.")}</p>
      <Button variant="danger" disabled={journey.days.length<=1} onClick={()=>attempt(()=>removePlanDay(journey,day.dayId!),()=>{setSelectedDay(Math.max(1,day.day-1));closeMenu();},Math.max(1,day.day-1))}>{en ? 'Remove this day' : copy("이 DAY 삭제")}</Button>
    </>}{error && <p className="ui-error" role="alert">{error}</p>}</div></BottomSheet>}
    {stayEditing&&<BottomSheet title={`${stayEditing.name} · ${en?'Add stay dates':'숙박일 추가'}`} onClose={()=>setStayEditing(null)}><div className="plan-form"><p className="plan-help">{copy("기존 숙박일은 유지하고, 선택한 날에도 이 숙소를 담아요.")}</p><StayForm journey={journey} dayId={day.dayId!} onSubmit={choice=>{try{if(!save(setPlanStay(journey,stayEditing,choice.dayId,choice.nights,choice.fixed)))return en?'Could not save.':'저장하지 못했어요.';setStayEditing(null);return null;}catch(error){return error instanceof Error?error.message:copy("숙박일을 확인해 주세요.");}}}/></div></BottomSheet>}
    {editing && <BottomSheet title={editing.name} onClose={()=>setEditing(null)}><div className="plan-form">
      <div className="plan-progress-options" role="group" aria-label={en ? 'Visit status' : '방문 상태'}>
        <Button size="compact" variant="secondary" aria-pressed={visitProgress(journey,editing.visitId)==='pending'} onClick={()=>changeProgress(editing,'pending')}><Undo2 size={14}/>{en?'Not visited':'미방문'}</Button>
        <Button size="compact" variant="secondary" aria-pressed={visitProgress(journey,editing.visitId)==='done'} onClick={()=>changeProgress(editing,'done')}><CheckCircle2 size={14}/>{en?'Visited':'완료'}</Button>
        <Button size="compact" variant="secondary" aria-pressed={visitProgress(journey,editing.visitId)==='skipped'} onClick={()=>changeProgress(editing,'skipped')}><SkipForward size={14}/>{en?'Skip':'건너뛰기'}</Button>
      </div>
      {(editing.kind==='FOOD'||editing.kind==='CAFE')&&<Button size="compact" variant="secondary" className="plan-local-action" onClick={()=>startReplacement(editing)}><RefreshCw size={14}/>{en ? 'Replace just this place' : '이 장소만 다른 곳으로 교체'}</Button>}
      <p className="plan-help">{editing.address||copy("주소 확인 필요")}{!hasLocation(editing)&&(en?' · Location unverified':' · 위치 미확인')}</p>
      <a className="plan-directions-link" href={naverDirectionsUrl(editing)} target="_blank" rel="noopener noreferrer"><Navigation size={14}/>{en ? 'Check in Naver Maps' : '네이버 지도에서 확인'}</a>
      <Field label={copy("메모 (선택)")}><textarea value={editing.note} onChange={event=>setEditing({...editing,note:event.target.value})} placeholder={copy("나중에 기억할 내용만 적어두세요.")} rows={3}/></Field>
      <Field label={copy("방문 시각 (선택)")}><input type="time" value={editing.time??''} onChange={event=>setEditing({...editing,time:event.target.value})}/></Field>
      {editing.kind!=='STAY'&&<Field label={en ? 'Planned time here · minutes (optional)' : '예상 체류시간 · 분 (선택)'}><input type="number" min={1} max={1440} step={1} value={parseDurationMinutes(editing.duration)??''} onChange={event=>setEditing({...editing,duration:event.target.value?`${Number(event.target.value)}분`:''})}/></Field>}
      {editing.kind==='STAY' && <label className="plan-check"><input type="checkbox" checked={editing.bookingFixed??false} onChange={event=>setEditing({...editing,bookingFixed:event.target.checked})}/>{copy("예약한 숙소로 고정")}</label>}
      <Button onClick={()=>attempt(()=>{if(/^[-+\d.eE]+분$/.test(editing.duration)){const minutes=Number(editing.duration.slice(0,-1));if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw new Error(en?'Enter a duration from 1 to 1440 minutes.':'체류시간은 1~1440분으로 입력해 주세요.');}return {...journey,days:journey.days.map(item=>({...item,places:item.places.map(place=>place.visitId===editing.visitId?editing:place)}))};},()=>setEditing(null))}>{en ? 'Save changes' : copy("변경 저장")}</Button>
      <Button variant="secondary" disabled={savedPlaces.some(place=>place.id===editing.id)} onClick={()=>{if(!onSaveBusiness(editing))setError(copy("장소를 저장하지 못했어요. 다시 시도해 주세요."));}}>{savedPlaces.some(place=>place.id===editing.id)?copy("저장한 장소"):copy("장소 저장")}</Button>
      {editing.anchorVisitId&&<Button variant="secondary" onClick={()=>attempt(()=>({...journey,days:journey.days.map(item=>({...item,places:item.places.map(place=>place.visitId===editing.visitId?{...place,anchorVisitId:undefined}:place)}))}),()=>setEditing(null))}>{copy("연결을 풀고 독립 방문으로")}</Button>}
      {editing.kind==='STAY'&&<Button variant="secondary" onClick={()=>{setStayEditing(editing);setEditing(null);}}>{copy("다른 숙박일에도 담기")}</Button>}
      {editing.kind!=='STAY' && <Button variant="secondary" onClick={()=>openTransfer(editing)}>{copy("다른 DAY로 이동 · 복사")}</Button>}
      <Button variant="danger" onClick={()=>{setRemoving(editing);setEditing(null);}}>{copy("일정에서 빼기")}</Button>
      {error && <p className="ui-error" role="alert">{error}</p>}
    </div></BottomSheet>}
    {replacementTarget && replacementDay && replacementAnchor && <NearbyBusinessSheet key={`replace:${replacementTarget.visitId}`} journey={journey} dayId={replacementDay.dayId!} anchor={replacementAnchor} catalog={catalog} savedPlaces={savedPlaces} replacing={replacementTarget} closerTo={replacing?.closerTo} initialKind={replacementTarget.kind} slotLabel={replacementTarget.planningSlot?planningSlotLabel(replacementTarget.planningSlot,en):undefined} onClose={()=>setReplacing(null)} onAdd={place=>{
      try { if(!save(replacePlanBusiness(journey,replacementDay.dayId!,replacementTarget.visitId!,place))) return en?'Could not replace this place. Your itinerary is kept.':'교체하지 못했어요. 원래 일정은 그대로예요.'; setReplacing(null); setSelectedVisit(replacementTarget.visitId); setStatus(en?'Replaced one place. The day, order and planned time are kept.':'한 곳만 교체했어요. DAY·순서·방문 시각은 유지했어요.'); return null; }
      catch(error){return error instanceof Error?error.message:'교체하지 못했어요.';}
    }}/>} 
    {warning && warningVisit && <BottomSheet title={en?'Review this connection':'이 구간 확인·수정'} description={warningFrom?`${warningFrom.name} → ${warningVisit.name}`:warningVisit.name} onClose={()=>setWarning(null)}><div className="plan-form">
      <p className="plan-help">{warning.code==='ESTIMATED_TIME_CONFLICT' ? en?`Estimated time is short by ${warning.shortfallMinutes} minutes. Actual travel conditions need checking.`:`추정 계산상 ${warning.shortfallMinutes}분 부족해요. 실제 이동 시간은 확인이 필요해요.` : warning.code==='LOCATION_UNVERIFIED' ? en?'The location is unverified. Check the saved address in Naver Maps.':'위치가 미확인이에요. 등록된 주소를 네이버 지도에서 확인해 주세요.' : warning.code==='TRAVEL_TIME_UNVERIFIED' ? en?'Walking time has not been verified. Adjustments do not verify the route.':'도보 경로·시간이 미확인이에요. 일정을 수정해도 실제 경로 확인은 별도로 필요해요.' : en?'Add visit times and planned durations to compare this connection.':'방문 시각과 체류시간을 넣으면 이 구간의 추정 시간을 비교할 수 있어요.'}</p>
      {warning.actions.includes('view-place')&&<Button size="compact" variant="secondary" className="plan-local-action" onClick={()=>{setEditing(structuredClone(warningVisit));setWarning(null);}}><MapPin size={14}/>{en?'View place information':'장소 정보 확인'}</Button>}
      {warning.actions.includes('edit-time')&&<>
        {warningFrom&&warningFrom.kind!=='STAY'&&<Button size="compact" variant="secondary" className="plan-local-action" onClick={()=>{setSelectedDay(journey.days.find(item=>item.places.some(place=>place.visitId===warningFrom.visitId))!.day);setEditing(structuredClone(warningFrom));setWarning(null);}}><Clock3 size={14}/>{warningFrom.name} · {en?'Edit time here':'체류시간 수정'}</Button>}
        <Button size="compact" variant="secondary" className="plan-local-action" onClick={()=>{setEditing(structuredClone(warningVisit));setWarning(null);}}><Clock3 size={14}/>{warningVisit.name} · {en?'Edit visit time':'방문 시각 수정'}</Button>
      </>}
      {warning.actions.includes('move-day')&&journey.days.length>1&&<Button size="compact" variant="secondary" className="plan-local-action" onClick={()=>openTransfer(warningVisit)}><ArrowRight size={14}/>{en?'Move this stop to another DAY':'이 장소를 다른 DAY로 이동'}</Button>}
      {warning.actions.includes('replace-business')&&<Button size="compact" variant="secondary" className="plan-local-action" onClick={()=>startReplacement(warningVisit,warningFrom)}><RefreshCw size={14}/>{en?'See closer candidates · straight-line distance':'가까운 후보 보기 · 직선거리 기준'}</Button>}
      <a className="plan-directions-link" href={naverDirectionsUrl(warningVisit)} target="_blank" rel="noopener noreferrer"><Navigation size={14}/>{en?'Check actual directions':'실제 길찾기 확인'}</a>
    </div></BottomSheet>}
    {transferring && <BottomSheet title={`${transferring.name} 이동·복사`} onClose={()=>setTransferring(null)}><div className="plan-form">
      <Field label={copy("대상 DAY")}><select value={targetDay} onChange={event=>setTargetDay(event.target.value)}>{journey.days.map(day=><option key={day.dayId} value={day.dayId}>DAY {day.day}</option>)}</select></Field>
      <label className="plan-check"><input type="checkbox" checked={copyVisit} onChange={event=>setCopy(event.target.checked)}/>{copy("원본을 남기고 복사")}</label>
      {day.places.some(place=>place.anchorVisitId===transferring.visitId) && <label className="plan-check"><input type="checkbox" checked={linked} onChange={event=>setLinked(event.target.checked)}/>{copy("함께 담은 업체도 이동·복사")}</label>}
      <p className="plan-help">{copy("장소에 연결한 기록도 함께 처리해요. 업체만 따로 옮기면 독립된 방문으로 남아요.")}</p>
      <Button disabled={!copyVisit&&targetDay===day.dayId} onClick={()=>attempt(()=>transferVisit(journey,day.dayId!,transferring.visitId!,targetDay,copyVisit,linked),()=>{setSelectedDay(journey.days.find(item=>item.dayId===targetDay)?.day??day.day);setTransferring(null);},targetDay)}>{copyVisit?copy("이 DAY에 복사"):copy("이 DAY로 이동")}</Button>
      {error && <p className="ui-error" role="alert">{error}</p>}
    </div></BottomSheet>}
  </div>;
}
