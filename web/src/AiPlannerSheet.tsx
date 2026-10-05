import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject, type ReactNode } from 'react';
import { withRequestDeadline } from './requestDeadline';
import { ArrowLeft, Check, ChevronDown, ChevronRight, MapPin, LockKeyhole, Plus, Sparkles, SlidersHorizontal, Utensils, BedDouble, Info, Coffee, Store, Images, X } from 'lucide-react';
import type { Journey, Place, PlaceKind, PlanningSlot, PlanningGap } from './data';
import { BottomSheet } from './BottomSheet';
import { LandmarkGuideCard } from './LandmarkGuideCard';
import { Button, Field } from './ui';
import { applyPlannerSelections, updatePlannerStayNights, upsertPlannerBusiness, plannerStayForDay, removePlannerBusiness, personalPlannerBusiness, type BusinessChoice, type PlannerBusinessForm } from './aiPlannerSelections';
import { catalogVersion, validatePlannerResult, defaultPlannerConditions, localAiPlannerAdapter, type AiPlannerAdapter, type PlannerConditions, type PlannerResult } from './aiPlanner';
import './ai-travel.css';
import './ai-planner.css';
import { useLocale } from './locale';
import { plannerText } from './aiPlanner';
import { readQuickPlannerPrompt, normalizeQuickPlannerConditions, dayBusinessSuggestions } from './aiPlannerQuickStart';
import { travelRegionOptions } from './aiTravelDraft';
import { PhotoCredit } from './PublicTourismCredit';
import { createAiPlannerDraftStore } from './aiPlannerDraft';
import { plannerTimeline, plannerVisitContext, planningSlotLabel, planningGapLabel } from './plannerTimeline';

export interface AiPlannerDraft { conditions: PlannerConditions; preview: PlannerResult | null; selectedDay: number; excludedVisits: string[]; businesses: BusinessChoice[]; businessForm?: PlannerBusinessForm }
export interface AiPlannerSheetProps { places: Place[]; savedPlaces: Place[]; author: string; draftRef: RefObject<AiPlannerDraft|null>; existingJourneyIds?:string[]; initialPrompt?: string; onClose: ()=>void; onCreate:(journey:Journey)=>string|null; onDraftNotice?:(message:string)=>void; adapter?:AiPlannerAdapter }
const period = (n:number,locale:'ko'|'en')=>locale==='en'?(n===1?'Day trip':`${n-1} nights, ${n} days`):n===1?'당일치기':`${n-1}박 ${n}일`;
const toggle = (ids:string[],id:string)=>ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];

function PlannerDisclosure({ icon, label, children }: {icon:ReactNode;label:string;children:ReactNode}) {
  return <details className="ai-planner-details"><summary>{icon}<span>{label}</span><ChevronDown className="ai-planner-chevron" size={16}/></summary><div className="ai-planner-disclosure-body">{children}</div></details>;
}

const plannerKinds = {
  LANDMARK: { icon: MapPin, ko: '랜드마크', en: 'Landmark' },
  FOOD: { icon: Utensils, ko: '음식점', en: 'Restaurant' },
  STAY: { icon: BedDouble, ko: '숙소', en: 'Stay' },
  CAFE: { icon: Coffee, ko: '카페', en: 'Cafe' },
  SHOP: { icon: Store, ko: '로컬숍', en: 'Shop' },
};

function PlannerKindBadge({ kind, locale }: { kind: PlaceKind; locale: 'ko' | 'en' }) {
  const category = plannerKinds[kind], Icon = category.icon;
  return <span className="ai-planner-kind" data-kind={kind}><Icon size={13} aria-hidden="true"/>{category[locale]}</span>;
}

function PlannerPlacePhoto({ place, className }: { place: Place; className: string }) {
  const Icon = plannerKinds[place.kind].icon;
  return <div className={className}>
    {place.image ? <img src={place.image} alt=""/> : <span className="ai-planner-photo-empty" data-kind={place.kind} aria-hidden="true"><Icon size={25}/></span>}
    <PhotoCredit image={place.image}/>
  </div>;
}

export function AiPlannerSheet({places,savedPlaces,author,draftRef,existingJourneyIds=[],initialPrompt='',onClose,onCreate,onDraftNotice,adapter=localAiPlannerAdapter}:AiPlannerSheetProps) {
  const { locale }=useLocale();
  const say=(text:string)=>plannerText(locale,text);
  const [draftStore]=useState(()=>createAiPlannerDraftStore());
  const draftContext={ownerId:'local-profile',catalog:places,savedPlaces,journeyIds:existingJourneyIds};
  const [restored]=useState(()=>draftStore.read(draftContext));
  const [initialDraft]=useState(()=>restored.status==='completed'?null:draftRef.current??restored.draft);
  const [draftWarning,setDraftWarning]=useState(restored.message);
  const [needsReset,setNeedsReset]=useState(restored.status==='corrupt'||restored.status==='unsupported');
  const [staleDraft,setStaleDraft]=useState(restored.status==='catalog-changed');
  const skipPersistence=useRef(false);
  const [conditions,setConditions]=useState<PlannerConditions>(()=>initialDraft?.preview?initialDraft.conditions:normalizeQuickPlannerConditions(initialDraft?.conditions??readQuickPlannerPrompt(initialPrompt,defaultPlannerConditions(),places)));
  const [preview,setPreview]=useState<PlannerResult|null>(initialDraft?.preview??null);
  const [selectedDay,setSelectedDay]=useState(initialDraft?.selectedDay??1);
  const [excludedVisits,setExcludedVisits]=useState<string[]>(initialDraft?.excludedVisits??[]);
  const [businesses,setBusinesses]=useState<BusinessChoice[]>(initialDraft?.businesses??[]);
  const [businessForm,setBusinessForm]=useState<PlannerBusinessForm|undefined>(initialDraft?.businessForm);
  const [editing,setEditing]=useState(Boolean(initialDraft?.businessForm));
  const [businessSlot,setBusinessSlot]=useState<PlanningSlot>(initialDraft?.businessForm?.planningSlot??'lunch');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[businessKind,setBusinessKind]=useState<'FOOD'|'CAFE'|'STAY'>(()=>initialDraft?.businessForm?.kind??(initialDraft?.conditions.suggestStay&&!initialDraft?.conditions.suggestFood?'STAY':'FOOD'));
  const [businessMode,setBusinessMode]=useState<'recommended'|'saved'|'search'>('recommended'),[search,setSearch]=useState(''),[anchorId,setAnchorId]=useState(''),[nights,setNights]=useState(1);
  const pending=useRef<AbortController|null>(null), sequence=useRef(0), saving=useRef(false);
  const surface=useRef<HTMLDivElement>(null);
  const previousDay=useRef(selectedDay);
  const showingPreview=Boolean(preview);
  useLayoutEffect(()=>{surface.current?.closest('.phase-sheet-body')?.scrollTo({top:0});},[showingPreview]);
  useLayoutEffect(()=>{if(previousDay.current!==selectedDay){previousDay.current=selectedDay;surface.current?.querySelector('.ai-planner-route')?.scrollIntoView({block:'start'});}},[selectedDay]);
  const registering=Boolean(businessForm);
  useLayoutEffect(()=>{if(registering)surface.current?.querySelector('.ai-planner-registration')?.scrollIntoView({block:'start'});},[registering]);
  const sourcesVersion=catalogVersion(conditions.mode==='saved'?savedPlaces:places);
  const currentVersion=useRef(sourcesVersion); currentVersion.current=sourcesVersion;
  useLayoutEffect(()=>{
    if(skipPersistence.current)return;
    const draft={conditions,preview,selectedDay,excludedVisits,businesses,businessForm};
    draftRef.current=draft;
    if(needsReset)return;
    const result=draftStore.write(draft,{ownerId:'local-profile',catalog:places,savedPlaces,journeyIds:existingJourneyIds});
    setDraftWarning(result.ok?(staleDraft?restored.message:''):result.message);
  },[draftRef,draftStore,conditions,preview,selectedDay,excludedVisits,businesses,businessForm,needsReset,staleDraft,places,savedPlaces,restored.message]);
  useEffect(()=>()=>{sequence.current++;pending.current?.abort();},[]);
  const cancel=()=>{sequence.current++;pending.current?.abort();pending.current=null;setBusy(false);};
  const close=()=>{cancel();onClose();};
  const change=(patch:Partial<PlannerConditions>)=>{cancel();setError('');setConditions(current=>normalizeQuickPlannerConditions({...current,...patch}));};
  const pool=conditions.mode==='saved'?savedPlaces:places.filter(place=>!place.personal);
  const candidates=useMemo(()=>[...new Map(pool.filter(p=>p.kind==='LANDMARK'&&(!conditions.region||p.area===conditions.region||p.area.startsWith(`${conditions.region} `))).map(p=>[p.id,p])).values()],[pool,conditions.mode,conditions.region]);
  const regions=travelRegionOptions(places.filter(p=>p.kind==='LANDMARK'&&!p.personal));
  const savedRegions=travelRegionOptions(savedPlaces.filter(p=>p.kind==='LANDMARK'));
  const quickPrompt=(prompt:string)=>change(readQuickPlannerPrompt(prompt,normalizeQuickPlannerConditions(conditions),places));
  const generate=async()=>{
    if(pending.current||saving.current||needsReset)return;
    if(conditions.mode==='region'&&!conditions.region){setError(locale==='en'?'Add a destination to your request or choose a region below.':'문장에 여행 지역을 적거나 아래에서 지역만 선택해 주세요.');return;}
    if(conditions.mode==='saved'&&!conditions.region&&savedRegions.length>1){setError(locale==='en'?'Your saved places span several regions. Choose one destination for this trip.':'저장 장소가 여러 지역에 있어요. 이번에 여행할 지역 하나만 골라 주세요.');return;}
    const controller=new AbortController(),requestId=crypto.randomUUID(),token=++sequence.current;
    pending.current=controller;setBusy(true);setError('');
    try {
      const request={requestId,sourceVersion:sourcesVersion,language:locale,selectedPlaceIds:candidates.map(p=>p.id),dayIds:[],lockedVisitIds:[],conditions:structuredClone(conditions),catalog:places,savedPlaces,author};
      const response=await withRequestDeadline(signal=>adapter.generate(request,signal),controller.signal);
      if(controller.signal.aborted||token!==sequence.current)return;
      const result=validatePlannerResult(request,response);
      if(controller.signal.aborted||token!==sequence.current)return;
      if(result.requestId!==requestId || result.sourceVersion!==currentVersion.current) {setError('장소 자료가 바뀌었어요. 다시 만들어 주세요.');return;}
      setPreview(result);setSelectedDay(1);setExcludedVisits([]);setBusinesses([]);setBusinessForm(undefined);setAnchorId('');setBusinessKind('FOOD');setBusinessSlot('lunch');setEditing(false);setStaleDraft(false);
    } catch(cause) {if(!controller.signal.aborted&&token===sequence.current)setError(cause instanceof Error?cause.message:'초안을 만들지 못했어요. 다시 시도해 주세요.');}
    finally {if(token===sequence.current){setBusy(false);pending.current=null;}}
  };
  const selectedJourney=useMemo(()=>preview?applyPlannerSelections(preview.data.journey,excludedVisits,businesses):null,[preview,excludedVisits,businesses]);
  const day=preview?.data.journey.days.find(d=>d.day===selectedDay);
  const selectedRoute=selectedJourney?.days.find(d=>d.day===selectedDay);
  const selectedStayInfo=day&&preview?plannerStayForDay(businesses,preview.data.journey,day.dayId!):null;
  const selectedStay=selectedStayInfo?.choice;
  const stayNights=selectedStayInfo?.remainingNights??nights;
  const selectedAnchors=day?.places.filter(p=>p.kind==='LANDMARK'&&!excludedVisits.includes(p.visitId!))??[];
  const businessPool=[...new Map([...places,...savedPlaces].map(p=>[p.id,p])).values()];
  const businessCandidates=dayBusinessSuggestions(anchorId?selectedAnchors.filter(p=>p.visitId===anchorId):selectedAnchors,businessPool,businessKind,businessMode==='saved'?new Set(savedPlaces.map(p=>p.id)):undefined,businessMode==='search'?search:'');
  const chooseBusiness=(place:Place,anchor:Place)=>{
    if(!preview||!day?.dayId||!anchor.visitId)return false;
    try {
      const next=upsertPlannerBusiness(businesses,preview.data.journey,{dayId:day.dayId,anchorId:anchor.visitId,place:{...place,planningSlot:businessForm?.planningSlot??businessSlot},nights:stayNights});
      applyPlannerSelections(preview.data.journey,excludedVisits,next);
      setBusinesses(next);setError('');return true;
    }catch(cause){setError(cause instanceof Error?cause.message:'업체를 담지 못했어요.');return false;}
  };
  const editBusiness=(kind:'FOOD'|'CAFE'|'STAY',slot:PlanningSlot,anchor?:string)=>{setEditing(true);setBusinessKind(kind);setBusinessSlot(slot);setAnchorId(anchor??'');setBusinessMode('recommended');requestAnimationFrame(()=>surface.current?.querySelector('.ai-planner-business-section')?.scrollIntoView({block:'start',behavior:'smooth'}));};
  const editGap=(gap:PlanningGap)=>{const anchor=selectedAnchors.find(p=>p.visitId===(gap.afterVisitId??gap.beforeVisitId))??selectedAnchors[0];editBusiness(gap.kind,gap.slot,anchor?.visitId);if(gap.reason==='booked'&&day?.dayId&&anchor?.visitId)setBusinessForm({dayId:day.dayId,anchorId:anchor.visitId,kind:'STAY',name:'',address:'',planningSlot:'stay'});};
  const removeBusiness=(place:Place)=>{
    if(!preview||!day?.dayId||place.bookingFixed)return;
    setBusinesses(current=>removePlannerBusiness(current,preview.data.journey,day.dayId!,place.id,place.planningSlot));
    const original=day.places.filter(p=>p.kind===place.kind&&p.planningSlot===place.planningSlot&&p.kind!=='LANDMARK').map(p=>p.visitId!);
    setExcludedVisits(current=>[...new Set([...current,...original])]);
  };
  const changeNights=(value:number)=>{
    if(!preview||!day?.dayId)return;
    try{const next=updatePlannerStayNights(businesses,preview.data.journey,day.dayId!,value);applyPlannerSelections(preview.data.journey,excludedVisits,next);setNights(value);setBusinesses(next);setError('');}catch(cause){setError(cause instanceof Error?cause.message:'숙박 기간을 확인해 주세요.');}
  };
  const registerBusiness=()=>{
    const anchor=selectedAnchors.find(place=>place.visitId===businessForm?.anchorId);
    if(!businessForm||businessForm.dayId!==day?.dayId||!anchor){setError(locale==='en'?'Choose a landmark for this business.':'업체를 연결할 랜드마크를 골라 주세요.');return;}
    try{const place=personalPlannerBusiness(businessForm,anchor);if(businessForm.kind==='STAY'&&day.planningGaps?.some(g=>g.reason==='booked'&&g.kind==='STAY'))place.bookingFixed=true;if(chooseBusiness(place,anchor)){setBusinessForm(undefined);setError('');}}catch(cause){setError(cause instanceof Error?cause.message:'업체를 담지 못했어요.');}
  };
  const save=()=>{
    if(!selectedJourney||!preview||saving.current||needsReset||businessForm)return;
    const savedDraftState=draftStore.read(draftContext);
    if(staleDraft||savedDraftState.status==='catalog-changed'||preview.sourceVersion!==sourcesVersion||preview.data.compositionVersion!==2){setStaleDraft(true);setError('초안을 다시 확인해야 해요. 조건으로 돌아가 다시 만들어 주세요.');return;}
    if(!selectedJourney.days.some(d=>d.places.length)){setError('포함할 장소를 한 곳 이상 선택해 주세요.');return;}
    saving.current=true;setError('');
    try {if(onCreate(structuredClone(selectedJourney))) {skipPersistence.current=true;draftRef.current=null;const cleared=draftStore.clear('local-profile');if(!cleared.ok)onDraftNotice?.(locale==='en'?'Your trip was saved. The old draft could not be cleared, but it will not be saved twice.':'여행은 저장했어요. 이전 초안 정리가 지연됐지만 중복으로 저장하지 않아요.');close();} else {saving.current=false;setError('저장하지 못했어요. 선택한 초안을 유지했으니 다시 시도해 주세요.');}}
    catch {saving.current=false;setError('저장하지 못했어요. 초안은 그대로 유지했어요.');}
  };
  return <BottomSheet title={say(preview?'여행 초안 확인':'AI 여행 만들기')} description={say("등록 장소 추천 샘플 · 실제 AI 연결 전")} onClose={close}>
    <div className="ai-planner" ref={surface}>
    {draftWarning&&<p className="ai-planner-note" role="status">{locale==='en'?(staleDraft?'Your draft was restored. Place data has changed; generate a fresh preview before saving.':needsReset?'The existing draft could not be read and has not been overwritten. Start a new draft to continue.':'Draft storage is unavailable. Keep this page open to retain your input.'):draftWarning}</p>}
    {needsReset&&<Button size="compact" variant="secondary" onClick={()=>{const cleared=draftStore.clear('local-profile');if(cleared.ok){setNeedsReset(false);setDraftWarning('');}else setDraftWarning(cleared.message);}}>{locale==='en'?'Start a new draft':'새 초안으로 시작'}</Button>}
    {!preview?<form className="ai-travel-form" onSubmit={event=>{event.preventDefault();void generate();}}>
      <div className="ai-planner-tabs" aria-label={say("추천 방식")}>{([['region','지역·취향 추천'],['saved','저장 장소로 추천']] as const).map(([mode,label])=><button type="button" key={mode} aria-pressed={conditions.mode===mode} onClick={()=>change({mode,region:(mode==='saved'?savedRegions:regions).includes(conditions.region)?conditions.region:''})}>{say(label)}</button>)}</div>
      <Field label={say("어떤 여행을 하고 싶으세요?")} hint={locale==='en'?"Describe your destination, trip length and preferences. This is a local sample using registered places, not a live AI response.":"지역·기간·취향을 적으면 등록된 장소에서 골라요. 실제 AI 답변이 아닌 조건 기반 미리보기예요."}>
        <textarea rows={4} value={conditions.prompt} maxLength={1000} placeholder={locale==='en'?"Busan for 2 days. I'd like to see the sea, skip cafes and walk less.":"부산에서 1박 2일, 바다를 보고 싶어요. 카페는 빼고 많이 걷지 않았으면 좋겠어요."} onChange={e=>quickPrompt(e.target.value)}/>
      </Field>
      {!conditions.prompt&&<button type="button" className="phase-search-reset ai-travel-example" onClick={()=>quickPrompt(conditions.mode==='saved'?(locale==='en'?'Use my saved places for 2 days and skip cafes.':'저장한 장소로 1박 2일, 카페는 빼고 여유롭게 여행하고 싶어요.'):(locale==='en'?'Busan for 2 days. See the sea and skip cafes.':'부산 1박 2일, 바다를 보고 카페는 빼고 덜 걷고 싶어요.'))}>{locale==='en'?'Use an example':'예시 문장 넣기'}<ChevronRight size={14}/></button>}
      <div className="ai-travel-conditions">
        <Field label={say("여행 지역")}><select value={conditions.region} onChange={e=>change({region:e.target.value})}><option value="">{say("지역 선택")}</option>{(conditions.mode==='saved'?savedRegions:regions).map(region=><option key={region}>{region}</option>)}</select></Field>
        <Field label={say("여행 기간")}><select value={conditions.dayCount>=1&&conditions.dayCount<=7?conditions.dayCount:''} onChange={e=>change({dayCount:Number(e.target.value)})}><option value="" disabled>{locale==='en'?'Choose a duration':'기간 선택'}</option>{Array.from({length:7},(_,i)=><option key={i} value={i+1}>{period(i+1,locale)}</option>)}</select></Field>
        <Field label={say("여행 속도")}><select value={conditions.pace} onChange={e=>change({pace:e.target.value as PlannerConditions['pace']})}><option value="slow">{say("여유롭게")}</option><option value="balanced">{say("적당히")}</option><option value="full">{say("알차게")}</option></select></Field>
        <Field label={locale==='en'?'Transport · route unverified':'이동수단 · 경로 검증 전'}><select value={conditions.transport} onChange={e=>change({transport:e.target.value as PlannerConditions['transport']})}><option value="undecided">{say("미정")}</option><option value="walk">{say("도보")}</option><option value="transit">{say("대중교통")}</option><option value="car">{say("자동차")}</option></select></Field>
      </div>
      {error&&<p className="ui-error" role="alert">{say(error)}</p>}
      <Button type="submit" loading={busy} disabled={needsReset||(conditions.mode==='region'&&!conditions.prompt.trim()&&!conditions.region)}><Sparkles size={17}/>{locale==='en'?'Create draft':'초안 만들기'}</Button>
      {busy&&<Button type="button" size="compact" variant="ghost" className="ai-planner-cancel" onClick={cancel}>{say("생성 취소 · 입력 유지")}</Button>}
    </form>:<div className="ai-travel-preview">
      <Button size="compact" variant="secondary" className="ai-planner-back" onClick={()=>{cancel();setConditions(current=>normalizeQuickPlannerConditions(current));setPreview(null);setError('');}}><ArrowLeft size={16}/>{say("조건 바꾸기")}</Button>
      <h3>{preview.data.journey.title}</h3><p className="ai-planner-note">{period(conditions.dayCount,locale)} · {locale==='en'?'Your route is ready to review and save. Change only what you need.':'요청에 맞춰 하루 흐름을 만들었어요. 그대로 저장하고 필요한 곳만 바꿔보세요.'}</p>
      {selectedJourney?.days.some(d=>d.planningGaps?.some(g=>g.reason==='missing-data'))&&<p className="frontend-partial-note" role="status">{locale==='en'?'Some requested places have no matching registered candidates. Those stops are marked in the route. Save this draft and add them later.':'일부 요청은 맞는 등록 장소가 없어 일정에 빈자리로 표시했어요. 지금 초안을 저장하고 상세에서 채울 수 있어요.'}</p>}
      <Button size="compact" variant="secondary" className="ai-planner-edit-toggle" disabled={Boolean(businessForm)} aria-pressed={editing} onClick={()=>setEditing(value=>!value)}>{editing?<Check size={15}/>:<SlidersHorizontal size={15}/>}{locale==='en'?(editing?'Done editing':'Edit itinerary'):(editing?'수정 완료':'일정 수정')}</Button>
      <div className="phase-day-options ai-travel-day-options">{preview.data.journey.days.map(item=><button key={item.dayId} className={selectedDay===item.day?'active':''} aria-pressed={selectedDay===item.day} disabled={Boolean(businessForm)} onClick={()=>{setSelectedDay(item.day);setAnchorId('');setNights(1);}}>DAY {item.day}<small>{selectedJourney?.days.find(d=>d.day===item.day)?.places.length??0} {say('곳')}</small></button>)}</div>
      <section className="ai-planner-route" aria-label={locale==='en'?`DAY ${selectedDay} visit order`:`DAY ${selectedDay} 방문 순서`}>
        <div className="ai-planner-section-heading"><h4>{locale==='en'?`DAY ${selectedDay} route`:`DAY ${selectedDay} 하루 흐름`}</h4><span>{locale==='en'?'Suggested parts of day · times unverified':'시간대 제안 · 이동·운영 시간 확인 전'}</span></div>
        <ol>{selectedRoute&&plannerTimeline(selectedRoute).map(entry=>{
          if(entry.type==='gap')return <li key={entry.gap.id} className="ai-planner-gap"><span className="ai-planner-slot">{planningSlotLabel(entry.gap.slot,locale==='en')}</span><div className="ai-planner-route-copy"><PlannerKindBadge kind={entry.gap.kind} locale={locale}/><strong>{planningGapLabel(entry.gap,locale==='en')}</strong><small>{plannerVisitContext(selectedRoute,entry,locale==='en')}</small>{entry.gap.reason==='booked'&&<small>{locale==='en'?'Your existing booking remains unchanged.':'새 숙소를 추천하지 않고 예약을 유지해요.'}</small>}</div>{editing&&selectedAnchors.length>0&&<Button size="compact" variant="secondary" disabled={Boolean(businessForm)} onClick={()=>editGap(entry.gap)}><Plus size={14}/>{entry.gap.reason==='booked'?(locale==='en'?'Enter booking':'예약 숙소 입력'):(locale==='en'?'Add':'담기')}</Button>}</li>;
          const {place}=entry;
          return <li key={place.visitId}>
            <span className="ai-planner-slot">{place.planningSlot?planningSlotLabel(place.planningSlot,locale==='en'):selectedRoute.places.indexOf(place)+1}</span>
            <PlannerPlacePhoto place={place} className="ai-planner-route-photo"/>
            <div className="ai-planner-route-copy">
              <PlannerKindBadge kind={place.kind} locale={locale}/>
              <strong>{place.name}</strong>
              {place.kind==='STAY'&&<small>DAY {selectedDay} {locale==='en'?'overnight':'숙박'}{place.bookingFixed?(locale==='en'?' · Booked':' · 예약 고정'):''}</small>}
              {place.personal&&<small>{locale==='en'?'Location unverified':'위치 확인 필요'}</small>}
              {place.kind!=='LANDMARK'&&<small>{plannerVisitContext(selectedRoute,entry,locale==='en')}</small>}
              {editing&&place.kind!=='LANDMARK'&&place.kind!=='SHOP'&&!place.bookingFixed&&<div className="ai-planner-row-actions"><Button size="compact" variant="secondary" disabled={Boolean(businessForm)} onClick={()=>editBusiness(place.kind as 'FOOD'|'CAFE'|'STAY',place.planningSlot??'lunch',place.anchorVisitId)}><SlidersHorizontal size={14}/>{locale==='en'?'Change':'바꾸기'}</Button><button className="ai-planner-remove" disabled={Boolean(businessForm)} aria-label={`${place.name} ${place.planningSlot?planningSlotLabel(place.planningSlot,locale==='en'):''} ${locale==='en'?'remove':'빼기'}`} onClick={()=>removeBusiness(place)}><X size={16}/></button></div>}
            </div>
          </li>;
        })}</ol>
        {!selectedRoute?.places.length&&<p className="ai-planner-note">{locale==='en'?'This day is open. Include a landmark from the details below.':'비워 둔 날이에요. 아래 장소 상세에서 랜드마크를 포함할 수 있어요.'}</p>}
      </section>
      {editing&&<section className="ai-planner-business-section" aria-label={say("음식점·숙소 보완하기")}>
        <div className="ai-planner-section-heading"><h4>{locale==='en'?'Along this day’s route':'이날 함께 들를 곳'}</h4><span>{locale==='en'?'Optional':'선택 사항'}</span></div>
        <div className="ai-planner-tabs"><button disabled={Boolean(businessForm)} aria-pressed={businessKind==='FOOD'} onClick={()=>{setBusinessKind('FOOD');setBusinessSlot('lunch');}}><Utensils size={14}/>{say("음식점")}</button><button disabled={Boolean(businessForm)} aria-pressed={businessKind==='CAFE'} onClick={()=>{setBusinessKind('CAFE');setBusinessSlot('afternoon');}}><Coffee size={14}/>{locale==='en'?'Cafe':'카페'}</button><button disabled={Boolean(businessForm)} aria-pressed={businessKind==='STAY'} onClick={()=>{setBusinessKind('STAY');setBusinessSlot('stay');}}><BedDouble size={14}/>{say("숙소")}</button></div>
        {businessKind==='FOOD'&&<div className="ai-planner-tabs" aria-label={locale==='en'?'Meal to change':'수정할 식사'}>{(['lunch','dinner'] as const).map(slot=><button key={slot} disabled={Boolean(businessForm)} aria-pressed={businessSlot===slot} onClick={()=>setBusinessSlot(slot)}>{planningSlotLabel(slot,locale==='en')}</button>)}</div>}
        {!businessForm&&<p className="ai-planner-note">{locale==='en'?'Registered samples within 15 km of this day’s landmarks. Add only what you like.':'이날 랜드마크 주변 15km 이내 등록 샘플이에요. 마음에 드는 곳만 담으세요.'}</p>}
        {!businessForm&&<PlannerDisclosure icon={<SlidersHorizontal size={16}/>} label={locale==='en'?'Filter or search candidates':'후보 필터·검색'}><div className="ui-stack">
          <Field label={say("기준 랜드마크")}><select value={anchorId} onChange={e=>setAnchorId(e.target.value)}><option value="">{locale==='en'?'All landmarks on this day':'이날 랜드마크 전체'}</option>{selectedAnchors.map(p=><option key={p.visitId} value={p.visitId}>{p.name}</option>)}</select></Field>
          <div className="ai-planner-tabs">{([['recommended','주변 후보'],['saved','저장한 업체'],['search','직접 검색']] as const).map(([mode,label])=><button key={mode} aria-pressed={businessMode===mode} onClick={()=>setBusinessMode(mode)}>{say(label)}</button>)}</div>
          {businessMode==='search'&&<Field label={say("등록 업체 검색")}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={say("업체명·주소")}/></Field>}
        </div></PlannerDisclosure>}
        {businessKind==='STAY'&&selectedDay<conditions.dayCount&&<Field label={say("숙박 기간")} hint={`${selectedStay?`${selectedStay.place.name} · `:''}DAY ${selectedDay}${locale==='en'?' onward':'부터 숙박'}`}><select value={stayNights} onChange={e=>changeNights(Number(e.target.value))}>{Array.from({length:conditions.dayCount-selectedDay},(_,i)=><option key={i} value={i+1}>{i+1}{locale==='en'?' nights':'박'}</option>)}</select></Field>}
        {!businessForm&&(businessKind==='STAY'&&selectedDay===conditions.dayCount?<p className="ai-planner-empty"><BedDouble size={20}/>{say("당일 여행과 마지막 DAY에는 숙박을 추가하지 않아요.")}</p>:!businessCandidates.length?<p className="ai-planner-empty"><MapPin size={20}/>{locale==='en'?'No registered candidates match. Try another name or add a place you know below.':'조건에 맞는 등록 후보가 없어요. 다른 이름으로 찾거나 아는 곳을 바로 담아보세요.'}</p>:businessCandidates.map(({place,anchor,km})=>{
          const selected=selectedRoute?.places.some(p=>p.id===place.id&&p.planningSlot===businessSlot);
          return <article className="ai-planner-business" key={place.id}>
            <PlannerPlacePhoto place={place} className="ai-planner-business-media"/>
            <div className="ai-planner-business-copy"><PlannerKindBadge kind={place.kind} locale={locale}/><strong>{place.name}</strong><p>{anchor.name} · {locale==='en'?'straight line':'직선'} {km<1?`${Math.round(km*1000)}m`:`${km.toFixed(1)}km`}</p><p>{place.description}</p><Button size="compact" variant="secondary" disabled={Boolean(businessForm)||selectedRoute?.places.some(p=>p.kind==='STAY'&&p.bookingFixed)&&place.kind==='STAY'} aria-pressed={selected} onClick={()=>selected?removeBusiness(selectedRoute!.places.find(p=>p.id===place.id&&p.planningSlot===businessSlot)!):chooseBusiness(place,anchor)}>{selected?<Check size={14}/>:<Plus size={14}/>}{selected?(locale==='en'?'Added · remove':'담김 · 해제'):`${planningSlotLabel(businessSlot,locale==='en')} ${locale==='en'?'· use this place':'여기로 변경'}`}</Button></div>
          </article>;
        }))}
        {selectedAnchors.length>0&&(businessKind!=='STAY'||selectedDay<conditions.dayCount)&&(businessForm?<div className="ai-planner-registration ui-stack">
          <div className="ai-planner-section-heading"><h4>{locale==='en'?'Add a place you know':'아는 업체 직접 담기'}</h4><Button size="compact" variant="ghost" onClick={()=>{setBusinessForm(undefined);setError('');}}><X size={14}/>{locale==='en'?'Cancel':'취소'}</Button></div>
          <Field label={say('기준 랜드마크')}><select value={businessForm.anchorId} onChange={e=>setBusinessForm({...businessForm,anchorId:e.target.value})}>{selectedAnchors.map(place=><option key={place.visitId} value={place.visitId}>{place.name}</option>)}</select></Field>
          <Field label={locale==='en'?'Business name':'업체명'}><input value={businessForm.name} maxLength={80} onChange={e=>setBusinessForm({...businessForm,name:e.target.value})}/></Field>
          <Field label={locale==='en'?'Address':'주소'}><input value={businessForm.address} maxLength={200} onChange={e=>setBusinessForm({...businessForm,address:e.target.value})}/></Field>
          <p className="ai-planner-note">{locale==='en'?'Only added to your trip. Location and distance remain unverified.':'내 여행에만 담겨요. 위치 확인 전에는 지도와 거리가 표시되지 않아요.'}</p>
          <Button size="compact" variant="secondary" disabled={!businessForm.name.trim()||!businessForm.address.trim()} onClick={registerBusiness}><Plus size={14}/>{locale==='en'?`Add to DAY ${selectedDay}`:`DAY ${selectedDay}에 담기`}</Button>
        </div>:<Button size="compact" variant="secondary" className="ai-planner-register" onClick={()=>setBusinessForm({dayId:day!.dayId!,anchorId:anchorId||selectedAnchors[0].visitId!,kind:businessKind,name:search,address:'',planningSlot:businessSlot})}><Plus size={14}/>{locale==='en'?'Add a place you know':'아는 업체 직접 담기'}</Button>)}
      </section>}
      <PlannerDisclosure icon={<Images size={16}/>} label={locale==='en'?'Landmark photos and details':'장소 사진·상세 보기'}>
      <div className="ui-stack">{day?.places.filter(place=>place.kind==='LANDMARK').map(place=>{
        const fixed=Boolean(place.bookingFixed)||conditions.requiredIds.includes(place.id),included=!excludedVisits.includes(place.visitId!);
        return <LandmarkGuideCard key={place.visitId} place={place} footer={<div className="ai-planner-evidence"><p>{preview.data.reasons[place.id]}</p><p>{say('체류')} {place.duration||say('직접 정하기')}</p></div>} actions={editing?<Button size="card" variant="secondary" disabled={fixed||Boolean(businessForm)} aria-pressed={included} className={included?'is-included':''} onClick={()=>{setExcludedVisits(toggle(excludedVisits,place.visitId!));setBusinesses(current=>current.filter(choice=>choice.anchorId!==place.visitId));if(anchorId===place.visitId)setAnchorId('');}}>{fixed?<LockKeyhole size={14}/>:included?<Check size={14}/>:<Plus size={14}/>}{say(fixed?'필수·고정 장소':included?'일정에 포함됨':'일정에 포함')}</Button>:undefined}/>;
      })}{!day?.places.length&&<p className="ai-planner-note">{say("이 DAY는 비워 두었어요. 생성 후 원하는 장소를 담을 수 있어요.")}</p>}</div>
      </PlannerDisclosure>
      <PlannerDisclosure icon={<Info size={16}/>} label={say("추천 근거·확인할 내용")}><ul>{preview.warnings.map(warning=><li key={warning}>{say(warning)}</li>)}</ul><p className="ai-planner-note">{preview.sources.map(s=>s.label).join(' · ')}</p>{preview.unplaced.map(item=><p className="ai-planner-note" key={item.placeId}>{preview.data.alternatives.find(p=>p.id===item.placeId)?.name}: {item.reason}</p>)}</PlannerDisclosure>
      {error&&<p className="ui-error" role="alert">{say(error)}</p>}
      <div className="ai-planner-save">{businessForm&&<p className="ai-planner-note">{locale==='en'?'Add or cancel the business entry to save your trip.':'작성한 업체를 담거나 취소하면 여행을 저장할 수 있어요.'}</p>}<Button disabled={Boolean(businessForm)||needsReset} onClick={save}><Check size={16}/>{say('내 여행에 저장')} · {selectedJourney?.days.reduce((sum,item)=>sum+item.places.length,0)} {say('곳')}</Button></div>
    </div>}
    </div>
  </BottomSheet>;
}
