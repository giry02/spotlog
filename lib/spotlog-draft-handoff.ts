import type { TripState } from './trip-engine';
import { visitName } from './trip-engine';
import { findFood, findPlace, findStay } from './trip-data';
import { isSpotlogDraftHandoff, type SpotlogDraftHandoff, type SpotlogContextPlace } from './spotlog-app-bridge';
/** Browser-owned export, never an LLM action. No photos, notes, booking details, times, coordinates or source trip/visit IDs are exported. */
export function buildSpotlogDraftFromTrip(state: TripState): SpotlogDraftHandoff {
  if (!state.plan.length || !state.region || !Number.isInteger(state.days) || state.days < 1 || state.days > 30) throw new Error('앱으로 가져올 일정과 지역을 먼저 확인해 주세요.');
  const kinds: Record<string, SpotlogContextPlace['kind']> = { place: 'LANDMARK', food: 'FOOD', cafe: 'CAFE', shop: 'SHOP', stay: 'STAY' };
  const draft: SpotlogDraftHandoff = { title: (state.title || `${state.region} ${state.days}일 여행`).slice(0, 150), region: state.region, days: Array.from({ length: state.days }, (_, index) => ({ day: index + 1, places: state.plan.filter(visit => visit.day === index + 1).map((visit, order) => {
    const source = findPlace(visit.entityId) ?? findFood(visit.entityId) ?? findStay(visit.entityId);
    return { id: visit.entityId ?? `unresolved-${index + 1}-${order + 1}`, name: (visit.locked ? '예약 숙소 (정보 미전달)' : visitName(visit)).slice(0, 150), kind: kinds[visit.kind], area: (source?.region ?? state.region ?? '').slice(0, 150), ...(source && !visit.locked && 'address' in source && source.address ? { address: source.address.slice(0, 500) } : {}) };
  }) })) };
  if (!isSpotlogDraftHandoff(draft)) throw new Error('앱으로 가져올 DAY·방문 수나 정보 크기를 확인해 주세요. 전체 일정은 일부를 빼지 않고 가져와야 해요.');
  return draft;
}
