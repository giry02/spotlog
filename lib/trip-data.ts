import { places as connectedPlaces, restaurants as demoRestaurants, type Place, type Restaurant } from './connected-data';
import { knowledgePlaces } from './knowledge-places';
import { registeredPlaces, registeredBusinesses, registeredRegion, straightDistanceKm, getLegacyAnchorCoordinate, type RegisteredPhoto } from './registered-catalog';
export { REGIONS, getNearbyRegisteredBusinesses, getKnownEntityPrice, entityPriceLabel, getRegisteredEntity } from './registered-catalog';

// The earlier connected prototype retains its 13 authored examples. Travel
// actions can also resolve destinations backed by the official RAG summaries.
export const places: Place[] = [...connectedPlaces, ...knowledgePlaces, ...registeredPlaces.map((item): Place => ({
  id: item.id, name: item.name, region: item.region, area: 'central', district: item.area,
  durationMinutes: 60, image: item.photos[0]?.image ?? '/images/registered-spotlog/no-photo.svg',
  tags: item.tags, mood: [3, 3, 3], description: item.description, credit: item.photos[0]?.id ?? '',
  sourceUrl: item.source.sourceUrl, sourceVerifiedAt: item.source.checkedAt,
  sourceProvider: item.source.provider, registered: true, address: item.address,
  latitude: item.latitude, longitude: item.longitude, photos: item.photos,
  visitNote: item.note || '체류시간은 편집 기준입니다. 현재 운영·입장 조건은 공식 안내에서 확인하세요.',
}))];
// A newly registered Jeju business can use the already checked Jeju destinations
// as search context even though those legacy places are outside the app import.
// Its map point still comes exclusively from the business's own source record.
const registeredSearchAnchors = [
  ...registeredPlaces.map(item => ({ id: item.id, region: item.region, latitude: item.latitude, longitude: item.longitude })),
  ...connectedPlaces.filter(item => item.region === '제주').flatMap(item => {
    const coordinate = getLegacyAnchorCoordinate(item.id);
    return coordinate ? [{ id: item.id, region: item.region, ...coordinate }] : [];
  }),
];
export const restaurants: Restaurant[] = [...demoRestaurants, ...registeredBusinesses.filter((item) => item.kind !== 'STAY').map((item): Restaurant => {
  const anchors = registeredSearchAnchors.filter((place) => place.region === item.region).sort((a, b) => straightDistanceKm(a, item) - straightDistanceKm(b, item));
  return { id: item.id, placeId: anchors[0]?.id ?? (item.region === '서울' ? 'seoulforest' : item.id),
    name: item.name, cuisine: item.kind === 'CAFE' ? '카페' : item.kind === 'SHOP' ? '상점' : '음식점',
    kind: item.kind as 'FOOD' | 'CAFE' | 'SHOP', region: item.region,
    menu: '메뉴·상품 미확인', price: 0, walk: 0, angle: 0, quiet: false,
    registered: true, priceVerified: false, priceStatus: 'unknown', walkVerified: false,
    address: item.address, latitude: item.latitude, longitude: item.longitude, photos: item.photos,
    sourceUrl: item.source.sourceUrl, sourceProvider: item.source.provider, sourceVerifiedAt: item.source.checkedAt,
  };
})];
export type Region = import('./registered-catalog').RegisteredRegion;
export type Stay = {
  id: string;
  name: string;
  region: Region;
  near: string[];
  price: number;
  tags: string[];
  registered?: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
  sourceUrl?: string;
  sourceProvider?: string;
  sourceVerifiedAt?: string;
  photos?: RegisteredPhoto[];
  priceVerified?: boolean;
  priceStatus?: 'unknown';
};
// Fictional businesses and sample prices. Never used as live availability or travel advice.
const demoStays: Stay[] = [
  {
    id: 'stay-coast',
    name: '바다곁 스테이',
    region: '제주',
    near: ['hyeopjae', 'geumneung', 'saebyeol'],
    price: 120000,
    tags: ['바다 중심', '2인 객실', '가상 숙소'],
  },
  {
    id: 'stay-tea',
    name: '차밭 작은집',
    region: '제주',
    near: ['osulloc', 'saebyeol', 'songaksan'],
    price: 90000,
    tags: ['조용한 휴식', '2인 객실', '가상 숙소'],
  },
  {
    id: 'stay-garden',
    name: '가든 패밀리 스테이',
    region: '제주',
    near: ['osulloc', 'hyeopjae', 'geumneung', 'saebyeol', 'songaksan'],
    price: 180000,
    tags: ['여럿이 함께', '4인 객실', '가상 숙소'],
  },
  {
    id: 'stay-east',
    name: '동녘 작은집',
    region: '제주',
    near: ['seongsan', 'seopjikoji', 'hamdeok', 'bijarim'],
    price: 115000,
    tags: ['제주 동부 여행권', '2인 객실', '가상 숙소'],
  },
  {
    id: 'stay-south',
    name: '남쪽 정원 스테이',
    region: '제주',
    near: ['cheonjiyeon', 'jeongbang', 'jusangjeolli'],
    price: 125000,
    tags: ['서귀포 여행권', '2인 객실', '가상 숙소'],
  },
  {
    id: 'stay-forest',
    name: '숲옆 시티 스테이',
    region: '서울',
    near: ['seoulforest'],
    price: 110000,
    tags: ['서울숲 중심', '2인 객실', '가상 숙소'],
  },
  {
    id: 'stay-city',
    name: '성수 작은방',
    region: '서울',
    near: ['seoulforest'],
    price: 80000,
    tags: ['작은 객실', '1~2인', '가상 숙소'],
  },
];
export const stays: Stay[] = [...demoStays, ...registeredBusinesses.filter((item) => item.kind === 'STAY').map((item): Stay => {
  const near = registeredSearchAnchors.filter((place) => place.region === item.region && straightDistanceKm(place, item) <= 15)
    .sort((a, b) => straightDistanceKm(a, item) - straightDistanceKm(b, item)).map((place) => place.id);
  return {
  id: item.id, name: item.name, region: registeredRegion(item.area),
  // A registered hotel has its own checked point. No landmark in the current
  // snapshot must never turn its anchor into undefined or a fabricated place.
  near: near.length ? near : [item.id],
  price: 0, tags: [...item.tags, '요금·빈방 미확인'], registered: true, priceVerified: false, priceStatus: 'unknown',
  address: item.address, latitude: item.latitude, longitude: item.longitude, photos: item.photos,
  sourceUrl: item.source.sourceUrl, sourceProvider: item.source.provider, sourceVerifiedAt: item.source.checkedAt,
}; })];
export const scenarios = [
  {
    id: 'coast',
    title: '장소부터 하나씩',
    subtitle: '제주 공식 자료 → 장소 담기 → 내 여행',
    prompt: '제주에서 바다 볼 만한 곳 찾아줘',
    image: '/images/hyeopjae-scenery.jpg',
    label: '차근차근',
  },
  {
    id: 'similar',
    title: '이런 분위기의 다른 곳',
    subtitle: '비슷한 장소 → 찜 → 주변 탐색',
    prompt: '오설록처럼 초록이 많은 제주 장소 찾아줘',
    image: '/images/osulloc-tea.jpg',
    label: '취향으로 발견',
  },
  {
    id: 'complete',
    title: '일정부터 한 번에',
    subtitle: 'DAY마다 오전·오후 → 식당 교체 → 저장',
    prompt: '제주 1박 2일, 바다와 맛집, 숙소까지 일정 짜줘',
    image: '/images/saebyeol-autumn.jpg',
    label: '바로 초안',
  },
  {
    id: 'booked',
    title: '숙소는 이미 예약했어요',
    subtitle: '예약 유지 → 방문·식사 조정',
    prompt: '제주 1박 2일 일정 짜줘. 숙소는 이미 예약했어',
    image: '/images/osulloc-museum.jpg',
    label: '예약 유지',
  },
  {
    id: 'seoul',
    title: '서울숲에서 반나절',
    subtitle: '산책 → 점심 → 카페 → 방문 순서',
    prompt: '서울숲에서 반나절 일정 짜줘. 점심과 카페를 넣어줘',
    image: '/images/seoulforest-path.jpg',
    label: '가벼운 나들이',
  },
  {
    id: 'saved',
    title: '찜한 장소로 여행 만들기',
    subtitle: '샘플 찜 2곳 → DAY 배치 → 저장',
    prompt: '찜한 제주 장소로 1박 2일 일정 짜줘',
    image: '/images/hyeopjae-scenery.jpg',
    label: '찜에서 출발',
  },
] as const;
export const findPlace = (id: string | null) => places.find((p) => p.id === id);
export const findFood = (id: string | null) =>
  restaurants.find((p) => p.id === id);
export const findStay = (id: string | null) => stays.find((p) => p.id === id);
export const period = (days: number) =>
  days === 1 ? '당일' : `${days - 1}박 ${days}일`;
export const money = (n: number) => n.toLocaleString('ko-KR') + '원';
