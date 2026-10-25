import { applySocialAction, parseSocialStore, SOCIAL_STORAGE_KEY, SOCIAL_LIMITS, type SocialAction, type SocialDependencies, type SocialStore } from './spotlog-social';

export type SocialStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type SocialStorageResult = { ok: true; store: SocialStore } | { ok: false; error: string };

/** Never repair or overwrite a malformed value without an explicit migration. */
export function readSocialStorage(storage: SocialStorage): SocialStorageResult {
  try { return parseSocialStore(storage.getItem(SOCIAL_STORAGE_KEY)); }
  catch { return { ok: false, error: '이 브라우저의 스레드 저장소에 접근할 수 없어 읽기 전용으로 열었어요. 기존 기록은 보존됩니다.' }; }
}

export function writeSocialStorage(storage: SocialStorage, store: SocialStore): SocialStorageResult {
  try {
    const existing = readSocialStorage(storage);
    if (!existing.ok) return existing;
    const raw = JSON.stringify(store);
    const verified = parseSocialStore(raw);
    if (!verified.ok) return verified;
    if (raw.length > SOCIAL_LIMITS.storageCharacters) return { ok: false, error: '스레드 저장 용량에 도달했어요. 기존 기록은 보존됩니다.' };
    storage.setItem(SOCIAL_STORAGE_KEY, raw);
    return { ok: true, store: verified.store };
  } catch {
    return { ok: false, error: '스레드를 기기에 저장하지 못했어요. 기존 기록은 보존하고 쓰기를 중단했어요. 브라우저 저장 공간을 확인한 뒤 새로고침해 주세요.' };
  }
}

export type SocialCommitResult =
  | { ok: true; store: SocialStore }
  | { ok: false; error: string; readonly: boolean; store?: SocialStore };

/** Read at every dispatch, so rapid React actions never apply to a stale render. */
export function commitSocialAction(storage: SocialStorage, action: SocialAction, dependencies: SocialDependencies): SocialCommitResult {
  const latest = readSocialStorage(storage);
  if (!latest.ok) return { ...latest, readonly: true };
  const applied = applySocialAction(latest.store, action, dependencies);
  if (!applied.ok) return { ok: false, store: latest.store, error: applied.error, readonly: false };
  const saved = writeSocialStorage(storage, applied.store);
  return saved.ok ? saved : { ...saved, store: latest.store, readonly: true };
}
