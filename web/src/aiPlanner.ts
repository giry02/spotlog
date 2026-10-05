import type { Journey, Place } from './data';
import { buildPersonalPlan, distanceBetween, hasLocation, setPlanDates } from './tripPlan.ts';
import { readPlannerIntent, type PlannerIntent } from './plannerIntent.ts';
import { chosenPlannerRegion, composePlannerItinerary, isPlannerRegion, planningSlots, reanchorPlannerGaps, requestedDaySlots, spatialPlannerOrder } from './itineraryComposer.ts';

export interface AiContext { requestId: string; sourceVersion: string; language: 'ko' | 'en'; selectedPlaceIds: string[]; dayIds: string[]; lockedVisitIds: string[] }
export interface AiSource { id: string; label: string; url?: string; checkedAt: string | null; sourceVersion: string }
export interface AiEnvelope<T> { requestId: string; sourceVersion: string; mock: boolean; data: T; sources: AiSource[]; warnings: string[]; unplaced: { placeId: string; reason: string }[] }
export interface AiGuideRequest extends AiContext { journey: Journey; dayId: string; question: string; placeId?: string; visitId?: string }
export interface AiTranslationRequest extends AiContext { sourceId: string; text: string; glossaryVersion: string }
export interface GuideAdapter { answer(request: AiGuideRequest, signal?: AbortSignal): Promise<AiEnvelope<{ text: string }>> }
export interface TranslationAdapter { translate(request: AiTranslationRequest, signal?: AbortSignal): Promise<AiEnvelope<{ text: string; status: 'sample' | 'reviewed' | 'unavailable' }>> }
export type AiFailureCode = '401' | '403' | '429' | '500' | 'timeout' | 'empty' | 'invalid' | 'stale';
export class AiPlannerError extends Error {
  code: AiFailureCode;
  constructor(code: AiFailureCode, message: string) { super(message); this.name = 'AiPlannerError'; this.code = code; }
}
export interface PlannerConditions {
  mode: 'region' | 'saved'; region: string; dayCount: number; startDate: string; prompt: string;
  pace: 'slow' | 'balanced' | 'full'; transport: 'undecided' | 'walk' | 'transit' | 'car';
  arrival: string; departure: string; walking: 'normal' | 'less'; companions: string; meals: string; accessibility: string;
  requiredIds: string[]; excludedIds: string[]; fixedIds: string[]; suggestFood: boolean; suggestStay: boolean;
}
export const defaultPlannerConditions = (): PlannerConditions => ({ mode: 'region', region: '', dayCount: 2, startDate: '', prompt: '', pace: 'balanced', transport: 'undecided', arrival: '', departure: '', walking: 'normal', companions: '', meals: '', accessibility: '', requiredIds: [], excludedIds: [], fixedIds: [], suggestFood: false, suggestStay: false });
export interface PlannerRequest extends AiContext { conditions: PlannerConditions; catalog: Place[]; savedPlaces: Place[]; author: string }
export interface PlannerData { journey: Journey; reasons: Record<string, string>; conditions: PlannerConditions; alternatives: Place[]; intent?: PlannerIntent; compositionVersion?: 2 }
export type PlannerResult = AiEnvelope<PlannerData>;
export interface RevisionRequest extends AiContext { journey: Journey; dayId: string; scope: 'day' | 'afternoon' | 'remaining'; fromVisitId?: string; lessWalking: boolean; excludedVisitIds: string[] }
export interface RevisionData { journey: Journey; changedDayIds: string[]; removedVisitIds: string[]; retainedLocks: string[] }
export type RevisionResult = AiEnvelope<RevisionData>;
export interface AiPlannerAdapter { generate(request: PlannerRequest, signal?: AbortSignal): Promise<PlannerResult>; revise(request: RevisionRequest, signal?: AbortSignal): Promise<RevisionResult> }

/** Content version is compared again at approval, not just when requesting. No mutable timestamp shortcut. */
export const journeyVersion = (journey: Journey): string => JSON.stringify(journey);
export const catalogVersion = (places: Place[]): string => JSON.stringify(places.map(p => [p.id,p.name,p.area,p.lat,p.lng,p.description,p.tags,p.photos]));
const object = (value:unknown):value is Record<string,unknown> => typeof value==='object'&&value!==null&&!Array.isArray(value);
const strings = (value:unknown):value is string[] => Array.isArray(value)&&value.every(item=>typeof item==='string');
function validateEnvelope(request:AiContext,result:unknown):asserts result is AiEnvelope<unknown> {
  if(!object(result)||result.requestId!==request.requestId||result.sourceVersion!==request.sourceVersion||typeof result.mock!=='boolean'||!object(result.data)||!strings(result.warnings)||!Array.isArray(result.sources)||!Array.isArray(result.unplaced)
    ||!result.sources.every(s=>object(s)&&typeof s.id==='string'&&typeof s.label==='string'&&typeof s.sourceVersion==='string'&&(s.checkedAt===null||typeof s.checkedAt==='string')&&(s.url===undefined||typeof s.url==='string'))
    ||!result.unplaced.every(p=>object(p)&&typeof p.placeId==='string'&&typeof p.reason==='string')) throw new AiPlannerError('invalid','추천 응답을 확인하지 못했어요. 입력을 유지했으니 다시 시도해 주세요.');
}
function hasJourneyShape(value:unknown):value is Journey {
  return object(value)&&['id','title','region','dateRange','duration','cover','summary','story','author'].every(key=>typeof value[key]==='string')&&typeof value.isMine==='boolean'&&typeof value.saves==='number'&&strings(value.tags)&&Array.isArray(value.days)
    &&value.days.every(day=>object(day)&&typeof day.dayId==='string'&&Number.isInteger(day.day)&&['date','title','story'].every(key=>typeof day[key]==='string')&&Array.isArray(day.places)&&Array.isArray(day.blocks)
      &&day.places.every(p=>object(p)&&['id','visitId','name','kind','area','address','image','description','note','duration'].every(key=>typeof p[key]==='string')&&['LANDMARK','FOOD','STAY','CAFE','SHOP'].includes(String(p.kind))&&(p.lat===null||typeof p.lat==='number')&&(p.lng===null||typeof p.lng==='number')&&(p.photos===undefined||Array.isArray(p.photos)&&p.photos.every(photo=>object(photo)&&['image','alt','caption'].every(key=>typeof photo[key]==='string'))))
      &&day.blocks.every(b=>object(b)&&typeof b.id==='string'&&['TEXT','IMAGE','PLACE'].includes(String(b.type))));
}
/** Validate an adapter response before putting it into React state or offering approval. */
export function validatePlannerResult(request:PlannerRequest,result:unknown,options:{allowLegacy?:boolean}={}):PlannerResult {
  validateEnvelope(request,result);
  const data=result.data;
  if(!object(data)||!hasJourneyShape(data.journey)||!object(data.reasons)||!Object.values(data.reasons).every(v=>typeof v==='string')||!Array.isArray(data.alternatives)||!data.alternatives.every(p=>object(p)&&typeof p.id==='string')||JSON.stringify(data.conditions)!==JSON.stringify(request.conditions)) throw new AiPlannerError('invalid','추천 응답의 일정 형식을 확인하지 못했어요. 다시 시도해 주세요.');
  const journey=data.journey,c=request.conditions,visits=journey.days.flatMap(day=>day.places),legacy=options.allowLegacy&&data.compositionVersion===undefined;
  const region=chosenPlannerRegion(c,c.mode==='saved'?request.savedPlaces:request.catalog);
  const landmarkPool=(c.mode==='saved'?request.savedPlaces:request.catalog.filter(p=>!p.personal)).filter(p=>p.kind==='LANDMARK'&&!c.excludedIds.includes(p.id)&&(legacy&&c.mode==='saved'||isPlannerRegion(p,region)));
  const allowedLandmarks=new Set(landmarkPool.map(p=>p.id));
  const booked=plannerBookedStays(request);
  const businessPool=[...request.catalog.filter(p=>!p.personal),...booked].filter(p=>!c.excludedIds.includes(p.id)&&isPlannerRegion(p,region));
  const allowed=new Set([...allowedLandmarks,...(!legacy?businessPool.map(p=>p.id):[])]);
  if((!legacy&&data.compositionVersion!==2)||journey.purpose!=='PLAN'||journey.visibility!=='PRIVATE'||!journey.isMine||journey.status!=='PLANNING'||journey.trash||journey.days.length!==c.dayCount||!visits.length||visits.length>60||visits.filter(p=>p.kind==='LANDMARK').length>30||new Set(visits.map(p=>p.visitId)).size!==visits.length||new Set(journey.days.map(d=>d.dayId)).size!==journey.days.length
    ||journey.days.some((d,index)=>d.day!==index+1)||visits.some(p=>!allowed.has(p.id))||[...c.requiredIds,...c.fixedIds].some(id=>!visits.some(p=>p.id===id))||c.fixedIds.some(id=>!visits.some(p=>p.id===id&&p.bookingFixed))) throw new AiPlannerError('invalid','필수 장소·기간·선택 범위를 지키지 않은 추천은 적용하지 않았어요. 다시 시도해 주세요.');
  if(c.mode==='saved'&&[...allowedLandmarks].some(id=>!visits.some(p=>p.id===id)))throw new AiPlannerError('invalid','저장한 장소가 응답에서 빠졌어요. 다시 시도해 주세요.');
  const dated=setPlanDates(journey,c.startDate);
  if(journey.days.some((day,index)=>day.date!==dated.days[index].date)||journey.startDate!==dated.startDate)throw new AiPlannerError('invalid','요청한 날짜와 결과가 달라 적용하지 않았어요.');
  if(journey.days.some(day=>day.blocks.some(b=>b.type!=='PLACE'||!day.places.some(p=>p.visitId===b.visitId&&p.id===b.placeId))||day.places.some(p=>!day.blocks.some(b=>b.visitId===p.visitId))))throw new AiPlannerError('invalid','장소와 일정 카드가 일치하지 않아 적용하지 않았어요.');
  if(!legacy)validateCompletePlannerResult(request,data as unknown as PlannerData,landmarkPool,businessPool,booked);
  return {...result,data:{...data,journey:{...journey,planningPreferences:structuredClone(c)}}} as PlannerResult;
}
const unique = (places: Place[]) => [...new Map(places.map(p => [p.id,p])).values()];
const regional = (p: Place, region: string) => p.area === region || p.area.startsWith(`${region} `);
function plannerBookedStays(request:PlannerRequest):Place[] {
  const c=request.conditions,intent=readPlannerIntent(c.prompt,c.dayCount,c.meals);
  return unique([...request.savedPlaces,...request.catalog].filter(p=>p.kind==='STAY'&&(c.fixedIds.includes(p.id)||p.bookingFixed||intent.stay==='booked'&&p.name.length>=3&&c.prompt.includes(p.name))));
}
function validateCompletePlannerResult(request:PlannerRequest,data:PlannerData,landmarks:Place[],businesses:Place[],booked:Place[]):void {
  const c=request.conditions,intent=readPlannerIntent(c.prompt,c.dayCount,c.meals),journey=data.journey;
  const fail=()=>{throw new AiPlannerError('invalid','요청한 포함·제외 조건과 시간대·주변 장소가 일치하지 않아 적용하지 않았어요.');};
  if(JSON.stringify(data.intent)!==JSON.stringify(intent))fail();
  const sameCoordinate=(a:number,b:number)=>!Number.isFinite(a)&&!Number.isFinite(b)||a===b;
  const allGapIds=new Set<string>();
  journey.days.forEach((day,index)=>{
    if(!Array.isArray(day.planningGaps))fail();
    const gaps=day.planningGaps!;
    const expectations=requestedDaySlots(c,intent,index);
    const byVisit=new Map(day.places.map(p=>[p.visitId,p]));
    for(const p of day.places){
      const origin=(p.kind==='LANDMARK'?landmarks:businesses).find(source=>source.id===p.id);
      if(!origin||p.kind!==origin.kind||p.name!==origin.name||p.address!==origin.address||p.area!==origin.area||p.image!==origin.image||p.description!==origin.description||JSON.stringify(p.photos)!==JSON.stringify(origin.photos)||!sameCoordinate(p.lat,origin.lat)||!sameCoordinate(p.lng,origin.lng)||p.time!==undefined||p.move!==undefined||!planningSlots.includes(p.planningSlot!))fail();
      if(p.kind!=='LANDMARK'){
        const isBooked=booked.some(b=>b.id===p.id),anchor=byVisit.get(p.anchorVisitId)??(isBooked?journey.days.flatMap(d=>d.places).find(v=>v.visitId===p.anchorVisitId):undefined);
        if(!anchor||anchor.kind!=='LANDMARK'||!expectations.some(e=>e.kind===p.kind&&e.slot===p.planningSlot)||(!isBooked&&(distanceBetween(anchor,p)===null||distanceBetween(anchor,p)!>15)))fail();
        if(p.kind==='STAY'&&(JSON.stringify(p.stayDayIds)!==JSON.stringify([day.dayId])||isBooked&&!p.bookingFixed||!isBooked&&intent.stay==='booked'))fail();
      }
    }
    for(const gap of gaps){
      if(!object(gap)||typeof gap.id!=='string'||!gap.id||allGapIds.has(gap.id)||!expectations.some(e=>e.kind===gap.kind&&e.slot===gap.slot)||!['missing-data','booked'].includes(gap.reason)||gap.reason==='booked'&&(gap.kind!=='STAY'||intent.stay!=='booked')||gap.afterVisitId!==undefined&&byVisit.get(gap.afterVisitId)?.kind!=='LANDMARK'||gap.beforeVisitId!==undefined&&byVisit.get(gap.beforeVisitId)?.kind!=='LANDMARK')fail();
      allGapIds.add(gap.id);
      if(gap.afterVisitId&&gap.beforeVisitId&&day.places.findIndex(p=>p.visitId===gap.afterVisitId)>=day.places.findIndex(p=>p.visitId===gap.beforeVisitId))fail();
    }
    for(const expected of expectations)if(day.places.filter(p=>p.kind===expected.kind&&p.planningSlot===expected.slot).length+gaps.filter(g=>g.kind===expected.kind&&g.slot===expected.slot).length!==1)fail();
    if(day.places.some((p,i)=>i>0&&planningSlots.indexOf(p.planningSlot!)<planningSlots.indexOf(day.places[i-1].planningSlot!)))fail();
  });
  if(booked.some(p=>!journey.days.some(d=>d.places.some(v=>v.id===p.id&&v.bookingFixed))))fail();
}
const source = (version: string): AiSource => ({ id: 'internal-catalog', label: 'Spotlog 등록 장소 · 조건 조합 샘플', checkedAt: null, sourceVersion: version });
export function validatePlannerConditions(c: PlannerConditions, candidates: Place[]): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(c.dayCount) || c.dayCount < 1 || c.dayCount > 7) errors.push('추천 기간은 1일부터 7일까지 선택해 주세요.');
  if (c.mode === 'region' && !c.region) errors.push('여행 지역을 선택해 주세요.');
  if (c.requiredIds.some(id => c.excludedIds.includes(id))) errors.push('필수 장소와 제외 장소가 겹쳐요.');
  if (c.fixedIds.some(id => c.excludedIds.includes(id))) errors.push('고정한 장소는 제외할 수 없어요.');
  if (c.requiredIds.some(id=>!candidates.some(p=>p.id===id&&p.kind==='LANDMARK'))||c.fixedIds.some(id=>!candidates.some(p=>p.id===id&&(p.kind==='LANDMARK'||p.kind==='STAY')))) errors.push('필수·고정 장소를 현재 자료에서 찾을 수 없어요. 다시 선택해 주세요.');
  const region=chosenPlannerRegion(c,candidates);
  if(c.mode==='saved'&&!region)errors.push('저장한 장소가 여러 지역에 있어요. 이번에 여행할 지역을 선택해 주세요.');
  if (region && [...c.requiredIds,...c.fixedIds].some(id => candidates.some(p => p.id === id && !regional(p,region)))) errors.push('필수·고정 장소와 선택한 지역이 달라요.');
  if(c.dayCount===1&&c.fixedIds.some(id=>candidates.some(p=>p.id===id&&p.kind==='STAY')))errors.push('예약한 숙소를 포함하려면 숙박 기간을 선택해 주세요.');
  if (c.startDate && (!/^\d{4}-\d{2}-\d{2}$/.test(c.startDate) || !Number.isFinite(Date.parse(`${c.startDate}T00:00:00Z`)) || new Date(`${c.startDate}T00:00:00Z`).toISOString().slice(0,10)!==c.startDate)) errors.push('출발 날짜를 확인해 주세요.');
  if ([c.arrival,c.departure].some(time => time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) errors.push('도착·출발 시간을 확인해 주세요.');
  if (c.dayCount === 1 && c.arrival && c.departure && c.arrival >= c.departure) errors.push('당일 여행은 출발 시간이 도착 시간보다 뒤여야 해요.');
  const count = unique(candidates.filter(p => p.kind==='LANDMARK' && !c.excludedIds.includes(p.id)&&(!region||isPlannerRegion(p,region)))).length;
  if ((c.mode === 'saved' && count > 30) || new Set([...c.requiredIds,...c.fixedIds]).size > 30) errors.push('한 번에 추천할 장소는 최대 30곳이에요. 제외할 장소를 선택해 주세요.');
  return errors;
}
export function generatePlannerSample(request: PlannerRequest): PlannerResult {
  const c = structuredClone(request.conditions);
  // The caller supplies the public, rights-cleared catalog. Saved data remains request-private.
  const pool = unique(c.mode === 'saved' ? request.savedPlaces : request.catalog.filter(p => !p.personal));
  const booked=plannerBookedStays(request),intent=readPlannerIntent(c.prompt,c.dayCount,c.meals);
  const errors = validatePlannerConditions(c,unique([...pool,...booked]));
  if (errors.length) throw new AiPlannerError('invalid',errors.join(' '));
  const required = new Set([...c.requiredIds,...c.fixedIds]);
  const region=chosenPlannerRegion(c,pool);
  if(booked.some(p=>!regional(p,region)))throw new AiPlannerError('invalid','예약한 숙소와 여행 지역이 달라요. 지역 또는 숙소 정보를 확인해 주세요.');
  if(booked.some(p=>c.excludedIds.includes(p.id)))throw new AiPlannerError('invalid','예약한 숙소가 제외 장소에 있어요. 예약 또는 제외 조건을 확인해 주세요.');
  if(booked.length>c.dayCount-1)throw new AiPlannerError('invalid','예약한 숙소 수가 숙박일보다 많아요. 여행 기간 또는 고정한 숙소를 확인해 주세요.');
  if(booked.length&&intent.stay==='exclude')throw new AiPlannerError('invalid','고정한 숙소가 있어요. 숙박 제외 요청 또는 고정 숙소를 확인해 주세요.');
  const eligible = pool.filter(p => p.kind==='LANDMARK' && !c.excludedIds.includes(p.id) && regional(p,region));
  if (!eligible.length) throw new AiPlannerError('empty','조건에 맞는 등록 랜드마크가 없어요. 지역이나 제외 조건을 바꿔 주세요.');
  const words = c.prompt.trim().split(/\s+/).filter(word => word.length > 1);
  const scored = eligible.map((place,index) => ({ place,index,score: words.filter(word=>`${place.name} ${place.description} ${(place.tags??[]).join(' ')}`.includes(word)).length })).sort((a,b)=>Number(required.has(b.place.id))-Number(required.has(a.place.id)) || b.score-a.score || a.index-b.index);
  const perDay = c.pace==='slow' || c.walking==='less' ? 2 : c.pace==='full' ? 4 : 3;
  const limit = c.mode==='saved' ? eligible.length : Math.min(30, Math.max(required.size,c.dayCount*perDay));
  const selected = spatialPlannerOrder(scored.slice(0,limit).map(({place})=>place));
  let journey = setPlanDates(buildPersonalPlan(selected,c.dayCount,'',request.author),c.startDate);
  journey = { ...journey, summary: '등록 장소를 조건에 맞춰 배치한 샘플 일정', days: journey.days.map(day=>({...day,places:day.places.map(p=>({...p,bookingFixed:c.fixedIds.includes(p.id) || undefined}))})) };
  const composed=composePlannerItinerary(journey,request.catalog,c,intent,booked);
  journey=composed.journey;
  const withPreferences: Journey & {planningPreferences:PlannerConditions} = {...journey,planningPreferences:structuredClone(c)};
  journey=withPreferences;
  const warnings = ['등록 자료로 만든 추천 샘플이에요. 실제 AI·RAG 결과가 아니에요.','이동 경로·소요 시간·영업시간은 확인 전이에요.',...intent.reasons];
  if(journey.days.some(day=>day.planningGaps?.some(g=>g.reason==='missing-data')))warnings.push('가까운 등록 업체가 부족한 시간대는 업체 미정으로 남겼어요. 일정 수정에서 추가할 수 있어요.');
  if (!c.startDate) warnings.push('날짜가 없어 영업일·운행일을 확인하지 않았어요.');
  if (c.arrival || c.departure) warnings.push(`첫날 도착 ${c.arrival||'미정'} · 마지막 날 출발 ${c.departure||'미정'}. 시간 내 방문 가능 여부는 확인이 필요해요.`);
  if (c.walking==='less') warnings.push('하루 추천 장소 수를 줄였어요. 실제 도보 거리는 경로 연결 후 확인해요.');
  if (c.companions || c.meals || c.accessibility) warnings.push('동행·식사·접근성 요청을 보관했어요. 자료가 부족해 충족 여부는 직접 확인해야 해요.');
  if (selected.some(p=>!hasLocation(p))) warnings.push('좌표가 없는 장소도 선택에서 지우지 않았어요. 지도·이동 정보는 확인이 필요해요.');
  if (new Set(selected.map(p=>p.area.split(' ')[0])).size>1) warnings.push('서로 다른 지역이 포함돼요. 도시·섬 사이 이동편을 확인해 주세요.');
  if (selected.length>c.dayCount*perDay) warnings.push('필수·저장 장소를 모두 유지했어요. 하루 방문 수가 많아 기간이나 제외 장소를 조정하는 것이 좋아요.');
  const outsideRegion=c.mode==='saved'?pool.filter(p=>p.kind==='LANDMARK'&&!c.excludedIds.includes(p.id)&&!regional(p,region)):[];
  const alternatives = [...scored.slice(limit).map(({place})=>place),...outsideRegion];
  const reasons = {...Object.fromEntries(selected.map(p=>[p.id,required.has(p.id)?'직접 지정한 필수·고정 장소':c.mode==='saved'?'내가 저장한 장소':words.some(word=>`${p.name} ${p.description} ${(p.tags??[]).join(' ')}`.includes(word))?'입력한 관심 단어와 등록 설명이 일치해요.':`${region}에 등록된 랜드마크예요.`])),...composed.reasons};
  return {requestId:request.requestId,sourceVersion:request.sourceVersion,mock:true,data:{journey,reasons:Object.fromEntries(Object.entries(reasons).map(([id,reason])=>[id,plannerText(request.language,reason)])),conditions:c,alternatives,intent,compositionVersion:2},sources:[source(request.sourceVersion)],warnings:warnings.map(w=>plannerText(request.language,w)),unplaced:alternatives.map(p=>({placeId:p.id,reason:plannerText(request.language,outsideRegion.includes(p)?'이번에 선택한 여행 지역과 달라 이번 일정에 넣지 않았어요.':'선택한 여행 속도의 권장 방문 수를 넘어서 대안으로 남겼어요.')}))};
}
export function revisionScopeVisits(request: RevisionRequest): Set<string> {
  const targetIndex = request.journey.days.findIndex(d=>d.dayId===request.dayId);
  if (targetIndex<0) throw new AiPlannerError('stale','선택한 날짜가 바뀌었어요. 다시 열어 주세요.');
  const target = request.journey.days[targetIndex];
  if (request.scope==='remaining' && !target.places.some(p=>p.visitId===request.fromVisitId)) throw new AiPlannerError('invalid','남은 일정을 시작할 장소를 선택해 주세요.');
  return new Set(request.journey.days.flatMap((day,index)=>day.places.filter((place,placeIndex)=> {
    if (request.scope==='remaining') return index>targetIndex || index===targetIndex && placeIndex>=target.places.findIndex(p=>p.visitId===request.fromVisitId);
    if(index!==targetIndex) return false;
    if(request.scope==='afternoon') return /^([01]\d|2[0-3]):[0-5]\d/.test(place.time??'') ? (place.time??'') >= '12:00' : ['afternoon','dinner','stay'].includes(place.planningSlot??'');
    return true;
  }).map(place=>place.visitId!).filter(Boolean)));
}
export function protectedRevisionVisits(request:RevisionRequest):Set<string> {
  const scoped=revisionScopeVisits(request),all=request.journey.days.flatMap(day=>day.places);
  const required=new Set(request.journey.planningPreferences?.requiredIds??[]);
  const locked=new Set(all.filter(p=>p.bookingFixed||p.kind==='STAY'||required.has(p.id)||request.lockedVisitIds.includes(p.visitId!)).map(p=>p.visitId!));
  all.forEach(p=>{if((locked.has(p.visitId!)||!scoped.has(p.visitId!))&&p.anchorVisitId)locked.add(p.anchorVisitId);});
  return locked;
}
export function revisePlannerSample(request: RevisionRequest): RevisionResult {
  if (journeyVersion(request.journey)!==request.sourceVersion) throw new AiPlannerError('stale','여행 내용이 달라졌어요. 최신 일정으로 다시 제안해 주세요.');
  if (!request.journey.isMine || request.journey.purpose!=='PLAN' || request.journey.trash) throw new AiPlannerError('invalid','휴지통에 있지 않은 내 개인 일정에서만 변경할 수 있어요.');
  const scoped = revisionScopeVisits(request);
  if (!scoped.size) throw new AiPlannerError('empty',request.scope==='afternoon'?'오후 시간이 지정된 장소가 없어요. 일정에서 방문 시간을 먼저 정해 주세요.':'수정할 장소가 없어요.');
  const all = request.journey.days.flatMap(d=>d.places);
  // A reservation, lodging, or linked business also protects its landmark group.
  const locked = protectedRevisionVisits(request);
  const excluded = new Set(request.excludedVisitIds);
  if (all.some(p=>excluded.has(p.visitId!) && (!scoped.has(p.visitId!) || locked.has(p.visitId!)))) throw new AiPlannerError('invalid','고정 장소·숙소 또는 선택 범위 밖 장소는 제외할 수 없어요.');
  const removed = new Set<string>();
  const warnings = ['선택 범위의 변경안이에요. 적용 전까지 원래 일정은 그대로예요.','이동 시간·영업시간은 확인 전이에요.'];
  const days = request.journey.days.map(day=>{
    const candidates = day.places.filter(p=>scoped.has(p.visitId!)&&!locked.has(p.visitId!)&&!p.anchorVisitId);
    if(request.lessWalking) candidates.slice(2).forEach(p=>excluded.add(p.visitId!));
    day.places.forEach(p=>{if(scoped.has(p.visitId!) && !locked.has(p.visitId!) && (excluded.has(p.visitId!) || p.anchorVisitId && excluded.has(p.anchorVisitId))) removed.add(p.visitId!);});
    if(!day.places.some(p=>removed.has(p.visitId!))) return day;
    return reanchorPlannerGaps({...day,places:day.places.filter(p=>!removed.has(p.visitId!)),blocks:day.blocks.filter(b=>b.type!=='PLACE'||!removed.has(b.visitId!))});
  });
  if(request.lessWalking) warnings.push('변경 범위에서 고정되지 않은 방문을 하루 최대 2곳으로 줄이는 제안이에요. 실제 도보 거리 단축은 보장하지 않아요.');
  const changedDayIds = days.filter((day,index)=>day!==request.journey.days[index]).map(d=>d.dayId!);
  if(!changedDayIds.length) warnings.push('현재 조건에서는 바뀌는 장소가 없어요.');
  return {requestId:request.requestId,sourceVersion:request.sourceVersion,mock:true,data:{journey:{...request.journey,days},changedDayIds,removedVisitIds:[...removed],retainedLocks:[...locked]},sources:[source(request.sourceVersion)],warnings:warnings.map(w=>plannerText(request.language,w)),unplaced:all.filter(p=>removed.has(p.visitId!)).map(p=>({placeId:p.id,reason:'사용자가 승인할 변경안에서 방문 제외'}))};
}
export function validateRevisionResult(request:RevisionRequest,result:unknown):RevisionResult {
  validateEnvelope(request,result);
  if(!object(result.data)||!hasJourneyShape(result.data.journey)||!strings(result.data.changedDayIds)||!strings(result.data.removedVisitIds)||!strings(result.data.retainedLocks))throw new AiPlannerError('invalid','변경 응답의 형식을 확인하지 못했어요.');
  const next=result.data.journey,original=request.journey,scoped=revisionScopeVisits(request),locked=protectedRevisionVisits(request);
  if(next.id!==original.id||next.days.length!==original.days.length)throw new AiPlannerError('invalid','요청한 여행·기간이 달라 변경하지 않았어요.');
  const changed:string[]=[],removed:string[]=[];
  original.days.forEach((before,index)=>{
    const after=next.days[index];
    if(before.dayId!==after.dayId)throw new AiPlannerError('invalid','변경 범위 밖의 DAY를 바꿀 수 없어요.');
    const afterIds=new Set(after.places.map(p=>p.visitId));
    const removedHere=before.places.filter(p=>!afterIds.has(p.visitId));
    if(removedHere.some(p=>!scoped.has(p.visitId!)||locked.has(p.visitId!)))throw new AiPlannerError('invalid','고정 장소·숙소 또는 선택 범위 밖 장소는 제외할 수 없어요.');
    removed.push(...removedHere.map(p=>p.visitId!));
    const expected=removedHere.length?reanchorPlannerGaps({...before,places:before.places.filter(p=>afterIds.has(p.visitId)),blocks:before.blocks.filter(b=>b.type!=='PLACE'||!removedHere.some(p=>p.visitId===b.visitId))}):before;
    // This adapter currently offers removal proposals only. Reject extra edits and additions.
    if(JSON.stringify(expected)!==JSON.stringify(after))throw new AiPlannerError('invalid','요청하지 않은 장소·글·사진 변경이 포함되어 적용하지 않았어요.');
    if(removedHere.length)changed.push(before.dayId!);
  });
  const removedVisitIds=result.data.removedVisitIds;
  if(JSON.stringify(changed)!==JSON.stringify(result.data.changedDayIds)||new Set(removed).size!==removedVisitIds.length||removed.some(id=>!removedVisitIds.includes(id)))throw new AiPlannerError('invalid','변경 항목이 요청과 일치하지 않아요.');
  return result as RevisionResult;
}
export function applyRevision(current: Journey, result: RevisionResult, request:RevisionRequest): Journey {
  if(!current.isMine || current.purpose!=='PLAN' || current.trash) throw new AiPlannerError('invalid','휴지통에 있지 않은 내 개인 일정에서만 변경할 수 있어요.');
  if(journeyVersion(current)!==result.sourceVersion || current.id!==result.data.journey.id) throw new AiPlannerError('stale','그동안 일정이 바뀌었어요. 현재 일정은 유지하고 최신 내용으로 다시 제안해 주세요.');
  if(!request||request.sourceVersion!==journeyVersion(current))throw new AiPlannerError('stale','원래 변경 요청이 달라졌어요. 다시 제안해 주세요.');
  validateRevisionResult(request,result);
  if(!result.data.changedDayIds.length) throw new AiPlannerError('invalid','적용할 변경이 없어요.');
  for(const dayId of result.data.changedDayIds) {
    const before=current.days.find(d=>d.dayId===dayId),after=result.data.journey.days.find(d=>d.dayId===dayId);
    if(!before||!after || JSON.stringify(before.blocks.filter(b=>b.type!=='PLACE'))!==JSON.stringify(after.blocks.filter(b=>b.type!=='PLACE'))) throw new AiPlannerError('invalid','변경 범위 밖의 글·사진은 바꿀 수 없어요.');
    if(before.places.some(p=>(p.bookingFixed||p.kind==='STAY'||result.data.retainedLocks.includes(p.visitId!)) && JSON.stringify(p)!==JSON.stringify(after.places.find(next=>next.visitId===p.visitId)))) throw new AiPlannerError('invalid','고정 장소·숙소를 바꾸는 변경안은 적용할 수 없어요.');
  }
  return {...current,days:current.days.map(day=>result.data.changedDayIds.includes(day.dayId!)?structuredClone(result.data.journey.days.find(d=>d.dayId===day.dayId)!):day)};
}
export function plannerBusinessCandidates(anchor: Place, catalog: Place[], kind: 'FOOD'|'STAY', savedIds?: Set<string>, query=''): Place[] {
  return unique(catalog).filter(p=>p.kind===kind && (!savedIds||savedIds.has(p.id)) && (!query||`${p.name} ${p.address}`.includes(query))).filter(p=>{const km=distanceBetween(anchor,p);return km!==null && km<=15;}).sort((a,b)=>(distanceBetween(anchor,a)??Infinity)-(distanceBetween(anchor,b)??Infinity));
}
export function createAiPlannerSampleAdapter(options: {delayMs?:number; failure?:AiFailureCode}={}): AiPlannerAdapter {
  const wait = (signal?:AbortSignal) => new Promise<void>((resolve,reject)=>{
    if(signal?.aborted) {reject(new DOMException('Cancelled','AbortError'));return;}
    const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},options.delayMs??350);
    signal?.addEventListener('abort',abort,{once:true});
  });
  const fail=()=>{if(options.failure) {const messages:Record<AiFailureCode,string>={'401':'로그인이 필요해요. 입력은 유지했어요.','403':'이 요청을 사용할 권한이 없어요.','429':'요청이 많아요. 잠시 후 다시 시도해 주세요.','500':'추천을 불러오지 못했어요. 다시 시도해 주세요.',timeout:'응답이 늦어지고 있어요. 입력을 유지했으니 다시 시도해 주세요.',empty:'현재 조건에 맞는 자료가 없어요.',invalid:'입력 조건을 확인해 주세요.',stale:'원본 내용이 바뀌었어요. 다시 시도해 주세요.'};throw new AiPlannerError(options.failure,messages[options.failure]);}};
  return {async generate(request,signal){await wait(signal);fail();return generatePlannerSample(request);},async revise(request,signal){await wait(signal);fail();return revisePlannerSample(request);}};
}
export const localAiPlannerAdapter = createAiPlannerSampleAdapter();

/** Interface copy is separate from Korean place data and authored content. */
export const plannerEnglish: Record<string,string> = {
  '여행 초안 확인':'Review your trip', 'AI 여행 만들기':'Plan a trip with AI', '등록 장소 추천 샘플 · 실제 AI 연결 전':'Sample planner · AI connection pending',
  '지역·취향 추천':'Region & interests','저장 장소로 추천':'From saved places','어떤 여행을 하고 싶으세요?':'What kind of trip would you like?',
  '여행 지역':'Region','지역 선택':'Choose a region','여행 기간':'Trip length','날짜·이동·여행 속도':'Dates, transport & pace','출발 날짜 · 선택':'Start date · optional',
  '첫날 도착':'Arrival on day 1','마지막 날 출발':'Departure on last day','이동수단':'Transport','여행 속도':'Pace','미정':'Undecided','도보':'Walking','대중교통':'Public transport','자동차':'Car',
  '여유롭게':'Relaxed','적당히':'Balanced','알차게':'Full','덜 걷고 싶어요':'Less walking','필수·제외·고정 장소':'Required, excluded & fixed places','추천에 맡기기':'Let planner choose','꼭 가기':'Must visit','고정하기':'Keep fixed','제외하기':'Exclude',
  '동행·식사·접근성':'Companions, meals & accessibility','누구와 가나요?':'Who is travelling?','식사 요청':'Meal preferences','이동·접근성 요청':'Accessibility needs',
  '주변 음식점 후보도 보기':'Show nearby food suggestions','숙소 후보도 보기':'Show accommodation suggestions','여행 초안 만들기':'Create a draft','생성 취소 · 입력 유지':'Cancel · keep my inputs','조건 바꾸기':'Change preferences',
  '음식점·숙소 보완하기':'Add food & accommodation','음식점':'Food','숙소':'Accommodation','기준 랜드마크':'Nearby this landmark','주변 후보':'Nearby suggestions','저장한 업체':'Saved businesses','직접 검색':'Search','등록 업체 검색':'Search registered businesses','숙박 기간':'Stay length',
  '추천 근거·확인할 내용':'Sources & things to verify','내 여행에 저장':'Save to my trips','선택됨':'Selected','선택':'Select','필수·고정 장소':'Required / fixed','일정에 포함됨':'Included','일정에 포함':'Include',
  '일정 일부 바꾸기':'Revise part of your trip','등록 자료 변경 제안 · 실제 AI 연결 전':'Sample changes · AI connection pending','기준 DAY':'Starting day','변경 범위':'Scope','이 DAY만':'This day only','이 DAY 오후만':'This afternoon only','지정 장소부터 남은 일정':'Remaining trip from a stop','이 장소부터':'Start from this stop','시작할 장소 선택':'Choose a starting stop',
  '덜 걷도록 방문 수 줄이기':'Fewer visits for less walking','확인한 변경만 적용':'Apply reviewed changes','원래 일정 유지 · 다시 제안':'Keep original · revise again','변경안 비교하기':'Compare changes','제안 취소':'Cancel suggestion',
  '업체는 결과를 보고 직접 선택한 경우에만 추가해요.':'Businesses are added only when you select them.',
  '알레르기·휠체어 이용 가능 여부는 업체에 직접 확인해야 해요.':'Confirm allergies and wheelchair access directly with the business.',
  '입력한 단어와 등록 설명을 비교해요. 자세한 조건은 아래에서 직접 정할 수 있어요.':'Matches words to registered descriptions. Set detailed preferences below.',
  '고정한 장소는 결과와 부분 수정에서 유지해요. 예약 시간은 생성 후 내 여행에서 지정할 수 있어요.':'Fixed places stay in your plan. Add reservation times in My trips after creating it.',
  '지역을 선택하거나 랜드마크를 먼저 저장해 주세요.':'Choose a region or save some landmarks first.',
  '바다를 보며 천천히 여행하고 싶어요.':'I would like a relaxed trip by the sea.',
  '부모님, 아이와 함께':'With parents or children','채식, 피하고 싶은 음식 등':'Vegetarian or foods to avoid','계단을 피하고 싶어요':'I would like to avoid stairs','업체명·주소':'Business name or address',
  '이 DAY는 비워 두었어요. 생성 후 원하는 장소를 담을 수 있어요.':'This day is empty. You can add places after creating the trip.',
  '등록 샘플의 직선거리 15km 이내 후보예요. 실제 이동·영업·가격·예약 여부는 확인 전이에요.':'Registered samples within 15 km straight-line distance. Routes, opening hours, prices and availability are unverified.',
  '이 기준 장소 주변에 등록된 후보가 없어요. 내 여행을 만든 뒤 주변 업체에서 직접 등록할 수 있어요.':'No registered suggestions nearby. You can add a business in My trips after creating the plan.',
  '당일 여행과 마지막 DAY에는 숙박을 추가하지 않아요.':'No overnight stay is added to a day trip or the last day.',
  '방문 시간이 오후 12시 이후로 정해진 장소만 바꿔요. 시간이 없는 장소는 유지해요.':'Only stops scheduled at or after noon are changed. Stops without a time are kept.',
  '그동안 일정이 바뀌었어요. 현재 일정은 유지하고 최신 내용으로 다시 제안해 주세요.':'Your trip changed. The current itinerary is safe. Request a new suggestion.',
  '이후 여행이 수정됐어요. 이 변경안은 적용할 수 없어요.':'The trip has changed since this suggestion. These changes cannot be applied.',
  '등록 자료 · 운영 정보 확인일 없음':'Registered information · opening details not verified',
  '직접 정하기':'Set later','이동 시간 확인 전':'Travel time unverified','체류':'Stay','곳':'places','빈 일정':'Empty day','제외할 방문 선택':'Choose visits to exclude','변경 전':'Before','변경 후':'After','변경 비교':'Compare changes',
  ' 고정한 장소·숙소와 연결된 예약은 유지해요.':' Fixed stops, accommodation and linked reservations are kept.',
  '여행 지역을 선택해 주세요.':'Choose a region.', '추천 기간은 1일부터 7일까지 선택해 주세요.':'Choose 1 to 7 days.',
  '조건에 맞는 등록 랜드마크가 없어요. 지역이나 제외 조건을 바꿔 주세요.':'No matching landmarks. Change your region or exclusions.',
  '필수 장소와 제외 장소가 겹쳐요.':'A required place is also excluded.', '고정한 장소는 제외할 수 없어요.':'A fixed place cannot be excluded.',
  '필수·고정 장소를 현재 자료에서 찾을 수 없어요. 다시 선택해 주세요.':'A required or fixed place is unavailable. Select it again.',
  '필수·고정 장소와 선택한 지역이 달라요.':'A required or fixed place is outside the chosen region.',
  '출발 날짜를 확인해 주세요.':'Check the start date.', '도착·출발 시간을 확인해 주세요.':'Check arrival and departure times.',
  '당일 여행은 출발 시간이 도착 시간보다 뒤여야 해요.':'Departure must be later than arrival for a day trip.',
  '한 번에 추천할 장소는 최대 30곳이에요. 제외할 장소를 선택해 주세요.':'Choose up to 30 places. Exclude some places to continue.',
  '등록 자료로 만든 추천 샘플이에요. 실제 AI·RAG 결과가 아니에요.':'This is a sample built from registered information, without a live AI or RAG connection.',
  '이동 경로·소요 시간·영업시간은 확인 전이에요.':'Routes, travel times and opening hours are unverified.',
  '날짜가 없어 영업일·운행일을 확인하지 않았어요.':'Opening and transport dates are unverified because no date is set.',
  '하루 추천 장소 수를 줄였어요. 실제 도보 거리는 경로 연결 후 확인해요.':'Fewer stops are suggested per day. Walking distances still need route verification.',
  '동행·식사·접근성 요청을 보관했어요. 자료가 부족해 충족 여부는 직접 확인해야 해요.':'Companion, meal and accessibility requests are saved. Confirm them directly because the available data is limited.',
  '좌표가 없는 장소도 선택에서 지우지 않았어요. 지도·이동 정보는 확인이 필요해요.':'Places without coordinates are kept. Map and route details need verification.',
  '서로 다른 지역이 포함돼요. 도시·섬 사이 이동편을 확인해 주세요.':'Several regions are included. Check transport between cities or islands.',
  '필수·저장 장소를 모두 유지했어요. 하루 방문 수가 많아 기간이나 제외 장소를 조정하는 것이 좋아요.':'All required and saved places are kept. Some days have many stops; adjust trip length or exclusions.',
  '직접 지정한 필수·고정 장소':'A place you marked as required or fixed','내가 저장한 장소':'A place you saved','입력한 관심 단어와 등록 설명이 일치해요.':'Your interest words match the registered description.',
  '선택한 여행 속도의 권장 방문 수를 넘어서 대안으로 남겼어요.':'Kept as an alternative because it exceeds the suggested number of stops for your pace.',
  '선택 범위의 변경안이에요. 적용 전까지 원래 일정은 그대로예요.':'These suggestions affect only the selected scope. Your trip stays unchanged until approval.',
  '이동 시간·영업시간은 확인 전이에요.':'Travel times and opening hours are unverified.',
  '현재 조건에서는 바뀌는 장소가 없어요.':'There are no changes for these preferences.',
  '변경 범위에서 고정되지 않은 방문을 하루 최대 2곳으로 줄이는 제안이에요. 실제 도보 거리 단축은 보장하지 않아요.':'Suggests up to two flexible stops per day within scope. A shorter walking route is not guaranteed.',
  '오후 시간이 지정된 장소가 없어요. 일정에서 방문 시간을 먼저 정해 주세요.':'No stops have afternoon times. Set visit times in your itinerary first.',
  '수정할 장소가 없어요.':'There are no stops to revise.',
  '남은 일정을 시작할 장소를 선택해 주세요.':'Choose a stop to start the remaining itinerary.',
  '고정 장소·숙소 또는 선택 범위 밖 장소는 제외할 수 없어요.':'Fixed places, accommodation and out-of-scope stops cannot be excluded.',
  '장소 자료가 바뀌었어요. 다시 만들어 주세요.':'Place information changed. Please create a new draft.',
  '여행이 바뀌었어요. 최신 내용으로 다시 제안해 주세요.':'Your trip changed. Request a new suggestion.',
  '저장하지 못했어요. 선택한 초안을 유지했으니 다시 시도해 주세요.':'Could not save. Your selections are kept. Try again.',
  '저장하지 못했어요. 초안은 그대로 유지했어요.':'Could not save. Your draft is kept.',
  '포함할 장소를 한 곳 이상 선택해 주세요.':'Include at least one place.',
  '로그인이 필요해요. 입력은 유지했어요.':'Sign-in is required. Your inputs are kept.',
  '이 요청을 사용할 권한이 없어요.':'You do not have access to this request.',
  '요청이 많아요. 잠시 후 다시 시도해 주세요.':'Too many requests. Try again shortly.',
  '추천을 불러오지 못했어요. 다시 시도해 주세요.':'Could not load recommendations. Try again.',
  '응답이 늦어지고 있어요. 입력을 유지했으니 다시 시도해 주세요.':'The request timed out. Your inputs are kept. Try again.',
  '현재 조건에 맞는 자료가 없어요.':'There is no information matching your preferences.',
};
export const plannerText = (language:'ko'|'en', text:string) => {
  if(language==='ko')return text;
  if(plannerEnglish[text])return plannerEnglish[text];
  if(text.endsWith('에 등록된 랜드마크예요.'))return `A registered landmark in ${text.replace('에 등록된 랜드마크예요.','')}.`;
  if(text.startsWith('첫날 도착 '))return text.replace('첫날 도착 ','Arrival ').replace(' · 마지막 날 출발 ',' · departure ').replaceAll('미정','not set').replace('. 시간 내 방문 가능 여부는 확인이 필요해요.','. Check whether these visits fit your available time.');
  return text;
};
