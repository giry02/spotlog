import type { Place } from './data';

/** Open Naver's route form with this destination; leave origin/transport to the user. */
export function naverDirectionsUrl(place: Pick<Place, 'name' | 'address' | 'lat' | 'lng'> & { locationVerified?: boolean }): string {
  const hasCoordinates = place.locationVerified !== false
    && Number.isFinite(place.lat) && Number.isFinite(place.lng)
    && Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180;
  if (!hasCoordinates) {
    return `https://map.naver.com/p/search/${encodeURIComponent([place.name, place.address].filter(Boolean).join(' '))}`;
  }
  const params = new URLSearchParams({
    elng: String(place.lng), elat: String(place.lat), etext: place.name, menu: 'route',
  });
  return `https://map.naver.com/index.nhn?${params}`;
}