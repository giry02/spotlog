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
  | 'external'
  | 'compare'
  | 'budget'
  | 'check'
  | 'detail'
  | 'library'
  | 'history'
  | 'help'
  | 'answer';
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
  comparisonIds?: string[];
  detailId?: string | null;
  budgetPeople?: number;
  budgetRooms?: number;
  undoOfTurnId?: number;
  librarySnapshot?: SavedPlan[];
  historySnapshot?: { id: number; question: string }[];
};
export type TripTurn = {
  id: number;
  state: TripState;
  restoredFrom?: number;
  assistantMessage?: string;
  source?: 'demo' | 'flowise';
};
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
  | { type: 'bookmark'; id: string; saved?: boolean }
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
  | { type: 'resume'; id: number }
  | { type: 'compare'; ids?: string[] }
  | { type: 'budget'; people?: number; rooms?: number }
  | { type: 'check' | 'library' | 'history' | 'help' | 'undo' | 'reset' }
  | { type: 'detail'; id?: string }
  | { type: 'transfer'; id: string; day: number }
  | { type: 'add-entity'; id: string; day?: number }
  | { type: 'select-entity'; id: string }
  | {
      type: 'configure';
      days?: number;
      theme?: TripState['theme'];
      foodBudget?: number | null;
      booked?: boolean;
      meals?: boolean;
      cafes?: boolean;
      lodging?: boolean;
    };

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
          'compare',
          'budget',
          'check',
          'detail',
          'library',
          'history',
          'help',
          'answer',
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
        (s.comparisonIds === undefined ||
          (Array.isArray(s.comparisonIds) &&
            s.comparisonIds.length <= 3 &&
            s.comparisonIds.every((id) => Boolean(chatEntity(id))))) &&
        (s.detailId === undefined ||
          s.detailId === null ||
          Boolean(chatEntity(s.detailId))) &&
        (s.budgetPeople === undefined ||
          (Number.isInteger(s.budgetPeople) &&
            s.budgetPeople >= 1 &&
            s.budgetPeople <= 20)) &&
        (s.budgetRooms === undefined ||
          (Number.isInteger(s.budgetRooms) &&
            s.budgetRooms >= 1 &&
            s.budgetRooms <= 10)) &&
        (t.assistantMessage === undefined ||
          typeof t.assistantMessage === 'string') &&
        (t.source === undefined || ['demo', 'flowise'].includes(t.source)) &&
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
  comparisonIds: s.comparisonIds ? [...s.comparisonIds] : undefined,
  librarySnapshot: s.librarySnapshot?.map((p) => ({
    ...p,
    visits: p.visits.map((v) => ({ ...v })),
  })),
  historySnapshot: s.historySnapshot?.map((t) => ({ ...t })),
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

function chatEntity(id: string | null | undefined) {
  if (!id) return undefined;
  const p = findPlace(id),
    f = findFood(id),
    h = findStay(id);
  return p
    ? { id, name: p.name, kind: 'place' as const }
    : f
      ? {
          id,
          name: f.name,
          kind: f.cuisine === '카페' ? ('cafe' as const) : ('food' as const),
        }
      : h
        ? { id, name: h.name, kind: 'stay' as const }
        : undefined;
}
function mentionsEntity(q: string, id: string, name: string) {
  const compact = q.replace(/\s/g, '');
  return (
    compact.includes(name.replace(/\s/g, '')) ||
    (id === 'osulloc' && /오설록/.test(q)) ||
    (id === 'hyeopjae' && /협재/.test(q)) ||
    (id === 'saebyeol' && /새별/.test(q))
  );
}
function namedEntities(q: string) {
  return [...places, ...restaurants, ...stays]
    .filter((p) => mentionsEntity(q, p.id, p.name))
    .map((p) => chatEntity(p.id)!);
}
function chatCandidates(s: TripState) {
  const ids =
    s.stage === 'compare'
      ? (s.comparisonIds ?? [])
      : s.stage === 'detail' && s.detailId
        ? [s.detailId]
        : s.stage === 'food'
          ? foodResults(s).map((p) => p.id)
          : s.stage === 'stay'
            ? stayResults(s).map((p) => p.id)
            : s.stage === 'saved'
              ? places
                  .filter(
                    (p) =>
                      s.savedIds.includes(p.id) &&
                      (!s.region || p.region === s.region),
                  )
                  .map((p) => p.id)
              : s.stage === 'place' && s.anchorId
                ? [s.anchorId]
                : placeResults(s).map((p) => p.id);
  return ids.flatMap((id) => {
    const entity = chatEntity(id);
    return entity ? [entity] : [];
  });
}
function ordinalNumber(q: string): number | null {
  const match = q.match(
    /첫\s*번째|두\s*번째|세\s*번째|마지막|([1-9]\d*)\s*(?:번(?:째)?|번째)/,
  );
  if (!match) return null;
  if (/마지막/.test(match[0])) return -1;
  return /첫/.test(match[0])
    ? 1
    : /두/.test(match[0])
      ? 2
      : /세/.test(match[0])
        ? 3
        : Number(match[1]);
}
function requestedDay(q: string): number | null {
  const match = q.match(/DAY\s*([1-3])|([1-3])\s*일차|([1-3])\s*번째\s*날/i);
  if (match) return Number(match[1] ?? match[2] ?? match[3]);
  return /첫째\s*날/.test(q)
    ? 1
    : /둘째\s*날/.test(q)
      ? 2
      : /셋째\s*날/.test(q)
        ? 3
        : null;
}
function visitTargets(s: TripState, q: string): Visit[] {
  const day = requestedDay(q);
  let pool = s.plan.filter((v) => (day ? v.day === day : true));
  const named = namedEntities(q);
  if (named.length)
    return pool.filter((v) => named.some((entity) => entity.id === v.entityId));
  if (/점심/.test(q)) pool = pool.filter((v) => v.label === '점심');
  else if (/저녁/.test(q)) pool = pool.filter((v) => v.label === '저녁');
  else if (/숙소|숙박/.test(q)) pool = pool.filter((v) => v.kind === 'stay');
  else if (/카페/.test(q)) pool = pool.filter((v) => v.kind === 'cafe');
  else if (/식당|식사/.test(q)) pool = pool.filter((v) => v.kind === 'food');
  else if (/방문|장소/.test(q)) pool = pool.filter((v) => v.kind === 'place');
  else return [];
  if (!day) pool = pool.filter((v) => v.day === s.activeDay);
  const index = ordinalNumber(q);
  return index
    ? pool.slice(
        index === -1 ? -1 : index - 1,
        index === -1 ? undefined : index,
      )
    : pool;
}

function amountInQuestion(q: string): number | null {
  const compact = q.replace(/[,\s]/g, '');
  const combined = compact.match(/(\d+(?:\.\d+)?)만(?:(\d+)천)?원?/);
  if (combined)
    return Number(combined[1]) * 10000 + Number(combined[2] ?? 0) * 1000;
  const match = compact.match(/(\d+(?:\.\d+)?)(천원|원)/);
  return match ? Number(match[1]) * (match[2] === '천원' ? 1000 : 1) : null;
}

function reduceTrip(before: TripState, action: TripAction): TripState {
  let s = copy(before);
  s.notice = '';
  const choosePlace = (id: string) => {
    const p = findPlace(id);
    if (!p) return;
    if (s.plan.length && p.region !== s.region) {
      s.notice =
        '현재 일정과 같은 지역의 장소를 골라주세요. 다른 지역 여행은 새 일정으로 시작할 수 있어요.';
      return;
    }
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
      if (kind === 'food') {
        target.anchorId = findFood(id)!.placeId;
        target.kind = findFood(id)!.cuisine === '카페' ? 'cafe' : 'food';
      }
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
    const saved = s.savedIds.includes(action.id),
      desired = action.saved ?? !saved;
    s.savedIds = !desired
      ? s.savedIds.filter((id) => id !== action.id)
      : saved
        ? s.savedIds
        : [...s.savedIds, action.id];
    s.question = `${p.name} ${desired ? '찜할래' : '찜 해제'}`;
    s.notice = `${p.name}${desired ? '을 찜했어요. 찜한 장소로 일정도 만들 수 있어요.' : '을 찜에서 뺐어요.'}`;
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
    if (action.day < 1 || action.day > s.days)
      return {
        ...s,
        notice: `현재 여행에는 DAY ${action.day}가 없어요. 여행 기간은 ${s.days}일이에요.`,
        question: `DAY ${action.day} 일정 보여줘`,
      };
    s.activeDay = action.day;
    s.stage = before.stage === 'route' ? 'route' : 'plan';
    s.anchorId =
      s.plan.find((v) => v.day === action.day && v.kind === 'place')
        ?.entityId ?? s.anchorId;
    s.question = `DAY ${action.day} ${s.stage === 'route' ? '방문 순서' : '일정'} 보여줘`;
  }
  if (action.type === 'add-selected') {
    const kind = s.foodKind === '카페' ? 'cafe' : 'food';
    const id = kind === 'cafe' ? s.cafeId : s.foodId;
    if (!id || !s.plan.length || !s.anchorId)
      return {
        ...s,
        question: '선택한 곳을 일정에 담아줘',
        notice: !s.plan.length
          ? '먼저 일정을 만들어 주세요. 선택한 후보는 그대로 유지할게요.'
          : `먼저 추가할 ${s.foodKind} 후보를 골라주세요.`,
      };
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
    if (s.editingId === action.id) s.editingId = null;
    if (s.directionsVisitId === action.id) s.directionsVisitId = null;
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
    if (!a) return before;
    if (!b || a.kind === 'stay' || b.kind === 'stay')
      return {
        ...s,
        question: `${visitName(a)} 순서를 ${action.direction < 0 ? '앞으로' : '뒤로'} 옮겨줘`,
        notice: !b
          ? '이 DAY의 끝이라 더 옮길 수 없어요.'
          : '숙박 자리는 유지하고 방문·식사 순서만 바꿀 수 있어요.',
      };
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
  if (action.type === 'configure') {
    if (action.days !== undefined) {
      if (!Number.isInteger(action.days) || action.days < 1 || action.days > 3)
        return {
          ...s,
          question: '여행 기간 변경',
          notice: '이번 체험은 1~3일 여행을 지원해요.',
        };
      if (s.plan.some((v) => v.day > action.days!))
        return {
          ...s,
          question: '여행 기간 변경',
          notice:
            '줄일 날짜에 일정이 있어요. 방문을 옮기거나 제거한 다음 기간을 줄여주세요.',
        };
      s.days = action.days;
    }
    if (action.theme !== undefined) s.theme = action.theme;
    if (action.foodBudget !== undefined) s.foodBudget = action.foodBudget;
    if (action.meals !== undefined) s.meals = action.meals;
    if (action.cafes !== undefined) s.cafes = action.cafes;
    if (action.lodging !== undefined) s.lodging = action.lodging;
    if (action.booked === true) {
      s.booked = true;
      s.stayId = null;
      s.plan = s.plan.map((v) =>
        v.kind === 'stay' ? { ...v, locked: true, entityId: null } : v,
      );
    } else if (
      action.booked === false &&
      (s.booked || s.plan.some((v) => v.locked))
    )
      s.notice =
        '예약한 숙소는 유지할게요. 이 체험에서 실제 예약을 취소하지 않아요.';
    s.question = '여행 조건 변경';
  }
  if (action.type === 'select-entity') {
    const entity = chatEntity(action.id);
    if (!entity) return before;
    if (entity.kind === 'place') choosePlace(entity.id);
    else {
      const f = findFood(entity.id),
        h = findStay(entity.id);
      const region = h?.region ?? findPlace(f!.placeId)!.region;
      if (s.plan.length && region !== s.region)
        return {
          ...s,
          question: `${entity.name} 선택해줘`,
          notice: '현재 일정과 같은 지역의 후보를 골라주세요.',
        };
      s.region = region as Region;
      if (f) {
        s.anchorId = f.placeId;
        s.foodKind = f.cuisine === '카페' ? '카페' : '식당';
        // Exact candidate selection is still subject to the current filters.
        if (!foodResults(s).some((p) => p.id === f.id))
          return {
            ...copy(before),
            question: `${entity.name} 선택해줘`,
            notice:
              '현재 도보·음식·가격 조건 밖의 후보예요. 조건을 바꾼 다음 선택해 주세요.',
          };
        s.stage = 'food';
        chooseBusiness('food', entity.id);
      } else {
        if (s.booked)
          return {
            ...s,
            question: `${entity.name} 선택해줘`,
            notice: '예약한 숙소는 유지할게요. 새 숙소로 교체하지 않았어요.',
          };
        if (s.anchorId && !h!.near.includes(s.anchorId))
          s.anchorId = h!.near[0];
        s.stage = 'stay';
        chooseBusiness('stay', entity.id);
      }
    }
    s.question = `${entity.name} 선택해줘`;
  }
  if (action.type === 'detail') {
    const selected =
      action.id ??
      (before.stage === 'food'
        ? before.foodKind === '카페'
          ? before.cafeId
          : before.foodId
        : before.stage === 'stay'
          ? before.stayId
          : (before.detailId ?? before.anchorId));
    const entity = chatEntity(selected);
    s.stage = 'detail';
    s.detailId = entity?.id ?? null;
    s.question = `${entity?.name ?? '선택한 곳'} 상세정보 보여줘`;
    if (!entity)
      s.notice =
        '상세정보를 볼 장소·식당·카페·숙소의 이름이나 후보 번호를 말해 주세요.';
  }
  if (action.type === 'compare') {
    const ids = [
      ...new Set(
        action.ids ??
          chatCandidates(before)
            .slice(0, 3)
            .map((p) => p.id),
      ),
    ]
      .filter((id) => chatEntity(id))
      .slice(0, 3);
    s.stage = 'compare';
    s.comparisonIds = ids.length >= 2 ? ids : [];
    s.question = '후보 비교해줘';
    s.notice =
      ids.length < 2
        ? '비교할 후보가 2개 이상 필요해요. 장소·식당·숙소 이름 2~3개를 말하거나 후보가 있는 화면에서 비교해 주세요.'
        : '표시된 후보의 샘플 정보만 비교했어요. 아직 어떤 후보도 선택하지 않았어요.';
  }
  if (action.type === 'budget') {
    s.stage = 'budget';
    s.budgetPeople = Math.max(
      1,
      Math.min(20, Math.trunc(action.people ?? s.budgetPeople ?? 2)),
    );
    s.budgetRooms = Math.max(
      1,
      Math.min(10, Math.trunc(action.rooms ?? s.budgetRooms ?? 1)),
    );
    s.question = `${s.budgetPeople}인 ${s.budgetRooms}객실 여행 예산 계산해줘`;
    s.notice = s.plan.length
      ? '선택한 식사·카페는 1인 메뉴, 숙박은 1객실·1박 예시로 따로 계산했어요.'
      : '먼저 일정을 만들면 선택한 항목의 예시 가격으로 계산할 수 있어요.';
  }
  if (action.type === 'check') {
    s.stage = 'check';
    s.question = '일정 점검해줘';
  }
  if (action.type === 'library') {
    s.stage = 'library';
    s.question = '저장한 여행 보여줘';
  }
  if (action.type === 'history') {
    s.stage = 'history';
    s.question = '대화 기록 보여줘';
  }
  if (action.type === 'help') {
    s.stage = 'help';
    s.question = '할 수 있는 기능 알려줘';
  }
  if (action.type === 'transfer') {
    const visit = s.plan.find((v) => v.id === action.id);
    if (!visit) return before;
    s.question = `${visitName(visit)}을 DAY ${action.day}로 옮겨줘`;
    if (visit.locked || visit.kind === 'stay')
      return {
        ...s,
        notice:
          '숙박 날짜와 예약 숙소는 유지해요. 방문·식사·카페만 다른 DAY로 옮길 수 있어요.',
      };
    if (action.day < 1 || action.day > s.days)
      return { ...s, notice: `현재 여행은 DAY ${s.days}까지 있어요.` };
    if (
      s.plan.some(
        (v) =>
          v.id !== visit.id &&
          v.day === action.day &&
          v.entityId === visit.entityId,
      )
    )
      return { ...s, notice: '그 DAY에는 같은 후보가 이미 있어요.' };
    visit.day = action.day;
    s.plan = s.plan.filter((v) => v.id !== visit.id);
    const next = s.plan.findIndex(
      (v) => v.day > action.day || (v.day === action.day && v.kind === 'stay'),
    );
    s.plan.splice(next < 0 ? s.plan.length : next, 0, visit);
    s.activeDay = action.day;
    s.stage = 'plan';
    s.notice =
      '이 항목만 다른 DAY로 옮겼어요. 나머지 항목과 예약 숙소는 유지했어요.';
  }
  if (action.type === 'add-entity') {
    const entity = chatEntity(action.id),
      day = action.day ?? s.activeDay;
    s.question = `${entity?.name ?? '후보'}을 DAY ${day}에 추가해줘`;
    if (!entity || !s.plan.length)
      return { ...s, notice: '먼저 일정을 만들고 추가할 후보를 골라주세요.' };
    if (day < 1 || day > s.days)
      return { ...s, notice: `현재 여행은 DAY ${s.days}까지 있어요.` };
    const p = findPlace(entity.id),
      f = findFood(entity.id),
      h = findStay(entity.id);
    const region = p?.region ?? h?.region ?? findPlace(f!.placeId)!.region;
    if (region !== s.region)
      return {
        ...s,
        notice: '현재 일정과 같은 지역의 후보만 추가할 수 있어요.',
      };
    if (entity.kind === 'stay')
      return {
        ...s,
        notice:
          '숙소는 기존 숙박 항목에서 교체해 주세요. 예약 숙소는 유지됩니다.',
      };
    if (s.plan.some((v) => v.day === day && v.entityId === entity.id))
      return { ...s, notice: '이 DAY에 이미 담긴 곳이에요.' };
    const serial =
      Math.max(
        0,
        ...s.plan.map((v) => Number(v.id.replace('visit-', '')) || 0),
      ) + 1;
    const visit: Visit = {
      id: `visit-${serial}`,
      day,
      kind: entity.kind,
      entityId: entity.id,
      anchorId: p?.id ?? f!.placeId,
      label:
        entity.kind === 'place'
          ? '추가 방문'
          : entity.kind === 'cafe'
            ? '카페에서 쉬기'
            : '추가 식사',
      locked: false,
    };
    const next = s.plan.findIndex(
      (v) => v.day > day || (v.day === day && v.kind === 'stay'),
    );
    s.plan.splice(next < 0 ? s.plan.length : next, 0, visit);
    s.stage = 'plan';
    s.activeDay = day;
    s.notice = '선택한 후보만 추가했어요. 기존 일정과 예약 숙소는 그대로예요.';
  }
  if (action.type === 'message') {
    const q = action.text.trim().slice(0, 500);
    if (!q) return before;
    s.question = q;
    const finish = (nextAction: TripAction) => ({
      ...reduceTrip(before, nextAction),
      question: q,
    });
    const entities = namedEntities(q),
      ordinal = ordinalNumber(q);
    if (
      /도움말|사용법|할 수 있는 기능|가능한 기능|전체 기능|모든 기능|시나리오|연결된 기능|연결 구조|기능 연결|어떤 기능|뭘 할 수/.test(
        q,
      )
    )
      return finish({ type: 'help' });
    if (/비교/.test(q)) {
      if (entities.length > 3)
        return {
          ...s,
          stage: 'compare',
          comparisonIds: [],
          notice:
            '한 번에 후보 2~3개를 비교할 수 있어요. 비교할 이름을 3개 이하로 말해 주세요.',
        };
      const pool = entities.length
        ? entities
        : /식당|맛집/.test(q)
          ? restaurants
              .filter(
                (p) => p.placeId === before.anchorId && p.cuisine !== '카페',
              )
              .map((p) => chatEntity(p.id)!)
          : /카페/.test(q)
            ? restaurants
                .filter(
                  (p) => p.placeId === before.anchorId && p.cuisine === '카페',
                )
                .map((p) => chatEntity(p.id)!)
            : /숙소|숙박/.test(q)
              ? stayResults(before).map((p) => chatEntity(p.id)!)
              : chatCandidates(before);
      return finish({
        type: 'compare',
        ids: pool
          .slice(0, /(?:이|두)\s*두|두\s*(?:개|곳)|이\s*두/.test(q) ? 2 : 3)
          .map((p) => p.id),
      });
    }
    if (
      /여행\s*(?:총)?\s*(?:예산|비용|경비)|총\s*(?:비용|예산|금액)|예산\s*(?:계산|알려|보여)|비용\s*(?:계산|알려|보여)|합쳐.*얼마|몇\s*원|인.*(?:예산|얼마)|(?:예산|비용).*인|식비|숙박비|카페비|총\s*얼마/.test(
        q,
      ) ||
      (before.plan.length > 0 &&
        /\d+\s*(?:인|명)/.test(q) &&
        amountInQuestion(q) !== null &&
        /맞춰|으로|안에서/.test(q))
    ) {
      const people = q.match(/(\d+)\s*(?:인|명)/),
        rooms = q.match(/(\d+)\s*(?:객실|방)/);
      const result = finish({
        type: 'budget',
        people: people ? Number(people[1]) : undefined,
        rooms: rooms ? Number(rooms[1]) : undefined,
      });
      if (/맞춰|안에서|이하/.test(q) && amountInQuestion(q))
        result.notice +=
          ' 총액 목표에 맞춰 일정을 자동 교체하는 기능은 아직 연결하지 않았어요.';
      return result;
    }
    if (
      /일정.*(?:점검|검토|확인해|괜찮|문제|시간)|(?:시간|동선).*(?:괜찮|점검|검토)/.test(
        q,
      )
    )
      return finish({ type: 'check' });
    if (
      /상세|메뉴|영업\s*시간|운영\s*시간|몇\s*시|객실|주차|시설|주소/.test(q) &&
      !/(?:예산|만원|원 이하)/.test(q)
    ) {
      let id = entities.length === 1 ? entities[0].id : undefined;
      if (!id && ordinal) {
        const pool =
          before.plan.length &&
          /식당|카페|숙소|방문|장소/.test(q) &&
          !['food', 'stay', 'discover', 'compare', 'saved'].includes(
            before.stage,
          )
            ? visitTargets(before, q)
                .map((v) => chatEntity(v.entityId))
                .filter((v) => Boolean(v))
            : chatCandidates(before);
        id = pool[ordinal === -1 ? pool.length - 1 : ordinal - 1]?.id;
        // visitTargets already applies the explicit ordinal.
        if (
          before.plan.length &&
          pool.length === 1 &&
          !['food', 'stay', 'discover', 'compare', 'saved'].includes(
            before.stage,
          )
        )
          id = pool[0]?.id;
      }
      if (entities.length > 1)
        return {
          ...s,
          stage: 'detail',
          detailId: null,
          notice:
            '상세정보를 볼 후보 하나를 골라 주세요. 여러 후보는 비교해 달라고 말할 수 있어요.',
        };
      if (!id)
        id =
          before.stage === 'food'
            ? before.foodKind === '카페'
              ? (before.cafeId ?? undefined)
              : (before.foodId ?? undefined)
            : before.stage === 'stay'
              ? (before.stayId ?? undefined)
              : (before.detailId ??
                (/메뉴/.test(q)
                  ? before.foodKind === '카페'
                    ? (before.cafeId ?? undefined)
                    : (before.foodId ?? undefined)
                  : (before.anchorId ?? undefined)));
      if (!id)
        return {
          ...s,
          stage: 'detail',
          detailId: null,
          notice:
            '상세정보를 볼 장소·식당·카페·숙소 이름이나 후보 번호를 말해 주세요.',
        };
      return finish({ type: 'detail', id });
    }
    if (
      /찜/.test(q) &&
      /해제|취소|제거|빼|해줘|해둘|할래|하기/.test(q) &&
      !/일정.*(?:짜|만들)|보여/.test(q)
    ) {
      const named = entities.filter((p) => p.kind === 'place');
      const pool = chatCandidates(before).filter((p) => p.kind === 'place');
      const id =
        named.length === 1
          ? named[0].id
          : !entities.length
            ? ordinal
              ? pool[ordinal === -1 ? pool.length - 1 : ordinal - 1]?.id
              : (before.anchorId ?? undefined)
            : undefined;
      if (!id)
        return {
          ...s,
          stage: 'saved',
          notice: '찜하거나 해제할 장소 이름 하나를 말해 주세요.',
        };
      return finish({
        type: 'bookmark',
        id,
        saved: !/해제|취소|제거|빼/.test(q),
      });
    }
    const day = requestedDay(q);
    if (
      day &&
      /(?:일정|방문 순서|동선).*(?:보여|볼래|보기)|DAY\s*[1-3]\s*(?:보여|볼래)/i.test(
        q,
      ) &&
      !/옮|바꿔|짜|만들/.test(q)
    )
      return finish({ type: 'day', day });
    if (
      before.plan.length &&
      /(?:바꿔|교체|빼줘|제거|삭제|옮겨|앞으로|뒤로)/.test(q) &&
      !/(?:일정|여행).*(?:짜|만들)/.test(q)
    ) {
      const destination = [
        ...q.matchAll(/(?:DAY\s*([1-3])|([1-3])\s*일차)\s*로/gi),
      ].at(-1);
      const sourceQuestion = destination ? q.replace(destination[0], '') : q;
      const targets = visitTargets(before, sourceQuestion);
      if (targets.length !== 1)
        return {
          ...s,
          stage: 'plan',
          notice: targets.length
            ? '같은 조건의 항목이 여러 개예요. DAY와 장소 이름 또는 방문 번호를 함께 말해 주세요.'
            : '바꿀 항목이 명확하지 않아요. 예: “DAY 1 점심 바꿔줘”, “DAY 1 첫 번째 방문을 뒤로 옮겨줘”.',
        };
      if (destination)
        return finish({
          type: 'transfer',
          id: targets[0].id,
          day: Number(destination[1] ?? destination[2]),
        });
      if (/빼줘|제거|삭제/.test(q))
        return finish({ type: 'remove', id: targets[0].id });
      if (/앞으로|뒤로/.test(q))
        return finish({
          type: 'move',
          id: targets[0].id,
          direction: /앞으로/.test(q) ? -1 : 1,
        });
      return finish({ type: 'edit', id: targets[0].id });
    }
    if (before.plan.length && /추가|담아/.test(q)) {
      let id = entities.length === 1 ? entities[0].id : undefined;
      if (!id && ordinal) {
        const pool = chatCandidates(before);
        id = pool[ordinal === -1 ? pool.length - 1 : ordinal - 1]?.id;
      }
      if (!id)
        id = /카페/.test(q)
          ? (before.cafeId ?? undefined)
          : /숙소/.test(q)
            ? (before.stayId ?? undefined)
            : before.stage === 'food' && before.foodKind === '카페'
              ? (before.cafeId ?? undefined)
              : (before.foodId ?? undefined);
      if (!id)
        return {
          ...s,
          notice:
            '일정에 추가할 후보의 이름이나 번호를 먼저 골라주세요. 일정은 그대로 유지했어요.',
        };
      return finish({ type: 'add-entity', id, day: day ?? before.activeDay });
    }
    if (/선택|골라|고를|할래|갈래/.test(q) && entities.length === 1)
      return finish({ type: 'select-entity', id: entities[0].id });
    if (
      /선택|골라|고를|할래|갈래/.test(q) &&
      ordinal &&
      !/방문|일정|기록|여행/.test(q)
    ) {
      const pool = chatCandidates(before),
        candidate = pool[ordinal === -1 ? pool.length - 1 : ordinal - 1];
      return candidate
        ? finish({ type: 'select-entity', id: candidate.id })
        : {
            ...s,
            notice:
              '그 번호의 후보가 없어요. 보이는 후보 이름이나 번호를 말해 주세요.',
          };
    }
    if (ordinal && /다녀왔|방문했|건너뛰|건너뛸|아직\s?안\s?갔/.test(q)) {
      const targets = visitTargets(before, q);
      if (targets.length === 1)
        return finish({
          type: 'progress',
          id: targets[0].id,
          status: /아직\s?안\s?갔/.test(q)
            ? 'pending'
            : /건너/.test(q)
              ? 'skipped'
              : 'done',
        });
      return {
        ...s,
        stage: 'progress',
        notice: '방문 기록을 바꿀 DAY와 항목 이름을 함께 말해 주세요.',
      };
    }
    // Resolve functional requests before generic place/business selection, so map and
    // progress questions cannot silently replace chosen businesses or rebuild a plan.
    const mentions = (id: string, name: string) =>
      q.replace(/\s/g, '').includes(name.replace(/\s/g, '')) ||
      (id === 'osulloc' && /오설록/.test(q)) ||
      (id === 'hyeopjae' && /협재/.test(q));
    const namedVisit = before.plan.filter(
      (v) =>
        v.entityId &&
        mentions(v.entityId, visitName(v)) &&
        (!day || v.day === day),
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
    const duration = q.match(
      /(\d)\s*박\s*(\d)\s*일(?!정|차)|(\d)\s*일(?!정|차)/,
    );
    if (duration) {
      const days = Number(duration[2] ?? duration[3]);
      if (days < 1 || days > 3)
        return { ...s, notice: '이번 체험은 당일·1박 2일·2박 3일을 지원해요.' };
      if (
        s.plan.some((v) => v.day > days) &&
        !/(일정|여행).{0,12}(짜|만들|추천|구성)|일정으로/.test(q)
      )
        return {
          ...copy(before),
          question: q,
          notice:
            '줄일 날짜에 일정이 있어요. 새 초안을 만들어 달라고 하거나 해당 방문을 옮겨주세요.',
        };
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
    const selectionOrdinal = q.match(
      /첫\s*번째|두\s*번째|세\s*번째|[1-3]\s*번(?:째)?/,
    );
    if (selectionOrdinal && !/일정|방문|메뉴|상세|기록/.test(q)) {
      const i = /첫|1/.test(selectionOrdinal[0])
        ? 0
        : /두|2/.test(selectionOrdinal[0])
          ? 1
          : 2;
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
    const amount = amountInQuestion(q);
    if (amount !== null) {
      const value = amount;
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
      !(
        selectionOrdinal &&
        before.stage === 'food' &&
        !/장소|근처|주변/.test(q)
      )
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
  let originalQuestion: string | undefined;
  let commandNotice: string | undefined;
  if (action.type === 'message') {
    const q = action.text.trim().slice(0, 500);
    const compactControl = q.replace(/[\s.!?。！？]/g, '');
    originalQuestion = q;
    if (
      /^(?:대화|채팅)(?:를)?(?:초기화|리셋)(?:해줘|해주세요|할래)?$|^(?:대화|채팅)(?:를)?지워(?:줘|주세요)$|^(?:처음부터(?:다시)?시작|새대화(?:로)?시작)(?:해줘|해주세요|할래)?$/.test(
        compactControl,
      )
    )
      action = { type: 'reset' };
    else if (
      /^(?:(?:방금|마지막)(?:수정|변경)(?:을)?(?:취소|되돌려)|실행취소|수정취소|이전으로되돌려)(?:해줘|주세요|줘|할래)?$/.test(
        compactControl,
      )
    )
      action = { type: 'undo' };
    else if (
      /(?:대화|질문|결과)\s*(?:기록|내역)|이전\s*대화.*보여/.test(q) &&
      !/이어|돌아|계속/.test(q)
    )
      action = { type: 'history' };
    else if (
      /저장한\s*(?:내\s*)?여행|내\s*여행|저장된\s*일정/.test(q) &&
      /열어|불러|이어|선택/.test(q)
    ) {
      const ordinal = ordinalNumber(q),
        named = session.library.filter((p) => q.includes(p.title));
      const saved = ordinal
        ? session.library[
            ordinal === -1 ? session.library.length - 1 : ordinal - 1
          ]
        : named.length === 1
          ? named[0]
          : session.library.length === 1
            ? session.library[0]
            : undefined;
      if (saved) action = { type: 'open', id: saved.id };
      else {
        action = { type: 'library' };
        commandNotice = session.library.length
          ? '열어볼 저장 여행의 번호를 말해 주세요. 예: “첫 번째 저장한 여행 열어줘”.'
          : '아직 저장한 여행이 없어요. 일정을 만든 뒤 저장해 주세요.';
      }
    } else if (
      /저장한\s*(?:내\s*)?여행|내\s*여행\s*(?:보여|목록)|저장된\s*일정/.test(q)
    )
      action = { type: 'library' };
    else if (
      /(?:결과|대화|기록).*(?:이어|돌아|계속)|(?:이어|돌아).*(?:결과|대화)/.test(
        q,
      ) &&
      ordinalNumber(q)
    ) {
      const turns = session.turns.filter((t) => Boolean(t.state.question)),
        number = ordinalNumber(q)!;
      const turn = turns[number === -1 ? turns.length - 1 : number - 1];
      if (turn) action = { type: 'resume', id: turn.id };
      else {
        action = { type: 'history' };
        commandNotice =
          '그 번호의 대화 결과가 없어요. 기록에 표시된 번호를 말해 주세요.';
      }
    } else if (
      (/(?:일정|여행).*(?:저장해|저장할|저장해줘|보관)/.test(q) ||
        /^저장해(?:줘)?$/.test(q)) &&
      !/찜|장소/.test(q)
    ) {
      if (currentTrip(session).plan.length) action = { type: 'save' };
      else {
        action = { type: 'library' };
        commandNotice = '먼저 일정을 만든 뒤 저장할 수 있어요.';
      }
    }
  }
  if (action.type === 'reset')
    return createTripSession(
      currentTrip(session).savedIds,
      session.library.map((p) => ({
        ...p,
        visits: p.visits.map((v) => ({ ...v })),
      })),
    );
  let state: TripState;
  let library = session.library;
  let restoredFrom: number | undefined;
  if (action.type === 'undo') {
    const before = currentTrip(session);
    const ignored = new Set(
      session.turns
        .map((t) => t.state.undoOfTurnId)
        .filter((id) => id !== undefined),
    );
    let changedIndex = -1;
    for (let i = session.turns.length - 1; i > 0; i--) {
      const now = session.turns[i],
        previous = session.turns[i - 1];
      if (now.state.undoOfTurnId || ignored.has(now.id)) continue;
      if (
        JSON.stringify(now.state.plan) !== JSON.stringify(previous.state.plan)
      ) {
        changedIndex = i;
        break;
      }
    }
    state = copy(before);
    state.question = '방금 수정 취소해줘';
    state.stage = before.plan.length ? 'plan' : 'discover';
    if (changedIndex < 0)
      state.notice =
        '되돌릴 일정 변경이 없어요. 대화와 찜·저장한 여행은 유지했어요.';
    else {
      const prior = session.turns[changedIndex - 1].state;
      const locked = before.plan.filter((v) => v.locked);
      if (
        locked.some(
          (v) =>
            !prior.plan.some(
              (p) =>
                p.id === v.id &&
                p.locked &&
                p.day === v.day &&
                p.entityId === v.entityId &&
                p.anchorId === v.anchorId,
            ),
        )
      )
        state.notice =
          '예약 숙소를 바꾸는 변경은 되돌리지 않아요. 예약 숙소는 유지했어요.';
      else {
        state.plan = prior.plan.map((v) => ({ ...v }));
        state.region = prior.region;
        state.days = prior.days;
        state.activeDay = prior.activeDay;
        state.editingId = null;
        state.undoOfTurnId = session.turns[changedIndex].id;
        state.stage = state.plan.length ? 'plan' : 'discover';
        state.notice =
          '마지막 일정 변경을 되돌렸어요. 찜·저장한 여행과 이후 대화는 유지돼요. 저장본에 반영하려면 다시 저장해 주세요.';
      }
    }
  } else if (action.type === 'resume') {
    const turn = session.turns.find((t) => t.id === action.id);
    if (!turn) return session;
    state = copy(turn.state);
    state.savedIds = [...currentTrip(session).savedIds];
    const displayNumber =
      session.turns
        .filter((t) => Boolean(t.state.question))
        .findIndex((t) => t.id === turn.id) + 1;
    state.question = `${Math.max(1, displayNumber)}번째 결과에서 이어갈래`;
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
  if (originalQuestion) state.question = originalQuestion;
  if (commandNotice) state.notice = commandNotice;
  if (state.stage === 'library')
    state.librarySnapshot = library.map((p) => ({
      ...p,
      visits: p.visits.map((v) => ({ ...v })),
    }));
  if (state.stage === 'history')
    state.historySnapshot = session.turns
      .filter((t) => Boolean(t.state.question))
      .map((t) => ({ id: t.id, question: t.state.question }));
  if (action.type !== 'undo') delete state.undoOfTurnId;
  if (state.editingId && !state.plan.some((v) => v.id === state.editingId))
    state.editingId = null;
  if (
    state.directionsVisitId &&
    !state.plan.some((v) => v.id === state.directionsVisitId)
  )
    state.directionsVisitId = null;
  state.activeDay = Math.max(1, Math.min(state.days, state.activeDay));
  return {
    turns: [...session.turns, { id: session.nextId, state, restoredFrom }],
    nextId: session.nextId + 1,
    library,
  };
}
export function explanation(s: TripState) {
  if (s.stage === 'answer') return '다음 질문으로 여행 대화를 이어가세요.';
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
  if (s.stage === 'compare')
    return '후보를 같은 기준으로 나란히 비교할 수 있어요. 비교는 선택과 분리되어 있고, 원하는 후보를 말하면 그곳에서 이어가요.';
  if (s.stage === 'budget')
    return '일정에 담긴 샘플 메뉴와 객실 가격을 인원·객실 수에 따라 계산했어요. 가격을 모르는 항목은 제외하고 별도로 표시해요.';
  if (s.stage === 'check')
    return '현재 데이터로 확인할 수 있는 미정 항목·중복 방문·지역·예산 조건을 점검했어요. 실제 영업시간이나 이동시간은 판단하지 않았어요.';
  if (s.stage === 'detail')
    return s.detailId
      ? `${chatEntity(s.detailId)?.name}의 상세정보예요. 정보를 보는 동안 기존 선택과 일정은 유지돼요.`
      : '자세히 볼 후보 이름이나 번호를 말해 주세요.';
  if (s.stage === 'library')
    return '이 기기에 저장한 여행이에요. 여행을 열면 현재 대화에 일정이 추가되고, 이전 대화도 남아요.';
  if (s.stage === 'history')
    return '이전 결과에서 이어갈 수 있어요. 표시된 결과 번호를 말하거나 이어가기 버튼을 눌러 주세요.';
  if (s.stage === 'help')
    return '장소 찾기부터 후보 비교·일정 수정·예산·저장·방문 기록까지 대화로 체험할 수 있어요. 아래 예문을 고르거나 같은 형식으로 질문해 보세요.';
  return s.plan.length
    ? `${s.region} ${period(s.days)}, ${s.plan.length}개의 방문·식사·숙박으로 연결했어요.${s.booked ? ' 예약한 숙소는 그대로 두었어요.' : ''} DAY를 바꾸거나 필요한 항목만 수정해 보세요.`
    : '아직 만든 일정이 없어요. 장소를 고르거나 지역·기간을 말해주면 초안을 만들게요.';
}
export function nextQuestions(s: TripState): string[] {
  switch (s.stage) {
    case 'answer':
      return ['도움말 보여줘', '일정 다시 보여줘'];
    case 'help':
      return [
        '제주에서 바다 볼 만한 곳 찾아줘',
        '서울숲에서 반나절 일정 짜줘',
        '저장한 여행 보여줘',
      ];
    case 'compare':
      return [
        '첫 번째 후보 선택해줘',
        '두 번째 후보 상세정보 보여줘',
        '일정 다시 보여줘',
      ];
    case 'budget':
      return [
        '1인 여행 예산 계산해줘',
        '2인 1객실 여행 예산 계산해줘',
        '일정 점검해줘',
      ];
    case 'check':
      return ['일정 다시 보여줘', '여행 예산 계산해줘', '방금 수정 취소해줘'];
    case 'detail':
      return s.detailId
        ? [
            `${chatEntity(s.detailId)?.name} 선택해줘`,
            '일정 다시 보여줘',
            '할 수 있는 기능 알려줘',
          ]
        : ['할 수 있는 기능 알려줘'];
    case 'library':
      return [
        '첫 번째 저장한 여행 열어줘',
        '찜한 장소 보여줘',
        '할 수 있는 기능 알려줘',
      ];
    case 'history':
      return [
        '첫 번째 결과에서 이어갈래',
        '일정 다시 보여줘',
        '할 수 있는 기능 알려줘',
      ];
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
