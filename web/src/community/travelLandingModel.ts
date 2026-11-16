import type { Journey, Place } from '../data';
import type { HomeTripTemplate } from '../consumerPublicSeed';
import type { HomeRegionReference } from '../homeDiscovery';
import { isCurrentPublicTravelJournal, selectTravelHomeContent, type TravelHomeFilters } from './travelHomeModel.ts';

export type TravelSection = 'recommended' | 'courses' | 'journals';
export const travelLandingSection = (value: unknown): TravelSection => value === 'courses' || value === 'journals' ? value : 'recommended';

/** Compose the existing public projection with current course destinations; never look up a personal library. */
export function selectTravelLandingContent(templates: ReadonlyArray<HomeTripTemplate>, journals: ReadonlyArray<Journey>, places: ReadonlyArray<Place>, references: ReadonlyArray<HomeRegionReference>, filters: TravelHomeFilters) {
  const currentPlaces = new Map(places.map(item => [item.id, item]));
  const seen = new Set<string>();
  const approvedTemplates = templates.flatMap(template => {
    if (seen.has(template.id) || template.publicJourney && !isCurrentPublicTravelJournal(template.publicJourney, currentPlaces)) return [];
    const current = template.places.flatMap(place => { const approved = currentPlaces.get(place.id); return approved ? [approved] : []; });
    if (!current.length) return [];
    seen.add(template.id);
    return [{ ...template, places: current }];
  });
  const projection = selectTravelHomeContent(approvedTemplates, journals, places, references, filters);
  const visibleIds = new Set(projection.courses.map(item => item.id));
  return { ...projection, templates: approvedTemplates.filter(item => visibleIds.has(item.id)),
    regions: [...new Set(approvedTemplates.map(item => item.region.trim()).filter(Boolean))] };
}
