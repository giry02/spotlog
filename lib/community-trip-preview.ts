import type { CommunityTrip } from './community-trips';
import { initialTrip, type TripState } from './trip-engine';

/** A local map snapshot; opening a public course never imports it into a trip. */
export function createCommunityTripPreview(trip: CommunityTrip): TripState {
  return {
    ...initialTrip(),
    stage: 'plan',
    region: trip.region,
    days: trip.days,
    theme: trip.theme,
    communitySourceId: trip.id,
    plan: trip.visits.map((visit, index) => ({
      ...visit,
      id: `community-preview-${trip.id}-${index}`,
      locked: false,
    })),
  };
}
