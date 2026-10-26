import snapshot from './registered-spotlog-snapshot';
import jejuSnapshot from './jeju-registered-businesses';
import jejuPhotos from './jeju-business-photos';

export const REGISTERED_CATALOG_IMPORTED_AT = snapshot.importedAt;
export const REGIONS = ['제주', '서울', '부산', '경주', '강릉'] as const;
export type RegisteredRegion = (typeof REGIONS)[number];
export type RegisteredKind = 'LANDMARK' | 'FOOD' | 'CAFE' | 'STAY' | 'SHOP';
export type RegisteredPhoto = (typeof snapshot.entries)[number]['photos'][number] | (typeof jejuPhotos.entries)[number]['photos'][number];
type RegisteredEntry = (typeof snapshot.entries)[number] | (typeof jejuSnapshot.entries)[number];
export type RegisteredEntity = Omit<RegisteredEntry, 'kind' | 'photos'> & {
  kind: RegisteredKind;
  region: RegisteredRegion;
  photos: RegisteredPhoto[];
};
export function registeredRegion(area: string): RegisteredRegion {
  const region = REGIONS.find((region) => area.includes(region));
  if (!region) throw new Error('등록 자료의 지역 분류가 없습니다.');
  return region;
}
// Markets are shopping destinations in the original public-tourism source.
// Their stable Spotlog identity is shared; this changes no source app record.
// Keep the app import reproducible and the separately checked local supplement
// independent. Adding real records never changes a fictional demo's identity.
export const registeredEntities: readonly RegisteredEntity[] = [...snapshot.entries, ...jejuSnapshot.entries].map((entry) => ({
  ...entry,
  photos: [...(jejuPhotos.entries.find(item => item.id === entry.id)?.photos ?? entry.photos)],
  kind: ['public-busan-gukje', 'public-busan-jagalchi'].includes(entry.id) ? 'SHOP' : entry.kind as RegisteredKind,
  region: registeredRegion(entry.area),
}));
export const registeredPlaces = registeredEntities.filter((item) => item.kind === 'LANDMARK');
export const registeredBusinesses = registeredEntities.filter((item) => item.kind !== 'LANDMARK');
const byId = new Map(registeredEntities.map((item) => [item.id, item]));
export const getRegisteredEntity = (id: string | null | undefined) => id ? byId.get(id) : undefined;
export const registeredMapCoordinates = Object.fromEntries(registeredEntities.map((item) => [item.id, {
  latitude: item.latitude,
  longitude: item.longitude,
  sourceUrl: item.source.sourceUrl,
  sourceTitle: item.source.provider,
  checkedAt: item.source.checkedAt,
  pointNote: 'Spotlog에 등록한 공식 자료의 대표 위치입니다. 실제 출입구와 현재 영업 여부는 방문 전에 확인하세요.',
}]));
type Coordinate = { latitude: number; longitude: number };
export function straightDistanceKm(from: Coordinate, to: Coordinate) {
  const rad = (n: number) => n * Math.PI / 180;
  const a = Math.sin(rad(to.latitude - from.latitude) / 2) ** 2 + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}
const legacyAnchorCoordinates: Readonly<Record<string, Coordinate>> = {
  seoulforest: { latitude: 37.5443306, longitude: 127.03762054 },
  // Same checked VisitJeju representative points used by trip-map-data.ts.
  // Businesses retain their own independent coordinates; these points are only
  // the search centers and itinerary context for existing destination IDs.
  hyeopjae: { latitude: 33.3924809, longitude: 126.2389861 },
  geumneung: { latitude: 33.390003, longitude: 126.23591 },
  osulloc: { latitude: 33.30601, longitude: 126.2901309 },
  songaksan: { latitude: 33.2077419, longitude: 126.2909048 },
  saebyeol: { latitude: 33.36723, longitude: 126.35711 },
};
export const getLegacyAnchorCoordinate = (id: string) => legacyAnchorCoordinates[id];
export type NearbyRegisteredBusiness = {
  entity: RegisteredEntity;
  distanceKm: number;
  radiusKm: 3 | 15;
  distanceKind: 'straight';
};
/** Explicit extension only: a lack of nearby records never silently widens 3 km. */
export function getNearbyRegisteredBusinesses(
  anchorId: string,
  kind: Exclude<RegisteredKind, 'LANDMARK'> | '식당' | '카페' | '숙소' | '상점',
  options: { expanded?: boolean; anchor?: Coordinate } = {},
): NearbyRegisteredBusiness[] {
  const anchor = getRegisteredEntity(anchorId) ?? legacyAnchorCoordinates[anchorId] ?? options.anchor;
  if (!anchor) return [];
  const categories: Partial<Record<string, RegisteredKind>> = { 식당: 'FOOD', 카페: 'CAFE', 숙소: 'STAY', 상점: 'SHOP' };
  const category = categories[kind] ?? kind;
  const radiusKm = options.expanded === true ? 15 : 3;
  return registeredBusinesses.filter((item) => item.kind === category && item.id !== anchorId)
    .map((entity): NearbyRegisteredBusiness => ({ entity, distanceKm: straightDistanceKm(anchor, entity), radiusKm, distanceKind: 'straight' }))
    .filter((item) => item.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.entity.id.localeCompare(b.entity.id));
}
/** A missing price is never free and never evidence that a budget is met. */
export function getKnownEntityPrice(item: { price: number; priceVerified?: boolean; priceStatus?: string } | null | undefined): number | null {
  if (!item || item.priceVerified === false || item.priceStatus === 'unknown') return null;
  return Number.isFinite(item.price) && item.price >= 0 ? item.price : null;
}
export function entityPriceLabel(item: { price: number; priceVerified?: boolean; priceStatus?: string } | null | undefined) {
  const price = getKnownEntityPrice(item);
  return price === null ? '가격 미확인' : price.toLocaleString('ko-KR') + '원';
}
