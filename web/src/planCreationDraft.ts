import type { Journey, Place } from './data';
import { buildPersonalPlan, setPlanDates, setPlanStay } from './tripPlan.ts';

export const PLAN_CREATION_KEY = 'spotlog.web.plan-creation.v1';
export interface PlanCreationDraft {
  region: string;
  selectedIds: string[];
  dayCount: number;
  title: string;
  startDate: string;
  stayAssignments?: { placeId: string; startDay: number; nights: number }[];
}
export function isPlanCreationDraft(value: unknown): value is PlanCreationDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<PlanCreationDraft>;
  return typeof draft.region === 'string' && Array.isArray(draft.selectedIds)
    && draft.selectedIds.every(id => typeof id === 'string')
    && Number.isInteger(draft.dayCount) && draft.dayCount! >= 1 && draft.dayCount! <= 7
    && typeof draft.title === 'string' && typeof draft.startDate === 'string'
    && (draft.startDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(draft.startDate))
    && (draft.stayAssignments === undefined || Array.isArray(draft.stayAssignments) && new Set(draft.stayAssignments.map(item=>item?.placeId)).size===draft.stayAssignments.length && draft.stayAssignments.every(item=>item && typeof item.placeId==='string' && Number.isInteger(item.startDay) && item.startDay>=1 && item.startDay<=7 && Number.isInteger(item.nights) && item.nights>=1 && item.nights<=6));
}
/** Removed places are discarded; an intentionally empty selection stays empty. */
export function restorePlanCreationDraft(value: PlanCreationDraft | null, places: Place[]): PlanCreationDraft {
  const regions = [...new Set(places.map(place => place.area.split(' ')[0]))];
  const region = value && regions.includes(value.region) ? value.region : regions[0] ?? '';
  const available = places.filter(place => place.area.split(' ')[0] === region).map(place => place.id);
  return {
    region,
    selectedIds: value ? value.selectedIds.filter(id => available.includes(id)) : available,
    dayCount: value?.dayCount ?? 2,
    title: value?.title ?? '',
    startDate: value?.startDate ?? '',
    ...(value?.stayAssignments ? {stayAssignments:value.stayAssignments.filter(item=>places.some(place=>place.id===item.placeId&&place.kind==='STAY'))} : {}),
  };
}

/** Accommodation uses explicitly selected nights; never insert a hotel as a sightseeing base. */
export function createPlanFromCreationDraft(draft:PlanCreationDraft, places:Place[], author:string):Journey {
  const selected=draft.selectedIds.map(id=>places.find(place=>place.id===id));
  if(selected.some(place=>!place))throw new Error('저장 목록에서 빠진 장소가 있어요. 선택한 장소를 다시 확인해 주세요.');
  const visits=selected as Place[],stays=visits.filter(place=>place.kind==='STAY');
  let journey=setPlanDates(buildPersonalPlan(visits.filter(place=>place.kind!=='STAY'),draft.dayCount,draft.title,author),draft.startDate);
  const occupied=new Set<number>();
  for(const stay of stays){
    const assignment=draft.stayAssignments?.find(item=>item.placeId===stay.id);
    if(!assignment||!Number.isInteger(assignment.startDay)||!Number.isInteger(assignment.nights)||assignment.startDay<1||assignment.nights<1||assignment.startDay+assignment.nights>draft.dayCount)throw new Error(`${stay.name}의 숙박 시작 DAY와 박수를 선택해 주세요.`);
    for(let night=assignment.startDay;night<assignment.startDay+assignment.nights;night++){if(occupied.has(night))throw new Error('같은 숙박일에 숙소가 겹쳐요. 사용할 숙소 한 곳을 선택해 주세요.');occupied.add(night);}
    const clean={...structuredClone(stay),visitId:undefined,anchorVisitId:undefined,stayDayIds:undefined,bookingFixed:undefined,time:undefined,move:undefined,planningSlot:'stay' as const,note:stay.personal?stay.note:''};
    journey=setPlanStay(journey,clean,journey.days[assignment.startDay-1].dayId!,assignment.nights,false);
  }
  const region=[...new Set(visits.map(place=>place.area.split(' ')[0]))].join(' · ')||journey.region;
  return {...journey,region,cover:journey.cover||stays[0]?.image||'',title:draft.title.trim()||`${region} ${draft.dayCount===1?'당일':`${draft.dayCount-1}박 ${draft.dayCount}일`} 여행`,summary:`저장한 ${visits.length}곳으로 시작하는 내 여행`};
}
