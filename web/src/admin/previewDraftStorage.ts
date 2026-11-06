type PreviewDraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type PreviewBackingStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const ADMIN_PREVIEW_DRAFT_STORAGE_KEY = 'spotlog.admin.preview.drafts.v1';
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);

let activeStorage: PreviewDraftStorage | null = null;

function browserSessionStorage(): PreviewBackingStorage | null {
  try { return typeof window === 'undefined' ? null : window.sessionStorage; }
  catch { return null; }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function draftEntries(raw: string): [string, string][] {
  const envelope: unknown = JSON.parse(raw);
  if (!record(envelope) || envelope.schemaVersion !== 1 || Object.keys(envelope).some(key => !['schemaVersion', 'entries'].includes(key)) || !record(envelope.entries)) throw new Error('invalid preview drafts');
  const entries = Object.entries(envelope.entries);
  if (entries.some(([key, value]) => unsafeKeys.has(key) || typeof value !== 'string')) throw new Error('invalid preview draft entry');
  return entries as [string, string][];
}

/** Preview editor drafts keep their existing principal keys inside one isolated tab envelope. */
export function activatePreviewDraftStorage(suppliedStorage?: PreviewBackingStorage | null): () => void {
  const previous = activeStorage, values = new Map<string, string>();
  let backing = suppliedStorage === undefined ? browserSessionStorage() : suppliedStorage;
  let damaged = false;
  if (backing) {
    let raw: string | null = null;
    try { raw = backing.getItem(ADMIN_PREVIEW_DRAFT_STORAGE_KEY); }
    catch { backing = null; }
    if (raw !== null) {
      try { for (const [key, value] of draftEntries(raw)) values.set(key, value); }
      catch { damaged = true; }
    }
  }
  const persist = () => {
    // Keep the updated page-memory copy, but never replace a damaged original or
    // report refresh recovery as available when browser persistence has failed.
    if (damaged) throw new Error('저장된 미리보기 초안을 읽지 못했어요. 기존 자료와 현재 입력을 보존했어요.');
    if (backing) {
      try { backing.setItem(ADMIN_PREVIEW_DRAFT_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, entries: Object.fromEntries(values) })); return; }
      catch { backing = null; }
    }
    throw new Error('미리보기 초안은 현재 화면에 유지돼요. 이 탭에 보관하지 못해 새로고침하면 사라질 수 있어요.');
  };
  const safeKey = (key: string) => {
    if (typeof key !== 'string' || unsafeKeys.has(key)) throw new Error('미리보기 초안 식별자를 확인해 주세요.');
  };
  const storage: PreviewDraftStorage = {
    getItem: key => { safeKey(key); return values.get(key) ?? null; },
    setItem: (key, value) => { safeKey(key); if (typeof value !== 'string') throw new Error('미리보기 초안 내용을 확인해 주세요.'); values.set(key, value); persist(); },
    removeItem: key => { safeKey(key); values.delete(key); persist(); },
  };
  activeStorage = storage;
  return () => { if (activeStorage === storage) activeStorage = previous; };
}

export function getPreviewDraftStorage(): PreviewDraftStorage | null {
  return activeStorage;
}
