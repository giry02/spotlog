import {
  places,
  restaurants,
  stays,
  findPlace,
  findFood,
  findStay,
  period,
  type Region,
} from './trip-data';
import { directionsTarget } from './travel-links';

export type Stage =
  | 'discover'
  | 'place'
  | 'food'
  | 'stay'
  | 'plan'
  | 'saved'
  | 'route'
  | 'directions'
  | 'progress'
  | 'external';
export type Visit = {
  id: string;
  day: number;
  kind: 'place' | 'food' | 'cafe' | 'stay';
  entityId: string | null;
  anchorId: string;
  label: string;
  locked: boolean;
  status?: 'done' | 'skipped';
};
export type TripState = {
  stage: Stage;
  question: string;
  notice: string;
  region: Region | null;
  days: number;
  theme: 'all' | 'sea' | 'green';
  similarTo: string | null;
  anchorId: string | null;
  foodId: string | null;
  cafeId: string | null;
  stayId: string | null;
  foodKind: '식당' | '카페';
  cuisine: '전체' | '한식' | '양식';
  walk: number;
  foodBudget: number | null;
  stayBudget: number;
  booked: boolean;
  meals: boolean;
  cafes: boolean;
  lodging: boolean;
  savedIds: string[];
  plan: Visit[];
  editingId: string | null;
  activeDay: number;
  savedPlanId: string | null;
  directionsVisitId?: string | null;
  directionsPlaceId?: string | null;
  directionsBusinessId?: string | null;
};
export type TripTurn = { id: number; state: TripState; restoredFrom?: number };
export type SavedPlan = {
  id: string;
  title: string;
  region: Region;
  days: number;
  visits: Visit[];
  booked: boolean;
};
export type TripSession = {
  turns: TripTurn[];
  nextId: number;
  library: SavedPlan[];
};
export type TripAction =
  | { type: 'message'; text: string }
  | { type: 'place'; id: string }
  | { type: 'bookmark'; id: string }
  | { type: 'food'; id: string }
  | { type: 'stay'; id: string }
  | { type: 'show'; stage: Stage; kind?: '식당' | '카페'; day?: number }
  | { type: 'region'; region: Region }
  | { type: 'walk'; value: number }
  | { type: 'cuisine'; value: TripState['cuisine'] }
  | { type: 'stay-budget'; value: number }
  | { type: 'build'; savedOnly?: boolean }
  | { type: 'day'; day: number }
  | { type: 'add-selected' }
  | { type: 'edit'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; direction: -1 | 1 }
  | { type: 'directions'; id?: string; placeId?: string; businessId?: string }
  | { type: 'progress'; id: string; status: 'done' | 'skipped' | 'pending' }
  | { type: 'save' }
  | { type: 'open'; id: string }
  | { type: 'resume'; id: number };

export function initialTrip(savedIds: string[] = []): TripState {
  return {
    stage: 'discover',
    question: '',
    notice: '',
    region: null,
    days: 1,
    theme: 'all',
    similarTo: null,
    anchorId: null,
    foodId: null,
    cafeId: null,
    stayId: null,
    foodKind: '식당',
    cuisine: '전체',
    walk: 20,
    foodBudget: null,
    stayBudget: 200000,
    booked: false,
    meals: true,
    cafes: false,
    lodging: true,
    savedIds: [...savedIds],
    plan: [],
    editingId: null,
    activeDay: 1,
    savedPlanId: null,
  };
}
export function createTripSession(
  savedIds: string[] = [],
  library: SavedPlan[] = [],
): TripSession {
  return {
    turns: [{ id: 1, state: initialTrip(savedIds) }],
    nextId: 2,
    library,
  };
}
export const currentTrip = (session: TripSession) =>
  session.turns[session.turns.length - 1].state;
export function isTripSession(value: unknown): value is TripSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as TripSession;
  const validVisits = (visits: unknown): visits is Visit[] =>
    Array.isArray(visits) &&
    visits.every(
      (v) =>
        v &&
        typeof v.id === 'string' &&
        Number.isInteger(v.day) &&
        v.day >= 1 &&
        v.day <= 3 &&
        ['place', 'food', 'cafe', 'stay'].includes(v.kind) &&
        typeof v.label === 'string' &&
        typeof v.locked === 'boolean' &&
        (v.status === undefined || ['done', 'skipped'].includes(v.status)) &&
        Boolean(findPlace(v.anchorId)) &&
        (v.entityId === null ||
          Boolean(
            v.kind === 'place'
              ? findPlace(v.entityId)
              : v.kind === 'stay'
                ? findStay(v.entityId)
                : findFood(v.entityId),
          )),
    );
  return (
    Array.isArray(session.turns) &&
    session.turns.length > 0 &&
    Number.isInteger(session.nextId) &&
    session.nextId > Math.max(...session.turns.map((t) => t?.id ?? 0)) &&
    session.turns.every((t) => {
      const s = t?.state;
      return (
        Number.isInteger(t?.id) &&
        s &&
        [
          'discover',
          'place',
          'food',
          'stay',
          'plan',
          'saved',
          'route',
          'directions',
          'progress',
          'external',
        ].includes(s.stage) &&
        typeof s.question === 'string' &&
        typeof s.notice === 'string' &&
        [null, '제주', '서울'].includes(s.region) &&
        Number.isInteger(s.days) &&
        s.days >= 1 &&
        s.days <= 3 &&
        ['식당', '카페'].includes(s.foodKind) &&
        Array.isArray(s.savedIds) &&
        s.savedIds.every((id) => Boolean(findPlace(id))) &&
        validVisits(s.plan)
      );
    }) &&
    Array.isArray(session.library) &&
    session.library.every(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        typeof p.title === 'string' &&
        ['제주', '서울'].includes(p.region) &&
        Number.isInteger(p.days) &&
        p.days >= 1 &&
        p.days <= 3 &&
        validVisits(p.visits),
    )
  );
}
const copy = (s: TripState): TripState => ({
  ...s,
  savedIds: [...s.savedIds],
  plan: s.plan.map((v) => ({ ...v })),
});
/** Continue in itinerary order, starting at the selected DAY. Old visits default to pending. */
export function nextPendingVisit(s: TripState): Visit | undefined {
  return (
    s.plan.find((v) => v.day >= s.activeDay && !v.status) ??
    s.plan.find((v) => !v.status)
  );
}
export function placeResults(s: TripState) {
  const reference = findPlace(s.similarTo);
  return places
    .filter(
      (p) =>
        (!s.region || p.region === s.region) &&
        p.id !== s.similarTo &&
        (s.theme !== 'sea' || p.id === 'hyeopjae') &&
        (s.theme !== 'green' || p.id !== 'hyeopjae'),
    )
    .sort((a, b) =>
      reference
        ? a.mood.reduce((n, v, i) => n + Math.abs(v - reference.mood[i]), 0) -
          b.mood.reduce((n, v, i) => n + Math.abs(v - reference.mood[i]), 0)
        : 0,
    );
}
export function foodResults(s: TripState) {
  return restaurants
    .filter(
      (r) =>
        r.placeId === s.anchorId &&
        (s.foodKind === '카페' ? r.cuisine === '카페' : r.cuisine !== '카페') &&
        (s.cuisine === '전체' || r.cuisine === s.cuisine) &&
        r.walk <= s.walk &&
        (!s.foodBudget || r.price <= s.foodBudget),
    )
    .sort((a, b) => a.walk - b.walk);
}
export function stayResults(s: TripState) {
  return stays
    .filter(
      (p) =>
        p.region === s.region &&
        p.price <= s.stayBudget &&
        (!s.anchorId || p.near.includes(s.anchorId)),
    )
    .sort((a, b) => a.price - b.price);
}
export function visitName(v: Visit) {
  if (!v.entityId)
    return v.locked
      ? '예약한 숙소 이용'
      : `${v.kind === 'stay' ? '숙소' : v.kind === 'cafe' ? '카페' : v.kind === 'food' ? '식당' : '장소'} 미정`;
  return (
    (v.kind === 'place'
      ? findPlace(v.entityId)
      : v.kind === 'stay'
        ? findStay(v.entityId)
        : findFood(v.entityId)
    )?.name ?? '장소 확인 필요'
  );
}
export function makePlan(s: TripState, savedOnly = false): TripState {
  const n = copy(s);
  let candidates = savedOnly
    ? places.filter((p) => s.savedIds.includes(p.id))
    : places.filter((p) => !s.region || p.region === s.region);
  if (!s.region) {
    const regions = [...new Set(candidates.map((p) => p.region))];
    if (regions.length !== 1)
      return {
        ...n,
        stage: savedOnly ? 'saved' : 'discover',
        notice:
          '여행할 지역을 먼저 골라주세요. 서로 다른 지역을 한 일정에 섞지 않아요.',
      };
    n.region = regions[0] as Region;
  }
  candidates = candidates.filter((p) => p.region === n.region);
  if (!candidates.length)
    return {
      ...n,
      stage: 'saved',
      notice:
        '이 지역에 찜한 장소가 없어요. 장소를 찜한 다음 다시 만들어 보세요.',
    };
  const firstId = s.anchorId ?? (s.theme === 'sea' ? 'hyeopjae' : null);
  candidates.sort(
    (a, b) => Number(b.id === firstId) - Number(a.id === firstId),
  );
  if (!savedOnly && s.days === 1)
    candidates = candidates.slice(0, s.anchorId ? 1 : 2);
  n.plan = [];
  let serial = 1;
  const add = (
    day: number,
    kind: Visit['kind'],
    entityId: string | null,
    anchorId: string,
    label: string,
    locked = false,
  ) =>
    n.plan.push({
      id: `visit-${serial++}`,
      day,
      kind,
      entityId,
      anchorId,
      label,
      locked,
    });
  for (let day = 1; day <= s.days; day++) {
    const batchSize = Math.ceil(candidates.length / s.days);
    const dayPlaces = candidates.slice((day - 1) * batchSize, day * batchSize);
    const anchor = dayPlaces[0]?.id ?? candidates[candidates.length - 1].id;
    if (dayPlaces[0]) add(day, 'place', anchor, anchor, '오전 방문');
    if (s.meals && dayPlaces.length) {
      const selected = findFood(s.foodId);
      const lunch =
        selected?.placeId === anchor && selected.cuisine !== '카페'
          ? selected
          : restaurants.find(
              (r) => r.placeId === anchor && r.cuisine !== '카페',
            );
      add(day, 'food', lunch?.id ?? null, anchor, '점심');
    }
    dayPlaces
      .slice(1)
      .forEach((p) => add(day, 'place', p.id, p.id, '오후 방문'));
    const lastAnchor = dayPlaces.at(-1)?.id ?? anchor;
    if (s.cafes && dayPlaces.length) {
      const selectedCafe = findFood(s.cafeId);
      add(
        day,
        'cafe',
        selectedCafe?.placeId === lastAnchor
          ? selectedCafe.id
          : (restaurants.find(
              (r) => r.placeId === lastAnchor && r.cuisine === '카페',
            )?.id ?? null),
        lastAnchor,
        '카페에서 쉬기',
      );
    }
    if (s.meals && s.days > 1 && day < s.days) {
      const used = n.plan.filter((v) => v.day === day).map((v) => v.entityId);
      add(
        day,
        'food',
        restaurants.find(
          (r) =>
            r.placeId === lastAnchor &&
            r.cuisine !== '카페' &&
            !used.includes(r.id),
        )?.id ?? null,
        lastAnchor,
        '저녁',
      );
    }
    if (day < s.days && (s.lodging || s.booked)) {
      const selected = findStay(s.stayId);
      const hotel =
        selected?.region === n.region
          ? selected
          : stays
              .filter(
                (h) =>
                  h.region === n.region &&
                  h.price <= s.stayBudget &&
                  h.near.includes(lastAnchor),
              )
              .sort((a, b) => a.price - b.price)[0];
      const stayAnchor = hotel?.near.includes(lastAnchor)
        ? lastAnchor
        : s.anchorId && hotel?.near.includes(s.anchorId)
          ? s.anchorId
          : (hotel?.near[0] ?? lastAnchor);
      add(
        day,
        'stay',
        s.booked ? null : (hotel?.id ?? null),
        stayAnchor,
        '숙박',
        s.booked,
      );
    }
  }
  n.anchorId = candidates[0].id;
  n.stage = 'plan';
  n.activeDay = 1;
  n.editingId = null;
  n.savedPlanId = null;
  n.notice = savedOnly
    ? '찜한 장소만 방문지로 배치했어요. 식당·숙소는 같은 지역의 체험 후보로 연결했어요.'
    : '방문 → 식사 → 숙박 순서의 초안이에요. 원하는 부분만 바꿀 수 있어요.';
  return n;
}

function reduceTrip(before: TripState, action: TripAction): TripState {
  let s = copy(before);
  s.notice = '';
  const choosePlace = (id: string) => {
    const p = findPlace(id);
    if (!p) return;
    const target = s.plan.find((v) => v.id === s.editingId);
    if (target && target.kind === 'place') {
      if (p.region !== s.region) {
        s.notice = '일정과 같은 지역의 장소를 선택해 주세요.';
        return;
      }
      target.entityId = p.id;
      target.anchorId = p.id;
      delete target.status;
      s.stage = 'plan';
      s.editingId = null;
    } else {
      s.stage = 'place';
    }
    s.region = p.region as Region;
    s.anchorId = id;
    s.foodId = null;
    s.cafeId = null;
    s.stayId = null;
  };
  const showFood = (kind: '식당' | '카페' = '식당') => {
    s.foodKind = kind;
    s.cuisine = '전체';
    if (kind === '카페') {
      s.cafes = true;
      s.cafeId = null;
    } else s.foodId = null;
    if (!s.anchorId) {
      s.stage = 'discover';
      s.notice = '어느 장소 주변을 볼까요? 먼저 아래에서 장소를 골라주세요.';
    } else s.stage = 'food';
  };
  const showStay = () => {
    if (s.booked) {
      s.stage = s.plan.length ? 'plan' : 'place';
      s.notice =
        '이미 예약한 숙소는 유지할게요. 새로운 숙소를 자동으로 넣지 않아요.';
      return;
    }
    if (!s.region) {
      s.stage = 'discover';
      s.notice = '숙소를 찾을 지역이나 장소를 먼저 골라주세요.';
      return;
    }
    s.stage = 'stay';
    s.stayId = null;
  };
  const chooseBusiness = (kind: 'food' | 'stay', id: string) => {
    const item =
      kind === 'food'
        ? foodResults(s).find((p) => p.id === id)
        : stayResults(s).find((p) => p.id === id);
    if (!item) {
      s.notice = '현재 조건에 표시된 후보를 골라주세요.';
      return;
    }
    if (kind === 'stay' && s.booked) {
      s.notice = '예약한 숙소는 유지됩니다.';
      return;
    }
    if (kind === 'food') {
      if (s.foodKind === '카페') s.cafeId = id;
      else s.foodId = id;
    } else {
      s.stayId = id;
      if (s.days < 2) {
        s.days = 2;
        s.notice = '숙박을 넣을 수 있도록 1박 2일로 맞췄어요.';
      }
    }
    const target = s.plan.find((v) => v.id === s.editingId);
    if (
      target &&
      !target.locked &&
      (kind === 'stay'
        ? target.kind === 'stay'
        : ['food', 'cafe'].includes(target.kind))
    ) {
      target.entityId = id;
      delete target.status;
      s.stage = 'plan';
      s.editingId = null;
      s.notice = `DAY ${target.day} ${target.label}만 바꿨어요. 다른 방문과 예약 숙소는 유지했어요.`;
    }
  };
  const setRegion = (region: Region) => {
    if (s.region !== region) {
      s.anchorId = null;
      s.foodId = null;
      s.cafeId = null;
      s.stayId = null;
      s.similarTo = null;
      s.theme = 'all';
      s.plan = [];
      s.savedPlanId = null;
      s.editingId = null;
    }
    s.region = region;
  };
  const edit = (id: string) => {
    const v = s.plan.find((v) => v.id === id);
    if (!v) return;
    if (v.locked) {
      s.notice = '예약한 숙소라 자동 교체하지 않아요.';
      return;
    }
    s.editingId = v.id;
    s.activeDay = v.day;
    s.anchorId = v.anchorId;
    s.walk = 20;
    s.foodBudget = null;
    if (v.kind === 'stay') showStay();
    else if (v.kind === 'food' || v.kind === 'cafe')
      showFood(v.kind === 'cafe' ? '카페' : '식당');
    else {
      s.stage = 'discover';
      s.theme = 'all';
      s.similarTo = null;
    }
    s.notice = `DAY ${v.day} · ${v.label}에 넣을 후보예요. 선택하면 이 자리만 바뀝니다.`;
  };
  if (action.type === 'place') {
    choosePlace(action.id);
    s.question = `${findPlace(action.id)?.name ?? '장소'}로 갈래`;
  }
  if (action.type === 'bookmark') {
    const p = findPlace(action.id);
    if (!p) return before;
    const saved = s.savedIds.includes(action.id);
    s.savedIds = saved
      ? s.savedIds.filter((id) => id !== action.id)
      : [...s.savedIds, action.id];
    s.question = `${p.name} ${saved ? '찜 해제' : '찜할래'}`;
    s.notice = `${p.name}${saved ? '을 찜에서 뺐어요.' : '을 찜했어요. 찜한 장소로 일정도 만들 수 있어요.'}`;
  }
  if (action.type === 'region') {
    setRegion(action.region);
    s.stage = before.stage === 'saved' ? 'saved' : 'discover';
    s.question = `${action.region}에서 찾아줘`;
  }
  if (action.type === 'food') {
    chooseBusiness('food', action.id);
    s.question = `${findFood(action.id)?.name ?? '식당'}으로 할래`;
  }
  if (action.type === 'stay') {
    chooseBusiness('stay', action.id);
    s.question = `${findStay(action.id)?.name ?? '숙소'}를 일정에 넣을래`;
  }
  if (action.type === 'walk') {
    s.walk = Math.max(1, Math.min(20, action.value));
    s.foodId = null;
    s.question = `도보 ${s.walk}분 안에서 찾아줘`;
  }
  if (action.type === 'cuisine') {
    s.cuisine = action.value;
    s.foodId = null;
    s.question = `${action.value === '전체' ? '모든 음식 종류' : action.value + '만'} 보여줘`;
  }
  if (action.type === 'stay-budget') {
    s.stayBudget = action.value;
    s.stayId = null;
    s.question = `숙소는 1박 ${action.value / 10000}만원 이하로`;
  }
  if (action.type === 'show') {
    s.editingId = null;
    if (action.day && action.day >= 1 && action.day <= s.days)
      s.activeDay = action.day;
    if (action.stage === 'food') showFood(action.kind);
    else if (action.stage === 'stay') showStay();
    else s.stage = action.stage;
    if (action.stage === 'discover') {
      s.theme = 'all';
      s.similarTo = null;
    }
    s.question =
      action.stage === 'food'
        ? `여기 주변 ${action.kind ?? '식당'} 찾아줘`
        : action.stage === 'stay'
          ? '근처 숙소도 찾아줘'
          : action.stage === 'saved'
            ? '찜한 장소 보여줘'
            : action.stage === 'route'
              ? '방문 순서 보여줘'
              : action.stage === 'plan'
                ? '일정 다시 보여줘'
                : '다른 장소도 찾아줘';
  }
  if (action.type === 'build') {
    s = makePlan(s, action.savedOnly);
    s.question = action.savedOnly
      ? '찜한 장소로 일정 짜줘'
      : '선택한 곳으로 일정 짜줘';
  }
  if (action.type === 'day') {
    if (action.day < 1 || action.day > s.days) return before;
    s.activeDay = action.day;
    s.anchorId =
      s.plan.find((v) => v.day === action.day && v.kind === 'place')
        ?.entityId ?? s.anchorId;
    s.question = `DAY ${action.day} ${s.stage === 'route' ? '방문 순서' : '일정'} 보여줘`;
  }
  if (action.type === 'add-selected') {
    const kind = s.foodKind === '카페' ? 'cafe' : 'food';
    const id = kind === 'cafe' ? s.cafeId : s.foodId;
    if (!id || !s.plan.length || !s.anchorId) return before;
    if (s.plan.some((v) => v.day === s.activeDay && v.entityId === id)) {
      s.notice = '이 날에 이미 담긴 곳이에요.';
      s.stage = 'plan';
      s.question = '선택한 곳을 일정에 담아줘';
    } else {
      const serial =
        Math.max(
          0,
          ...s.plan.map((v) => Number(v.id.replace('visit-', '')) || 0),
        ) + 1;
      const visit: Visit = {
        id: `visit-${serial}`,
        day: s.activeDay,
        kind,
        entityId: id,
        anchorId: s.anchorId,
        label: kind === 'cafe' ? '카페에서 쉬기' : '추가 식사',
        locked: false,
      };
      const sameDay = s.plan.filter(
        (v) => v.day === s.activeDay && v.kind !== 'stay',
      );
      const anchorIndex = s.plan.findIndex((v) => v.id === sameDay.at(-1)?.id);
      const nextDayIndex = s.plan.findIndex((v) => v.day >= s.activeDay);
      s.plan.splice(
        anchorIndex < 0
          ? nextDayIndex < 0
            ? s.plan.length
            : nextDayIndex
          : anchorIndex + 1,
        0,
        visit,
      );
      s.stage = 'plan';
      s.question = `${findFood(id)?.name}을 DAY ${s.activeDay}에 담아줘`;
      s.notice = '선택한 DAY에 추가했어요. 다른 날짜와 예약 숙소는 그대로예요.';
    }
  }
  if (action.type === 'edit') {
    edit(action.id);
    s.question = `DAY ${s.activeDay} ${before.plan.find((v) => v.id === action.id)?.label ?? '방문'} 바꿔줘`;
  }
  if (action.type === 'remove') {
    const v = s.plan.find((v) => v.id === action.id);
    if (!v) return before;
    if (v.locked) {
      s.notice = '예약 숙소는 지우지 않았어요.';
      return s;
    }
    s.plan = s.plan.filter((v) => v.id !== action.id);
    s.stage = 'plan';
    s.question = `${visitName(v)}을 일정에서 빼줘`;
  }
  if (action.type === 'move') {
    const dayVisits = s.plan.filter(
      (v) => v.day === s.plan.find((x) => x.id === action.id)?.day,
    );
    const i = dayVisits.findIndex((v) => v.id === action.id),
      a = dayVisits[i],
      b = dayVisits[i + action.direction];
    if (!a || !b || a.kind === 'stay' || b.kind === 'stay') return before;
    const from = s.plan.findIndex((v) => v.id === a.id),
      to = s.plan.findIndex((v) => v.id === b.id);
    [s.plan[from], s.plan[to]] = [s.plan[to], s.plan[from]];
    s.plan = s.plan.map((v) =>
      v.kind === 'place' ? { ...v, label: '방문' } : v,
    );
    s.stage = 'plan';
    s.question = `${visitName(a)} 방문 순서를 ${action.direction < 0 ? '앞으로' : '뒤로'}`;
  }
  if (action.type === 'directions') {
    const visit = action.id
      ? s.plan.find((v) => v.id === action.id)
      : undefined;
    if (action.id && !visit) return before;
    if (action.placeId && !findPlace(action.placeId)) return before;
    if (
      action.businessId &&
      !findFood(action.businessId) &&
      !findStay(action.businessId)
    )
      return before;
    s.stage = 'directions';
    s.directionsVisitId = visit?.id ?? null;
    s.directionsPlaceId = action.placeId ?? s.anchorId;
    s.directionsBusinessId =
      action.businessId ??
      (!visit && !action.placeId
        ? before.stage === 'food'
          ? before.foodKind === '카페'
            ? before.cafeId
            : before.foodId
          : before.stage === 'stay'
            ? before.stayId
            : null
        : null);
    s.question = `${visit ? visitName(visit) : (findPlace(s.directionsPlaceId)?.name ?? '여기')} 길찾기 해줘`;
  }
  if (action.type === 'progress') {
    const visit = s.plan.find((v) => v.id === action.id);
    if (!visit) return before;
    if (action.status === 'pending') delete visit.status;
    else visit.status = action.status;
    s.activeDay = visit.day;
    const next = nextPendingVisit(s);
    if (next) {
      s.activeDay = next.day;
      s.anchorId = next.anchorId;
    }
    s.stage = 'progress';
    s.editingId = null;
    s.question = `${visitName(visit)} ${action.status === 'done' ? '다녀왔어' : action.status === 'skipped' ? '이번에는 건너뛸래' : '아직 안 갔어'}`;
    s.notice = `${visitName(visit)} · ${action.status === 'done' ? '방문 완료' : action.status === 'skipped' ? '건너뜀' : '미방문'} 상태로 표시했어요. 일정의 장소와 예약은 유지돼요.`;
  }
  if (action.type === 'message') {
    const q = action.text.trim().slice(0, 500);
    if (!q) return before;
    s.question = q;
    // Resolve functional requests before generic place/business selection, so map and
    // progress questions cannot silently replace chosen businesses or rebuild a plan.
    const mentions = (id: string, name: string) =>
      q.replace(/\s/g, '').includes(name.replace(/\s/g, '')) ||
      (id === 'osulloc' && /오설록/.test(q)) ||
      (id === 'hyeopjae' && /협재/.test(q));
    const namedVisit = before.plan.filter(
      (v) => v.entityId && mentions(v.entityId, visitName(v)),
    );
    if (
      namedVisit.length > 1 &&
      /(길.?찾|다녀왔|방문했|건너뛰|건너뛸|안 갔)/.test(q)
    )
      return {
        ...s,
        stage: 'progress',
        notice:
          '같은 장소가 여러 DAY에 있어요. 아래 날짜별 방문에서 해당 항목을 골라주세요.',
      };
    if (/길\s?찾|가는 길|어떻게 가|찾아가는/.test(q)) {
      const namedPlace = places.find(
        (p) =>
          q.includes(p.name) ||
          (p.id === 'osulloc' && /오설록/.test(q)) ||
          (p.id === 'hyeopjae' && /협재/.test(q)),
      );
      const visit =
        namedVisit[0] ??
        (/다음/.test(q) || before.stage === 'progress'
          ? nextPendingVisit(before)
          : undefined);
      const business = [...restaurants, ...stays].find((p) =>
        q.replace(/\s/g, '').includes(p.name.replace(/\s/g, '')),
      );
      return {
        ...reduceTrip(before, {
          type: 'directions',
          id: visit?.id,
          placeId: namedPlace?.id,
          businessId: business?.id,
        }),
        question: q,
      };
    }
    if (
      /(실제|진짜).*(식당|맛집|카페|숙소)|지도에서.*(식당|맛집|카페|숙소)/.test(
        q,
      )
    )
      return {
        ...s,
        stage: 'external',
        foodKind: /카페/.test(q) ? '카페' : '식당',
        notice: !s.anchorId
          ? '주변 검색의 기준이 될 장소를 먼저 골라주세요.'
          : '',
      };
    if (/다녀왔|방문했|갔다 왔|건너뛰|건너뛸|아직\s?안\s?갔/.test(q)) {
      const namedEntity = [...places, ...restaurants, ...stays].find((p) =>
        mentions(p.id, p.name),
      );
      if (namedEntity && !namedVisit.length)
        return {
          ...s,
          stage: 'progress',
          notice:
            '그 장소는 현재 일정에 없어요. 현재 일정의 방문 기록만 바꿀 수 있어요.',
        };
      const visit = namedVisit[0] ?? nextPendingVisit(before);
      if (!visit)
        return {
          ...s,
          stage: 'progress',
          notice:
            '표시할 미방문 항목이 없어요. 아래 방문 기록에서 다시 미방문으로 되돌릴 수 있어요.',
        };
      return {
        ...reduceTrip(before, {
          type: 'progress',
          id: visit.id,
          status: /아직\s?안\s?갔|안\s?다녀왔|방문\s?안/.test(q)
            ? 'pending'
            : /건너뛰|건너뛸/.test(q)
              ? 'skipped'
              : 'done',
        }),
        question: q,
      };
    }
    if (/다음.*(어디|방문|일정)|여행.*(진행|이어)|이어서 방문/.test(q)) {
      const next = nextPendingVisit(s);
      if (next) {
        s.activeDay = next.day;
        s.anchorId = next.anchorId;
      }
      return { ...s, stage: 'progress' };
    }
    if (s.plan.length && /(카페|식당|선택한 곳).{0,18}(담아|추가)/.test(q))
      return { ...reduceTrip(before, { type: 'add-selected' }), question: q };
    let recognized = false;
    if (/부산|강릉|대전|해외|일본|부산/.test(q))
      return {
        ...s,
        notice:
          '이번 체험에는 제주·서울 샘플만 있어요. 아래에서 지역을 골라주세요.',
        stage: 'discover',
      };
    if (/제주/.test(q)) {
      setRegion('제주');
      recognized = true;
    } else if (/서울|성수/.test(q)) {
      setRegion('서울');
      recognized = true;
    }
    const duration = q.match(/(\d)\s*박\s*(\d)\s*일|(\d)\s*일/);
    if (duration) {
      const days = Number(duration[2] ?? duration[3]);
      if (days < 1 || days > 3)
        return { ...s, notice: '이번 체험은 당일·1박 2일·2박 3일을 지원해요.' };
      s.days = days;
      recognized = true;
    }
    if (/반나절|당일/.test(q)) {
      s.days = 1;
      recognized = true;
    }
    if (
      /숙소.{0,10}(이미.{0,5}예약|예약했|예약해.?뒀|예약 완료|예약돼)|예약한 숙소/.test(
        q,
      ) &&
      !/아직|미예약|예약.{0,6}(안|않|못)/.test(q)
    ) {
      s.booked = true;
      s.stayId = null;
      if (s.days === 1 && !duration && !/당일|반나절/.test(q)) s.days = 2;
      s.plan = s.plan.map((v) =>
        v.kind === 'stay' ? { ...v, locked: true, entityId: null } : v,
      );
      s.stage = s.plan.length ? 'plan' : s.anchorId ? 'place' : 'discover';
      s.notice = '예약한 숙소는 그대로 사용할게요. 새 숙소는 추천하지 않아요.';
      recognized = true;
    }
    if (/(숙소|숙박).{0,5}(빼|제외|말고|필요 없)/.test(q)) {
      s.lodging = false;
      recognized = true;
    } else if (/(숙소|숙박).{0,6}(포함|넣|까지)/.test(q)) s.lodging = true;
    if (/(식당|맛집|식사).{0,6}(빼|제외|말고)|관광지만/.test(q)) {
      s.meals = false;
      recognized = true;
    } else if (/맛집|식당|점심|저녁|식사/.test(q)) {
      s.meals = true;
      recognized = true;
    }
    if (/카페.{0,5}(빼|제외|말고)/.test(q)) {
      s.cafes = false;
      recognized = true;
    } else if (/카페|커피/.test(q)) {
      s.cafes = true;
      recognized = true;
    }
    if (/바다|해변/.test(q)) {
      s.theme = 'sea';
      recognized = true;
    }
    if (/초록|숲|차분|산책/.test(q)) {
      s.theme = 'green';
      recognized = true;
    }
    const named = places.find(
      (p) =>
        q.includes(p.name) ||
        (p.id === 'osulloc' && /오설록/.test(q)) ||
        (p.id === 'hyeopjae' && /협재/.test(q)),
    );
    if (named) {
      if (/비슷|처럼|닮/.test(q)) {
        s.similarTo = named.id;
        s.stage = 'discover';
        s.anchorId = null;
      } else choosePlace(named.id);
      recognized = true;
    }
    const namedFood = restaurants.find((r) => q.includes(r.name));
    const namedStay = stays.find((r) => q.includes(r.name));
    if (namedFood) {
      chooseBusiness('food', namedFood.id);
      recognized = true;
    }
    if (namedStay) {
      chooseBusiness('stay', namedStay.id);
      recognized = true;
    }
    const ordinal = q.match(/첫\s*번째|두\s*번째|세\s*번째|[1-3]\s*번(?:째)?/);
    if (ordinal) {
      const i = /첫|1/.test(ordinal[0]) ? 0 : /두|2/.test(ordinal[0]) ? 1 : 2;
      const isPlace =
        /장소/.test(q) || ['discover', 'place', 'saved'].includes(before.stage);
      const pool = isPlace
        ? before.stage === 'saved'
          ? places.filter(
              (p) =>
                before.savedIds.includes(p.id) &&
                (!before.region || p.region === before.region),
            )
          : before.stage === 'place'
            ? places.filter((p) => p.id === before.anchorId)
            : placeResults(before)
        : before.stage === 'stay'
          ? stayResults(before)
          : foodResults(before);
      if (!pool[i])
        return {
          ...s,
          notice: '그 순서의 후보가 없어요. 화면에 보이는 후보를 골라주세요.',
        };
      if (isPlace) choosePlace(pool[i].id);
      else
        chooseBusiness(before.stage === 'stay' ? 'stay' : 'food', pool[i].id);
      recognized = true;
    }
    const walk = q.match(/(?:도보|걸어서)\s*(\d+)\s*분/);
    if (walk) {
      s.walk = Math.max(1, Math.min(20, Number(walk[1])));
      s.foodId = null;
      recognized = true;
    }
    if (/한식/.test(q)) {
      s.cuisine = '한식';
      s.foodId = null;
      recognized = true;
    }
    if (/양식|파스타/.test(q)) {
      s.cuisine = '양식';
      s.foodId = null;
      recognized = true;
    }
    if (/종류.{0,5}(전체|상관)|전체 음식/.test(q)) {
      s.cuisine = '전체';
      recognized = true;
    }
    const amount = q
      .replaceAll(',', '')
      .match(/(\d+(?:\.\d+)?)\s*(만원|만 원|천원|천 원|원)/);
    if (amount) {
      const value =
        Number(amount[1]) *
        (amount[2].includes('만')
          ? 10000
          : amount[2].includes('천')
            ? 1000
            : 1);
      if (value <= 0 || value > 1000000)
        return {
          ...s,
          notice: '체험 금액은 0원 초과 100만원 이하로 입력해 주세요.',
        };
      if (/숙소|숙박/.test(q) || before.stage === 'stay') {
        s.stayBudget = value;
        s.stayId = null;
      } else {
        s.foodBudget = value;
        s.foodId = null;
      }
      recognized = true;
    }
    const build =
      /(일정|여행).{0,12}(짜|만들|추천|구성)|일정으로/.test(q) ||
      Boolean(duration && /가고|여행|코스|일정/.test(q));
    if (build) {
      s = makePlan(s, /찜|저장한 장소/.test(q));
      s.question = q;
      return s;
    }
    if (/(점심|저녁|숙소|카페).{0,6}(바꿔|교체)/.test(q) && s.plan.length) {
      const dayMatch = q.match(/DAY\s*([1-3])|([1-3])\s*일차/i);
      const requestedDay = Number(
        dayMatch?.[1] ?? dayMatch?.[2] ?? s.activeDay,
      );
      const target = s.plan.find(
        (v) =>
          v.day === requestedDay &&
          (/숙소/.test(q)
            ? v.kind === 'stay'
            : /카페/.test(q)
              ? v.kind === 'cafe'
              : v.label === (/저녁/.test(q) ? '저녁' : '점심')),
      );
      if (target) edit(target.id);
      else
        s.notice =
          '해당 일정이 없어요. 일정 카드에서 바꿀 항목을 선택해 주세요.';
      return s;
    }
    if (/찜|저장한 장소/.test(q)) {
      if (s.anchorId && /찜(해|할|하기)|저장해/.test(q)) {
        if (!s.savedIds.includes(s.anchorId)) s.savedIds.push(s.anchorId);
        s.notice = '찜한 장소에 담았어요.';
      } else s.stage = 'saved';
      recognized = true;
    }
    const findStayRequest =
      /숙소|숙박|호텔/.test(q) && !s.booked && !/(빼|제외|말고)/.test(q);
    const findFoodRequest =
      /맛집|식당|먹을|카페|커피|한식|양식|파스타/.test(q) &&
      !/(빼|제외|말고|바꿔)/.test(q);
    if (findStayRequest) {
      showStay();
      recognized = true;
    } else if (
      findFoodRequest &&
      !namedFood &&
      !(ordinal && before.stage === 'food' && !/장소|근처|주변/.test(q))
    ) {
      const cuisine = s.cuisine;
      showFood(/카페|커피/.test(q) ? '카페' : '식당');
      if (/한식|양식|파스타/.test(q)) s.cuisine = cuisine;
      recognized = true;
    }
    if (/일정( 다시|을|도)? 보여|방문 순서|동선|지도/.test(q)) {
      s.stage = /동선|순서|지도/.test(q) ? 'route' : 'plan';
      recognized = true;
    }
    if (
      /다른 장소|장소 찾아|곳 찾아|볼 만한|지역 전체/.test(q) &&
      !findFoodRequest &&
      !findStayRequest
    ) {
      s.stage = 'discover';
      if (/다른 장소|지역 전체/.test(q)) {
        s.theme = 'all';
        s.similarTo = null;
      }
      recognized = true;
    }
    if (!recognized)
      s.notice =
        '이번에는 아래 다음 질문이나 장소·식당·숙소 카드를 이용해 주세요. 자유로운 문장 전체를 이해하는 AI는 아직 연결하지 않았어요.';
  }
  if (s.stage === 'food') {
    const key = s.foodKind === '카페' ? 'cafeId' : 'foodId';
    if (s[key] && !foodResults(s).some((r) => r.id === s[key])) s[key] = null;
  }
  return s;
}

export function appendTrip(
  session: TripSession,
  action: TripAction,
): TripSession {
  let state: TripState;
  let library = session.library;
  let restoredFrom: number | undefined;
  if (action.type === 'resume') {
    const turn = session.turns.find((t) => t.id === action.id);
    if (!turn) return session;
    state = copy(turn.state);
    state.savedIds = [...currentTrip(session).savedIds];
    state.question = `${turn.id}번째 결과에서 이어갈래`;
    state.notice =
      '이때의 장소·조건·일정을 가져왔어요. 뒤의 대화도 그대로 남아 있어요.';
    restoredFrom = turn.id;
  } else if (action.type === 'save') {
    state = copy(currentTrip(session));
    if (!state.plan.length || !state.region) return session;
    const id = state.savedPlanId ?? `trip-${Date.now()}-${session.nextId}`;
    const saved: SavedPlan = {
      id,
      title: `${state.region} ${period(state.days)} 여행`,
      region: state.region,
      days: state.days,
      booked: state.booked,
      visits: state.plan.map((v) => ({ ...v })),
    };
    library = [...library.filter((p) => p.id !== id), saved];
    state.savedPlanId = id;
    state.stage = 'plan';
    state.question = '이 일정을 내 여행에 저장해줘';
    state.notice =
      '이 기기의 내 여행에 저장했어요. 실제 Spotlog 계정에는 전송하지 않았어요.';
  } else if (action.type === 'open') {
    const saved = library.find((p) => p.id === action.id);
    if (!saved) return session;
    state = {
      ...initialTrip(currentTrip(session).savedIds),
      stage: 'plan',
      region: saved.region,
      days: saved.days,
      plan: saved.visits.map((v) => ({ ...v })),
      booked: saved.booked,
      savedPlanId: saved.id,
      question: `${saved.title} 다시 열어줘`,
      anchorId: saved.visits.find((v) => v.kind === 'place')?.entityId ?? null,
    };
  } else state = reduceTrip(currentTrip(session), action);
  if (state === currentTrip(session)) return session;
  return {
    turns: [...session.turns, { id: session.nextId, state, restoredFrom }],
    nextId: session.nextId + 1,
    library,
  };
}
export function explanation(s: TripState) {
  const place = findPlace(s.anchorId);
  if (s.stage === 'discover')
    return s.similarTo
      ? `${findPlace(s.similarTo)?.name}의 분위기에서 출발해 ${s.region ?? '다른 지역'}의 후보를 찾았어요. 마음에 드는 곳을 고르면 그 주변으로 이어갈게요.`
      : `${s.region ?? '제주·서울'}에서 ${s.theme === 'sea' ? '바다 풍경을 즐길' : s.theme === 'green' ? '초록 풍경을 만날' : '여행을 시작할'} 장소예요. 먼저 가고 싶은 곳을 골라보세요.`;
  if (s.stage === 'place')
    return `${place?.name ?? '선택한 장소'}에서 시작할게요. 주변 식당이나 숙소를 찾아도 이 장소를 기준으로 이어집니다.`;
  if (s.stage === 'food')
    return (s.foodKind === '카페' ? s.cafeId : s.foodId)
      ? `${findFood(s.foodKind === '카페' ? s.cafeId : s.foodId)?.name}을 골랐어요. ${place?.name}과 연결해 두었으니 카페·숙소를 더 찾거나 일정으로 만들 수 있어요.`
      : `${place?.name ?? '선택 장소'} 주변 ${s.foodKind} ${foodResults(s).length}곳이에요. 도보 범위와 음식 조건을 바꾸면 같은 후보 목록이 바뀝니다.`;
  if (s.stage === 'stay')
    return s.stayId
      ? `${findStay(s.stayId)?.name}을 ${period(s.days)} 여행의 숙소 후보로 골랐어요. 예약을 진행한 것은 아니에요.`
      : `${place?.name ?? s.region}을 중심으로 숙소 ${stayResults(s).length}곳을 비교할 수 있어요. 표시 금액은 1객실·1박 체험 가격입니다.`;
  if (s.stage === 'saved')
    return '찜한 장소를 여행의 출발점으로 쓸 수 있어요. 한 지역을 고르면 해당 지역의 장소만 DAY별로 배치합니다.';
  if (s.stage === 'route')
    return '선택한 DAY의 방문 순서예요. 일정의 순서와 같은 장소를 보여주며, 실제 지도나 이동시간 조회는 아닙니다.';
  if (s.stage === 'directions') {
    const target = directionsTarget(s);
    return target.unavailable
      ? '이 방문의 실제 위치가 없어 길찾기를 열 수 없어요. 기준 장소의 지도는 따로 확인할 수 있어요.'
      : !target.place
        ? '길찾기 목적지가 될 장소를 먼저 골라주세요.'
        : '길찾기는 지도에서 실제로 확인할 수 있어요. 장소명으로 목적지를 전달하고, 출발지·교통수단은 지도에서 정합니다.';
  }
  if (s.stage === 'external')
    return `${place?.name ?? '선택할 장소'} 주변의 실제 업체는 지도 검색으로 확인할 수 있어요. 지도에서 확인한 결과를 체험 일정에 자동으로 담지는 않아요.`;
  if (s.stage === 'progress') {
    const next = nextPendingVisit(s);
    return !s.plan.length
      ? '먼저 일정을 만들면 다녀온 곳과 다음 방문을 이어서 확인할 수 있어요.'
      : next
        ? `다음은 DAY ${next.day} · ${visitName(next)}이에요. 다녀온 곳을 표시하고 남은 일정으로 이어가세요.`
        : '모든 방문을 확인했어요. 방문 기록은 아래에서 다시 미방문으로 되돌릴 수 있어요.';
  }
  return s.plan.length
    ? `${s.region} ${period(s.days)}, ${s.plan.length}개의 방문·식사·숙박으로 연결했어요.${s.booked ? ' 예약한 숙소는 그대로 두었어요.' : ''} DAY를 바꾸거나 필요한 항목만 수정해 보세요.`
    : '아직 만든 일정이 없어요. 장소를 고르거나 지역·기간을 말해주면 초안을 만들게요.';
}
export function nextQuestions(s: TripState): string[] {
  switch (s.stage) {
    case 'discover':
      return ['제주에서 바다 볼 만한 곳 찾아줘', '서울숲에서 반나절 일정 짜줘'];
    case 'place':
      return [
        '여기 근처 식당 찾아줘',
        '근처 숙소도 찾아줘',
        '여기 길찾기 해줘',
        `${s.region} 1박 2일 일정 짜줘`,
      ];
    case 'food':
      return (s.foodKind === '카페' ? s.cafeId : s.foodId)
        ? s.plan.length
          ? [
              `이 ${s.foodKind}를 DAY ${s.activeDay}에 추가해줘`,
              '일정 다시 보여줘',
              '방문 순서 보여줘',
            ]
          : [
              '근처 숙소도 찾아줘',
              '여기 근처 카페 찾아줘',
              '선택한 곳으로 일정 짜줘',
            ]
        : s.foodKind === '카페'
          ? ['도보 10분 안에서', '도보 20분 안에서', '일정 다시 보여줘']
          : ['도보 5분 안에서', '한식만 보여줘', '근처 숙소도 찾아줘'];
    case 'stay':
      return s.stayId
        ? ['선택한 곳으로 일정 짜줘', '주변 카페 찾아줘']
        : ['숙소 10만원 이하로', '숙소 20만원 이하로', '숙소는 이미 예약했어'];
    case 'saved':
      return [
        '찜한 제주 장소로 1박 2일 일정 짜줘',
        '찜한 서울 장소로 당일 일정 짜줘',
      ];
    case 'route':
      return ['일정 다시 보여줘', '점심 바꿔줘'];
    case 'directions':
      return ['실제 식당 찾아줘', '다음 어디 가?', '일정 다시 보여줘'];
    case 'external':
      return [
        '여기 근처 식당 찾아줘',
        '여기 근처 카페 찾아줘',
        '일정 다시 보여줘',
      ];
    case 'progress':
      return nextPendingVisit(s)
        ? [
            '다음 장소 길찾기 해줘',
            '다녀왔어',
            '이번엔 건너뛸래',
            '일정 다시 보여줘',
          ]
        : ['일정 다시 보여줘', '다른 장소 찾아줘'];
    default:
      return [
        '다음 어디 가?',
        '점심 바꿔줘',
        '방문 순서 보여줘',
        '근처 카페 찾아줘',
      ];
  }
}
