import type { Journey, Place } from './data';
import { createJourneyFromPlaces } from './journeyCreation';
import { addVisit } from './visits';

export interface TripPlacementRequest {
  journeyId: string | null;
  title: string;
  region: string;
  dayCount: number;
  startDate: string;
  targetDay: number;
  places: Place[];
}

export type TripPlacementResult =
  | { ok: true; journeys: Journey[]; journeyId: string; targetDay: number; addedCount: number; duplicateCount: number }
  | { ok: false; error: string };

export function tripPeriodLabel(days: number): string {
  return days === 1 ? '당일치기' : `${days - 1}박 ${days}일`;
}

/** Revalidate at confirmation time. This helper never persists data or changes public originals. */
export function applyTripPlacement(journeys: Journey[], request: TripPlacementRequest, author: string): TripPlacementResult {
  const places = [...new Map(request.places.map((place) => [place.id, place])).values()];
  if (!places.length) return { ok: false, error: '먼저 담을 장소를 선택해 주세요.' };
  if (!Number.isInteger(request.targetDay) || request.targetDay < 1) return { ok: false, error: '담을 DAY를 선택해 주세요.' };

  let target: Journey;
  if (request.journeyId !== null) {
    const existing = journeys.find((journey) => journey.id === request.journeyId);
    if (!existing || !existing.isMine) return { ok: false, error: '내 여행을 선택해 주세요. 다른 사람의 원본에는 담을 수 없어요.' };
    if (!existing.days.some((day) => day.day === request.targetDay)) return { ok: false, error: '선택한 DAY가 변경되었어요. 담을 날짜를 다시 확인해 주세요.' };
    // Existing duration, title, dates and all other DAYs are intentionally ignored by placement.
    target = existing;
  } else {
    if (!Number.isInteger(request.dayCount) || request.dayCount < 1 || request.dayCount > 7) return { ok: false, error: '여행 기간은 당일치기부터 6박 7일까지 선택할 수 있어요.' };
    if (request.targetDay > request.dayCount) return { ok: false, error: '선택한 여행 기간 안에서 담을 DAY를 골라 주세요.' };
    const created = createJourneyFromPlaces({ title: request.title, days: request.dayCount, startDate: request.startDate, places: [] }, author);
    if (!created) return { ok: false, error: '여행 제목과 출발 날짜를 확인해 주세요.' };
    target = { ...created, region: request.region.trim() || [...new Set(places.map((place) => place.area.trim().split(/\s+/)[0]))].filter(Boolean).join(' · ') || '국내', cover: places[0].image, summary: `저장한 ${places.length}곳으로 시작하는 여행입니다.` };
  }

  let addedCount = 0;
  for (const place of places) {
    const next = addVisit(target, request.targetDay, place);
    if (next !== target) addedCount += 1;
    target = next;
  }
  return {
    ok: true,
    journeys: request.journeyId === null ? [target, ...journeys] : journeys.map((journey) => journey.id === target.id ? target : journey),
    journeyId: target.id,
    targetDay: request.targetDay,
    addedCount,
    duplicateCount: places.length - addedCount,
  };
}
