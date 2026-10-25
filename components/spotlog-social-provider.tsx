'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createEmptySocialStore, SOCIAL_STORAGE_KEY, type SocialAction, type SocialStore } from '../lib/spotlog-social';
import { commitSocialAction, readSocialStorage, type SocialStorage } from '../lib/spotlog-social-client';
import { createClientId } from '../lib/client-id';

type SpotlogSocialContextValue = {
  ready: boolean;
  store: SocialStore;
  error: string | null;
  readonly: boolean;
  dispatch: (action: SocialAction) => boolean;
};
const SocialContext = createContext<SpotlogSocialContextValue | null>(null);

export function SpotlogSocialProvider({ children }: { children: ReactNode }) {
  // Server render and first client render agree. Persisted content is read only after hydration.
  const [store, setStore] = useState<SocialStore>(createEmptySocialStore);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readonly, setReadonly] = useState(true);
  const storage = useRef<SocialStorage | null>(null);
  const blocked = useRef(true);

  useEffect(() => {
    try { storage.current = window.localStorage; }
    catch { storage.current = null; }
    const result = storage.current ? readSocialStorage(storage.current) : { ok: false as const, error: '이 브라우저의 스레드 저장소에 접근할 수 없어 읽기 전용으로 열었어요.' };
    if (result.ok) {
      setStore(result.store);
      setError(null);
      blocked.current = false;
      setReadonly(false);
    } else {
      setError(result.error);
      blocked.current = true;
      setReadonly(true);
    }
    setReady(true);
    const update = (event: StorageEvent) => {
      if (event.key !== SOCIAL_STORAGE_KEY && event.key !== null) return;
      if (event.storageArea && event.storageArea !== storage.current) return;
      if (!storage.current) return;
      // Read the current value rather than an older event payload from another tab.
      const current = readSocialStorage(storage.current);
      if (current.ok) {
        setStore(current.store);
        setError(null);
        blocked.current = false;
        setReadonly(false);
      } else {
        setError(current.error);
        blocked.current = true;
        setReadonly(true);
      }
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);

  const dispatch = useCallback((action: SocialAction): boolean => {
    if (blocked.current || !storage.current) return false;
    const saved = commitSocialAction(storage.current, action, {
      now: () => new Date().toISOString(),
      id: () => `comment-${createClientId()}`,
    });
    if (!saved.ok) {
      if (saved.store) setStore(saved.store);
      blocked.current = saved.readonly;
      setReadonly(saved.readonly);
      setError(saved.error);
      return false;
    }
    setStore(saved.store);
    setError(null);
    return true;
  }, []);

  return <SocialContext.Provider value={{ ready, store, error, readonly, dispatch }}>{children}</SocialContext.Provider>;
}

export function useSpotlogSocial(): SpotlogSocialContextValue {
  const context = useContext(SocialContext);
  if (!context) throw new Error('SpotlogSocialProvider 안에서 스레드 기능을 사용해 주세요.');
  return context;
}
