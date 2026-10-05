import type { Journey, JourneyDay, TripTravelProgress, VisitProgressStatus } from './data';

export function visitProgress(journey: Journey, visitId?: string): VisitProgressStatus | 'pending' {
  return visitId ? journey.travelProgress?.visits[visitId]?.status ?? 'pending' : 'pending';
}

/** Keep progress only for surviving visits in this private itinerary. */
export function reconcileTravelProgress(journey: Journey): Journey {
  const progress = journey.travelProgress;
  if (!progress) return journey;
  if (!journey.isMine || journey.purpose !== 'PLAN' || journey.visibility !== 'PRIVATE') {
    const { travelProgress: _progress, ...rest } = journey;
    return rest;
  }
  const visitDays = new Map(journey.days.flatMap(day => day.places.map(place => [place.visitId, day] as const)));
  const visits = Object.fromEntries(Object.entries(progress.visits).filter(([id]) => visitDays.has(id)));
  const cursorDay = progress.visitId ? visitDays.get(progress.visitId) : undefined;
  const day = cursorDay ?? journey.days.find(day => day.dayId === progress.dayId) ?? journey.days[0];
  return { ...journey, travelProgress: { dayId: day?.dayId ?? '', visits,
    ...(cursorDay ? { visitId: progress.visitId } : {}) } };
}

export function nextPendingInDay(journey: Journey, day: JourneyDay, afterVisitId?: string) {
  const after = day.places.findIndex(place => place.visitId === afterVisitId);
  const remaining = day.places.filter(place => visitProgress(journey, place.visitId) === 'pending');
  return remaining.find(place => day.places.indexOf(place) > after) ?? remaining[0];
}

export function nextPendingDay(journey: Journey, dayId: string) {
  const index = journey.days.findIndex(day => day.dayId === dayId);
  return [...journey.days.slice(index + 1), ...journey.days.slice(0, index)]
    .find(day => nextPendingInDay(journey, day));
}

export function rememberTravelPosition(journey: Journey, dayId: string, visitId?: string): Journey {
  if (!journey.isMine || journey.purpose !== 'PLAN' || journey.visibility !== 'PRIVATE') throw new Error('내 여행에서만 진행을 기록할 수 있어요.');
  const day = journey.days.find(day => day.dayId === dayId);
  if (!day || visitId && !day.places.some(place => place.visitId === visitId)) throw new Error('방문 위치가 바뀌었어요. 일정을 다시 확인해 주세요.');
  const travelProgress: TripTravelProgress = { dayId, visits: journey.travelProgress?.visits ?? {}, ...(visitId ? { visitId } : {}) };
  return { ...journey, travelProgress };
}

export function setVisitProgress(journey: Journey, dayId: string, visitId: string, status: VisitProgressStatus | 'pending', now = new Date()): Journey {
  if (!['pending', 'done', 'skipped'].includes(status) || !Number.isFinite(now.getTime())) throw new Error('방문 상태를 확인해 주세요.');
  const result = rememberTravelPosition(journey, dayId, visitId);
  const visits = { ...result.travelProgress!.visits };
  if (status === 'pending') delete visits[visitId];
  else visits[visitId] = { status, recordedAt: now.toISOString() };
  const next = status === 'pending' ? visitId : nextPendingInDay({ ...result, travelProgress: { ...result.travelProgress!, visits } }, result.days.find(day => day.dayId === dayId)!, visitId)?.visitId;
  return { ...result, travelProgress: { dayId, visits, ...(next ? { visitId: next } : {}) } };
}

export function clearVisitProgress(journey: Journey, visitId: string): Journey {
  if (!journey.travelProgress?.visits[visitId]) return journey;
  const visits = { ...journey.travelProgress.visits };
  delete visits[visitId];
  return { ...journey, travelProgress: { ...journey.travelProgress, visits } };
}

/** Cursor navigation does not invalidate undo of the last actual itinerary change. */
export function tripChangeIdentity(journey: Journey): string {
  const { travelProgress, ...rest } = journey;
  return JSON.stringify({ ...rest, ...(travelProgress && Object.keys(travelProgress.visits).length ? { visitStates: travelProgress.visits } : {}) });
}
