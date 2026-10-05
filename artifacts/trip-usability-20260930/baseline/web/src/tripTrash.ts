import type { Journey, JourneyStatus } from './data';

export const TRASH_RETENTION_MONTHS = 6;
export const TRASH_TIME_ZONE = 'Asia/Seoul';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface JourneyTrash {
  deletedAt: string;
  expiresAt: string;
  ownerId: string;
  previousVisibility: 'PUBLIC' | 'PRIVATE';
  previousStatus: JourneyStatus;
}
export type TrashableJourney = Journey & { trash?: JourneyTrash };
export type TrashFailure = 'NOT_FOUND' | 'NOT_OWNER' | 'ALREADY_DELETED' | 'NOT_DELETED' | 'EXPIRED' | 'STALE' | 'INVALID';

const errors: Record<TrashFailure, string> = {
  NOT_FOUND: '이 여행을 찾을 수 없어요. 목록을 다시 확인해 주세요.',
  NOT_OWNER: '내 여행만 관리할 수 있어요.',
  ALREADY_DELETED: '이미 휴지통에 있는 여행이에요.',
  NOT_DELETED: '이미 복원되었거나 휴지통에 없는 여행이에요.',
  EXPIRED: '6개월 보관 기간이 지나 복원할 수 없어요.',
  STALE: '이 여행의 상태가 바뀌었어요. 목록에서 다시 선택해 주세요.',
  INVALID: '휴지통 정보를 확인하지 못했어요. 현재 기록은 그대로 유지됩니다.',
};
export class TripTrashError extends Error {
  readonly code: TrashFailure;
  constructor(code: TrashFailure) { super(errors[code]); this.name = 'TripTrashError'; this.code = code; }
}

function validTime(value: string | Date): number {
  const result = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(result)) throw new TripTrashError('INVALID');
  return result;
}

/** Six calendar months in Korea time, clamped to the last day of the target month.
 * Store the resulting instant, rather than recalculating in each device's timezone.
 * Production must receive these timestamps from the service clock. */
export function trashExpiry(deletedAt: string | Date): string {
  const local = new Date(validTime(deletedAt) + KST_OFFSET_MS);
  const target = new Date(local);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + TRASH_RETENTION_MONTHS);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(local.getUTCDate(), lastDay));
  return new Date(target.getTime() - KST_OFFSET_MS).toISOString();
}

export function isJourneyTrash(value: unknown): value is JourneyTrash {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<JourneyTrash>;
  if (typeof item.ownerId !== 'string' || !item.ownerId.trim() || typeof item.deletedAt !== 'string' || typeof item.expiresAt !== 'string') return false;
  if (!['PUBLIC', 'PRIVATE'].includes(item.previousVisibility ?? '') || !['PLANNING', 'TRAVELING', 'PUBLISHED'].includes(item.previousStatus ?? '')) return false;
  try { return trashExpiry(item.deletedAt) === new Date(validTime(item.expiresAt)).toISOString(); } catch { return false; }
}

/** Use for ALL browse, edit, publication, counts and route entry points. A malformed
 * tombstone is hidden as well; it must never accidentally make a deleted trip public. */
export const isJourneyInTrash = (journey: TrashableJourney): boolean => journey.trash !== undefined;
export const activeJourneys = (journeys: TrashableJourney[]): TrashableJourney[] => journeys.filter(journey => !isJourneyInTrash(journey));
/** Editors which operate on visible records must not erase the hidden trash when
 * saving their result. A stale active record cannot resurrect the same deleted ID. */
export function mergeActiveJourneyChanges(current: TrashableJourney[], nextActive: TrashableJourney[]): TrashableJourney[] {
  const deleted = current.filter(isJourneyInTrash);
  const deletedIds = new Set(deleted.map(journey => journey.id));
  if (nextActive.some(journey => isJourneyInTrash(journey) || deletedIds.has(journey.id))) throw new TripTrashError('STALE');
  return [...nextActive, ...deleted];
}
export function isTrashExpired(journey: TrashableJourney, now: Date = new Date()): boolean {
  return !isJourneyTrash(journey.trash) || validTime(now) >= Date.parse(journey.trash.expiresAt);
}
export function listTrashedJourneys(journeys: TrashableJourney[], ownerId: string, now: Date = new Date()): TrashableJourney[] {
  return journeys.filter(journey => journey.isMine && isJourneyTrash(journey.trash) && journey.trash.ownerId === ownerId && !isTrashExpired(journey, now))
    .sort((a, b) => Date.parse(b.trash!.deletedAt) - Date.parse(a.trash!.deletedAt));
}

function requireJourney(journeys: TrashableJourney[], id: string, ownerId: string): TrashableJourney {
  const journey = journeys.find(item => item.id === id);
  if (!journey) throw new TripTrashError('NOT_FOUND');
  if (!ownerId.trim() || !journey.isMine || (journey.trash && journey.trash.ownerId !== ownerId)) throw new TripTrashError('NOT_OWNER');
  return journey;
}
function requireTombstone(journey: TrashableJourney, expectedDeletedAt?: string): JourneyTrash {
  if (!isJourneyInTrash(journey)) throw new TripTrashError('NOT_DELETED');
  if (!isJourneyTrash(journey.trash)) throw new TripTrashError('INVALID');
  if (expectedDeletedAt && journey.trash.deletedAt !== expectedDeletedAt) throw new TripTrashError('STALE');
  return journey.trash;
}
function makePrivate(journey: TrashableJourney, status: JourneyStatus): TrashableJourney {
  const result: TrashableJourney = { ...journey, visibility: 'PRIVATE', status: status === 'PUBLISHED' ? 'PLANNING' : status };
  // A recovered editor draft must not re-publish the trip when it is resumed.
  if (result.editorDraft) result.editorDraft = { ...result.editorDraft, value: { ...result.editorDraft.value, visibility: 'PRIVATE', status: result.editorDraft.value.status === 'PUBLISHED' ? 'PLANNING' : result.editorDraft.value.status } };
  return result;
}

export function moveJourneyToTrash(journeys: TrashableJourney[], id: string, ownerId: string, now: Date = new Date()): TrashableJourney[] {
  const journey = requireJourney(journeys, id, ownerId);
  if (isJourneyInTrash(journey)) throw new TripTrashError('ALREADY_DELETED');
  const deletedAt = new Date(validTime(now)).toISOString();
  const next = makePrivate(journey, journey.status);
  next.trash = { deletedAt, expiresAt: trashExpiry(deletedAt), ownerId, previousVisibility: journey.visibility, previousStatus: journey.status };
  return journeys.map(item => item.id === id ? next : item);
}

export function restoreJourneyFromTrash(journeys: TrashableJourney[], id: string, ownerId: string, expectedDeletedAt?: string, now: Date = new Date()): TrashableJourney[] {
  const journey = requireJourney(journeys, id, ownerId);
  const tombstone = requireTombstone(journey, expectedDeletedAt);
  if (isTrashExpired(journey, now)) throw new TripTrashError('EXPIRED');
  const next = makePrivate(journey, tombstone.previousStatus);
  delete next.trash;
  return journeys.map(item => item.id === id ? next : item);
}

/** Removes this record only. Shared media, bookmarks, other itineraries and original
 * journals are not removed. Server media garbage collection is a separate job. */
export function permanentlyDeleteJourney(journeys: TrashableJourney[], id: string, ownerId: string, expectedDeletedAt?: string): TrashableJourney[] {
  const journey = requireJourney(journeys, id, ownerId);
  requireTombstone(journey, expectedDeletedAt);
  return journeys.filter(item => item.id !== id);
}
