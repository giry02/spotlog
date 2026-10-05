import type { Journey, Place } from './data';

// Place IDs identify destinations; visit IDs identify occurrences inside a journey.
export function normalizeVisits(journey: Journey): Journey {
  return { ...journey, days: journey.days.map((day) => {
    const reserved = new Set(day.places.map((place) => place.visitId).filter(Boolean));
    const assigned = new Set<string>();
    const places = day.places.map((place, index) => {
      let visitId = place.visitId;
      if (!visitId || assigned.has(visitId)) {
        const base = `${journey.id}:day-${day.day}:visit-${index}`;
        visitId = base;
        let suffix = 1;
        while (reserved.has(visitId) || assigned.has(visitId)) visitId = `${base}-${suffix++}`;
      }
      assigned.add(visitId);
      return { ...place, visitId };
    });
    const used = new Set<string>();
    const blocks = day.blocks.map((block) => {
      if (block.type !== 'PLACE') return block;
      const match = places.find((place) => block.visitId ? place.visitId === block.visitId : place.id === block.placeId && !used.has(place.visitId))
        ?? places.find((place) => place.id === block.placeId);
      if (!match) return block;
      used.add(match.visitId);
      return { ...block, visitId: match.visitId };
    });
    return { ...day, places, blocks };
  }) };
}

export function addVisit(journey: Journey, dayNumber: number, place: Place, repeat = false): Journey {
  if (!journey.isMine) return journey;
  const day = journey.days.find((item) => item.day === dayNumber);
  if (!day || (!repeat && day.places.some((item) => item.id === place.id))) return journey;
  const visitId = crypto.randomUUID();
  return { ...journey, days: journey.days.map((item) => item.day !== dayNumber ? item : { ...item,
    places: [...item.places, { ...place, visitId, move: '이동시간 확인 필요' }],
    blocks: [...item.blocks, { id: `block-${visitId}`, type: 'PLACE', placeId: place.id, visitId }],
  }) };
}

export function removeVisit(journey: Journey, dayNumber: number, visitId: string): Journey {
  if (!journey.isMine || !visitId) return journey;
  return { ...journey, days: journey.days.map((day) => day.day !== dayNumber ? day : { ...day,
    places: day.places.filter((place) => place.visitId !== visitId),
    blocks: day.blocks.filter((block) => block.type !== 'PLACE' || block.visitId !== visitId),
  }) };
}
