import type { SavedTripDraft } from './savedTripBuilder';

export const SAVED_TRIP_DRAFT_KEY = 'spotlog.web.saved-trip-draft.v1';

/** Persist unfinished DAY choices without treating them as a created itinerary. */
export function isSavedTripDraft(value: unknown): value is SavedTripDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as Partial<SavedTripDraft>;
  if (typeof draft.active !== 'boolean' || !['auto', 'manual'].includes(draft.mode ?? '')
    || !Number.isInteger(draft.dayCount) || draft.dayCount! < 1 || draft.dayCount! > 7
    || !Number.isInteger(draft.activeDay) || draft.activeDay! < 1 || draft.activeDay! > draft.dayCount!
    || typeof draft.startDate !== 'string' || draft.startDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate)
    || typeof draft.title !== 'string' || !Array.isArray(draft.automaticIds) || !Array.isArray(draft.assignments)) return false;
  if (!draft.automaticIds.every(id => typeof id === 'string' && id.length > 0) || new Set(draft.automaticIds).size !== draft.automaticIds.length) return false;
  const assigned = new Set<string>();
  return draft.assignments.every(item => {
    if (!item || typeof item !== 'object' || typeof item.placeId !== 'string' || !item.placeId || assigned.has(item.placeId)
      || item.day !== null && (!Number.isInteger(item.day) || item.day < 1 || item.day > draft.dayCount!)) return false;
    assigned.add(item.placeId); return true;
  });
}
