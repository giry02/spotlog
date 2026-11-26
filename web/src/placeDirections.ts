import type { Place } from './data';

export type DirectionsPlace = Pick<Place, 'name'> & Partial<Pick<Place, 'address' | 'lat' | 'lng' | 'area' | 'locationVerified'>>;
export type GoogleTravelMode = 'walking' | 'driving' | 'transit';

function hasVerifiedCoordinates(place: DirectionsPlace): place is DirectionsPlace & { lat: number; lng: number } {
  const { lat, lng } = place;
  return place.locationVerified !== false && typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0);
}

/** Google Maps chooses its current start location if the device makes it available. */
export function googleDirectionsUrl(place: DirectionsPlace, mode?: GoogleTravelMode): string | null {
  const name = place.name.trim();
  const address = place.address?.trim();
  const area = place.area?.trim();
  const destination = hasVerifiedCoordinates(place)
    ? `${place.lat},${place.lng}`
    : [...new Set([name, address || area].filter(Boolean))].join(' ');
  if (!destination) return null;
  const params = new URLSearchParams({ api: '1', destination });
  if (mode) params.set('travelmode', mode);
  const url = `https://www.google.com/maps/dir/?${params}`;
  return url.length <= 2048 ? url : null;
}

/** Open Naver's route form with this destination; leave origin/transport to the user. */
export function naverDirectionsUrl(place: DirectionsPlace): string {
  if (!hasVerifiedCoordinates(place)) {
    return `https://map.naver.com/p/search/${encodeURIComponent([place.name, place.address || place.area].filter(Boolean).join(' '))}`;
  }
  const params = new URLSearchParams({
    elng: String(place.lng), elat: String(place.lat), etext: place.name, menu: 'route',
  });
  return `https://map.naver.com/index.nhn?${params}`;
}
