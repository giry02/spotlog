import { findPlace, findFood, findStay } from './trip-data';
import type { TripState } from './trip-engine';

// Names/addresses identify the landmarks. We do not invent coordinates or entrances.
const landmarkQueries: Record<string, string> = {
  hyeopjae: '협재해변 제주 제주시 한림읍 협재리',
  osulloc: '오설록 티뮤지엄 제주 서귀포시 안덕면 신화역사로 15',
  saebyeol: '새별오름 제주 제주시 애월읍 봉성리',
  seoulforest: '서울숲 서울 성동구 뚝섬로 273',
};
export function mapLinks(placeId: string) {
  const place = findPlace(placeId);
  const query = landmarkQueries[placeId];
  if (!place || !query) return null;
  const params = new URLSearchParams({ api: '1', destination: query });
  return {
    directions: `https://www.google.com/maps/dir/?${params}`,
    kakao: `https://map.kakao.com/link/search/${encodeURIComponent(query)}`,
    naver: `https://map.naver.com/p/search/${encodeURIComponent(query)}`,
  };
}
export function nearbyMapSearch(
  placeId: string,
  kind: '식당' | '카페' | '숙소',
) {
  const query = landmarkQueries[placeId];
  if (!query) return null;
  return `https://map.kakao.com/link/search/${encodeURIComponent(`${query} ${kind}`)}`;
}
export function directionsTarget(s: TripState) {
  const visit = s.plan.find((v) => v.id === s.directionsVisitId);
  const businessId =
    visit && visit.kind !== 'place' ? visit.entityId : s.directionsBusinessId;
  const business = findFood(businessId ?? null) ?? findStay(businessId ?? null);
  const food = findFood(businessId ?? null);
  const stay = findStay(businessId ?? null);
  const businessAnchor =
    food?.placeId ??
    (stay
      ? stay.near.includes(s.anchorId ?? '')
        ? s.anchorId
        : stay.near[0]
      : null);
  const place = findPlace(
    visit
      ? visit.kind === 'place'
        ? visit.entityId
        : visit.anchorId
      : (businessAnchor ?? s.directionsPlaceId ?? s.anchorId),
  );
  // Every business in this demo is fictional; never create a directions URL for it.
  const unavailable =
    !!business || (!!visit && (visit.kind !== 'place' || !visit.entityId));
  return {
    place,
    visit,
    business,
    unavailable,
    links: !unavailable && place ? mapLinks(place.id) : null,
  };
}
