import type { Journey, JourneyDay, Place, PlanningSlot } from './data';
import type { PlannerConditions } from './aiPlanner';
import { distanceBetween } from './tripPlan.ts';
import type { PlannerIntent } from './plannerIntent';

export const planningSlots: PlanningSlot[] = ['morning', 'lunch', 'afternoon', 'dinner', 'stay'];
export const plannerRegionOf = (place: Place) => place.area.trim().split(/\s+/)[0];
export const isPlannerRegion = (place: Place, region: string) => place.area === region || place.area.startsWith(`${region} `);
export const chosenPlannerRegion = (c: PlannerConditions, places: Place[]): string => {
  if (c.region && !['전체', '국내', '모든 지역'].includes(c.region)) return c.region;
  const regions = [...new Set(places.filter(p => p.kind === 'LANDMARK' && !c.excludedIds.includes(p.id)).map(plannerRegionOf))];
  return regions.length === 1 ? regions[0] : '';
};
/** Nearest-neighbour ordering is a rough grouping only, not road routing or a time estimate. */
export function spatialPlannerOrder(places: Place[]): Place[] {
  const remaining = [...places], ordered: Place[] = [];
  while (remaining.length) {
    const previous = ordered.at(-1);
    let index = 0;
    if (previous) {
      const distances = remaining.map((p, i) => ({ i, distance: distanceBetween(previous, p) ?? Infinity })).sort((a, b) => a.distance - b.distance);
      index = distances[0].i;
    }
    ordered.push(remaining.splice(index, 1)[0]);
  }
  return ordered;
}
export function requestedDaySlots(c: PlannerConditions, intent: PlannerIntent, index: number): Array<{ slot: PlanningSlot; kind: 'FOOD' | 'CAFE' | 'STAY'; booked?: boolean }> {
  const arrival = index === 0 && c.arrival ? c.arrival : '00:00';
  const departure = index === c.dayCount - 1 && c.departure ? c.departure : '23:59';
  const slots: ReturnType<typeof requestedDaySlots> = [];
  if (intent.food === 'include' && intent.lunch && arrival < '15:00' && departure > '11:00') slots.push({ slot: 'lunch', kind: 'FOOD' });
  if (intent.cafe === 'include' && arrival < '18:00' && departure > '14:00') slots.push({ slot: 'afternoon', kind: 'CAFE' });
  if (intent.food === 'include' && intent.dinner && arrival < '22:00' && departure > '17:00') slots.push({ slot: 'dinner', kind: 'FOOD' });
  if (intent.stay !== 'exclude' && index < c.dayCount - 1) slots.push({ slot: 'stay', kind: 'STAY', booked: intent.stay === 'booked' });
  return slots;
}
/** Removing a visit must not leave a missing-meal row pointing to a deleted card. */
export function reanchorPlannerGaps(day: JourneyDay): JourneyDay {
  if(!day.planningGaps)return day;
  const landmarks=day.places.filter(p=>p.kind==='LANDMARK');
  const gaps=day.planningGaps.map(gap=>{
    const after=landmarks.find(p=>p.visitId===gap.afterVisitId),before=landmarks.find(p=>p.visitId===gap.beforeVisitId);
    if((gap.afterVisitId===undefined||after)&&(gap.beforeVisitId===undefined||before))return gap;
    const slot=planningSlots.indexOf(gap.slot),last=landmarks.filter(p=>planningSlots.indexOf(p.planningSlot??'morning')<slot).at(-1),next=landmarks.find(p=>planningSlots.indexOf(p.planningSlot??'morning')>=slot);
    const {afterVisitId: _after,beforeVisitId:_before,...rest}=gap;
    return {...rest,...(last?{afterVisitId:last.visitId}:{}),...(next?{beforeVisitId:next.visitId}:{})};
  });
  return {...day,planningGaps:gaps};
}
export function composePlannerItinerary(journey: Journey, catalog: Place[], c: PlannerConditions, intent: PlannerIntent, bookedStays: Place[] = []): { journey: Journey; reasons: Record<string, string> } {
  const reasons: Record<string, string> = {};
  const region = chosenPlannerRegion(c, journey.days.flatMap(day => day.places));
  const candidates = [...new Map(catalog.filter(p => !p.personal && !c.excludedIds.includes(p.id) && isPlannerRegion(p, region)).map(p => [p.id, p])).values()];
  const days = journey.days.map((day, dayIndex) => {
    const arrival = dayIndex === 0 && c.arrival ? c.arrival : '00:00';
    const departure = dayIndex === c.dayCount - 1 && c.departure ? c.departure : '23:59';
    const landmarks = day.places.map((p, index, all): Place => ({ ...p, planningSlot: arrival >= '17:00' ? 'dinner' : arrival >= '12:00' ? 'afternoon' : departure <= '12:00' ? 'morning' : index < Math.ceil(all.length / 2) ? 'morning' : 'afternoon' }));
    const placed: Place[] = [...landmarks];
    const gaps: NonNullable<JourneyDay['planningGaps']> = [];
    const used = new Set<string>();
    for (const item of requestedDaySlots(c, intent, dayIndex)) {
      const slotIndex = planningSlots.indexOf(item.slot);
      const before = landmarks.filter(p => planningSlots.indexOf(p.planningSlot!) < slotIndex || item.kind==='CAFE'&&p.planningSlot===item.slot).at(-1);
      const after = landmarks.find(p => planningSlots.indexOf(p.planningSlot!) > slotIndex || item.kind!=='CAFE'&&p.planningSlot===item.slot);
      const booked = item.kind === 'STAY' ? bookedStays.find(p => p.stayDayIds?.includes(day.dayId!)) ?? bookedStays[Math.min(dayIndex,bookedStays.length-1)] : undefined;
      const anchor = before ?? after ?? (booked ? journey.days.flatMap(d=>d.places).at(-1) : undefined);
      const candidatesForSlot = anchor && !item.booked ? candidates.filter(p => p.kind === item.kind && !used.has(p.id)).map(p => ({ place: p, km: distanceBetween(anchor, p) })).filter((p): p is { place: Place; km: number } => p.km !== null && p.km <= 15).sort((a, b) => a.km - b.km) : [];
      const choice = booked ?? candidatesForSlot[0]?.place;
      if (!choice || !anchor) {
        gaps.push({ id: crypto.randomUUID(), slot: item.slot, kind: item.kind, reason: item.booked || booked ? 'booked' : 'missing-data', ...(before ? { afterVisitId: before.visitId } : {}), ...(after ? { beforeVisitId: after.visitId } : {}) });
        continue;
      }
      used.add(choice.id);
      const visit: Place = { ...structuredClone(choice), visitId: crypto.randomUUID(), anchorVisitId: anchor.visitId, planningSlot: item.slot, time: undefined, move: undefined, note: booked ? choice.note : '', duration: item.kind === 'STAY' ? '숙박' : '', bookingFixed: booked ? true : undefined, stayDayIds: item.kind === 'STAY' ? [day.dayId!] : undefined };
      placed.push(visit);
      reasons[visit.id] = booked ? '이미 예약한 숙소를 유지했어요.' : '등록 자료에서 같은 지역의 가까운 업체를 시간대에 배치했어요. 운영 여부는 확인 전이에요.';
    }
    placed.sort((a, b) => planningSlots.indexOf(a.planningSlot!) - planningSlots.indexOf(b.planningSlot!));
    // Cafes belong after the afternoon sightseeing block, while lunch stays between morning and afternoon.
    return { ...day, places: placed, blocks: placed.map(p => day.blocks.find(b => b.visitId === p.visitId) ?? { id: crypto.randomUUID(), type: 'PLACE' as const, placeId: p.id, visitId: p.visitId }), planningGaps: gaps };
  });
  return { journey: { ...journey, region, days }, reasons };
}
