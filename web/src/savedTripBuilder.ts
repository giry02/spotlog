import type { Journey, Place } from './data';
import { buildSavedTravelDraft } from './aiTravelDraft';
import { createJourneyFromPlaces } from './journeyCreation';

export type SavedTripMode = 'auto' | 'manual';
export interface SavedTripDraft {
  active: boolean;
  mode: SavedTripMode;
  dayCount: number;
  activeDay: number;
  startDate: string;
  title: string;
  automaticIds: string[];
  assignments: { placeId: string; day: number | null }[];
}
export const newSavedTripDraft = (): SavedTripDraft => ({ active: false, mode: 'auto', dayCount: 2, activeDay: 1, startDate: '', title: '', automaticIds: [], assignments: [] });
export const savedTripPeriod = (days: number) => days === 1 ? '당일' : `${days - 1}박 ${days}일`;
export function validTripDate(date: string): boolean {
  if (!date) return true;
  const parsed = new Date(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
export function savedTripDate(date: string, day: number): string {
  if (!date || !validTripDate(date)) return '';
  return new Date(Date.parse(`${date}T00:00:00Z`) + (day - 1) * 86400000).toISOString().slice(0, 10);
}
export function resizeSavedTrip(draft: SavedTripDraft, count: number): SavedTripDraft {
  if (!Number.isInteger(count) || count < 1 || count > 7) return draft;
  return { ...draft, dayCount: count, activeDay: Math.min(count, draft.activeDay),
    assignments: draft.assignments.map(item => item.day && item.day > count ? { ...item, day: null } : item) };
}
export function pickSavedTripPlace(draft: SavedTripDraft, placeId: string): SavedTripDraft {
  if (draft.mode === 'auto') return { ...draft, automaticIds: draft.automaticIds.includes(placeId) ? draft.automaticIds.filter(id => id !== placeId) : [...draft.automaticIds, placeId] };
  const current = draft.assignments.find(item => item.placeId === placeId);
  const rest = draft.assignments.filter(item => item.placeId !== placeId);
  return { ...draft, assignments: current?.day === draft.activeDay ? rest : [...rest, { placeId, day: draft.activeDay }] };
}
export function forgetSavedTripPlace(draft: SavedTripDraft, placeId: string): SavedTripDraft {
  return { ...draft, automaticIds: draft.automaticIds.filter(id => id !== placeId), assignments: draft.assignments.filter(item => item.placeId !== placeId) };
}
export function reorderSavedTripPlace(draft: SavedTripDraft, placeId: string, direction: -1 | 1): SavedTripDraft {
  const sameDay = draft.assignments.filter(item => item.day === draft.activeDay);
  const index = sameDay.findIndex(item => item.placeId === placeId);
  const other = sameDay[index + direction];
  if (index < 0 || !other) return draft;
  const assignments = [...draft.assignments];
  const from = assignments.findIndex(item => item.placeId === placeId), to = assignments.findIndex(item => item.placeId === other.placeId);
  [assignments[from], assignments[to]] = [assignments[to], assignments[from]];
  return { ...draft, assignments };
}

/** Only selected saved places are used. Manual DAY and order are never optimized. */
export function buildSavedTrip(draft: SavedTripDraft, places: Place[]): Journey {
  if (!Number.isInteger(draft.dayCount) || draft.dayCount < 1 || draft.dayCount > 7) throw new Error('여행 기간을 확인해 주세요.');
  if (!validTripDate(draft.startDate)) throw new Error('출발 날짜를 확인해 주세요.');
  const ids = draft.mode === 'auto' ? draft.automaticIds : draft.assignments.map(item => item.placeId);
  if (!ids.length) throw new Error('가고 싶은 장소를 한 곳 이상 담아 주세요.');
  if (new Set(ids).size !== ids.length) throw new Error('같은 장소가 중복되어 있어요. 담은 장소를 확인해 주세요.');
  const byId = new Map(places.map(place => [place.id, place]));
  if (ids.some(id => !byId.has(id))) throw new Error('저장 목록에서 빠진 장소가 있어요. 담은 장소를 다시 확인해 주세요.');
  const selected = ids.map(id => byId.get(id)!);
  const region = [...new Set(selected.map(place => place.area.split(/\s+/)[0]))].join(' · ') || '국내';
  const title = draft.title.trim() || `${region} ${savedTripPeriod(draft.dayCount)} 여행`;
  const base = createJourneyFromPlaces({ title, days: draft.dayCount, startDate: draft.startDate, places: [] }, 'Spotlog 여행자');
  if (!base) throw new Error('여행 제목과 날짜를 확인해 주세요.');
  let result: Journey;
  if (draft.mode === 'auto') {
    const generated = buildSavedTravelDraft(selected, draft.dayCount);
    if (!generated.journey) throw new Error(generated.errors.join(' ') || '일정을 나누지 못했어요. 다시 시도해 주세요.');
    result = { ...generated.journey, recommendationKind: undefined, title, dateRange: base.dateRange, days: generated.journey.days.map((day, index) => ({ ...day, date: base.days[index].date })) };
  } else {
    if (draft.assignments.some(item => item.day === null || !Number.isInteger(item.day) || item.day < 1 || item.day > draft.dayCount)) throw new Error('아직 DAY를 정하지 않은 장소를 배치해 주세요.');
    result = { ...base, region, cover: selected[0].image, summary: `직접 담은 ${selected.length}곳으로 만든 여행입니다.`,
      days: base.days.map(day => {
        const visits = draft.assignments.filter(item => item.day === day.day).map(item => ({ ...structuredClone(byId.get(item.placeId)!), visitId: crypto.randomUUID(), time: undefined, move: '이동시간 확인 필요' }));
        return { ...day, places: visits, blocks: visits.map(place => ({ id: `block-${place.visitId}`, type: 'PLACE' as const, placeId: place.id, visitId: place.visitId })) };
      }) };
  }
  return result;
}
