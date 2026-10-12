import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

type DraftMode = 'LOCAL' | 'API' | undefined;
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function reviewDraftKey(operatorId: string, editor: string, targetId: string): string {
  return ['spotlog:admin:review-draft:v1', operatorId, editor, targetId].map(encodeURIComponent).join(':');
}
function browserStorage(): DraftStorage | undefined { try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; } }
function compatible(value: unknown, fallback: unknown): boolean {
  if (Array.isArray(fallback)) return Array.isArray(value);
  if (fallback !== null && typeof fallback === 'object') return !!value && typeof value === 'object' && !Array.isArray(value) && Object.entries(fallback).every(([key, part]) => compatible((value as Record<string, unknown>)[key], part));
  return fallback === null ? value === null || typeof value === 'number' : typeof value === typeof fallback;
}
/** Cache helpers are deliberately mode gated: API customer content is never read or persisted here. */
export function readReviewDraft<T>(mode: DraftMode, key: string, fallback: T, storage = browserStorage()): T {
  if (mode !== 'LOCAL' || !storage) return fallback;
  try {
    const raw = storage.getItem(key); if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { schemaVersion?: number; value?: unknown };
    return parsed.schemaVersion === 1 && compatible(parsed.value, fallback) ? parsed.value as T : fallback;
  } catch { return fallback; }
}
export function writeReviewDraft<T>(mode: DraftMode, key: string, value: T, storage = browserStorage()): boolean {
  if (mode !== 'LOCAL' || !storage) return false;
  try { storage.setItem(key, JSON.stringify({ schemaVersion: 1, value })); return true; } catch { return false; }
}
export function clearReviewDraft(mode: DraftMode, key: string, storage = browserStorage()): void {
  if (mode === 'LOCAL' && storage) try { storage.removeItem(key); } catch { /* Current in-session input remains available. */ }
}

/** Principal and target remain part of every snapshot, even during a key-changing render. */
export function useReviewDraft<T>(mode: DraftMode, operatorId: string, editor: string, targetId: string, initial: T): [T, Dispatch<SetStateAction<T>>, () => void] {
  const key = reviewDraftKey(operatorId, editor, targetId);
  const identity = `${mode ?? 'API'}:${key}`;
  const [snapshot, setSnapshot] = useState(() => ({ identity, key, mode, value: readReviewDraft(mode, key, initial), dirty: false }));
  const value = snapshot.identity === identity ? snapshot.value : readReviewDraft(mode, key, initial);
  useEffect(() => {
    if (snapshot.identity !== identity) setSnapshot({ identity, key, mode, value: readReviewDraft(mode, key, initial), dirty: false });
  }, [identity, snapshot.identity, key, mode, initial]);
  useEffect(() => { if (snapshot.dirty) writeReviewDraft(snapshot.mode, snapshot.key, snapshot.value); }, [snapshot]);
  const update: Dispatch<SetStateAction<T>> = next => setSnapshot(previous => {
    const current = previous.identity === identity ? previous.value : readReviewDraft(mode, key, initial);
    return { identity, key, mode, value: typeof next === 'function' ? (next as (value: T) => T)(current) : next, dirty: true };
  });
  const clear = () => {
    clearReviewDraft(mode, key);
    setSnapshot(previous => ({ identity, key, mode, value: previous.identity === identity ? previous.value : value, dirty: false }));
  };
  return [value, update, clear];
}
