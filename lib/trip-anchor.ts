import { findPlace, getRegisteredEntity } from './trip-data';

/** A verified registered business can be a search anchor without inventing a landmark. */
export function findTripAnchor(id: string | null | undefined) {
  return findPlace(id ?? null) ?? getRegisteredEntity(id) ?? undefined;
}
