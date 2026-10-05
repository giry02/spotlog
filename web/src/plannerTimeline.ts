import type { JourneyDay, Place, PlanningGap, PlanningSlot } from './data';

const order: PlanningSlot[] = ['morning','lunch','afternoon','dinner','stay'];
export const planningSlotLabel = (slot: PlanningSlot, en = false) => (en
  ? { morning:'Morning',lunch:'Lunch',afternoon:'Afternoon',dinner:'Dinner',stay:'Overnight' }
  : { morning:'오전',lunch:'점심',afternoon:'오후',dinner:'저녁',stay:'숙박' })[slot];
export type PlannerTimelineEntry = { type:'place'; place:Place } | { type:'gap'; gap:PlanningGap };
/** Keep the actual visit order; insert unresolved parts of the day without fabricating a visit. */
export function plannerTimeline(day: JourneyDay): PlannerTimelineEntry[] {
  const entries:PlannerTimelineEntry[]=day.places.map(place=>({type:'place',place}));
  for(const gap of day.planningGaps??[]) {
    if(day.places.some(p=>p.kind===gap.kind&&p.planningSlot===gap.slot))continue;
    const next=entries.findIndex(entry=>order.indexOf(entry.type==='place'?entry.place.planningSlot??'morning':entry.gap.slot)>order.indexOf(gap.slot));
    entries.splice(next<0?entries.length:next,0,{type:'gap',gap});
  }
  return entries;
}
export function plannerVisitContext(day: JourneyDay, entry: PlannerTimelineEntry, en = false): string {
  const rows=plannerTimeline(day),key=entry.type==='place'?entry.place.visitId:entry.gap.id;
  const index=rows.findIndex(row=>(row.type==='place'?row.place.visitId:row.gap.id)===key);
  const before=rows.slice(0,index).reverse().find(row=>row.type==='place'&&row.place.kind==='LANDMARK');
  const after=rows.slice(index+1).find(row=>row.type==='place'&&row.place.kind==='LANDMARK');
  return [before?.type==='place'?(en?`After ${before.place.name}`:`${before.place.name} 방문 후`):'',after?.type==='place'?(en?`Before ${after.place.name}`:`${after.place.name} 방문 전`):''].filter(Boolean).join(' · ');
}
export function planningGapLabel(gap: PlanningGap, en=false): string {
  if(gap.reason==='booked')return en?'Use your booked accommodation':'예약한 숙소 이용';
  return en?'No verified business available':'등록 업체가 없어 장소 미정';
}
