import { useEffect, useState } from 'react';
import { emptyGroupInterests, GROUP_INTERESTS_CHANGED_EVENT, groupInterestStorageKey, readGroupInterests, type GroupInterestsRead, type GroupInterestsStorage } from './groupInterestStore';

export function groupInterestsDeviceStorage(): GroupInterestsStorage | null { try { return window.localStorage; } catch { return null; } }

/** A stale owner snapshot is never rendered while effects switch to the new account. */
export function useGroupInterests(ownerId: string) {
  const [snapshot, setSnapshot] = useState(() => ({ ownerId, value: readGroupInterests(groupInterestsDeviceStorage(), ownerId) }));
  useEffect(() => {
    const reload = () => setSnapshot({ ownerId, value: readGroupInterests(groupInterestsDeviceStorage(), ownerId) });
    const storageChanged = (event: StorageEvent) => { if (event.key === null || event.key === groupInterestStorageKey(ownerId)) reload(); };
    const preferenceChanged = (event: Event) => { if ((event as CustomEvent<{ ownerId?: string }>).detail?.ownerId === ownerId) reload(); };
    reload(); window.addEventListener('storage', storageChanged); window.addEventListener(GROUP_INTERESTS_CHANGED_EVENT, preferenceChanged); window.addEventListener('focus', reload);
    return () => { window.removeEventListener('storage', storageChanged); window.removeEventListener(GROUP_INTERESTS_CHANGED_EVENT, preferenceChanged); window.removeEventListener('focus', reload); };
  }, [ownerId]);
  const pending: GroupInterestsRead = { state: emptyGroupInterests(ownerId), status: 'ready', message: '' };
  return snapshot.ownerId === ownerId ? snapshot.value : pending;
}
