import { Share } from 'react-native';
import { findPlace } from '../data/mockCatalog';
import type { TripDraft } from '../types/domain';

export function formatTripForSharing(trip: TripDraft) {
  const schedule = Array.from({ length: trip.days }, (_, index) => index + 1)
    .map((day) => {
      const items = trip.items
        .filter((item) => item.day === day)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((item) => {
          const place = findPlace(item.placeId);
          return place ? `${item.time} ${place.name} (${place.area})` : null;
        })
        .filter((line): line is string => Boolean(line));

      return items.length ? `DAY ${day}\n${items.join('\n')}` : null;
    })
    .filter((day): day is string => Boolean(day))
    .join('\n\n');

  return [
    `Spotlog 여행 · ${trip.title}`,
    `${trip.startDate} – ${trip.endDate} · ${trip.nights}박 ${trip.days}일`,
    schedule,
    '장면에서 시작하는 나만의 여행, Spotlog',
  ].filter(Boolean).join('\n\n');
}

export function shareTrip(trip: TripDraft) {
  return Share.share(
    { title: trip.title, message: formatTripForSharing(trip) },
    { dialogTitle: 'Spotlog 여행 일정 공유' },
  );
}
