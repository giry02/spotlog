import { MY_REGION_OPTIONS, type MyRegionName } from './discoveryRegionStore.ts';
import { groupLocalityIssues } from './together/groupRegions.ts';
import { CURRENT_AREA_CONSENT_VERSION } from '../../shared/hybridBridge.ts';
import { isNativeCurrentLocationAvailable, NativeCurrentLocationError, requestNativeCurrentPosition } from './nativeLocationBridge.ts';

export { CURRENT_AREA_CONSENT_VERSION };
export const CURRENT_AREA_PROVIDER_NAME = 'BigDataCloud';
export const CURRENT_AREA_PROVIDER_URL = 'https://www.bigdatacloud.com/docs/article/why-is-reverse-geocoding-api-free';
export const CURRENT_AREA_PROVIDER_ATTRIBUTION = '주소 변환: BigDataCloud';
export const CURRENT_AREA_LOCATION_NOTICE = '현재 위치를 한 번 확인하고 동네 이름으로 바꾸기 위해 BigDataCloud에 위도·경도를 전달해요. 제공업체는 위치와 IP를 익명화한 위치 데이터 품질 개선에 사용해요. 스팟로그에는 정밀 좌표를 저장하지 않고 직접 저장한 지역 이름만 보관해요.';
export const CURRENT_AREA_ENDPOINT = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

export type CurrentAreaErrorCode = 'CONSENT_REQUIRED' | 'UNSUPPORTED' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'OFFLINE' | 'REVERSE_UNAVAILABLE' | 'INVALID_RESPONSE' | 'UNSUPPORTED_COUNTRY' | 'INACCURATE';
const messages: Record<CurrentAreaErrorCode, string> = {
  CONSENT_REQUIRED: '현재 위치와 동네 이름 변환에 대한 안내를 확인하고 동의해 주세요.',
  UNSUPPORTED: '이 환경에서는 현재 위치를 가져올 수 없어요. 동네를 직접 선택해 주세요.',
  DENIED: '위치 권한이 꺼져 있어요. 기기 또는 브라우저 설정에서 허용하거나 동네를 직접 선택해 주세요.',
  UNAVAILABLE: '현재 위치를 확인하지 못했어요. 다시 시도하거나 동네를 직접 선택해 주세요.',
  TIMEOUT: '현재 위치 확인이 늦어지고 있어요. 다시 시도하거나 동네를 직접 선택해 주세요.',
  OFFLINE: '인터넷 연결을 확인해 주세요. 동네는 직접 선택해서 저장할 수 있어요.',
  REVERSE_UNAVAILABLE: '동네 이름을 가져오지 못했어요. 다시 시도하거나 지역을 직접 선택해 주세요.',
  INVALID_RESPONSE: '현재 위치의 동네 정보를 확인하지 못했어요. 지역을 직접 선택해 주세요.',
  UNSUPPORTED_COUNTRY: '현재 위치로 동네 설정은 국내 지역을 지원해요. 다른 지역은 직접 선택해 주세요.',
  INACCURATE: '위치 오차가 커서 동네를 정하기 어려워요. 위치 설정을 확인하거나 지역을 직접 선택해 주세요.',
};
export class CurrentAreaError extends Error {
  readonly code: CurrentAreaErrorCode;
  constructor(code: CurrentAreaErrorCode) { super(messages[code]); this.name = 'CurrentAreaError'; this.code = code; }
}
export interface CurrentAreaConsent { accepted: true; purpose: 'GROUP_NEARBY'; version: string }
export interface CurrentArea {
  region: MyRegionName; district: string; neighborhood?: string; accuracyMeters: number;
  source: 'DEVICE_REVERSE_GEOCODE'; precision: 'NEIGHBORHOOD' | 'DISTRICT' | 'REGION'; needsReview: true; attribution: string;
}
export interface CurrentAreaOptions {
  consent?: CurrentAreaConsent | null;
  signal?: AbortSignal;
  geolocation?: Pick<Geolocation, 'getCurrentPosition'>;
  fetch?: typeof globalThis.fetch;
  secureContext?: boolean;
  online?: boolean;
  /** Only the current client-side provider is accepted. No proxy or stored-coordinate endpoint. */
  endpoint?: string;
}

const aliases: Record<string, MyRegionName> = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산',
  세종특별자치시: '세종', 세종시: '세종', 경기도: '경기', 강원특별자치도: '강원', 강원도: '강원', 충청북도: '충북', 충청남도: '충남',
  전북특별자치도: '전북', 전라북도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주', 제주도: '제주',
  seoul: '서울', busan: '부산', daegu: '대구', incheon: '인천', gwangju: '광주', daejeon: '대전', ulsan: '울산', sejong: '세종',
  gyeonggi: '경기', gyeonggido: '경기', gangwon: '강원', gangwondo: '강원', chungcheongbukdo: '충북', chungcheongnamdo: '충남',
  jeollabukdo: '전북', jeonbuk: '전북', jeollanamdo: '전남', gyeongsangbukdo: '경북', gyeongsangnamdo: '경남', jeju: '제주', jejudo: '제주',
};
const subdivisions: Record<string, MyRegionName> = {
  'KR-11': '서울', 'KR-26': '부산', 'KR-27': '대구', 'KR-28': '인천', 'KR-29': '광주', 'KR-30': '대전', 'KR-31': '울산',
  'KR-41': '경기', 'KR-42': '강원', 'KR-43': '충북', 'KR-44': '충남', 'KR-45': '전북', 'KR-46': '전남', 'KR-47': '경북',
  'KR-48': '경남', 'KR-49': '제주', 'KR-50': '세종', 'KR-51': '강원', 'KR-52': '전북',
};
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const label = (value: unknown): string => typeof value === 'string' && value.length <= 100 && !/[\u0000-\u001f\u007f]/u.test(value)
  ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : '';
function regionName(value: unknown): MyRegionName | undefined {
  const text = label(value);
  if ((MY_REGION_OPTIONS as readonly string[]).includes(text)) return text as MyRegionName;
  return aliases[text] || aliases[text.toLowerCase().replace(/[\s_-]/gu, '')];
}
const cancelError = () => new DOMException('요청을 취소했어요.', 'AbortError');
const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw cancelError(); };
function untilAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown, value?: T) => { if (settled) return; settled = true; signal.removeEventListener('abort', abort); if (error) reject(error); else resolve(value!); };
    const abort = () => finish(cancelError());
    operation.then(value => finish(undefined, value), error => finish(error));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Only explicitly returned administrative labels are used; no display-name, street or POI inference. */
export function currentAreaFromResponse(value: unknown, accuracyMeters: number): CurrentArea {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) throw new CurrentAreaError('INVALID_RESPONSE');
  if (accuracyMeters > 10000) throw new CurrentAreaError('INACCURATE');
  if (!record(value) || label(value.countryCode).toUpperCase() !== 'KR') throw new CurrentAreaError('UNSUPPORTED_COUNTRY');
  if (label(value.lookupSource).toLowerCase().replace(/[\s_-]/gu, '') !== 'reversegeocoding') throw new CurrentAreaError('INACCURATE');
  const namedRegion = regionName(value.principalSubdivision), codedRegion = subdivisions[label(value.principalSubdivisionCode).toUpperCase()];
  if (namedRegion && codedRegion && namedRegion !== codedRegion) throw new CurrentAreaError('INVALID_RESPONSE');
  const region = namedRegion || codedRegion || regionName(value.city);
  if (!region) throw new CurrentAreaError('INVALID_RESPONSE');
  const info = record(value.localityInfo) ? value.localityInfo : {};
  if (info.administrative !== undefined && (!Array.isArray(info.administrative) || info.administrative.length > 40)) throw new CurrentAreaError('INVALID_RESPONSE');
  const administrative = (Array.isArray(info.administrative) ? info.administrative : []).filter(record)
    .map((row, index) => ({ name: label(row.name), order: typeof row.order === 'number' && Number.isFinite(row.order) ? row.order : index }))
    .sort((left, right) => left.order - right.order).map(row => row.name);
  const areaWords = [...new Set([...administrative, label(value.city), label(value.locality)].flatMap(name => name.split(' ')).filter(Boolean))];
  const parentWords = areaWords.filter(name => /^[가-힣0-9·.]{1,30}[시군구]$/u.test(name) && !regionName(name));
  // A metro city is already the region. For provinces, retain an authored city + nested ward.
  const district = parentWords.join(' ');
  if (district.length > 40) throw new CurrentAreaError('INVALID_RESPONSE');
  const neighborhoods = areaWords.filter(name => /^[가-힣0-9·.]{1,29}[동읍면]$/u.test(name));
  const canKeepNeighborhood = accuracyMeters <= 1000 && (region === '세종' || Boolean(district));
  const neighborhood = canKeepNeighborhood ? neighborhoods.at(-1) : undefined;
  const area = { region, district, ...(neighborhood ? { neighborhood } : {}) };
  if (groupLocalityIssues(area).length) throw new CurrentAreaError('INVALID_RESPONSE');
  return { ...area, accuracyMeters, source: 'DEVICE_REVERSE_GEOCODE', precision: neighborhood ? 'NEIGHBORHOOD' : district ? 'DISTRICT' : 'REGION', needsReview: true, attribution: CURRENT_AREA_PROVIDER_ATTRIBUTION };
}

function devicePosition(geo: Pick<Geolocation, 'getCurrentPosition'>, signal: AbortSignal): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown, value?: { latitude: number; longitude: number; accuracy: number }) => {
      if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value!);
    };
    const abort = () => finish(cancelError());
    const timer = setTimeout(() => finish(new CurrentAreaError('TIMEOUT')), 12000);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    try {
      geo.getCurrentPosition(position => {
        const { latitude, longitude, accuracy } = position.coords;
        if (![latitude, longitude, accuracy].every(Number.isFinite) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracy < 0) return finish(new CurrentAreaError('UNAVAILABLE'));
        if (accuracy > 10000) return finish(new CurrentAreaError('INACCURATE'));
        finish(undefined, { latitude, longitude, accuracy });
      }, error => finish(new CurrentAreaError(error.code === 1 ? 'DENIED' : error.code === 3 ? 'TIMEOUT' : 'UNAVAILABLE')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
    } catch { finish(new CurrentAreaError('UNAVAILABLE')); }
  });
}

/** User-initiated, consented foreground lookup only. No IP fallback, watch, storage, backend or coordinate cache. */
export async function acquireCurrentArea(options: CurrentAreaOptions = {}): Promise<CurrentArea> {
  if (options.consent?.accepted !== true || options.consent.purpose !== 'GROUP_NEARBY' || options.consent.version !== CURRENT_AREA_CONSENT_VERSION) throw new CurrentAreaError('CONSENT_REQUIRED');
  checkAbort(options.signal);
  const endpoint = options.endpoint ?? CURRENT_AREA_ENDPOINT;
  if (endpoint !== CURRENT_AREA_ENDPOINT) throw new CurrentAreaError('UNSUPPORTED');
  const secure = options.secureContext ?? (typeof isSecureContext !== 'undefined' && isSecureContext);
  // An explicit injected browser adapter is for isolated tests. Never prefer it over a live app's OS bridge by default.
  const native = options.geolocation === undefined && isNativeCurrentLocationAvailable();
  const geo = options.geolocation ?? (typeof navigator !== 'undefined' ? navigator.geolocation : undefined);
  const fetcher = options.fetch ?? globalThis.fetch;
  if ((!native && (!secure || !geo)) || typeof fetcher !== 'function') throw new CurrentAreaError('UNSUPPORTED');
  const online = options.online ?? (typeof navigator === 'undefined' || navigator.onLine !== false);
  if (!online) throw new CurrentAreaError('OFFLINE');
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 25000);
  try {
    const position = native ? await requestNativeCurrentPosition({ signal: controller.signal, consent: options.consent }) : await devicePosition(geo!, controller.signal);
    checkAbort(controller.signal);
    const url = new URL(endpoint);
    url.searchParams.set('latitude', String(position.latitude)); url.searchParams.set('longitude', String(position.longitude)); url.searchParams.set('localityLanguage', 'ko');
    // Only live coordinates from this very device lookup are sent directly from this browser.
    const response = await untilAbort(fetcher(url.toString(), { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal, headers: { Accept: 'application/json' } }), controller.signal);
    checkAbort(controller.signal);
    if (!response.ok) throw new CurrentAreaError('REVERSE_UNAVAILABLE');
    if (!/^application\/json(?:\s*;|$)/iu.test(response.headers.get('content-type') || '') || Number(response.headers.get('content-length')) > 64000) throw new CurrentAreaError('INVALID_RESPONSE');
    const raw = await untilAbort(response.text(), controller.signal);
    checkAbort(controller.signal);
    if (raw.length > 64000) throw new CurrentAreaError('INVALID_RESPONSE');
    let value: unknown;
    try { value = JSON.parse(raw) as unknown; } catch { throw new CurrentAreaError('INVALID_RESPONSE'); }
    return currentAreaFromResponse(value, position.accuracy);
  } catch (error) {
    if (options.signal?.aborted) throw cancelError();
    if (timedOut) throw new CurrentAreaError('TIMEOUT');
    if (error instanceof NativeCurrentLocationError) throw new CurrentAreaError(error.code);
    if (error instanceof CurrentAreaError) throw error;
    throw new CurrentAreaError('REVERSE_UNAVAILABLE');
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); controller.abort(); }
}
