import { findPlace, findFood, findStay } from './trip-data';
import { registeredMapCoordinates, getRegisteredEntity } from './registered-catalog';
import type { TripState } from './trip-engine';

export type PlaceMapCoordinate = {
  latitude: number;
  longitude: number;
  sourceUrl: string;
  sourceTitle: string;
  checkedAt: string;
  pointNote: string;
};

const checkedAt = '2026-10-16';
const representativeNote =
  '공식 관광 안내의 대표 위치입니다. 실제 출입구·주차장·탐방로는 방문 전 길찾기에서 확인해 주세요.';
function visitJeju(
  latitude: number,
  longitude: number,
  contentsId: string,
  pointNote = representativeNote,
): PlaceMapCoordinate {
  return {
    latitude,
    longitude,
    sourceUrl: `https://www.visitjeju.net/kr/detail/view?contentsid=${contentsId}`,
    sourceTitle: '제주관광공사 비짓제주',
    checkedAt,
    pointNote,
  };
}

// A small, checked list of public landmark locations, not a geocoder or a route
// service. Each VisitJeju source publishes latitude/longitude in its place data.
// Coordinates are factual location references; no page text or map imagery is
// copied. The base map has its own OpenStreetMap attribution in TripMap.
// In particular, sample restaurants/stays are not assigned their anchor's point.
export const placeMapCoordinates: Readonly<Record<string, PlaceMapCoordinate>> =
  {
    ...registeredMapCoordinates,
    osulloc: visitJeju(33.30601, 126.2901309, 'CONT_000000000500457'),
    saebyeol: visitJeju(33.36723, 126.35711, 'CONT_000000000500309'),
    hyeopjae: visitJeju(33.3924809, 126.2389861, 'CONT_000000000500697'),
    geumneung: visitJeju(33.390003, 126.23591, 'CONT_000000000500079'),
    songaksan: visitJeju(
      33.2077419,
      126.2909048,
      'CONT_000000000500378',
      '송악산 해안 둘레길의 대표 위치입니다. 정상부 출입 가능 여부와 실제 둘레길 입구는 공식 안내에서 확인해 주세요.',
    ),
    seongsan: visitJeju(33.462147, 126.936424, 'CONT_000000000500349'),
    seopjikoji: visitJeju(33.4236948, 126.9296022, 'CONT_000000000500343'),
    hamdeok: visitJeju(33.5427261, 126.6690893, 'CONT_000000000500693'),
    bijarim: visitJeju(33.491318, 126.811386, 'CONT_000000000500270'),
    cheonjiyeon: visitJeju(33.2447173, 126.5598201, 'CONT_000000000500618'),
    jeongbang: visitJeju(33.244854, 126.5718, 'CONT_000000000500531'),
    jusangjeolli: visitJeju(33.23834, 126.42586, 'CNTS_000000000020476'),
    hallasan: visitJeju(
      33.36132,
      126.54195,
      'CONT_000000000500685',
      '한라산의 대표 위치이며 탐방 출발점이 아닙니다. 예약한 탐방로와 입구를 별도로 확인해 주세요.',
    ),
    udo: visitJeju(
      33.506439,
      126.9534006,
      'CONT_000000000500477',
      '우도 섬의 대표 위치이며 승선 항구가 아닙니다. 배편·항구·귀항 시간을 별도로 확인해 주세요.',
    ),
    sehwa: visitJeju(
      33.52530490304795,
      126.86127604404146,
      'CONT_000000000500361',
    ),
    // VisitJeju's Manjanggul point is far from its visitor address. VISITKOREA's
    // own JSON-LD/map location is near the documented Manjanggul-gil 182 entrance.
    manjanggul: {
      latitude: 33.5280164989348,
      longitude: 126.770664622639,
      sourceUrl:
        'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=111165',
      sourceTitle: '한국관광공사 VISITKOREA',
      checkedAt,
      pointNote:
        '만장굴 관람 구역의 대표 위치입니다. 실제 관람 가능 구간·개방 여부·입구는 공식 안내에서 확인해 주세요.',
    },
    saryeoni: visitJeju(
      33.4180631,
      126.6534847,
      'CONT_000000000500281',
      '사려니숲길 전체의 대표 위치이며 입구가 아닙니다. 비자림로·붉은오름 중 이용할 입구와 주차장을 별도로 확인해 주세요.',
    ),
    gotjawal: visitJeju(33.282955, 126.27152, 'CNTS_000000000021111'),
    aquaplanet: visitJeju(33.4325283, 126.9272108, 'CONT_000000000500565'),
    jejumuseum: visitJeju(33.5139974, 126.5489702, 'CONT_000000000500067'),
    // VisitJeju currently repeats Saryeoni's coordinates for Stone Park. Use the
    // separate Korea Tourism Organization map point for the actual park instead.
    dolculturepark: {
      latitude: 33.4513374699931,
      longitude: 126.656757527675,
      sourceUrl:
        'https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=76736',
      sourceTitle: '한국관광공사 VISITKOREA',
      checkedAt,
      pointNote: representativeNote,
    },
    ecoland: visitJeju(33.4617075, 126.6703845, 'CONT_000000000500438'),
    yeomiji: visitJeju(33.2531755, 126.4149952, 'CONT_000000000500442'),
    hallimpark: visitJeju(33.3879944, 126.2397837, 'CONT_000000000500690'),
    jeolmul: visitJeju(33.4302354, 126.6227963, 'CONT_000000000500570'),
    geomunoreum: visitJeju(33.4569963, 126.7143064, 'CONT_000000000500034'),
    yongmeori: visitJeju(33.2334272, 126.313741, 'CONT_000000000500471'),
    sanbangsan: visitJeju(33.236614, 126.31289, 'CONT_000000000500285'),
    seoulforest: {
      latitude: 37.5443306,
      longitude: 127.03762054,
      sourceUrl: 'https://map.sd.go.kr/trip_new/tMap.jsp',
      sourceTitle: '성동구 성동여행지도 · 서울숲',
      checkedAt,
      pointNote:
        '성동구 여행지도의 서울숲 대표 위치입니다. 공원 출입구·주차장은 길찾기에서 별도로 확인해 주세요.',
    },
  };

export type TripMapPoint = PlaceMapCoordinate & {
  visitId: string;
  placeId: string;
  day: number;
  /** One-based itinerary position within the day, including unlocated stops. */
  order: number;
  name: string;
  label: string;
};
export type TripMapBounds = [[number, number], [number, number]];
export type TripMapData = {
  points: TripMapPoint[];
  totalCount: number;
  unlocatedCount: number;
  bounds: TripMapBounds | null;
};

/** Match Spotlog PersonalTrip: the previous night's stay is departure stop 1. */
export function getTripMapDayVisits(
  state: Pick<TripState, 'plan' | 'activeDay'>,
) {
  const visits = state.plan.filter((visit) => visit.day === state.activeDay);
  const previousStay = state.plan.find(
    (visit) => visit.day === state.activeDay - 1 && visit.kind === 'stay',
  );
  return previousStay
    ? [{ ...previousStay, day: state.activeDay }, ...visits]
    : visits;
}

/** Derive pins from this exact itinerary snapshot without modifying the plan. */
export function getTripMapData(
  state: Pick<TripState, 'plan' | 'activeDay'>,
  options: { allDays?: boolean } = {},
): TripMapData {
  const visits = options.allDays
    ? [...state.plan].sort((a, b) => a.day - b.day)
    : getTripMapDayVisits(state);
  const points: TripMapPoint[] = [];
  const dayOrders = new Map<number, number>();
  if (options.allDays) {
    // Count the departure stay without duplicating its visit or missing-location
    // count in the whole-trip snapshot. Match each DAY's detailed itinerary.
    for (const visit of visits) {
      if (
        state.plan.some(
          (previous) =>
            previous.day === visit.day - 1 && previous.kind === 'stay',
        )
      )
        dayOrders.set(visit.day, 1);
    }
  }
  for (const visit of visits) {
    const validDay = Number.isInteger(visit.day) && visit.day >= 1;
    const order = validDay ? (dayOrders.get(visit.day) ?? 0) + 1 : 0;
    if (validDay) dayOrders.set(visit.day, order);
    if (
      !visit.entityId ||
      !Number.isInteger(visit.day) ||
      visit.day < 1
    )
      continue;
    const expectedKinds = { food: 'FOOD', cafe: 'CAFE', shop: 'SHOP', stay: 'STAY' } as const;
    const registered = getRegisteredEntity(visit.entityId);
    const place = visit.kind === 'place' ? findPlace(visit.entityId)
      : registered?.kind === expectedKinds[visit.kind] ? findFood(visit.entityId) ?? findStay(visit.entityId) : undefined;
    const coordinate = Object.hasOwn(placeMapCoordinates, visit.entityId)
      ? placeMapCoordinates[visit.entityId]
      : null;
    if (!place || !coordinate) continue;
    points.push({
      ...coordinate,
      visitId: visit.id,
      placeId: place.id,
      day: visit.day,
      order,
      name: place.name,
      label: visit.label,
    });
  }
  const bounds: TripMapBounds | null = points.length
    ? [
        [
          Math.min(...points.map((point) => point.latitude)),
          Math.min(...points.map((point) => point.longitude)),
        ],
        [
          Math.max(...points.map((point) => point.latitude)),
          Math.max(...points.map((point) => point.longitude)),
        ],
      ]
    : null;
  return {
    points,
    totalCount: visits.length,
    unlocatedCount: visits.length - points.length,
    bounds,
  };
}
