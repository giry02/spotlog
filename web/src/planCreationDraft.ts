import type { Place } from './data';

export const PLAN_CREATION_KEY = 'spotlog.web.plan-creation.v1';
export interface PlanCreationDraft {
  region: string;
  selectedIds: string[];
  dayCount: number;
  title: string;
  startDate: string;
}
export function isPlanCreationDraft(value: unknown): value is PlanCreationDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<PlanCreationDraft>;
  return typeof draft.region === 'string' && Array.isArray(draft.selectedIds)
    && draft.selectedIds.every(id => typeof id === 'string')
    && Number.isInteger(draft.dayCount) && draft.dayCount! >= 1 && draft.dayCount! <= 7
    && typeof draft.title === 'string' && typeof draft.startDate === 'string'
    && (draft.startDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(draft.startDate));
}
/** Removed places are discarded; an intentionally empty selection stays empty. */
export function restorePlanCreationDraft(value: PlanCreationDraft | null, places: Place[]): PlanCreationDraft {
  const regions = [...new Set(places.map(place => place.area.split(' ')[0]))];
  const region = value && regions.includes(value.region) ? value.region : regions[0] ?? '';
  const available = places.filter(place => place.area.split(' ')[0] === region).map(place => place.id);
  return {
    region,
    selectedIds: value ? value.selectedIds.filter(id => available.includes(id)) : available,
    dayCount: value?.dayCount ?? 2,
    title: value?.title ?? '',
    startDate: value?.startDate ?? '',
  };
}
