import type { Journey } from './data';

/** Completion is not publication: private completed records stay outside every public projection. */
export function isPublicJournal(journey: Journey): boolean {
  return journey.visibility === 'PUBLIC' && journey.status === 'PUBLISHED' && journey.purpose !== 'PLAN' && !journey.trash;
}

export function journalVisibilityLabel(journey: Journey): string {
  if (isPublicJournal(journey)) return '공개 여행기';
  if (journey.visibility === 'PRIVATE' && journey.status === 'PUBLISHED' && journey.purpose !== 'PLAN' && !journey.trash) return '비공개 여행기';
  return journey.visibility === 'PUBLIC' ? '공개 전 초안' : '비공개 초안';
}

export function publicJournalCopyCount(journeys: ReadonlyArray<Journey>): number {
  return journeys.filter(isPublicJournal).reduce((sum, item) => sum + item.saves, 0);
}
