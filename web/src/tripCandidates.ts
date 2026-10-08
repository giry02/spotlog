import type { Journey, Place, PlanningSlot, TripCandidateGroup } from './data';
import { insertNearby, isPersonalPlan, normalizePlan, replacePlanBusiness, setPlanStay } from './tripPlan.ts';

export const KEEP_CURRENT = '__keep__';
export const SKIP_CANDIDATES = '__skip__';
export type CandidateContext = { dayId: string; anchorVisitId: string; slot?: PlanningSlot; nights?: number; fixed?: boolean };

/** A multi-night shortlist is complete only when every selected night has that option. */
export function hasStayCandidate(journey: Journey, placeId: string, dayId: string, nights: number, fixed: boolean): boolean {
  const start = journey.days.findIndex(day => day.dayId === dayId);
  if (start < 0 || !Number.isInteger(nights) || nights < 1 || start + nights >= journey.days.length) return false;
  return journey.days.slice(start, start + nights).every(day => journey.businessCandidates?.some(group =>
    group.kind === 'STAY' && group.dayId === day.dayId && group.options.some(option => option.place.id === placeId && Boolean(option.fixed) === fixed)));
}

/** DAY moves follow their landmark. Removed anchors/days cannot leave stale selectable groups. */
export function reconcileTripCandidates(journey: Journey): Journey {
  if (!journey.businessCandidates) return journey;
  const groups = journey.businessCandidates.flatMap(group => {
    const anchorDay = journey.days.find(day => day.places.some(place => place.visitId === group.anchorVisitId && place.kind === 'LANDMARK'));
    if (!anchorDay) return [];
    const dayId = group.kind === 'STAY' ? group.dayId : anchorDay.dayId!;
    const index = journey.days.findIndex(day => day.dayId === dayId);
    if (index < 0 || group.kind === 'STAY' && index === journey.days.length - 1) return [];
    return [{ ...group, dayId }];
  });
  // Moving two landmarks must still leave just one set of accommodation alternatives per night.
  const merged = new Map<string, TripCandidateGroup>();
  for (const group of groups) {
    const key = candidateGroupKey(group);
    const previous = merged.get(key);
    merged.set(key, previous ? { ...previous, selectedId: undefined, options: [...new Map([...previous.options, ...group.options].map(option => [option.place.id, option])).values()] } : group);
  }
  return { ...journey, businessCandidates: [...merged.values()] };
}
export function candidateGroupKey(group: Pick<TripCandidateGroup, 'dayId' | 'anchorVisitId' | 'kind' | 'slot'>): string {
  return JSON.stringify([group.dayId, group.kind === 'STAY' ? '' : group.anchorVisitId, group.kind, group.slot ?? '']);
}
export function currentCandidateVisit(journey: Journey, group: TripCandidateGroup): Place | undefined {
  return journey.days.find(day => day.dayId === group.dayId)?.places.find(place => place.kind === group.kind &&
    (group.kind === 'STAY' || place.anchorVisitId === group.anchorVisitId && place.planningSlot === group.slot));
}
export function candidateSelection(journey: Journey, group: TripCandidateGroup): string | undefined {
  const current = currentCandidateVisit(journey, group);
  if (current?.bookingFixed) return KEEP_CURRENT;
  return group.selectedId ?? (current ? KEEP_CURRENT : group.options.length === 1 ? group.options[0].place.id : undefined);
}
export function addTripCandidate(input: Journey, place: Place, context: CandidateContext): Journey {
  const journey = normalizePlan(input);
  if (!isPersonalPlan(journey) || journey.visibility !== 'PRIVATE' || journey.trash) throw new Error('내 여행에서만 후보를 담을 수 있어요.');
  if (!['FOOD', 'CAFE', 'STAY'].includes(place.kind)) throw new Error('음식점·카페·숙소 후보를 골라주세요.');
  const anchorDay = journey.days.find(day => day.places.some(p => p.visitId === context.anchorVisitId && p.kind === 'LANDMARK'));
  const start = journey.days.findIndex(day => day.dayId === context.dayId);
  if (!anchorDay || start < 0 || place.kind !== 'STAY' && anchorDay.dayId !== context.dayId) throw new Error('기준 장소와 DAY를 다시 확인해 주세요.');
  const nights = place.kind === 'STAY' ? context.nights ?? 1 : 1;
  if (!Number.isInteger(nights) || nights < 1 || place.kind === 'STAY' && start + nights >= journey.days.length) throw new Error('숙박일과 여행 기간을 확인해 주세요.');
  const groups = structuredClone(journey.businessCandidates ?? []);
  for (const day of journey.days.slice(start, start + nights)) {
    const key = candidateGroupKey({ dayId: day.dayId!, anchorVisitId: context.anchorVisitId, kind: place.kind as TripCandidateGroup['kind'], slot: place.kind === 'STAY' ? undefined : context.slot });
    let group = groups.find(item => candidateGroupKey(item) === key);
    if (!group) {
      group = { id: crypto.randomUUID(), dayId: day.dayId!, anchorVisitId: context.anchorVisitId, kind: place.kind as TripCandidateGroup['kind'], slot: place.kind === 'STAY' ? undefined : context.slot, options: [] };
      groups.push(group);
    }
    const existing = group.options.find(option => option.place.id === place.id);
    if (existing && place.kind === 'STAY') existing.fixed = Boolean(context.fixed);
    if (!existing) {
      const { visitId: _visit, anchorVisitId: _anchor, stayDayIds: _stay, bookingFixed: _fixed, planningSlot: _slot, time: _time, move: _move, ...clean } = structuredClone(place);
      group.options.push({ place: { ...clean, note: place.personal ? place.note : '' }, fixed: Boolean(context.fixed) });
    }
  }
  return { ...journey, businessCandidates: groups };
}
export function removeTripCandidate(journey: Journey, groupId: string, placeId: string): Journey {
  return { ...journey, businessCandidates: journey.businessCandidates?.flatMap(group => {
    if (group.id !== groupId) return [group];
    const options = group.options.filter(option => option.place.id !== placeId);
    return options.length ? [{ ...group, options, selectedId: group.selectedId === placeId ? undefined : group.selectedId }] : [];
  }) };
}
export function selectTripCandidate(journey: Journey, groupId: string, selectedId: string): Journey {
  const group = journey.businessCandidates?.find(group => group.id === groupId);
  if (!group || ![KEEP_CURRENT, SKIP_CANDIDATES, ...group.options.map(option => option.place.id)].includes(selectedId)) throw new Error('후보가 바뀌었어요. 다시 확인해 주세요.');
  const current = currentCandidateVisit(journey, group);
  if (selectedId === KEEP_CURRENT && !current || current?.bookingFixed && selectedId !== KEEP_CURRENT) throw new Error('예약 고정 숙소는 유지해야 해요.');
  return { ...journey, businessCandidates: journey.businessCandidates!.map(group => group.id === groupId ? { ...group, selectedId } : group) };
}
/** Apply atomically from the latest itinerary. Failed review cannot partially replace a booking. */
export function confirmTripCandidates(input: Journey): Journey {
  let journey = normalizePlan(input);
  if (!isPersonalPlan(journey) || journey.visibility !== 'PRIVATE' || journey.trash) throw new Error('내 여행에서만 일정을 확정할 수 있어요.');
  if (!journey.days.some(day => day.places.length)) throw new Error('가고 싶은 장소를 한 곳 이상 담아주세요.');
  for (const group of journey.businessCandidates ?? []) {
    const selectedId = candidateSelection(journey, group);
    if (!selectedId) throw new Error('각 후보 묶음에서 한 곳을 고르거나 이번에는 제외해 주세요.');
    if (selectedId === SKIP_CANDIDATES || selectedId === KEEP_CURRENT) continue;
    const option = group.options.find(option => option.place.id === selectedId);
    if (!option) throw new Error('선택한 후보가 바뀌었어요. 다시 확인해 주세요.');
    const current = currentCandidateVisit(journey, group);
    const source = { ...option.place, planningSlot: group.slot };
    if (group.kind === 'STAY') journey = setPlanStay(journey, { ...source, planningSlot: 'stay' }, group.dayId, 1, option.fixed);
    else if (current) journey = replacePlanBusiness(journey, group.dayId, current.visitId!, source);
    else {
      journey = insertNearby(journey, group.dayId, group.anchorVisitId, source);
      if (group.slot) journey = { ...journey, days: journey.days.map(day => day.dayId !== group.dayId ? day : { ...day, places: day.places.map(place => place.id === source.id && place.anchorVisitId === group.anchorVisitId ? { ...place, planningSlot: group.slot } : place), planningGaps: day.planningGaps?.filter(gap => !(gap.slot === group.slot && gap.kind === group.kind)) }) };
    }
  }
  return normalizePlan({ ...journey, planStage: 'READY', businessCandidates: [] });
}
