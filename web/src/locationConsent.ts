import { policyDocument, type PolicyBundle } from './accountPolicies.ts';
/** Consent is scoped to this feature/version; never an OS permission substitute. */
export interface LocationConsent { version: string; purpose: 'NEARBY_SEARCH'; accepted: true }
type LocationErrorCode = 'UNCONNECTED' | 'CONSENT_REQUIRED' | 'UNSUPPORTED' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT';
export class LocationAccessError extends Error {
  code: LocationErrorCode;
  constructor(code: LocationErrorCode) { super(code); this.code = code; }
}
export function canUseCurrentLocation(bundle: PolicyBundle, consent: LocationConsent | null) {
  return bundle.status === 'PUBLISHED' && bundle.locationEnabled && consent?.accepted === true && consent.purpose === 'NEARBY_SEARCH' && consent.version === policyDocument(bundle, 'location').version;
}
/** A single foreground lookup. No automatic startup request, watchPosition or storage. */
export function requestCurrentLocation(bundle: PolicyBundle, consent: LocationConsent | null, geo: Pick<Geolocation, 'getCurrentPosition'> | undefined, signal?: AbortSignal): Promise<{ lat: number; lng: number; accuracy: number; measuredAt: number }> {
  if (bundle.status !== 'PUBLISHED' || !bundle.locationEnabled) return Promise.reject(new LocationAccessError('UNCONNECTED'));
  if (!canUseCurrentLocation(bundle, consent)) return Promise.reject(new LocationAccessError('CONSENT_REQUIRED'));
  if (!geo) return Promise.reject(new LocationAccessError('UNSUPPORTED'));
  if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => { if (done) return; done = true; signal?.removeEventListener('abort', abort); fn(); };
    const abort = () => finish(() => reject(new DOMException('Cancelled', 'AbortError')));
    signal?.addEventListener('abort', abort, { once: true });
    try { geo.getCurrentPosition(position => finish(() => {
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      if (![lat, lng, accuracy, position.timestamp].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy < 0) reject(new LocationAccessError('UNAVAILABLE'));
      else resolve({ lat, lng, accuracy, measuredAt: position.timestamp });
    }), error => finish(() => reject(new LocationAccessError(error.code === 1 ? 'DENIED' : error.code === 3 ? 'TIMEOUT' : 'UNAVAILABLE'))), { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }); }
    catch { finish(() => reject(new LocationAccessError('UNAVAILABLE'))); }
  });
}
