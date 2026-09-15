import type { Journey, Place } from './data';

export interface NewJourneyOptions {
  title: string;
  days: number;
  startDate: string;
  places: Place[];
}

/** Manual creation never pretends to optimize an itinerary. Saved places start on DAY 1. */
export function createJourneyFromPlaces(options: NewJourneyOptions, author: string): Journey | null {
  const title = options.title.trim();
  if (!title || !Number.isInteger(options.days) || options.days < 1 || options.days > 30) return null;
  const start = options.startDate ? new Date(`${options.startDate}T00:00:00Z`) : null;
  if (start && (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== options.startDate)) return null;
  const dateAt = (offset: number) => start ? new Date(start.getTime() + offset * 86400000).toISOString().slice(0, 10) : `DAY ${offset + 1}`;
  const id = `journey-${crypto.randomUUID()}`;
  const places = [...new Map(options.places.map(place => [place.id, place])).values()].map((place, index) => ({ ...place, visitId: `${id}:visit-${index}`, move: '이동시간 확인 필요' }));
  const region = [...new Set(places.map(place => place.area.split(/\s+/)[0]))].join(' · ') || '국내';
  return {
    id, title, region, dateRange: start ? `${dateAt(0)} ~ ${dateAt(options.days - 1)}` : '날짜 미정',
    duration: options.days === 1 ? '당일 여행' : `${options.days - 1}박 ${options.days}일`,
    status: 'PLANNING', visibility: 'PRIVATE', cover: places[0]?.image ?? '',
    summary: places.length ? `저장한 ${places.length}곳으로 시작하는 여행입니다.` : '새로운 여행을 준비합니다.', story: '',
    tags: [], saves: 0, views: 0, author, isMine: true,
    days: Array.from({ length: options.days }, (_, index) => ({
      day: index + 1, date: dateAt(index), title: `${index + 1}일차`, story: '',
      places: index === 0 ? places : [],
      blocks: index === 0 ? places.map((place, placeIndex) => ({ id: `${id}:place-${placeIndex}`, type: 'PLACE' as const, placeId: place.id, visitId: place.visitId })) : [],
    })),
  };
}
