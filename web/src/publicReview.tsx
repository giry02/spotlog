import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { Journey, Place } from './data';
import type { HomeTripTemplate } from './consumerPublicSeed';
export { reviewExposureOrder } from './reviewServiceBridge';
import { emptyReviewServiceState, readReviewServiceState, overlayPublicPlaces, publicJournalToJourney, publicTemplatesFromReview, REVIEW_SERVICE_EVENT, REVIEW_SERVICE_KEY, type ReviewServiceState } from './reviewServiceBridge';

const fallback = emptyReviewServiceState();
let lastRaw: string | null | undefined, lastState = fallback;
export const localPublicReviewEnabled = () => !!import.meta.env.DEV && !import.meta.env.VITE_REPORT_ENDPOINT && new URLSearchParams(location.search).get('mode') !== 'api';
function snapshot(): ReviewServiceState {
  if (!localPublicReviewEnabled()) return fallback;
  let raw: string | null; try { raw = localStorage.getItem(REVIEW_SERVICE_KEY); } catch { return lastState; }
  if (raw === lastRaw) return lastState;
  lastRaw = raw; try { lastState = readReviewServiceState(); } catch { /* retain last validated public projection */ }
  return lastState;
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === REVIEW_SERVICE_KEY) listener(); };
  window.addEventListener('storage', storage); window.addEventListener(REVIEW_SERVICE_EVENT, listener);
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(REVIEW_SERVICE_EVENT, listener); };
}
type PublicReviewValue = { state: ReviewServiceState; catalog: Place[]; operatingJourneys: Journey[]; operatingTemplates: HomeTripTemplate[] };
const PublicReviewContext = createContext<PublicReviewValue>({ state: fallback, catalog: [], operatingJourneys: [], operatingTemplates: [] });
export const usePublicReview = () => useContext(PublicReviewContext);
export function PublicReviewProvider({ baseline, children }: { baseline: Place[]; children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, snapshot, () => fallback);
  const value = useMemo(() => { const catalog = overlayPublicPlaces(baseline, state); const operatingTemplates = publicTemplatesFromReview(state, catalog); return { state, catalog, operatingTemplates, operatingJourneys: [...new Map(state.operatingJournals.map(j => [j.journalId, publicJournalToJourney(j, catalog)])).values()] }; }, [baseline, state]);
  return <PublicReviewContext.Provider value={value}>{children}</PublicReviewContext.Provider>;
}
export function nearbyReviewOrder(candidates: Place[], anchorId: string, state: ReviewServiceState): Place[] {
  const rules = state.nearbyOverrides.filter(o => o.anchorPlaceId === anchorId);
  return candidates.filter(p => !rules.some(r => r.businessPlaceId === p.id && r.mode === 'EXCLUDED')).sort((a, b) => {
    const left = rules.find(r => r.businessPlaceId === a.id && r.mode === 'FEATURED'), right = rules.find(r => r.businessPlaceId === b.id && r.mode === 'FEATURED');
    return left && right ? left.order - right.order : left ? -1 : right ? 1 : 0;
  });
}
