import type { Place } from './data';
import { distanceBetween } from './tripPlan.ts';
import { resolvePlacePhotos } from './placePhotos.ts';

export function candidatePhoto(place: Place, withdrawnImages: string[] = []): string {
  return resolvePlacePhotos(place, [], true).find(photo => !withdrawnImages.includes(photo.image))?.image ?? '';
}

/** Compare registered information only; planning duration is not opening hours. */
export function candidateComparison(place: Place, anchor?: Place) {
  const distance = anchor ? distanceBetween(anchor, place) : null;
  const kind = place.kind === 'STAY' ? '숙소' : place.kind === 'FOOD' ? '음식점' : '카페';
  const boilerplate = [
    `${place.area} 일정에서 확인할 ${kind} 후보입니다.`,
    `${place.area} 일정에서 비교할 ${kind} 후보예요.`,
  ];
  const description = place.description?.trim() ?? '';
  const excluded = new Set(['공식 관광정보', place.name, place.area, ...place.area.split(/\s+/), kind]);
  const features = [...new Set((place.tags ?? []).map(tag => tag.trim()).filter(tag => tag && !excluded.has(tag)))].slice(0, 3);
  return {
    distance: distance === null ? '거리 확인 필요' : distance < 1 ? `직선 ${Math.round(distance * 1000)}m` : `직선 ${distance.toFixed(1)}km`,
    features,
    description: boilerplate.includes(description) ? '' : description,
  };
}
