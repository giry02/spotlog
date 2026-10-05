import type { Journey, Place, PlanningSlot } from './data';
import { insertNearby, setPlanStay } from './tripPlan.ts';

export type BusinessChoice = { dayId: string; anchorId: string; place: Place; nights: number };
export type PlannerBusinessForm = { dayId: string; anchorId: string; kind: 'FOOD' | 'CAFE' | 'STAY'; name: string; address: string; planningSlot?:PlanningSlot };

function stayRange(choice: BusinessChoice, journey: Journey) {
  const start=journey.days.findIndex(day=>day.dayId===choice.dayId),end=start+choice.nights;
  if(start<0||!Number.isInteger(choice.nights)||choice.nights<1||end>=journey.days.length)throw new Error('숙박일과 여행 기간을 확인해 주세요.');
  return {start,end};
}
function staySlice(choice:BusinessChoice,journey:Journey,start:number,end:number):BusinessChoice {
  return {...choice,dayId:journey.days[start].dayId!,nights:end-start};
}
function subtractNights(choice:BusinessChoice,journey:Journey,start:number,end:number):BusinessChoice[] {
  const range=stayRange(choice,journey);
  if(range.end<=start||range.start>=end)return [choice];
  const remaining:BusinessChoice[]=[];
  if(range.start<start)remaining.push(staySlice(choice,journey,range.start,start));
  if(range.end>end)remaining.push(staySlice(choice,journey,end,range.end));
  return remaining;
}
/** A continued stay keeps the original landmark context even after splitting into later nights. */
export function plannerStayForDay(choices:BusinessChoice[],journey:Journey,dayId:string):{choice:BusinessChoice;remainingNights:number;startDay:number;endDay:number}|null {
  const index=journey.days.findIndex(day=>day.dayId===dayId);
  if(index<0)return null;
  for(const choice of [...choices].reverse()) {
    if(choice.place.kind!=='STAY')continue;
    const range=stayRange(choice,journey);
    if(range.start<=index&&index<range.end)return {choice,remainingNights:range.end-index,startDay:range.start+1,endDay:range.end};
  }
  return null;
}
/** Only overlapping nights are replaced. Other hotels and the rest of an existing stay remain. */
export function upsertPlannerBusiness(choices:BusinessChoice[],journey:Journey,next:BusinessChoice):BusinessChoice[] {
  const day=journey.days.find(day=>day.dayId===next.dayId);
  const anchor=(next.place.kind==='STAY'?journey.days.flatMap(day=>day.places):day?.places??[]).find(place=>place.visitId===next.anchorId&&place.kind==='LANDMARK');
  if(!day||!anchor)throw new Error('업체를 연결할 기준 장소를 확인해 주세요.');
  if(next.place.kind!=='STAY')return [...choices.filter(choice=>!(choice.dayId===next.dayId&&(next.place.planningSlot?choice.place.planningSlot===next.place.planningSlot&&choice.place.kind===next.place.kind:choice.place.id===next.place.id))),next];
  const range=stayRange(next,journey);
  return [...choices.flatMap(choice=>choice.place.kind==='STAY'?subtractNights(choice,journey,range.start,range.end):[choice]),next];
}
export function updatePlannerStayNights(choices: BusinessChoice[], journey: Journey, dayId: string, nights: number): BusinessChoice[] {
  const index = journey.days.findIndex(day => day.dayId === dayId);
  if (index < 0 || !Number.isInteger(nights) || nights < 1 || index + nights >= journey.days.length) throw new Error('숙박일과 여행 기간을 확인해 주세요.');
  const selected=plannerStayForDay(choices,journey,dayId);
  if(!selected)return choices;
  const original=selected.choice,range=stayRange(original,journey);
  const remaining=choices.flatMap(choice=>choice!==original?[choice]:range.start<index?[staySlice(choice,journey,range.start,index)]:[]);
  return upsertPlannerBusiness(remaining,journey,{...original,dayId,nights});
}
/** Removing a stay from DAY 2 leaves its DAY 1/DAY 3 nights intact. */
export function removePlannerBusiness(choices:BusinessChoice[],journey:Journey,dayId:string,placeId:string,slot?:PlanningSlot):BusinessChoice[] {
  const index=journey.days.findIndex(day=>day.dayId===dayId);
  if(index<0)return choices;
  return choices.flatMap(choice=>choice.place.id!==placeId||slot&&choice.place.planningSlot!==slot?[choice]:choice.place.kind==='STAY'?subtractNights(choice,journey,index,index+1):choice.dayId===dayId?[]:[choice]);
}

/** Always derive from the original draft, so shortening a stay removes its old nights. */
export function applyPlannerSelections(original: Journey, excludedVisits: string[], choices: BusinessChoice[]): Journey {
  const excluded=new Set([...excludedVisits,...original.days.flatMap(day=>day.places).filter(p=>!p.bookingFixed&&p.anchorVisitId&&excludedVisits.includes(p.anchorVisitId)).map(p=>p.visitId!)]);
  let journey:Journey = { ...original, days: original.days.map(day => ({ ...day,
    places: day.places.filter(place => !excluded.has(place.visitId!)).map(place=>place.bookingFixed&&place.anchorVisitId&&excluded.has(place.anchorVisitId)?{...place,anchorVisitId:undefined}:place),
    blocks: day.blocks.filter(block => block.type !== 'PLACE' || !excluded.has(block.visitId!)),
    planningGaps:day.planningGaps?.map(gap=>({...gap,afterVisitId:gap.afterVisitId&&excluded.has(gap.afterVisitId)?undefined:gap.afterVisitId,beforeVisitId:gap.beforeVisitId&&excluded.has(gap.beforeVisitId)?undefined:gap.beforeVisitId})),
  })) };
  for (const choice of choices) {
    const anchor = (choice.place.kind==='STAY'?journey.days.flatMap(day=>day.places):journey.days.find(day=>day.dayId===choice.dayId)?.places??[]).find(place=>place.visitId===choice.anchorId&&place.kind==='LANDMARK');
    if (!anchor) continue;
    if(choice.place.planningSlot&&choice.place.kind!=='STAY') {
      const slots:PlanningSlot[]=['morning','lunch','afternoon','dinner','stay'];
      journey={...journey,days:journey.days.map(day=>{
        if(day.dayId!==choice.dayId)return day;
        const removed=new Set(day.places.filter(p=>p.kind===choice.place.kind&&p.planningSlot===choice.place.planningSlot).map(p=>p.visitId));
        const visits=day.places.filter(p=>!removed.has(p.visitId));
        const visit={...structuredClone(choice.place),visitId:crypto.randomUUID(),anchorVisitId:anchor.visitId,time:undefined,move:undefined,note:choice.place.personal?choice.place.note:''};
        const next=visits.findIndex(p=>slots.indexOf(p.planningSlot??'morning')>slots.indexOf(visit.planningSlot!));
        visits.splice(next<0?visits.length:next,0,visit);
        const blocks=visits.map(p=>day.blocks.find(b=>b.type==='PLACE'&&b.visitId===p.visitId)??{id:crypto.randomUUID(),type:'PLACE' as const,placeId:p.id,visitId:p.visitId});
        return {...day,places:visits,blocks};
      })};
      continue;
    }
    journey = choice.place.kind === 'STAY'
      ? setPlanStay(journey, choice.place, choice.dayId, choice.nights, Boolean(choice.place.bookingFixed))
      : insertNearby(journey, choice.dayId, choice.anchorId, choice.place);
  }
  return {...journey,days:journey.days.map(day=>({...day,planningGaps:day.planningGaps?.filter(gap=>!day.places.some(place=>place.kind===gap.kind&&place.planningSlot===gap.slot))}))};
}

export function personalPlannerBusiness(form: PlannerBusinessForm, anchor: Place): Place {
  if (!form.name.trim() || !form.address.trim()) throw new Error('업체명과 주소를 적어 주세요.');
  return { id: `personal-${crypto.randomUUID()}`, kind: form.kind, name: form.name.trim(), address: form.address.trim(),
    area: anchor.area, lat: NaN, lng: NaN, locationVerified: false, personal: true,
    image: '', photos: [], description: '', note: '', duration: '', planningSlot:form.planningSlot };
}
