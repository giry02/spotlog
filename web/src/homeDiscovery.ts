import type { Place, PlaceKind } from './data';
import { interestPlaceRegion } from './interestCollectionStore.ts';

export interface HomeRegionReference {
  category: string;
  referenceId: string;
  name: string;
}

export interface HomePlaceFilters {
  region?: string;
  district?: string;
  query?: string;
  kind?: PlaceKind | 'ALL';
}

/** Display grouping for an already approved public catalogue, never a publication check. */
export function publicPlaceRegion(place: Place, references: ReadonlyArray<HomeRegionReference>): string {
  const regionId = (place as Place & { regionId?: string }).regionId;
  const registered = regionId && references.find(reference => reference.category === 'REGION'
    && reference.referenceId === regionId && reference.name.trim());
  return registered ? registered.name.trim() : interestPlaceRegion(place);
}

const normalizedQuery = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');

/** Home and place-guide searches intersect their scopes and preserve catalogue ordering. */
export function filterHomePlaces(places: ReadonlyArray<Place>, filters: HomePlaceFilters, references: ReadonlyArray<HomeRegionReference>): Place[] {
  const region = filters.region?.trim() || '';
  const query = normalizedQuery(filters.query || '');
  const district = normalizedQuery(filters.district || '');
  return places.filter(place => {
    if (region && publicPlaceRegion(place, references) !== region) return false;
    if (district && !normalizedQuery(`${place.area} ${place.address || ''}`).includes(district)) return false;
    if (filters.kind && filters.kind !== 'ALL' && place.kind !== filters.kind) return false;
    const searchable = [place.area, place.address, place.name, place.hook, place.description, place.note, ...(place.tags ?? [])]
      .filter(Boolean).join(' ');
    return !query || normalizedQuery(searchable).includes(query);
  });
}

/** Give each everyday place type a first card, then retain the remaining editorial order. */
export function homePlacePreview(places: ReadonlyArray<Place>, limit = 4): Place[] {
  if (!Number.isFinite(limit) || limit < 1) return [];
  const seen = new Set<string>();
  const unique = places.filter(place => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
  const prioritized: Place[] = [];
  for (const kind of ['FOOD', 'CAFE', 'LANDMARK', 'STAY'] as const) {
    const first = unique.find(place => place.kind === kind);
    if (first) prioritized.push(first);
  }
  const chosen = new Set(prioritized.map(place => place.id));
  return [...prioritized, ...unique.filter(place => !chosen.has(place.id))].slice(0, Math.floor(limit));
}
