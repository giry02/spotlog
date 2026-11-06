import type { Journey, JourneyDay, Place } from './data';
import { nextPendingDay, nextPendingInDay, visitProgress } from './tripProgress.ts';

export const RECENT_TRIP_KEY = 'spotlog.web.recent-trip.v1';
export type TripContinuation = { journey: Journey; day: JourneyDay; place?: Place; complete: boolean; needsReview: boolean };
export const isRecentTripId = (value: unknown): value is string | null => value === null || typeof value === 'string' && value.trim().length > 0;

/** Device itinerary only; a public journal or trashed trip must never become a resume target. */
export function tripContinuation(journeys: Journey[], recentId: string | null): TripContinuation | null {
  const plans = journeys.filter(journey => journey.isMine && journey.purpose === 'PLAN' && journey.visibility === 'PRIVATE' && !journey.trash && journey.days.length);
  const journey = plans.find(plan => plan.id === recentId) ?? plans[0];
  if (!journey) return null;
  const rememberedDay = journey.days.find(day => day.dayId === journey.travelProgress?.dayId) ?? journey.days[0];
  const pendingDay = nextPendingInDay(journey, rememberedDay) ? rememberedDay : nextPendingDay(journey, rememberedDay.dayId ?? '');
  const day = pendingDay ?? rememberedDay;
  const cursor = day.places.find(place => place.visitId === journey.travelProgress?.visitId && visitProgress(journey, place.visitId) === 'pending');
  const place = cursor ?? nextPendingInDay(journey, day);
  const needsReview = journey.planStage === 'DRAFT' || Boolean(journey.businessCandidates?.some(group => group.options.length));
  return { journey, day, ...(place ? { place } : {}), complete: !place && journey.days.some(day => day.places.length > 0), needsReview };
}
