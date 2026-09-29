import type { Journey, JourneyDay, Place, PlaceKind } from './data';

const id = () => crypto.randomUUID();
export const isPersonalPlan = (journey: Journey) => journey.isMine && journey.purpose === 'PLAN';
export const hasLocation = (place: Place) => place.locationVerified !== false && Number.isFinite(place.lat) && Number.isFinite(place.lng) && Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180;
export function distanceBetween(a: Place, b: Place): number | null {
  if (!hasLocation(a) || !hasLocation(b)) return null;
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 12742 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function normalizePlan(journey: Journey): Journey {
  return { ...journey, days: journey.days.map(day => ({ ...day, dayId: day.dayId ?? `${journey.id}:day-${day.day}` })) };
}
export function buildPersonalPlan(places: Place[], days: number, title: string, author: string): Journey {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('여행 기간을 확인해 주세요.');
  const tripId = `trip-${id()}`;
  const unique = [...new Map(places.map(place => [place.id, place])).values()];
  const region = [...new Set(unique.map(place => place.area.split(' ')[0]))].join(' · ') || '국내';
  const tripDays: JourneyDay[] = Array.from({ length: days }, (_, i) => ({ dayId: id(), day: i + 1, date: `DAY ${i + 1}`, title: `${i + 1}일차`, story: '', places: [], blocks: [] }));
  unique.forEach((source, i) => {
    const day = tripDays[Math.min(days - 1, Math.floor(i * days / Math.max(unique.length, days)))];
    const place = { ...structuredClone(source), visitId: id(), anchorVisitId: undefined, stayDayIds: undefined, bookingFixed: undefined };
    day.places.push(place);
    day.blocks.push({ id: id(), type: 'PLACE', placeId: place.id, visitId: place.visitId });
  });
  return { id: tripId, purpose: 'PLAN', title: title.trim() || `${region} ${days === 1 ? '당일' : `${days - 1}박 ${days}일`} 여행`, region,
    dateRange: '날짜 미정', duration: days === 1 ? '당일 여행' : `${days - 1}박 ${days}일`, status: 'PLANNING', visibility: 'PRIVATE',
    cover: unique[0]?.image ?? '', summary: `저장한 ${unique.length}곳으로 시작하는 내 여행`, story: '', tags: [], saves: 0, views: 0, author, isMine: true, days: tripDays };
}
export function nearbyCandidates(anchor: Place, catalog: Place[], kind: PlaceKind): Place[] {
  return [...new Map(catalog.filter(place => place.kind === kind && place.id !== anchor.id).map(place => [place.id, place])).values()]
    .filter(place => { const distance = distanceBetween(anchor, place); return distance !== null && distance <= 15; })
    .sort((a, b) => (distanceBetween(anchor, a) ?? Infinity) - (distanceBetween(anchor, b) ?? Infinity));
}
export function appendPlanLandmark(journey: Journey, dayId: string, source: Place): Journey {
  if (!isPersonalPlan(journey)) throw new Error('내 여행에서만 담을 수 있어요.');
  const day = journey.days.find(day => day.dayId === dayId);
  if (!day) throw new Error('날짜가 바뀌었어요. 다시 선택해 주세요.');
  if (day.places.some(place => place.id === source.id)) return journey;
  const place = { ...structuredClone(source), visitId: id(), anchorVisitId: undefined };
  return { ...journey, cover: journey.cover || source.image, days: journey.days.map(item => item.dayId === dayId ? { ...item, places: [...item.places, place], blocks: [...item.blocks, { id: id(), type: 'PLACE', placeId: place.id, visitId: place.visitId }] } : item) };
}
export function insertNearby(journey: Journey, dayId: string, anchorId: string, source: Place): Journey {
  if (!isPersonalPlan(journey)) throw new Error('내 여행에서만 담을 수 있어요.');
  const day = journey.days.find(item => item.dayId === dayId);
  const anchor = day?.places.find(place => place.visitId === anchorId);
  if (!day || !anchor) throw new Error('기준 장소가 바뀌었어요. 다시 선택해 주세요.');
  if (day.places.some(place => place.id === source.id && place.anchorVisitId === anchorId)) return journey;
  const visit: Place = { ...structuredClone(source), visitId: id(), anchorVisitId: anchorId };
  const index = day.places.findIndex(place => place.visitId === anchorId);
  let insertAt = index + 1;
  while (day.places[insertAt]?.anchorVisitId === anchorId) insertAt++;
  const places = [...day.places.slice(0, insertAt), visit, ...day.places.slice(insertAt)];
  const anchorBlock = day.blocks.findIndex(block => block.visitId === anchorId);
  const blocks = [...day.blocks];
  blocks.splice(anchorBlock < 0 ? blocks.length : anchorBlock + insertAt - index, 0, { id: id(), type: 'PLACE', placeId: visit.id, visitId: visit.visitId });
  return { ...journey, days: journey.days.map(item => item.dayId === dayId ? { ...item, places, blocks } : item) };
}
export function reorderPlanVisit(journey: Journey, dayId: string, visitId: string, direction: -1 | 1): Journey {
  if (!isPersonalPlan(journey)) return journey;
  return { ...journey, days: journey.days.map(day => {
    if (day.dayId !== dayId) return day;
    const groups: Place[][] = [];
    for (const place of day.places) {
      const parent = place.anchorVisitId && groups.find(group => group[0].visitId === place.anchorVisitId);
      if (parent) parent.push(place); else groups.push([place]);
    }
    const index = groups.findIndex(group => group.some(place => place.visitId === visitId));
    const next = index + direction;
    if (index < 0 || next < 0 || next >= groups.length) return day;
    [groups[index], groups[next]] = [groups[next], groups[index]];
    const places = groups.flat();
    const positions = new Map(places.map((place, i) => [place.visitId, i]));
    const placeBlocks = day.blocks.filter(block => block.type === 'PLACE').sort((a,b) => (positions.get(a.visitId) ?? Infinity) - (positions.get(b.visitId) ?? Infinity));
    let blockIndex = 0;
    return { ...day, places, blocks: day.blocks.map(block => block.type === 'PLACE' ? placeBlocks[blockIndex++] : block) };
  }) };
}
export function removePlanVisit(journey: Journey, visitId: string, includeRelated: boolean): Journey {
  if (!isPersonalPlan(journey)) return journey;
  const removed = new Set(journey.days.flatMap(day => day.places).filter(place => place.visitId === visitId || (includeRelated && place.anchorVisitId === visitId)).map(place => place.visitId));
  return { ...journey, days: journey.days.map(day => ({ ...day,
    places: day.places.filter(place => !removed.has(place.visitId)).map(place => place.anchorVisitId === visitId ? { ...place, anchorVisitId: undefined } : place),
    blocks: day.blocks.filter(block => !block.visitId || !removed.has(block.visitId)),
  })) };
}
