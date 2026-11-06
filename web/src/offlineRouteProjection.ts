import type { Place } from './data';
import { distanceBetween, hasLocation } from './tripPlan.ts';

export interface RoutePosition { lat: number; lng: number }
export interface OfflineRoutePoint {
  place: Place;
  number: number;
  key: string;
  /** Actual projected position. Label offsets never change saved coordinates. */
  x: number;
  y: number;
  labelX: number;
  labelY: number;
}
export interface OfflineRouteProjection {
  width: number;
  height: number;
  points: OfflineRoutePoint[];
  missing: Array<{ place: Place; number: number }>;
  /** Never bridge an unknown coordinate and imply a continuous route. */
  segments: Array<[OfflineRoutePoint, OfflineRoutePoint]>;
  straightDistanceKm: number;
  project: (position: RoutePosition) => { x: number; y: number; within: boolean } | null;
}

const radians = Math.PI / 180;
const wrap = (lng: number, reference: number) => reference + ((lng - reference + 540) % 360) - 180;
const validPosition = (position: RoutePosition) => Number.isFinite(position.lat) && Number.isFinite(position.lng) && Math.abs(position.lat) <= 90 && Math.abs(position.lng) <= 180;

/** A coordinate diagram, without map tiles, roads, routing or location persistence. */
export function projectOfflineRoute(places: Place[]): OfflineRouteProjection {
  const width = 360, height = 280, padding = 34;
  const located = places.flatMap((place, index) => hasLocation(place) ? [{ place, number: index + 1, index }] : []);
  const missing = places.flatMap((place, index) => hasLocation(place) ? [] : [{ place, number: index + 1 }]);
  if (!located.length) return { width, height, points: [], missing, segments: [], straightDistanceKm: 0, project: () => null };
  const reference = located[0].place.lng;
  const meanLatitude = located.reduce((sum, item) => sum + item.place.lat, 0) / located.length;
  const latitudeScale = Math.max(0.01, Math.cos(meanLatitude * radians));
  const raw = located.map(item => ({ ...item, east: wrap(item.place.lng, reference) * latitudeScale, north: item.place.lat }));
  const west = Math.min(...raw.map(point => point.east)), east = Math.max(...raw.map(point => point.east));
  const south = Math.min(...raw.map(point => point.north)), north = Math.max(...raw.map(point => point.north));
  // A single location remains visible instead of producing infinite zoom/division by zero.
  const rangeX = Math.max(east - west, 0.008), rangeY = Math.max(north - south, 0.008);
  const scale = Math.min((width - padding * 2) / rangeX, (height - padding * 2) / rangeY);
  const centerX = (west + east) / 2, centerY = (south + north) / 2;
  const project = (position: RoutePosition) => {
    if (!validPosition(position)) return null;
    const x = width / 2 + (wrap(position.lng, reference) * latitudeScale - centerX) * scale;
    const y = height / 2 - (position.lat - centerY) * scale;
    return { x, y, within: x >= padding / 2 && x <= width - padding / 2 && y >= padding / 2 && y <= height - padding / 2 };
  };
  const points = raw.map(item => {
    const point = project(item.place)!;
    return { place: item.place, number: item.number, key: item.place.visitId ?? `${item.place.id}:${item.index}`, x: point.x, y: point.y, labelX: point.x, labelY: point.y };
  });
  // 64 source pixels keep 44px touch boxes separate at the narrowest 320px shell.
  // Only labels move; the saved location and straight route remain unchanged.
  const candidates: Array<{ x: number; y: number }> = [];
  for (let y = padding; y <= height - padding; y += 8) for (let x = padding; x <= width - padding; x += 8) candidates.push({ x, y });
  const placed: OfflineRoutePoint[] = [];
  for (const point of points) {
    const free = (candidate: { x: number; y: number }) => placed.every(other => Math.max(Math.abs(candidate.x - other.labelX), Math.abs(candidate.y - other.labelY)) >= 64);
    if (!free(point)) {
      const nearby = [...candidates].sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y));
      const target = nearby.find(free);
      if (target) { point.labelX = target.x; point.labelY = target.y; }
    }
    placed.push(point);
  }
  const byNumber = new Map(points.map(point => [point.number, point]));
  const segments = points.flatMap(point => {
    const next = byNumber.get(point.number + 1);
    return next ? [[point, next] as [OfflineRoutePoint, OfflineRoutePoint]] : [];
  });
  const straightDistanceKm = segments.reduce((sum, [from, to]) => sum + (distanceBetween(from.place, to.place) ?? 0), 0);
  return { width, height, points, missing, segments, straightDistanceKm, project };
}
