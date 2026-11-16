import type { JourneyDay } from './data';

/** Catalogue stay suggestions only: never an opening-time, route-time or fitness assessment. */
export function courseDayFacts(day: JourneyDay) {
  let stayMinutes = 0, unknownStays = 0, overnightCount = 0;
  for (const place of day.places) {
    if (place.kind === 'STAY') { overnightCount++; continue; }
    const duration = place.duration?.trim() || '';
    if (duration.includes('박')) { unknownStays++; continue; }
    const hours = duration.match(/(\d+)\s*시간/), minutes = duration.match(/(\d+)\s*분/);
    const value = Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0);
    if (value > 0) stayMinutes += value;
    else unknownStays++;
  }
  return { stopCount: day.places.length, stayMinutes, unknownStays, overnightCount };
}

export function courseStayLabel(minutes: number) {
  if (!minutes) return '체류시간 미등록';
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return `체류 합계 ${hours ? `${hours}시간` : ''}${hours && remainder ? ' ' : ''}${remainder ? `${remainder}분` : ''}`;
}
