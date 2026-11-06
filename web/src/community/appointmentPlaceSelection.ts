import type { Place } from '../data';
import type { AppointmentInput } from './platformModel';

/** Replace a derived venue name, while preserving a separately typed meeting point. */
export function selectAppointmentPlace(input: AppointmentInput, placeId: string, places: ReadonlyArray<Place>): AppointmentInput {
  const selected = placeId ? places.find(place => place.id === placeId) : undefined;
  if (placeId && !selected) return input;
  const previous = places.find(place => place.id === input.placeId);
  const point = input.meetingPoint?.trim() || '';
  const derived = !point || Boolean(previous && point === previous.name.trim());
  return { ...input, placeId, ...(derived ? { meetingPoint: selected?.name ?? '' } : {}) };
}
