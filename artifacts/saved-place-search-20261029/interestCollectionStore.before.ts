import type { Place, PlaceKind } from './data';

/** Personal folders are independent of legacy SavedCollection/trip stores. */
export interface InterestCollection {
  id: string;
  title: string;
  region?: string;
  placeIds: string[];
  createdAt: string;
  updatedAt: string;
}
export interface InterestCollectionsState {
  schemaVersion: 1;
  owner: string;
  revision: number;
  collections: InterestCollection[];
}
export type InterestStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type InterestRead = { state: InterestCollectionsState; status: 'ready' | 'invalid' | 'unavailable'; message: string };
export const INTEREST_COLLECTION_PREFIX = 'spotlog:interest-collections:v1:';
const collectionLimit = 100;
const placeLimit = 2000;

export function interestOwner(viewerId: string): string {
  const owner = viewerId.trim();
  if (!owner || owner.length > 300) throw new Error('목록을 저장할 계정을 확인해 주세요.');
  return owner;
}
export function interestStorageKey(viewerId: string): string { return `${INTEREST_COLLECTION_PREFIX}${encodeURIComponent(interestOwner(viewerId))}`; }
export function emptyInterestCollections(viewerId: string): InterestCollectionsState {
  return { schemaVersion: 1, owner: interestOwner(viewerId), revision: 0, collections: [] };
}
function shortText(value: unknown, maximum: number): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum; }
function validDate(value: unknown): value is string { return typeof value === 'string' && value.length < 40 && Number.isFinite(Date.parse(value)); }
function validState(value: unknown, owner: string): value is InterestCollectionsState {
  if (!value || typeof value !== 'object') return false;
  const state = value as InterestCollectionsState;
  if (state.schemaVersion !== 1 || state.owner !== owner || !Number.isSafeInteger(state.revision) || state.revision < 0 || !Array.isArray(state.collections) || state.collections.length > collectionLimit) return false;
  const ids = new Set<string>();
  return state.collections.every(item => {
    if (!item || typeof item !== 'object' || !shortText(item.id, 300) || ids.has(item.id) || !shortText(item.title, 80) || (item.region !== undefined && !shortText(item.region, 80)) || !validDate(item.createdAt) || !validDate(item.updatedAt) || !Array.isArray(item.placeIds) || item.placeIds.length > placeLimit || !item.placeIds.every(id => shortText(id, 300)) || new Set(item.placeIds).size !== item.placeIds.length) return false;
    ids.add(item.id); return true;
  });
}
export function readInterestCollections(storage: InterestStorage | null, viewerId: string): InterestRead {
  const state = emptyInterestCollections(viewerId);
  if (!storage) return { state, status: 'unavailable', message: '이 기기에서 목록 저장을 사용할 수 없어요.' };
  try {
    const raw = storage.getItem(interestStorageKey(viewerId));
    if (raw === null) return { state, status: 'ready', message: '' };
    const parsed: unknown = JSON.parse(raw);
    if (!validState(parsed, state.owner)) return { state, status: 'invalid', message: '저장한 목록을 읽지 못했어요. 기존 자료는 그대로 보관했어요.' };
    return { state: parsed, status: 'ready', message: '' };
  } catch { return { state, status: 'invalid', message: '저장한 목록을 읽지 못했어요. 기존 자료는 그대로 보관했어요.' }; }
}
/** Read-before-write protects malformed/future records and detects another tab's changes. */
export function writeInterestCollections(storage: InterestStorage | null, next: InterestCollectionsState, expectedRevision: number): InterestCollectionsState {
  if (!storage || !validState(next, next.owner)) throw new Error('목록을 저장하지 못했어요. 입력 내용을 확인해 주세요.');
  const current = readInterestCollections(storage, next.owner);
  if (current.status !== 'ready') throw new Error(current.message);
  if (current.state.revision !== expectedRevision) throw new Error('다른 화면에서 목록이 바뀌었어요. 목록을 다시 불러온 뒤 수정해 주세요.');
  const saved = { ...next, revision: expectedRevision + 1 };
  try { storage.setItem(interestStorageKey(next.owner), JSON.stringify(saved)); }
  catch { throw new Error('기기 저장 공간이 부족하거나 저장이 차단됐어요. 기존 목록은 유지했어요.'); }
  return saved;
}
export function createInterestCollection(state: InterestCollectionsState, title: string, region = '', id = `interest-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`, now = new Date().toISOString()): InterestCollectionsState {
  const name = title.trim(); const area = region.trim();
  if (!shortText(name, 80) || area.length > 80) throw new Error('목록 이름은 1~80자로 입력해 주세요.');
  if (state.collections.length >= collectionLimit) throw new Error('목록은 100개까지 만들 수 있어요.');
  if (!shortText(id, 300) || state.collections.some(item => item.id === id)) throw new Error('목록을 다시 만들어 주세요.');
  return { ...state, collections: [...state.collections, { id, title: name, ...(area ? { region: area } : {}), placeIds: [], createdAt: now, updatedAt: now }] };
}
export function renameInterestCollection(state: InterestCollectionsState, id: string, title: string, region = '', now = new Date().toISOString()): InterestCollectionsState {
  const name = title.trim(); const area = region.trim();
  if (!shortText(name, 80) || area.length > 80) throw new Error('목록 이름은 1~80자로 입력해 주세요.');
  if (!state.collections.some(item => item.id === id)) throw new Error('목록을 찾을 수 없어요.');
  return { ...state, collections: state.collections.map(item => item.id === id ? { ...item, title: name, region: area || undefined, updatedAt: now } : item) };
}
export function removeInterestCollection(state: InterestCollectionsState, id: string): InterestCollectionsState {
  return { ...state, collections: state.collections.filter(item => item.id !== id) };
}
export function setInterestCollectionPlaces(state: InterestCollectionsState, id: string, selectedIds: string[], savedPlaces: Pick<Place, 'id'>[], now = new Date().toISOString()): InterestCollectionsState {
  const collection = state.collections.find(item => item.id === id);
  if (!collection) throw new Error('목록을 찾을 수 없어요.');
  const allowed = new Set(savedPlaces.map(place => place.id));
  if (selectedIds.some(placeId => !allowed.has(placeId))) throw new Error('관심 장소에 저장한 곳만 목록에 담을 수 있어요.');
  const placeIds = [...new Set(selectedIds)];
  if (placeIds.length > placeLimit) throw new Error('한 목록에는 2,000곳까지 담을 수 있어요.');
  // Preserve temporarily missing saved references; changing a folder never removes a favorite.
  const missing = collection.placeIds.filter(placeId => !allowed.has(placeId));
  const merged = [...new Set([...placeIds, ...missing])];
  if (merged.length > placeLimit) throw new Error('한 목록에는 2,000곳까지 담을 수 있어요.');
  return { ...state, collections: state.collections.map(item => item.id === id ? { ...item, placeIds: merged, updatedAt: now } : item) };
}
export const interestKindLabels: Record<PlaceKind, string> = { LANDMARK: '랜드마크', FOOD: '음식점', CAFE: '카페', STAY: '숙소', SHOP: '쇼핑', LEISURE: '레저' };
/** Display grouping only. Canonical server region IDs can replace it without changing folder IDs. */
export function interestPlaceRegion(place: Pick<Place, 'area' | 'address'>): string {
  const first = (place.area || place.address || '').trim().split(/\s+/)[0] || '지역 미정';
  const aliases: Record<string, string> = { 서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 강원도: '강원', 충청북도: '충북', 충청남도: '충남', 전북특별자치도: '전북', 전라북도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주', 제주시: '제주', 서귀포시: '제주' };
  return aliases[first] ?? first;
}
export function filterInterestPlaces(places: Place[], collection: InterestCollection | undefined, region = '', kind: PlaceKind | '' = ''): Place[] {
  const ids = collection ? new Set(collection.placeIds) : null;
  return places.filter(place => (!ids || ids.has(place.id)) && (!region || interestPlaceRegion(place) === region) && (!kind || place.kind === kind));
}
