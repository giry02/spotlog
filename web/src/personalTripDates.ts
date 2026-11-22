import type { Journey } from './data';
import { addPlanDay, isPersonalPlan, normalizePlan, removePlanDay, setPlanDates } from './tripPlan.ts';

function dateNumber(value: string): number {
  const at = Date.parse(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(at) || new Date(at).toISOString().slice(0, 10) !== value) throw new Error('여행 날짜를 확인해 주세요.');
  return at;
}

/** Dates are chosen inside the saved trip. Only a completely empty itinerary may shrink automatically. */
export function setPersonalTripDateRange(source: Journey, startDate: string, endDate = ''): Journey {
  if (!isPersonalPlan(source) || source.visibility !== 'PRIVATE' || source.trash) throw new Error('수정할 내 여행을 확인해 주세요.');
  const journey = normalizePlan(source);
  if (!startDate) {
    if (endDate) throw new Error('출발 날짜를 먼저 정해 주세요.');
    return setPlanDates(journey, '');
  }
  const start = dateNumber(startDate);
  if (!endDate) return setPlanDates(journey, startDate);
  const count = (dateNumber(endDate) - start) / 86400000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new Error('여행 기간은 출발일부터 1~30일로 정해 주세요.');
  const hasContent = journey.days.some(day => day.places.length || day.blocks.length || day.story.trim() || day.planningGaps?.length) || Boolean(journey.businessCandidates?.length);
  if (count < journey.days.length && hasContent) throw new Error('담은 장소와 기록을 유지했어요. 기간을 줄이려면 DAY 메뉴에서 일정을 먼저 확인해 주세요.');
  let next = journey;
  while (next.days.length < count) next = addPlanDay(next);
  while (next.days.length > count) next = removePlanDay(next, next.days.at(-1)!.dayId!);
  return setPlanDates(next, startDate);
}
