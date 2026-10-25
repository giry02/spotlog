import { findFood, findPlace, findStay, getNearbyRegisteredBusinesses } from './trip-data';
import { isTripExtension, validTravelDate, CANDIDATE_SLOTS } from './trip-extensions';
import type { TripAction, TripState, Visit } from './trip-engine';
import { findTripAnchor } from './trip-anchor';

type Invalid = (message?: string) => never;
const safeId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const int = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const bounded = (value: unknown, max: number, nonempty = false) => typeof value === 'string' && value.length <= max && (!nonempty || Boolean(value.trim()));
const time = (value: unknown) => value === '' || typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function parseExtensionAction(a: Record<string, unknown>, invalid: Invalid): TripAction | undefined {
  if (!isTripExtension(a as {type:string})) return;
  const fields: Record<string, string[]> = {
    'trip-meta': ['title','startDate'], 'visit-details':['id','note','time','durationMinutes'], 'stay-placement':['stayId','startDay','nights'], 'day-add':['afterDay'], 'day-copy':['day','toDay'], 'day-delete':['day'], 'visit-copy':['id','day'], 'candidate-propose':['ids','day','anchorId','slot'], 'candidate-select':['groupId','id'], 'candidate-apply':['selections'], 'candidate-reject':[], 'trash-list':[], 'trash':['id'], 'restore':['id'], 'delete-permanent':['id','confirmed'],
  };
  if (Object.keys(a).some(key => key !== 'type' && !fields[String(a.type)].includes(key))) invalid();
  if (a.type === 'trip-meta') {
    if (a.title === undefined && a.startDate === undefined) invalid();
    if (a.title !== undefined && !bounded(a.title, 100, true)) invalid();
    if (a.startDate !== undefined && a.startDate !== null && !validTravelDate(a.startDate)) invalid();
  }
  if (a.type === 'visit-details') {
    if (!safeId(a.id) || ['note','time','durationMinutes'].every(key => a[key] === undefined)) invalid();
    if (a.note !== undefined && !bounded(a.note, 1000)) invalid();
    if (a.time !== undefined && !time(a.time)) invalid();
    if (a.durationMinutes !== undefined && !int(a.durationMinutes, 0, 1440)) invalid();
  }
  if (a.type === 'stay-placement' && (!safeId(a.stayId) || !findStay(String(a.stayId)) || !int(a.startDay, 1, 29) || !int(a.nights, 1, 29))) invalid();
  if (a.type === 'day-add' && a.afterDay !== undefined && !int(a.afterDay,1,30)) invalid();
  if (a.type === 'day-copy' && (!int(a.day,1,30) || a.toDay !== undefined && !int(a.toDay,1,30))) invalid();
  if (a.type === 'day-delete' && !int(a.day,1,30)) invalid();
  if (a.type === 'visit-copy' && (!safeId(a.id) || a.day !== undefined && !int(a.day,1,30))) invalid();
  if (a.type === 'candidate-propose') {
    if (!Array.isArray(a.ids) || a.ids.length < 2 || a.ids.length > 6 || new Set(a.ids).size !== a.ids.length || a.ids.some(id => !safeId(id) || !findFood(id) && !findStay(id))) invalid();
    if (a.day !== undefined && !int(a.day,1,30)) invalid();
    if (a.anchorId !== undefined && (!safeId(a.anchorId) || !findTripAnchor(String(a.anchorId)))) invalid();
    if (a.slot !== undefined && !CANDIDATE_SLOTS.includes(a.slot as typeof CANDIDATE_SLOTS[number])) invalid();
  }
  if (a.type === 'candidate-select' && (!safeId(a.groupId) || !safeId(a.id))) invalid();
  if (a.type === 'candidate-apply' && a.selections !== undefined) {
    if (!Array.isArray(a.selections) || a.selections.length > 30 || a.selections.some(raw => !raw || typeof raw !== 'object' || Object.keys(raw).some(key=>!['groupId','id'].includes(key)) || !safeId(raw.groupId) || !safeId(raw.id))) invalid();
  }
  if (['trash','restore','delete-permanent'].includes(String(a.type)) && !safeId(a.id)) invalid();
  if (a.type === 'delete-permanent' && a.confirmed !== true) invalid();
  return a as unknown as TripAction;
}

export function validateVisitExtensions(v: Record<string, unknown>, invalid: Invalid) {
  if (v.note !== undefined && !bounded(v.note,1000)) invalid();
  if (v.time !== undefined && !time(v.time)) invalid();
  if (v.durationMinutes !== undefined && !int(v.durationMinutes,0,1440)) invalid();
  if (v.nights !== undefined && (v.kind !== 'stay' || !int(v.nights,1,29))) invalid();
}

export function validateStateExtensions(s: Record<string, unknown>, invalid: Invalid) {
  if (s.title !== undefined && !bounded(s.title,200,true)) invalid();
  if (s.startDate !== undefined && s.startDate !== null && !validTravelDate(s.startDate)) invalid();
  if (s.businessMode !== undefined && !['registered','demo'].includes(String(s.businessMode))) invalid();
  if (s.pendingCandidates !== undefined) {
    if (!Array.isArray(s.pendingCandidates) || s.pendingCandidates.length > 30) invalid();
    const ids = new Set<string>();
    for (const raw of s.pendingCandidates as Record<string,unknown>[]) {
      if (!raw || typeof raw !== 'object' || Object.keys(raw).some(key=>!['id','day','anchorId','kind','slot','optionIds','selectedId'].includes(key)) || !safeId(raw.id) || ids.has(String(raw.id)) || !int(raw.day,1,Number(s.days)) || !safeId(raw.anchorId) || !findTripAnchor(String(raw.anchorId)) || !['food','cafe','shop','stay'].includes(String(raw.kind)) || !bounded(raw.slot,120,true)) invalid();
      ids.add(String(raw.id));
      if (findTripAnchor(String(raw.anchorId))!.region !== s.region) invalid();
      if (!Array.isArray(raw.optionIds) || raw.optionIds.length < 2 || raw.optionIds.length > 6 || new Set(raw.optionIds).size !== raw.optionIds.length) invalid();
      for (const id of raw.optionIds as string[]) {
        const food = findFood(id), stay = findStay(id);
        const nearby = s.businessMode === 'registered' ? id === raw.anchorId || getNearbyRegisteredBusinesses(String(raw.anchorId), raw.kind === 'stay' ? 'STAY' : raw.kind === 'cafe' ? 'CAFE' : raw.kind === 'shop' ? 'SHOP' : 'FOOD', {expanded: s.nearbyExpanded === true}).some(item=>item.entity.id===id) : undefined;
        if (raw.kind === 'stay' ? !stay || (nearby === undefined ? !stay.near.includes(String(raw.anchorId)) : !nearby) || Number(raw.day) >= Number(s.days) : !food || (nearby === undefined ? food.placeId !== raw.anchorId : !nearby) || (raw.kind === 'cafe' ? food.cuisine !== '카페' : raw.kind === 'shop' ? String(food.cuisine) !== '상점' : ['카페','상점'].includes(food.cuisine))) invalid();
      }
      if (raw.selectedId !== undefined && !(raw.optionIds as string[]).includes(String(raw.selectedId))) invalid();
    }
  }
}
