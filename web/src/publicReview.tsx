import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Journey, Place } from './data';
import type { HomeTripTemplate } from './consumerPublicSeed';
export { reviewExposureOrder } from './reviewServiceBridge';
import { emptyReviewServiceState, readReviewServiceState, overlayPublicPlaces, publicJournalToJourney, publicTemplatesFromReview, homePlacesFromReview, REVIEW_SERVICE_EVENT, REVIEW_SERVICE_KEY, type ReviewServiceState } from './reviewServiceBridge';

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
type PublicReviewValue = { state: ReviewServiceState; now: number; catalog: Place[]; operatingJourneys: Journey[]; operatingTemplates: HomeTripTemplate[] };
const PublicReviewContext = createContext<PublicReviewValue>({ state: fallback, now: Date.now(), catalog: [], operatingJourneys: [], operatingTemplates: [] });
export const usePublicReview = () => useContext(PublicReviewContext);
export function useHomePlaceExposures() {
  const { state, now } = usePublicReview();
  return useMemo(() => homePlacesFromReview(state, now), [state, now]);
}
/** Publication windows change even with reduced motion and no user interaction. */
function useExposureClock(state: ReviewServiceState) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer !== undefined) clearTimeout(timer);
      const time = Date.now(); setNow(time);
      const next = Math.min(...state.exposures.filter(entry => entry.enabled).flatMap(entry => [entry.startsAt, entry.endsAt].map(value => Date.parse(value)).filter(value => Number.isFinite(value) && value > time)));
      if (Number.isFinite(next)) timer = setTimeout(refresh, Math.min(next - time + 1, 2147483647));
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { if (timer !== undefined) clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [state]);
  return now;
}
export function PublicReviewProvider({ baseline, children }: { baseline: Place[]; children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, snapshot, () => fallback);
  const now = useExposureClock(state);
  const value = useMemo(() => { const catalog = overlayPublicPlaces(baseline, state); const operatingTemplates = publicTemplatesFromReview(state, catalog); return { state, catalog, operatingTemplates, operatingJourneys: [...new Map(state.operatingJournals.map(j => [j.journalId, publicJournalToJourney(j, catalog)])).values()] }; }, [baseline, state]);
  const timedValue = useMemo(() => ({...value, now}), [value, now]);
  return <PublicReviewContext.Provider value={timedValue}>{children}</PublicReviewContext.Provider>;
}
export function nearbyReviewOrder(candidates: Place[], anchorId: string, state: ReviewServiceState): Place[] {
  const rules = state.nearbyOverrides.filter(o => o.anchorPlaceId === anchorId);
  return candidates.filter(p => !rules.some(r => r.businessPlaceId === p.id && r.mode === 'EXCLUDED')).sort((a, b) => {
    const left = rules.find(r => r.businessPlaceId === a.id && r.mode === 'FEATURED'), right = rules.find(r => r.businessPlaceId === b.id && r.mode === 'FEATURED');
    return left && right ? left.order - right.order : left ? -1 : right ? 1 : 0;
  });
}
