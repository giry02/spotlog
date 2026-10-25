import { findFood, findPlace, findStay } from './trip-data';
import type { ItinerarySelection, TripState, Visit } from './trip-engine';

/** A narrow human constraint, not an assumption that every itinerary needs two stops. */
export function requestsMorningAfternoonVisits(text: string): boolean {
  const compact = text.replace(/[\s,·/ㆍ]+/g, '');
  const one = '(?:한|1|하나)(?:곳|군데)?';
  const pair = '(?:오전(?:과|랑|와|및)?오후|오후(?:과|랑|와|및)?오전)(?:에는?|은|로)?';
  const patterns = [
    new RegExp(`${pair}(?:(?:각각|각)${one}(?:씩)?|${one}씩)`),
    new RegExp(`오전(?:에는?|은)?${one}(?:씩)?(?:만|씩|에|은|에는|하고|그리고|넣고|씩넣고)*오후(?:에는?|은)?${one}(?:씩)?`),
  ];
  return patterns.some(pattern => {
    const match = pattern.exec(compact);
    return !!match && !/^(?:은|는|으로)?(?:말고|넣지|배치하지|구성하지|하지|필요없|아니)/.test(compact.slice(match.index + match[0].length));
  });
}

/** Execute the model's actual day/order selection. Never fill empty slots from a catalog. */
export function buildSelectedItinerary(
  state: TripState,
  selection: ItinerarySelection[],
): TripState {
  const region = state.region;
  if (!region || !selection.length || selection.some(({ day, placeId }) =>
    day < 1 || day > state.days || findPlace(placeId)?.region !== region,
  )) return state;
  const locked = state.plan.filter((visit) => visit.kind === 'stay' && visit.locked);
  if (locked.some((visit) => visit.day >= state.days)) return state;
  const collected = [...new Set(state.collectedIds ?? [])];
  // The LLM selects only grounded landmarks. Explicit business choices are
  // retained by their canonical anchor, rather than the last focused foodId.
  const collectedFood = collected.flatMap(id => {
    const food = findFood(id);
    return food && (food.cuisine === '카페' ? state.cafes : String(food.cuisine) === '상점' || state.meals) ? [food] : [];
  });
  const collectedStays = collected.flatMap(id => {
    const stay = findStay(id);
    return stay?.region === region ? [stay] : [];
  });
  const plan: Visit[] = [];
  const reservedIds = new Set(locked.map((visit) => visit.id));
  let serial = 1;
  const add = (day: number, kind: Visit['kind'], entityId: string | null, anchorId: string, label: string, isLocked = false) => {
    while (reservedIds.has(`visit-${serial}`)) serial++;
    plan.push({ id: `visit-${serial++}`, day, kind, entityId, anchorId, label, locked: isLocked });
  };
  for (let day = 1; day <= state.days; day++) {
    const visits = selection.filter((visit) => visit.day === day);
    for (let index = 0; index < visits.length; index++) {
      const visit = visits[index];
      const fullDay = findPlace(visit.placeId)?.planning?.dayScope === 'full-day';
      add(day, 'place', visit.placeId, visit.placeId, fullDay ? '하루 방문' : index === 0 ? '오전 방문' : index === 1 ? '오후 방문' : '추가 방문');
      const choices = collectedFood.filter(food => food.placeId === visit.placeId);
      for (const food of choices) {
        const meals = plan.filter(item => item.day === day && item.kind === 'food').length;
        add(day, food.cuisine === '카페' ? 'cafe' : String(food.cuisine) === '상점' ? 'shop' : 'food', food.id, food.placeId,
          food.cuisine === '카페' ? '카페에서 쉬기' : String(food.cuisine) === '상점' ? '쇼핑' : meals === 0 ? '점심' : meals === 1 ? '저녁' : '추가 식사');
      }
      if (index === 0 && state.meals && !choices.some(food => food.cuisine !== '카페')) {
        const chosen = findFood(state.foodId);
        add(day, 'food', chosen?.placeId === visit.placeId && chosen.cuisine !== '카페' ? chosen.id : null, visit.placeId, '점심');
      }
    }
    const lastAnchor = visits.at(-1)?.placeId;
    if (lastAnchor && state.cafes && !plan.some(visit => visit.day === day && visit.kind === 'cafe')) {
      const chosen = findFood(state.cafeId);
      add(day, 'cafe', chosen?.placeId === lastAnchor && chosen.cuisine === '카페' ? chosen.id : null, lastAnchor, '카페에서 쉬기');
    }
    if (lastAnchor && state.meals && day < state.days && plan.filter(visit => visit.day === day && visit.kind === 'food').length < 2)
      add(day, 'food', null, lastAnchor, '저녁');
    const reserved = locked.filter((visit) => visit.day === day);
    if (reserved.length) {
      plan.push(...reserved.map((visit) => ({ ...visit })));
    } else if (day < state.days && lastAnchor && (state.lodging || state.booked)) {
      const chosen = collectedStays[Math.min(day - 1, collectedStays.length - 1)] ?? (state.businessMode === 'registered' ? undefined : findStay(state.stayId));
      const hotel = !state.booked && chosen?.region === region ? chosen : undefined;
      const anchor = hotel && !hotel.near.includes(lastAnchor) ? hotel.near[0] : lastAnchor;
      add(day, 'stay', hotel?.id ?? null, anchor, '숙박', state.booked);
    }
  }
  // A business selected near one landmark can have a different canonical
  // nearest-landmark anchor. Preserve that explicit choice without inventing a visit.
  for (const food of collectedFood.filter(item => !plan.some(visit => visit.entityId === item.id))) {
    const day = plan.find(visit => visit.anchorId === food.placeId)?.day ?? 1;
    const kind = food.cuisine === '카페' ? 'cafe' : String(food.cuisine) === '상점' ? 'shop' : 'food';
    add(day, kind, food.id, food.placeId, kind === 'cafe' ? '카페에서 쉬기' : kind === 'shop' ? '쇼핑' : plan.some(visit=>visit.day===day && visit.kind==='food') ? '추가 식사' : '점심');
  }
  plan.sort((a,b)=>a.day-b.day || Number(a.kind==='stay')-Number(b.kind==='stay'));
  const hasConditions = selection.some(({ placeId }) => (findPlace(placeId)?.planning?.conditions.length ?? 0) > 0);
  return {
    ...state,
    plan,
    stage: 'plan',
    activeDay: 1,
    editingId: null,
    savedPlanId: null,
    communitySourceId: null,
    anchorId: selection[0].placeId,
    notice: '검색 자료에서 선택한 방문지를 지정한 날짜와 순서에 배치했어요. 식당·카페·숙소를 고르지 않은 자리는 비워 두었어요.' +
      (locked.length ? ' 예약한 숙소는 유지했어요.' : '') +
      (hasConditions ? ' 예약·운항·입장·기상 등 방문 조건은 각 장소의 상세 정보와 공식 안내에서 확인해 주세요.' : ''),
  };
}
