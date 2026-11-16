import type { Journey } from './data';
import type { StayChoice } from './NearbyBusinessSheet';

/** Preview only the nights the user explicitly selected; the last DAY is checkout. */
export function tripPickerStaySelection(journey: Journey, placeId: string, choice: StayChoice) {
  const start = journey.days.findIndex(day => day.dayId === choice.dayId);
  if (start < 0 || !Number.isInteger(choice.nights) || choice.nights < 1 || start + choice.nights >= journey.days.length) throw new Error('숙박일과 여행 기간을 확인해 주세요.');
  const days = journey.days.slice(start, start + choice.nights);
  const conflicts = days.flatMap(day => day.places.filter(place => place.kind === 'STAY' && place.id !== placeId).map(place => ({ dayId: day.dayId!, day: day.day, placeId: place.id, name: place.name, fixed: Boolean(place.bookingFixed) })));
  const version = JSON.stringify([journey.id, placeId, choice, days.map(day => [day.dayId, day.places.filter(place => place.kind === 'STAY').map(place => [place.id, place.visitId, place.name, Boolean(place.bookingFixed)])])]);
  return { conflicts, version, startDay: days[0].day, lastNightDay: days.at(-1)!.day };
}
