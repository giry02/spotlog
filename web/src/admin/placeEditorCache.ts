import type { AdminPlace, PlaceContent } from './types';

export interface PlaceEditorEntry { baseRevision: number; content: PlaceContent }
export type PlaceEditorEntries = Record<string, PlaceEditorEntry>;
export type PlaceEditorStorage = Pick<Storage, 'getItem' | 'setItem'>;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string');
const optionalStrings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => value[key] === undefined || typeof value[key] === 'string');
const provenance = (value: unknown, keys: string[]) => value === undefined || record(value) && ['CATALOG', 'CSV', 'STAFF', 'SYNTHETIC'].includes(String(value.origin)) && optionalStrings(value,keys);
const tags = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string');
const rights = (value: unknown) => record(value) && ['display', 'store', 'modify', 'ai'].every(key => typeof value[key] === 'boolean');
const integer = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Unfinished drafts may be incomplete; their nested shape must still be safe to edit. */
export function isPlaceEditorContent(value: unknown): value is PlaceContent {
  if (!record(value) || !['LANDMARK', 'FOOD', 'CAFE', 'STAY', 'SHOP'].includes(String(value.kind)) || !['OPEN', 'TEMP_CLOSED', 'CLOSED', 'CHECK'].includes(String(value.operation))) return false;
  if (!strings(value, ['name', 'companyId', 'area', 'address', 'description', 'provider', 'sourceUrl', 'checkedAt']) || !tags(value.tags) || !rights(value.rights)) return false;
  if (!optionalStrings(value,['regionId','visitDuration','hook','creatorLabel']) || !provenance(value.provenance,['sourcePlaceId','sourceRecordId','scope','note'])) return false;
  const location = value.location, guide = value.guide, ai = value.ai;
  if (!record(location) || !strings(location, ['reference', 'sourceUrl', 'checkedAt']) || typeof location.verified !== 'boolean' || !['lat', 'lng'].every(key => location[key] === null || typeof location[key] === 'number' && Number.isFinite(location[key]))) return false;
  if (!record(guide) || !strings(guide, ['hours', 'bestTime', 'facilities', 'menu', 'lodging', 'access', 'english', 'sourceUrl', 'checkedAt']) || !['MISSING', 'DRAFT', 'REVIEWED', 'STALE'].includes(String(guide.englishStatus)) || !integer(guide.sourceRevision)) return false;
  if (!record(ai) || !strings(ai, ['text', 'sourceUrl', 'provider', 'checkedAt']) || !tags(ai.tags) || typeof ai.allowed !== 'boolean' || !integer(ai.version)) return false;
  return Array.isArray(value.media) && value.media.every(media => record(media) && strings(media, ['mediaId', 'url', 'caption', 'alt', 'provider', 'author', 'sourceUrl', 'license', 'licenseUrl', 'checkedAt']) && ['PHOTO', 'VIDEO', 'MOTION'].includes(String(media.type)) && typeof media.cover === 'boolean' && typeof media.withdrawn === 'boolean' && rights(media.rights) && provenance(media.provenance,['sourceId','sourcePlaceId','imageSourceUrl','publishedAt','originalTitle','changes','reuseNote','objectPosition']));
}

export function placeEditorKey(operatorId: string): string { return 'spotlog.admin.place-editor.v2.LOCAL.' + encodeURIComponent(operatorId); }
function browserStorage(): PlaceEditorStorage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
export function readPlaceEditor(mode: 'LOCAL' | 'API', operatorId: string, suppliedStorage?: PlaceEditorStorage | null): { entries: PlaceEditorEntries; error: string } {
  if (mode !== 'LOCAL') return { entries: {}, error: '' };
  const storage = suppliedStorage === undefined ? browserStorage() : suppliedStorage;
  if (!storage) return { entries: {}, error: '이 기기에서 미저장 초안을 읽을 수 없어요. 현재 화면의 입력은 유지돼요.' };
  try {
    const raw = storage.getItem(placeEditorKey(operatorId));
    if (!raw) return { entries: {}, error: '' };
    const envelope: unknown = JSON.parse(raw);
    if (!record(envelope) || envelope.schemaVersion !== 2 || envelope.operatorId !== operatorId || !record(envelope.entries)) throw new Error('invalid');
    for (const [key, entry] of Object.entries(envelope.entries)) if (['__proto__', 'prototype', 'constructor'].includes(key) || !record(entry) || !integer(entry.baseRevision) || !isPlaceEditorContent(entry.content)) throw new Error('invalid');
    return { entries: envelope.entries as PlaceEditorEntries, error: '' };
  } catch { return { entries: {}, error: '보관한 미저장 초안의 형식을 읽지 못했어요. 기존 보관 자료를 덮어쓰지 않고 서버 초안을 표시해요.' }; }
}
export function writePlaceEditor(mode: 'LOCAL' | 'API', operatorId: string, entries: PlaceEditorEntries, suppliedStorage?: PlaceEditorStorage | null): boolean {
  if (mode !== 'LOCAL') return false;
  const storage = suppliedStorage === undefined ? browserStorage() : suppliedStorage;
  if (!storage) return false;
  try { storage.setItem(placeEditorKey(operatorId), JSON.stringify({ schemaVersion: 2, operatorId, entries })); return true; } catch { return false; }
}
export function placeEditorEntry(entries: PlaceEditorEntries, placeId: string): PlaceEditorEntry | undefined { return Object.hasOwn(entries, placeId) ? entries[placeId] : undefined; }
/** A tab changes only its own edited targets, never an unrelated tab's cached input. */
export function mergePlaceEditorChanges(stored: PlaceEditorEntries, previous: PlaceEditorEntries, next: PlaceEditorEntries): PlaceEditorEntries {
  const merged = { ...stored };
  for (const placeId of new Set([...Object.keys(previous),...Object.keys(next)])) {
    const before = placeEditorEntry(previous,placeId), after = placeEditorEntry(next,placeId);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    if (after) merged[placeId] = after;
    // A completed save cannot erase input that a second tab changed in the meantime.
    else if (JSON.stringify(placeEditorEntry(stored,placeId)) === JSON.stringify(before)) delete merged[placeId];
  }
  return merged;
}
export function editPlaceEntry(entries: PlaceEditorEntries, place: Pick<AdminPlace, 'placeId' | 'revision'>, content: PlaceContent): PlaceEditorEntries {
  return { ...entries, [place.placeId]: { baseRevision: placeEditorEntry(entries, place.placeId)?.baseRevision ?? place.revision, content } };
}
export function placeEditorConflict(entry: PlaceEditorEntry | undefined, revision: number): boolean { return !!entry && entry.baseRevision !== revision; }
