import type { Journey, Place } from './data';

/** A repeated place on another DAY is a separate choice, just like an itinerary visit. */
export function aiTravelVisitKey(day: number, place: Place, index: number): string {
  return place.visitId ?? `day-${day}:place-${place.id}:visit-${index}`;
}

/** Filter a generated preview only at approval time; retain the source for undo/retry. */
export function selectAiTravelVisits(source: Journey, excludedVisitKeys: ReadonlySet<string>): Journey {
  const selected = structuredClone(source);
  let changed = false;
  selected.days = selected.days.map((day) => {
    const excluded = day.places.filter((place, index) => excludedVisitKeys.has(aiTravelVisitKey(day.day, place, index)));
    if (!excluded.length) return day;
    changed = true;
    const excludedVisitIds = new Set(excluded.flatMap((place) => place.visitId ? [place.visitId] : []));
    const excludedPlaceIds = new Set(excluded.map((place) => place.id));
    const kept = day.places.filter((place, index) => !excludedVisitKeys.has(aiTravelVisitKey(day.day, place, index)));
    const keptPlaceIds = new Set(kept.map((place) => place.id));
    const originalGeneratedTitle = day.places.map((place) => place.name).join(' · ');
    return {
      ...day,
      // Only replace the generated list title; unrelated authored headings remain untouched.
      title: day.title === originalGeneratedTitle ? (kept.map((place) => place.name).join(' · ') || '선택한 장소 없음') : day.title,
      places: kept,
      blocks: day.blocks.filter((block) => {
        if (block.visitId) return !excludedVisitIds.has(block.visitId);
        // Legacy unkeyed place embeds can be removed only when no visit to that place remains.
        if (block.type === 'PLACE' && block.placeId) return !excludedPlaceIds.has(block.placeId) || keptPlaceIds.has(block.placeId);
        return true;
      }),
    };
  });
  if (changed) {
    const selectedPlaces = selected.days.flatMap((day) => day.places);
    selected.cover = selectedPlaces[0]?.image ?? '';
    selected.summary = `사진과 장소 정보를 확인해 ${selectedPlaces.length}곳을 선택한 로컬 추천 초안입니다.`;
  }
  return selected;
}
