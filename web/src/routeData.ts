import type { Place } from './data';
import {isRecord,requestJson,ServiceError} from './serviceRequest.ts';
type RouteSource = 'ROAD' | 'ESTIMATE';

interface RouteLeg {
  from: Place;
  to: Place;
  distanceKm: number;
  minutes: number;
  mode: 'WALK' | 'DRIVE';
}

export interface RouteResult {
  source: RouteSource;
  coordinates: Array<[number, number]>;
  distanceKm: number;
  minutes: number;
  legs: RouteLeg[];
}

interface OsrmRoutePayload {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
    legs?: Array<{ distance?: number; duration?: number }>;
  }>;
}

export const distanceKm = (from: Place, to: Place) => {
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.sin(longitudeDelta / 2) ** 2 * Math.cos(fromLatitude) * Math.cos(toLatitude);
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const routeMode = (place: Place): RouteLeg['mode'] => place.move?.includes('도보') ? 'WALK' : 'DRIVE';
export const roundMinutes = (value: number) => Math.max(5, Math.ceil(value / 5) * 5);

export const parseDurationMinutes = (value: string) => {
  if (value.includes('숙박') || value.includes('박')) return null;
  const hourMatch = value.match(/(\d+)\s*시간/);
  const minuteMatch = value.match(/(\d+)\s*분/);
  const minutes = Number(hourMatch?.[1] ?? 0) * 60 + Number(minuteMatch?.[1] ?? 0);
  return minutes > 0 ? minutes : null;
};

const timeToMinutes = (value?: string) => {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const formatClock = (value: number) => {
  const normalized = ((value % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

export const scheduleCheckForLeg = (leg: RouteLeg) => {
  if(leg.mode==='WALK')return null;
  const fromStart = timeToMinutes(leg.from.time);
  const nextStart = timeToMinutes(leg.to.time);
  const stay = parseDurationMinutes(leg.from.duration);
  if (fromStart === null || nextStart === null || stay === null) return null;
  const arrival = fromStart + stay + leg.minutes;
  const margin = nextStart - arrival;
  return {
    margin,
    arrival:formatClock(arrival),
    text: margin < 0
      ? `${Math.abs(margin)}분 부족 · ${formatClock(arrival)} 도착 예상`
      : `${margin}분 여유 · ${formatClock(arrival)} 도착 예상`,
  };
};

/** Our backend normalizes Naver driving results; never accept a result for another DAY/order. */
export function validateServiceRoute(value:unknown,places:Place[]):RouteResult {
  const ids=places.map(p=>p.visitId??p.id);
  if(!isRecord(value)||value.provider!=='NAVER'||value.mode!=='DRIVE'||JSON.stringify(value.visitIds)!==JSON.stringify(ids)
    ||!Array.isArray(value.coordinates)||value.coordinates.length<2||value.coordinates.length>100000
    ||value.coordinates.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)
    ||!Array.isArray(value.legs)||value.legs.length!==places.length-1
    ||value.legs.some(p=>!isRecord(p)||typeof p.distanceMeters!=='number'||!Number.isFinite(p.distanceMeters)||p.distanceMeters<0||typeof p.durationSeconds!=='number'||!Number.isFinite(p.durationSeconds)||p.durationSeconds<0))throw new ServiceError(502,'invalid-route');
  const legs=value.legs.map((p,index)=>({from:places[index],to:places[index+1],distanceKm:p.distanceMeters/1000,minutes:Math.ceil(p.durationSeconds/60),mode:routeMode(places[index+1])}));
  return {source:'ROAD',coordinates:value.coordinates,distanceKm:legs.reduce((n,p)=>n+p.distanceKm,0),minutes:legs.reduce((n,p)=>n+p.minutes,0),legs};
}
export async function fetchServiceRoute(endpoint:string,places:Place[],signal:AbortSignal):Promise<RouteResult>{
  const value=await requestJson(endpoint,{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'DRIVE',visits:places.map(p=>({visitId:p.visitId??p.id,lat:p.lat,lng:p.lng}))})},8000);
  return validateServiceRoute(value,places);
}

export const makeEstimatedRoute = (places: Place[]): RouteResult => {
  const legs = places.slice(1).map((place, index) => {
    const from = places[index];
    const distance = distanceKm(from, place);
    const mode = routeMode(place);
    const minutes = mode === 'WALK' ? roundMinutes((distance / 4.5) * 60) : roundMinutes((distance / 25) * 60 + 8);
    return { from, to: place, distanceKm: distance, minutes, mode };
  });
  return {
    source: 'ESTIMATE',
    coordinates: places.map((place) => [place.lng, place.lat]),
    distanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    legs,
  };
};

export const fetchRoadRoute = async (places: Place[], signal: AbortSignal): Promise<RouteResult> => {
  const coordinates = places.map((place) => `${place.lng},${place.lat}`).join(';');
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?alternatives=false&steps=false&overview=full&geometries=geojson`, { signal });
  if (!response.ok) throw new Error(`Route HTTP ${response.status}`);
  const payload = await response.json() as OsrmRoutePayload;
  const route = payload.code === 'Ok' ? payload.routes?.[0] : undefined;
  const geometry = route?.geometry?.coordinates;
  if (!route || !Array.isArray(geometry) || geometry.length < 2 || geometry.some(point=>!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)
    ||!Array.isArray(route.legs)||route.legs.length!==places.length-1||route.legs.some(leg=>!Number.isFinite(leg.distance)||!Number.isFinite(leg.duration)||leg.distance!<0||leg.duration!<0)) throw new Error('Road route unavailable');
  const legs = places.slice(1).map((place, index) => {
    const roadLeg = route.legs?.[index];
    const from = places[index];
    const distance = Number(roadLeg!.distance) / 1000;
    const mode = routeMode(place);
    const minutes = mode === 'WALK' ? roundMinutes((distance / 4.5) * 60) : roundMinutes(Number(roadLeg?.duration ?? 0) / 60 || (distance / 25) * 60 + 8);
    return { from, to: place, distanceKm: distance, minutes, mode };
  });
  return {
    source: 'ROAD',
    coordinates: geometry,
    distanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    legs,
  };
};

