import type { Place } from './data';

export interface PlannerBusinessSource {
  placeId: string;
  provider: '부산광역시 비짓부산';
  providerRecordId: string;
  sourceUrl: string;
  checkedAt: string;
  coordinateReference: '공식 관광 상세 지도 대표 지점';
  scope: 'name-address-category-coordinate';
}

type BusinessRecord = {
  id: string;
  kind: 'FOOD' | 'CAFE' | 'STAY';
  name: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  recordId: string;
  checkedAt?: string;
  menuCd?: string;
};

// A small, manually checked local catalog. These are basic place facts, not
// copied editorial descriptions, reviews, photos, ratings or live availability.
// The map coordinates are official representative points, not checked entrances.
const records: BusinessRecord[] = [
  { id: 'catalog-busan-geumsu', kind: 'FOOD', name: '금수복국 해운대본점', area: '부산 해운대', address: '부산 해운대구 중동1로43번길 23', lat: 35.16243, lng: 129.1645, recordId: '146' },
  { id: 'catalog-busan-geodae', kind: 'FOOD', name: '거대갈비', area: '부산 해운대', address: '부산 해운대구 달맞이길 22', lat: 35.16155, lng: 129.16693, recordId: '141' },
  { id: 'catalog-busan-dongbaek-sashimi', kind: 'FOOD', name: '동백섬횟집', area: '부산 해운대', address: '부산 해운대구 해운대해변로209번나길 17', lat: 35.160427, lng: 129.15468, recordId: '154' },
  { id: 'catalog-busan-namcheon-noodles', kind: 'FOOD', name: '남천면가', area: '부산 수영', address: '부산 수영구 황령대로473번길 14-2', lat: 35.139626, lng: 129.10675, recordId: '2356' },
  { id: 'catalog-busan-halme-gaya', kind: 'FOOD', name: '할매가야밀면', area: '부산 중구', address: '부산 중구 광복로 56-14', lat: 35.098934, lng: 129.03122, recordId: '102' },
  { id: 'catalog-busan-jaegi', kind: 'FOOD', name: '재기돼지국밥', area: '부산 영도', address: '부산 영도구 절영로49번길 25', lat: 35.08963, lng: 129.03987, recordId: '1837' },
  { id: 'catalog-busan-mongsil', kind: 'FOOD', name: '몽실종가돼지국밥 감천문화마을 본점', area: '부산 서구', address: '부산 서구 까치고개로197번길 3, 1층', lat: 35.10019, lng: 129.01718, recordId: '961' },
  { id: 'catalog-busan-sinchang', kind: 'FOOD', name: '신창국밥 본점', area: '부산 서구', address: '부산 서구 보수대로 53', lat: 35.10093, lng: 129.02254, recordId: '198' },
  { id: 'catalog-busan-westin', kind: 'STAY', name: '웨스틴 조선 부산', area: '부산 해운대', address: '부산광역시 해운대구 동백로 67 (우동)', lat: 35.156128, lng: 129.15404, recordId: '592' },
  { id: 'catalog-busan-shilla-stay', kind: 'STAY', name: '신라스테이 해운대', area: '부산 해운대', address: '부산광역시 해운대구 해운대로570번길 46 (우동)', lat: 35.15978, lng: 129.15875, recordId: '596' },
  { id: 'catalog-busan-paradise', kind: 'STAY', name: '파라다이스호텔부산', area: '부산 해운대', address: '부산광역시 해운대구 해운대해변로 296 (중동, 파라다이스 호텔)', lat: 35.160034, lng: 129.16446, recordId: '591' },
  { id: 'catalog-busan-park-hyatt', kind: 'STAY', name: '파크하얏트부산', area: '부산 해운대', address: '부산광역시 해운대구 마린시티1로 51 (우동)', lat: 35.156567, lng: 129.14197, recordId: '590' },
  { id: 'catalog-busan-bibibidang', kind: 'CAFE', name: '비비비당', area: '부산 해운대', address: '부산 해운대구 달맞이길 239-16, 4층', lat: 35.16249, lng: 129.18504, recordId: '1845', checkedAt: '2026-09-26' },
  { id: 'catalog-busan-blackup', kind: 'CAFE', name: '블랙업커피 서면점', area: '부산 부산진', address: '부산 부산진구 서전로10번길 41 (부전동)', lat: 35.156055, lng: 129.05998, recordId: '1636', checkedAt: '2026-09-26', menuCd: 'DOM_000000201002002001' },
  { id: 'catalog-busan-momos', kind: 'CAFE', name: '모모스커피 온천장점', area: '부산 금정', address: '부산 금정구 오시게로 20', lat: 35.21928, lng: 129.08643, recordId: '127', checkedAt: '2026-09-26' },
];

export const plannerBusinessPlaces: Place[] = records.map(({ recordId: _recordId, checkedAt: _checkedAt, menuCd: _menuCd, ...record }) => ({
  ...record,
  image: '',
  locationVerified: true,
  description: `${record.area} 일정에서 확인할 ${record.kind === 'STAY' ? '숙소' : record.kind === 'CAFE' ? '카페' : '음식점'} 후보입니다.`,
  note: record.kind === 'STAY' ? '예약 가능 여부·객실 요금·체크인 시간은 숙소에 확인하세요.' : '영업 여부·메뉴·가격·대기 상황은 방문 전에 확인하세요.',
  duration: record.kind === 'STAY' ? '숙박' : '',
  tags: ['공식 관광정보', record.area.split(' ')[1]],
}));

export const plannerBusinessSources: PlannerBusinessSource[] = records.map(record => ({
  placeId: record.id,
  provider: '부산광역시 비짓부산',
  providerRecordId: record.recordId,
  sourceUrl: `https://www.visitbusan.net/index.busan?menuCd=${record.menuCd ?? (record.kind === 'STAY' ? 'DOM_000000201004001000' : 'DOM_000000201002001000')}&uc_seq=${record.recordId}&lang_cd=ko`,
  checkedAt: record.checkedAt ?? '2026-09-21',
  coordinateReference: '공식 관광 상세 지도 대표 지점',
  scope: 'name-address-category-coordinate',
}));

export const plannerBusinessSourceById = new Map(plannerBusinessSources.map(source => [source.placeId, source]));
