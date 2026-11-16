import type { Place } from '../data';
import type { TogetherState } from './model';
import type { VisitGuidePublication } from './visitGuideTypes';
import { isVisitGuidePublication, readVisitGuide } from './visitGuides.ts';

export const visitGuidePublicStorageKey = 'spotlog.visit-guides.public.v1';
type GuideStorage = Pick<Storage, 'getItem' | 'setItem'>;
export interface VisitGuidePublicStore {
  publish: (publication: VisitGuidePublication) => void;
  read: (token: string, at?: Date) => VisitGuidePublication | undefined;
  revoke: (token: string) => void;
}
/** A local, limited projection cache; no account store lookup, member identities or joining action. */
export function createVisitGuidePublicStore(storage: GuideStorage): VisitGuidePublicStore {
  const load = (): Record<string, VisitGuidePublication> => {
    const value = storage.getItem(visitGuidePublicStorageKey);
    if (!value) return {};
    let decoded: unknown; try { decoded = JSON.parse(value); } catch { throw new Error('저장된 방문 안내를 읽을 수 없어요. 다시 발급해 주세요.'); }
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded) || Object.entries(decoded).some(([key, record]) => !isVisitGuidePublication(record) || record.token !== key)) throw new Error('저장된 방문 안내 형식이 변경됐어요. 다시 발급해 주세요.');
    return decoded as Record<string, VisitGuidePublication>;
  };
  const write = (records: Record<string, VisitGuidePublication>) => storage.setItem(visitGuidePublicStorageKey, JSON.stringify(records));
  return {
    publish(publication) {
      if (!isVisitGuidePublication(publication)) throw new Error('공유할 수 있는 방문 안내 형식을 다시 확인해 주세요.');
      const records = load(); records[publication.token] = structuredClone(publication); write(records);
    },
    read(linkToken, at = new Date()) {
      if (!/^[a-f0-9]{64}$/.test(linkToken) || !Number.isFinite(at.getTime())) return undefined;
      const record = load()[linkToken];
      return record && !record.revoked && Date.parse(record.expiresAt) > at.getTime() ? structuredClone(record) : undefined;
    },
    revoke(linkToken) {
      if (!/^[a-f0-9]{64}$/.test(linkToken)) return;
      const records = load(); if (!records[linkToken]) return;
      // A withdrawn token keeps no old projection content in the public cache.
      delete records[linkToken]; write(records);
    },
  };
}
/** Only already-issued records in this caller's account state are reconciled. Other accounts are never scanned. */
export function reconcileVisitGuidePublicStore(state: TogetherState, places: Place[], store: VisitGuidePublicStore, at = new Date()): void {
  for (const guide of state.visitGuides || []) {
    for (const oldToken of guide.withdrawnTokens || []) store.revoke(oldToken);
    const publication = guide.publication; if (!publication) continue;
    let current: VisitGuidePublication | undefined;
    try { current = readVisitGuide(state, publication.token, places, at); } catch { current = undefined; }
    if (current) store.publish(current); else store.revoke(publication.token);
  }
}
