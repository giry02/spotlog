import {
  places,
  restaurants,
  stays,
  findPlace,
  findFood,
  findStay,
  period,
  type Region,
  REGIONS,
  getNearbyRegisteredBusinesses,
  getKnownEntityPrice,
} from './trip-data';
import { directionsTarget } from './travel-links';
import { communityTrips, findCommunityTrip } from './community-trips';
import type { RagRetrieval, AnswerContext } from './rag-types';
import { buildSelectedItinerary } from './itinerary-selection';
import { applyTripExtension, type CandidateGroup, type TripExtensionAction } from './trip-extensions';
import type { SpotlogOpenAction } from './spotlog-app-bridge';
import { findTripAnchor } from './trip-anchor';
import { applyLocalTripAction, demoteEditedTrip, recentActiveTrip, type TripLocalAction, type OfflineTripPackage, type PlanStatus } from './trip-local-features';
import { filterCommunityTrips } from './community-discovery';
import { applyVisitOrder, type ReorderVisitsAction } from './trip-reorder';
import { resolveSocialTarget, type SocialTarget } from './social-target';
import type { SocialView } from './social-intent';

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
  | 'answer'
  | 'collection'
  | 'community'
  | 'trash'
  | 'offline'
  | 'social'
  | 'media';
export const MAX_COLLECTED_ENTITIES = 30;
export type ItinerarySelection = { day: number; placeId: string };
export type VisitKnowledge = {
  indexVersion: string;
  evidenceIds: string[];
  documentIds: string[];
};
export type Visit = {
  id: string;
  day: number;
  kind: 'place' | 'food' | 'cafe' | 'shop' | 'stay';
  entityId: string | null;
  anchorId: string;
  label: string;
  locked: boolean;
  status?: 'done' | 'skipped';
  knowledge?: VisitKnowledge;
  note?: string;
  time?: string;
  durationMinutes?: number;
  nights?: number;
};
export type TripState = {
  stage: Stage;
  question: string;
  notice: string;
  region: Region | null;
  days: number;
  title?: string;
  startDate?: string | null;
  pendingCandidates?: CandidateGroup[];
  businessMode?: 'registered' | 'demo';
  nearbyExpanded?: boolean;
  stayBudgetExplicit?: boolean;
  spotlogNavigation?: Omit<SpotlogOpenAction, 'type'>;
  socialTarget?: SocialTarget;
  socialView?: SocialView;
  planStatus?: PlanStatus;
  savedRegion?: Region | null;
  offlinePackageId?: string | null;
  theme: 'all' | 'sea' | 'green';
  similarTo: string | null;
  anchorId: string | null;
  foodId: string | null;
  cafeId: string | null;
  stayId: string | null;
  foodKind: '식당' | '카페' | '상점';
  cuisine: '전체' | '한식' | '양식';
  walk: number;
  foodBudget: number | null;
  stayBudget: number;
  booked: boolean;
  meals: boolean;
  cafes: boolean;
  lodging: boolean;
  savedIds: string[];
  collectedIds?: string[];
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
  communitySourceId?: string | null;
  communityRegion?: Region | null;
  communityTheme?: 'all' | 'sea' | 'green';
  communityQuery?: string;
  communityType?: 'all' | 'traveler' | 'ai';
  communityDays?: number | null;
  communityAuthorId?: string | null;
  mediaMode?: 'photos' | 'motion';
  mediaRegion?: Region | null;
  mediaKind?: 'all' | 'LANDMARK' | 'FOOD' | 'CAFE' | 'SHOP' | 'STAY';
};
export type TripTurn = {
  id: number;
  state: TripState;
  restoredFrom?: number;
  assistantMessage?: string;
  source?: 'demo' | 'flowise' | 'ollama' | 'large-model' | 'clarify' | 'local-action';
  retrieval?: RagRetrieval;
  evidenceIds?: string[];
  answerContext?: AnswerContext;
};
export type SavedPlan = {
  id: string;
  title: string;
  region: Region;
  days: number;
  visits: Visit[];
  booked: boolean;
  startDate?: string | null;
  deletedAt?: string;
  purgeAfter?: string;
  communitySourceId?: string | null;
  status?: PlanStatus;
  activeDay?: number;
};
export type TripSession = {
  turns: TripTurn[];
  nextId: number;
  library: SavedPlan[];
  offlineTrips?: OfflineTripPackage[];
  recentPlanIds?: string[];
};
export type TripAction =
  | TripExtensionAction
  | ReorderVisitsAction
  | TripLocalAction
  | SpotlogOpenAction
  | { type: 'social'; target: SocialTarget; view?: SocialView }
  | { type: 'media'; mode: 'photos' | 'motion'; region?: Region | null; kind?: 'all' | 'LANDMARK' | 'FOOD' | 'CAFE' | 'SHOP' | 'STAY' }
  | { type: 'message'; text: string }
  | { type: 'place'; id: string }
  | { type: 'bookmark'; id: string; saved?: boolean }
  | { type: 'food'; id: string }
  | { type: 'stay'; id: string }
  | { type: 'show'; stage: Stage; kind?: '식당' | '카페' | '상점'; day?: number }
  | { type: 'region'; region: Region }
  | { type: 'walk'; value: number }
  | { type: 'cuisine'; value: TripState['cuisine'] }
  | { type: 'stay-budget'; value: number }
  | { type: 'build'; savedOnly?: boolean; visits?: ItinerarySelection[] }
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
  | { type: 'collect-entity'; id: string }
  | { type: 'uncollect-entity'; id: string }
  | { type: 'copy-community'; id: string }
  | {
      type: 'community-filter';
      region?: Region | null;
      theme?: 'all' | 'sea' | 'green';
      query?: string;
      contentType?: 'all' | 'traveler' | 'ai';
      days?: number | null;
      authorId?: string | null;
    }
  | {
      type: 'configure';
      days?: number;
      theme?: TripState['theme'];
      foodBudget?: number | null;
      booked?: boolean;
      meals?: boolean;
      cafes?: boolean;
      lodging?: boolean;
      businessMode?: 'registered' | 'demo';
      nearbyExpanded?: boolean;
    };

export function initialTrip(savedIds: string[] = []): TripState {
  return {
    stage: 'discover',
    question: '',
    notice: '',
    region: null,
    days: 1,
    planStatus: 'DRAFT',
    businessMode: 'registered',
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
    collectedIds: [],
    plan: [],
    editingId: null,
    activeDay: 1,
    savedPlanId: null,
  };
}
export function createTripSession(
  savedIds: string[] = [],
  library: SavedPlan[] = [],
  businessMode: 'registered' | 'demo' = 'registered',
): TripSession {
  return {
    turns: [{ id: 1, state: { ...initialTrip(savedIds), businessMode } }],
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
        v.day <= 30 &&
        ['place', 'food', 'cafe', 'shop', 'stay'].includes(v.kind) &&
        typeof v.label === 'string' &&
        typeof v.locked === 'boolean' &&
        (v.status === undefined || ['done', 'skipped'].includes(v.status)) &&
        Boolean(findTripAnchor(v.anchorId)) &&
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
          'collection',
          'community',
          'trash',
          'offline',
          'social',
          'media',
        ].includes(s.stage) &&
        typeof s.question === 'string' &&
        typeof s.notice === 'string' &&
        (s.region === null || REGIONS.includes(s.region)) &&
        Number.isInteger(s.days) &&
        s.days >= 1 &&
        s.days <= 30 &&
        (s.planStatus===undefined||['DRAFT','READY'].includes(s.planStatus)) &&
        (s.savedRegion===undefined||s.savedRegion===null||REGIONS.includes(s.savedRegion)) &&
        (s.socialTarget === undefined || Boolean(resolveSocialTarget(s.socialTarget))) &&
        (s.socialView === undefined || ['overview', 'threads', 'reactions'].includes(s.socialView)) &&
        (s.stage !== 'social' || Boolean(resolveSocialTarget(s.socialTarget))) &&
        ['식당', '카페', '상점'].includes(s.foodKind) &&
        Array.isArray(s.savedIds) &&
        s.savedIds.every((id) => Boolean(findPlace(id))) &&
        (s.collectedIds === undefined ||
          (Array.isArray(s.collectedIds) &&
            s.collectedIds.length <= MAX_COLLECTED_ENTITIES &&
            new Set(s.collectedIds).size === s.collectedIds.length &&
            s.collectedIds.every((id) => Boolean(chatEntity(id))))) &&
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
        (t.source === undefined || ['demo', 'flowise', 'ollama', 'large-model', 'clarify', 'local-action'].includes(t.source)) &&
        (s.communitySourceId === undefined ||
          s.communitySourceId === null ||
          Boolean(findCommunityTrip(s.communitySourceId))) &&
        (s.communityRegion === undefined ||
          (s.communityRegion === null || REGIONS.includes(s.communityRegion))) &&
        (s.communityTheme === undefined ||
          ['all', 'sea', 'green'].includes(s.communityTheme)) &&
        validVisits(s.plan)
      );
    }) &&
    Array.isArray(session.library) &&
    session.library.every(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        typeof p.title === 'string' &&
        REGIONS.includes(p.region) &&
        Number.isInteger(p.days) &&
        p.days >= 1 &&
        p.days <= 30 &&
        (p.status===undefined||['DRAFT','READY'].includes(p.status)) &&
        (p.communitySourceId === undefined ||
          p.communitySourceId === null ||
          Boolean(findCommunityTrip(p.communitySourceId))) &&
        validVisits(p.visits),
    )
  );
}
const copy = (s: TripState): TripState => ({
  ...s,
  savedIds: [...s.savedIds],
  collectedIds: s.collectedIds ? [...s.collectedIds] : [],
  plan: s.plan.map((v) => ({ ...v })),
  comparisonIds: s.comparisonIds ? [...s.comparisonIds] : undefined,
  librarySnapshot: s.librarySnapshot?.map((p) => ({
    ...p,
    visits: p.visits.map((v) => ({ ...v })),
  })),
  historySnapshot: s.historySnapshot?.map((t) => ({ ...t })),
  pendingCandidates: s.pendingCandidates?.map(group => ({ ...group, optionIds:[...group.optionIds] })),
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
        (s.theme !== 'sea' ||
          /바다|해변|해안/.test(p.tags.join(' ') + p.name)) &&
        (s.theme !== 'green' || p.mood[0] >= 4),
    )
    .sort((a, b) =>
      reference
        ? a.mood.reduce((n, v, i) => n + Math.abs(v - reference.mood[i]), 0) -
          b.mood.reduce((n, v, i) => n + Math.abs(v - reference.mood[i]), 0)
        : 0,
    );
}
export function communityResults(s: TripState) {
  return filterCommunityTrips(s);
}
export function foodResults(s: TripState) {
  const nearby = s.businessMode === 'registered' && s.anchorId ? new Set(getNearbyRegisteredBusinesses(s.anchorId, s.foodKind, { expanded: s.nearbyExpanded }).map(item => item.entity.id)) : null;
  if (nearby && s.anchorId && findFood(s.anchorId)?.registered) nearby.add(s.anchorId);
  return restaurants
    .filter(
      (r) =>
        (s.businessMode !== 'registered' || Boolean(r.registered)) &&
        (nearby ? nearby.has(r.id) : s.anchorId ? r.placeId === s.anchorId : !s.region || (r.region ?? findTripAnchor(r.placeId)?.region) === s.region) &&
        (s.foodKind === '카페' ? r.cuisine === '카페' : s.foodKind === '상점' ? String(r.cuisine) === '상점' : !['카페', '상점'].includes(r.cuisine)) &&
        (s.cuisine === '전체' || r.cuisine === s.cuisine) &&
        r.walk <= s.walk &&
        (!s.foodBudget || (getKnownEntityPrice(r) !== null && r.price <= s.foodBudget)),
    )
    .sort((a, b) => a.walk - b.walk);
}
export function stayResults(s: TripState) {
  const nearby = s.businessMode === 'registered' && s.anchorId ? new Set(getNearbyRegisteredBusinesses(s.anchorId, 'STAY', { expanded: s.nearbyExpanded }).map(item => item.entity.id)) : null;
  if (nearby && s.anchorId && findStay(s.anchorId)?.registered) nearby.add(s.anchorId);
  return stays
    .filter(
      (p) =>
        (s.businessMode !== 'registered' || Boolean(p.registered)) &&
        p.region === s.region &&
        (s.stayBudgetExplicit ? getKnownEntityPrice(p) !== null && p.price <= s.stayBudget : getKnownEntityPrice(p) === null || p.price <= s.stayBudget) &&
        (nearby ? nearby.has(p.id) : !s.anchorId || p.near.includes(s.anchorId)),
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

function collectionAnchor(id: string): string | null {
  return (
    findPlace(id)?.id ?? findFood(id)?.placeId ?? findStay(id)?.near[0] ?? null
  );
}
function collectionRegion(id: string): Region | null {
  return (findPlace(id)?.region ??
    findStay(id)?.region ??
    findFood(id)?.region ?? findTripAnchor(findFood(id)?.placeId ?? null)?.region ??
    null) as Region | null;
}
function focusCollectedEntity(s: TripState, id: string) {
  const p = findPlace(id),
    f = findFood(id),
    h = findStay(id);
  s.region = collectionRegion(id);
  if (p) s.anchorId = p.id;
  else if (f) {
    s.anchorId = f.placeId;
    s.foodKind = f.cuisine === '카페' ? '카페' : String(f.cuisine) === '상점' ? '상점' : '식당';
    if (f.cuisine === '카페') {
      s.cafeId = f.id;
      s.cafes = true;
    } else {
      s.foodId = f.id;
      s.meals = true;
    }
  } else if (h) {
    s.stayId = h.id;
    s.lodging = true;
    if (!s.anchorId || !h.near.includes(s.anchorId)) s.anchorId = h.near[0];
  }
}
function collectEntities(before: TripState, ids: string[]): TripState {
  const s = copy(before);
  const distinct = [...new Set(ids)];
  const regions = distinct.map(collectionRegion);
  s.stage = 'collection';
  s.editingId = null;
  if (!distinct.length || distinct.some((id) => !chatEntity(id)))
    return {
      ...s,
      notice: '담을 장소·식당·카페·숙소의 이름이나 후보 번호를 말해 주세요.',
    };
  const activeRegion = s.collectedIds?.length
    ? collectionRegion(s.collectedIds[0])
    : s.region;
  if (
    new Set(regions).size !== 1 ||
    (activeRegion && regions[0] !== activeRegion)
  )
    return {
      ...s,
      notice:
        '다른 지역은 한 여행에 섞지 않아요. 현재 지역의 장소·식당·카페를 더 담아주세요.',
    };
  if (s.booked && distinct.some((id) => findStay(id)))
    return {
      ...s,
      notice:
        '예약한 숙소는 유지할게요. 담은 장소·식당·카페를 더 고를 수 있어요.',
    };
  const next = [...new Set([...(s.collectedIds ?? []), ...distinct])];
  if (next.length > MAX_COLLECTED_ENTITIES)
    return {
      ...s,
      notice: `한 여행에는 ${MAX_COLLECTED_ENTITIES}곳까지 담을 수 있어요. 필요 없는 후보를 먼저 빼주세요.`,
    };
  const added = next.length - (s.collectedIds?.length ?? 0);
  s.collectedIds = next;
  focusCollectedEntity(s, distinct[distinct.length - 1]);
  s.notice = added
    ? `${added}곳을 여행에 담았어요. 다른 장소와 식당·카페를 계속 담은 뒤, 원할 때 일정으로 만들 수 있어요.`
    : '이미 담은 곳이에요. 다른 장소와 식당·카페를 계속 찾아보세요.';
  if (s.days === 1 && distinct.some((id) => findStay(id))) {
    s.days = 2;
    s.notice += ' 숙소를 직접 담아 숙박할 수 있도록 1박 2일로 맞췄어요.';
  }
  return s;
}
function makeCollectedPlan(before: TripState): TripState {
  const s = copy(before);
  const ids = s.collectedIds ?? [];
  if (!ids.length)
    return {
      ...s,
      stage: 'collection',
      notice: '아직 여행에 담은 곳이 없어요. 장소·식당·카페를 먼저 담아주세요.',
    };
  const region = collectionRegion(ids[0]);
  if (!region || ids.some((id) => collectionRegion(id) !== region))
    return {
      ...s,
      stage: 'collection',
      notice:
        '한 지역의 후보만 일정으로 만들 수 있어요. 담은 지역을 확인해 주세요.',
    };
  const collectedStays = ids.map(findStay).filter((h) => h !== undefined);
  const lockedStays = s.plan.filter((v) => v.kind === 'stay' && v.locked);
  if (lockedStays.some((v) => v.day >= s.days))
    return {
      ...s,
      days: Math.max(
        s.days,
        ...s.plan.map((v) => v.day),
        ...lockedStays.map((v) => v.day + 1),
      ),
      stage: 'collection',
      notice:
        '예약 숙소가 있는 숙박 날짜는 유지해요. 예약한 기간보다 짧게 일정을 바꾸지 않았어요.',
    };
  if (!s.booked && s.days > 1 && collectedStays.length > s.days - 1)
    return {
      ...s,
      stage: 'collection',
      notice: `숙박은 ${s.days - 1}박인데 숙소 후보가 ${collectedStays.length}곳이에요. 사용할 숙소만 남기거나 여행 기간을 바꿔주세요.`,
    };
  const anchors = [
    ...new Set(ids.filter((id) => !findStay(id)).map(collectionAnchor)),
  ].filter((id): id is string => Boolean(id));
  if (!anchors.length && !collectedStays.length)
    return { ...s, stage: 'collection', notice: '담은 후보를 확인해 주세요.' };
  const plan: Visit[] = [];
  const reservedIds = new Set(lockedStays.map((v) => v.id));
  // Generated visit IDs can be reassigned after collection order changes.
  // Keep explicit details with the same entity/kind occurrence instead.
  const previousVisits = new Map<string, Visit[]>();
  for (const visit of before.plan) {
    if (!visit.entityId || visit.locked) continue;
    const key = `${visit.kind}:${visit.entityId}`;
    const matches = previousVisits.get(key) ?? [];
    matches.push(visit);
    previousVisits.set(key, matches);
  }
  let serial = 1;
  const add = (
    day: number,
    kind: Visit['kind'],
    entityId: string | null,
    anchorId: string,
    label: string,
    locked = false,
  ) => {
    while (reservedIds.has(`visit-${serial}`)) serial++;
    const previous = entityId && !locked
      ? previousVisits.get(`${kind}:${entityId}`)?.shift()
      : undefined;
    plan.push({
      id: `visit-${serial++}`,
      day,
      kind,
      entityId,
      anchorId,
      label,
      locked,
      ...(previous?.note !== undefined ? { note: previous.note } : {}),
      ...(previous?.time !== undefined ? { time: previous.time } : {}),
      ...(previous?.durationMinutes !== undefined ? { durationMinutes: previous.durationMinutes } : {}),
    });
  };
  // Without landmarks, a canonical tourism anchor is only a location reference.
  // Distribute the selected businesses themselves, in collection order.
  const businessOnly = ids.every(id => !findPlace(id));
  const units = businessOnly ? ids.filter(id => Boolean(findFood(id))) : anchors;
  const batchSize = Math.max(1, Math.ceil(units.length / s.days));
  const unitDays = new Map(
    units.map((unit, i) => [
      unit,
      businessOnly
        ? Math.floor(i * Math.min(s.days, units.length) / units.length) + 1
        : Math.min(s.days, Math.floor(i / batchSize) + 1),
    ]),
  );
  for (let day = 1; day <= s.days; day++) {
    for (const unit of units.filter((id) => unitDays.get(id) === day)) {
      const anchor = businessOnly ? findFood(unit)!.placeId : unit;
      if (!businessOnly && ids.includes(anchor) && findPlace(anchor)) {
        const index = plan.filter(
          (v) => v.day === day && v.kind === 'place',
        ).length;
        add(
          day,
          'place',
          anchor,
          anchor,
          index === 0 ? '오전 방문' : index === 1 ? '오후 방문' : '추가 방문',
        );
      }
      for (const id of businessOnly ? [unit] : ids) {
        const food = findFood(id);
        if (food?.placeId === anchor) {
          const meals = plan.filter(
            (v) => v.day === day && v.kind === 'food',
          ).length;
          add(
            day,
            food.cuisine === '카페' ? 'cafe' : String(food.cuisine) === '상점' ? 'shop' : 'food',
            food.id,
            anchor,
            String(food.cuisine) === '상점' ? '쇼핑' : food.cuisine === '카페'
              ? '카페에서 쉬기'
              : meals === 0
                ? '점심'
                : meals === 1
                  ? '저녁'
                  : '추가 식사',
          );
        }
      }
    }
    if (day < s.days) {
      const existingLocked = lockedStays.filter((v) => v.day === day);
      if (existingLocked.length) {
        plan.push(...existingLocked.map((v) => ({ ...v })));
        continue;
      }
      const selectedStay = findStay(s.stayId);
      const chosen =
        collectedStays[Math.min(day - 1, collectedStays.length - 1)] ??
        (s.businessMode !== 'registered' && s.lodging && selectedStay?.region === region
          ? selectedStay
          : undefined);
      const dayAnchor =
        plan.filter((v) => v.day === day).at(-1)?.anchorId ??
        anchors.at(-1) ??
        chosen?.near[0] ??
        s.anchorId;
      if (s.booked && dayAnchor)
        add(day, 'stay', null, dayAnchor, '숙박', true);
      else if (chosen && dayAnchor)
        add(
          day,
          'stay',
          chosen.id,
          chosen.near.includes(dayAnchor) ? dayAnchor : chosen.near[0],
          '숙박',
        );
    }
  }
  s.region = region;
  s.plan = plan;
  s.stage = 'plan';
  s.activeDay = 1;
  s.editingId = null;
  s.savedPlanId = null;
  s.anchorId = anchors[0] ?? collectedStays[0]?.near[0] ?? s.anchorId;
  s.notice =
    '여행에 담은 장소·식당·카페만 지역별로 연결했어요. 담지 않은 후보는 자동으로 추가하지 않았어요.';
  if (s.booked && s.days > 1) s.notice += ' 예약한 숙소는 유지했어요.';
  else if (s.days > 1 && !plan.some((v) => v.kind === 'stay'))
    s.notice +=
      ' 숙소는 아직 고르지 않았어요. 원할 때 나중에 추가할 수 있어요.';
  else if (s.days === 1 && collectedStays.length)
    s.notice += ' 당일 여행의 숙소 후보는 일정에 넣지 않았어요.';
  return s;
}
export function makePlan(
  s: TripState,
  savedOnly = false,
  onlyArea?: (typeof places)[number]['area'],
): TripState {
  if (
    !savedOnly &&
    ((s.collectedIds?.length ?? 0) > 0 || s.stage === 'collection')
  )
    return makeCollectedPlan(s);
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
  const primaryArea = findPlace(firstId)?.area ?? candidates[0].area;
  const areaOrder = onlyArea
    ? [onlyArea]
    : primaryArea === 'east'
      ? ['east', 'south', 'central', 'north', 'west']
      : primaryArea === 'south'
        ? ['south', 'west', 'central', 'east', 'north']
        : primaryArea === 'seoul'
          ? ['seoul']
          : primaryArea === 'central'
            ? ['central', 'north', 'east', 'south', 'west']
            : primaryArea === 'north'
              ? ['north', 'central', 'east', 'west', 'south']
              : ['west', 'south', 'east', 'central', 'north'];
  const themeScore = (p: (typeof places)[number]) =>
    s.theme === 'sea'
      ? Number(/바다|해변|해안/.test(p.tags.join(' ') + p.name))
      : s.theme === 'green'
        ? Number(p.mood[0] >= 4)
        : 0;
  candidates.sort(
    (a, b) =>
      Number(b.id === firstId) - Number(a.id === firstId) ||
      themeScore(b) - themeScore(a),
  );
  const dayPools: (typeof candidates)[] = [];
  if (!savedOnly) {
    const remaining = new Map(
      areaOrder.map((area) => [
        area,
        candidates.filter((p) => p.area === area),
      ]),
    );
    for (let day = 1; day <= s.days; day++) {
      const area =
        areaOrder.find((area) => (remaining.get(area)?.length ?? 0) >= 2) ??
        areaOrder.find((area) => (remaining.get(area)?.length ?? 0) > 0);
      dayPools.push(area ? remaining.get(area)!.splice(0, 2) : []);
    }
    candidates = dayPools.flat();
  }
  const existingLocked = s.plan.filter((v) => v.kind === 'stay' && v.locked);
  if (existingLocked.some((v) => v.day >= s.days))
    return {
      ...copy(s),
      days: Math.max(
        s.days,
        ...s.plan.map((v) => v.day),
        ...existingLocked.map((v) => v.day + 1),
      ),
      notice:
        '예약 숙소가 있는 숙박 날짜는 유지해요. 더 짧은 일정으로 바꾸지 않았어요.',
    };
  n.plan = [];
  let serial = 1;
  const reservedIds = new Set(existingLocked.map((v) => v.id));
  const add = (
    day: number,
    kind: Visit['kind'],
    entityId: string | null,
    anchorId: string,
    label: string,
    locked = false,
  ) => {
    while (reservedIds.has(`visit-${serial}`)) serial++;
    n.plan.push({
      id: `visit-${serial++}`,
      day,
      kind,
      entityId,
      anchorId,
      label,
      locked,
    });
  };
  for (let day = 1; day <= s.days; day++) {
    const batchSize = Math.ceil(candidates.length / s.days);
    const dayPlaces = savedOnly
      ? candidates.slice((day - 1) * batchSize, day * batchSize)
      : dayPools[day - 1];
    const anchor = dayPlaces[0]?.id ?? candidates.at(-1)?.id ?? s.anchorId;
    if (!anchor) continue;
    if (dayPlaces[0]) add(day, 'place', anchor, anchor, '오전 방문');
    if (s.meals && dayPlaces.length) {
      const selected = findFood(s.foodId);
      const lunch =
        selected?.placeId === anchor && selected.cuisine !== '카페'
          ? selected
          : restaurants.find(
              (r) => r.placeId === anchor && !['카페','상점'].includes(r.cuisine) && (s.businessMode !== 'registered' || r.registered),
            );
      add(day, 'food', lunch?.id ?? null, anchor, '점심');
    }
    dayPlaces
      .slice(1)
      .forEach((p, i) =>
        add(day, 'place', p.id, p.id, i === 0 ? '오후 방문' : '추가 방문'),
      );
    const lastAnchor = dayPlaces.at(-1)?.id ?? anchor;
    if (s.cafes && dayPlaces.length) {
      const selectedCafe = findFood(s.cafeId);
      add(
        day,
        'cafe',
        selectedCafe?.placeId === lastAnchor
          ? selectedCafe.id
          : (restaurants.find(
              (r) => r.placeId === lastAnchor && r.cuisine === '카페' && (s.businessMode !== 'registered' || r.registered),
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
            (s.businessMode !== 'registered' || r.registered) &&
            r.cuisine !== '카페' &&
            !used.includes(r.id),
        )?.id ?? null,
        lastAnchor,
        '저녁',
      );
    }
    if (day < s.days && (s.lodging || s.booked)) {
      const locked = existingLocked.filter((v) => v.day === day);
      if (locked.length) {
        n.plan.push(...locked.map((v) => ({ ...v })));
        continue;
      }
      const selected = findStay(s.stayId);
      const hotel = s.businessMode === 'registered' ? undefined :
        selected?.region === n.region
          ? selected
          : stays
              .filter(
                (h) =>
                  h.region === n.region &&
                  (s.businessMode !== 'registered' || h.registered) &&
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
  n.communitySourceId = null;
  n.notice = savedOnly
    ? '찜한 장소만 방문지로 배치했어요. 식당·숙소는 같은 지역의 체험 후보로 연결했어요.'
    : '하루에 오전·오후 방문을 나누고, 같은 권역의 장소를 묶은 초안이에요. 실제 이동시간·영업시간은 조회하지 않았어요. 원하는 부분만 바꿀 수 있어요.';
  if (!savedOnly && onlyArea && candidates.length < s.days * 2)
    n.notice +=
      ' 요청한 권역의 샘플 장소가 부족한 날짜는 다른 권역으로 채우지 않았어요. 원하는 방문을 더 담아 보세요.';
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
          kind: f.cuisine === '카페' ? ('cafe' as const) : String(f.cuisine) === '상점' ? ('shop' as const) : ('food' as const),
        }
      : h
        ? { id, name: h.name, kind: 'stay' as const }
        : undefined;
}
const placeAliases: Record<string, string> = {
  osulloc: '오설록',
  hyeopjae: '협재',
  saebyeol: '새별',
  seongsan: '성산',
  seopjikoji: '섭지코지',
  hamdeok: '함덕',
  bijarim: '비자림',
  cheonjiyeon: '천지연',
  jeongbang: '정방',
  jusangjeolli: '주상절리',
  songaksan: '송악산',
  geumneung: '금능',
};
function mentionsEntity(q: string, id: string, name: string) {
  const compact = q.replace(/\s/g, '');
  return (
    compact.includes(name.replace(/\s/g, '')) ||
    Boolean(placeAliases[id] && compact.includes(placeAliases[id]))
  );
}
function namedEntities(q: string) {
  const businesses = [...restaurants, ...stays].filter((p) =>
    q.replace(/\s/g, '').includes(p.name.replace(/\s/g, '')),
  );
  let placeQuestion = q.replace(/\s/g, '');
  for (const business of businesses)
    placeQuestion = placeQuestion.replaceAll(
      business.name.replace(/\s/g, ''),
      '',
    );
  return [
    ...places.filter((p) => mentionsEntity(placeQuestion, p.id, p.name)),
    ...businesses,
  ].map((p) => chatEntity(p.id)!);
}
function chatCandidates(s: TripState) {
  const ids =
    s.stage === 'collection'
      ? (s.collectedIds ?? [])
      : s.stage === 'compare'
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
  if (action.type === 'social') {
    const target = resolveSocialTarget(action.target);
    if (!target) return { ...s, notice: '스레드·평가를 볼 장소나 공개 코스를 확인해 주세요.' };
    return { ...s, stage: 'social', socialTarget: { ...action.target }, socialView: action.view ?? 'overview',
      question: `${target.title} 스레드·평가·담김 보기`,
      notice: '' };
  }
  if (action.type === 'open_spotlog') {const {type:_type,...navigation}=action;return { ...s, spotlogNavigation: navigation, question: 'Spotlog 앱 기능 열기', notice: '아래 버튼을 누르면 Spotlog 앱 화면을 열 수 있어요. 이 대화에서 실제 게시·예약·계정 변경은 실행하지 않아요.' };}
  if (action.type === 'media') return {...s,stage:'media',mediaMode:action.mode,mediaRegion:action.region===undefined?s.mediaRegion??s.region:action.region,mediaKind:action.kind??s.mediaKind??'all',question:action.mode==='photos'?'사진으로 등록 장소 둘러보기':'포토모션으로 등록 장소 둘러보기',notice:action.mode==='motion'?'등록 사진을 확대해 보는 효과예요. 실제 촬영 영상·VR·생성 동영상은 제공하지 않아요.':'등록 사진과 출처를 확인해요. 원문에서 외부 페이지를 여는 항목은 연결 표시가 있어요.'};
  const choosePlace = (id: string) => {
    const p = findPlace(id);
    if (!p) return;
    if ((s.plan.length || s.collectedIds?.length) && p.region !== s.region) {
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
      delete target.knowledge;
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
  const showFood = (kind: '식당' | '카페' | '상점' = '식당') => {
    s.foodKind = kind;
    s.cuisine = '전체';
    if (kind === '카페') {
      s.cafes = true;
      s.cafeId = null;
    } else s.foodId = null;
    if (!s.anchorId && !s.region) {
      s.stage = 'discover';
      s.notice = '찾을 지역을 알려주세요. 관광지를 먼저 고르지 않고 식당·카페·상점부터 찾을 수 있어요.';
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
      s.anchorId = findFood(id)!.placeId;
      if (s.foodKind === '카페') s.cafeId = id;
      else s.foodId = id;
    } else {
      s.stayId = id;
      if (s.businessMode === 'registered') {
        s.stage = 'stay';
        s.notice = '숙소 후보만 선택했어요. 숙박일·연박에서 체크인 DAY와 박수를 고르면 일정에 반영돼요. 실제 예약은 진행하지 않았어요.';
        return;
      }
      s.lodging = true;
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
        : ['food', 'cafe', 'shop'].includes(target.kind))
    ) {
      target.entityId = id;
      if (kind === 'food') {
        target.anchorId = findFood(id)!.placeId;
        target.kind = findFood(id)!.cuisine === '카페' ? 'cafe' : String(findFood(id)!.cuisine) === '상점' ? 'shop' : 'food';
      }
      delete target.status;
      s.stage = 'plan';
      s.editingId = null;
      s.notice = `DAY ${target.day} ${target.label}만 바꿨어요. 다른 방문과 예약 숙소는 유지했어요.`;
    } else if (kind === 'stay' && s.plan.length) {
      const hotel = findStay(id)!;
      let added = 0;
      let serial =
        Math.max(
          0,
          ...s.plan.map((v) => Number(v.id.replace('visit-', '')) || 0),
        ) + 1;
      for (let day = 1; day < s.days; day++) {
        if (s.plan.some((v) => v.day === day && v.kind === 'stay')) continue;
        const lastAnchor =
          s.plan.filter((v) => v.day === day).at(-1)?.anchorId ?? s.anchorId;
        const anchor =
          lastAnchor && hotel.near.includes(lastAnchor)
            ? lastAnchor
            : hotel.near[0];
        const nextDay = s.plan.findIndex((v) => v.day > day);
        s.plan.splice(nextDay < 0 ? s.plan.length : nextDay, 0, {
          id: `visit-${serial++}`,
          day,
          kind: 'stay',
          entityId: hotel.id,
          anchorId: anchor,
          label: '숙박',
          locked: false,
        });
        added++;
      }
      if (added) {
        s.stage = 'plan';
        s.editingId = null;
        s.notice += `${s.notice ? ' ' : ''}숙소가 없던 ${added}박에 선택한 숙소만 추가했어요. 방문·식사·카페와 다른 숙박은 그대로예요.`;
      } else
        s.notice =
          '이미 숙박이 배치되어 있어요. 숙소를 바꾸려면 해당 DAY의 숙박 항목에서 교체해 주세요.';
    }
  };
  const setRegion = (region: Region) => {
    if (region !== s.region && (s.booked || s.plan.some((v) => v.locked))) {
      s.notice =
        '예약한 숙소를 보호하기 위해 여행 지역을 바꾸지 않았어요. 다른 지역의 새 여행은 대화를 초기화한 뒤 시작해 주세요.';
      return;
    }
    if (
      s.collectedIds?.length &&
      region !== collectionRegion(s.collectedIds[0])
    ) {
      s.notice =
        '담은 곳과 다른 지역은 한 여행에 섞지 않아요. 현재 담은 곳을 빼거나 새 대화를 시작해 주세요.';
      return;
    }
    if (s.region !== region) {
      s.pendingCandidates = [];
      s.anchorId = null;
      s.foodId = null;
      s.cafeId = null;
      s.stayId = null;
      s.similarTo = null;
      s.theme = 'all';
      s.plan = [];
      s.savedPlanId = null;
      s.communitySourceId = null;
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
    else if (v.kind === 'food' || v.kind === 'cafe' || v.kind === 'shop')
      showFood(v.kind === 'cafe' ? '카페' : v.kind === 'shop' ? '상점' : '식당');
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
    if (before.stage === 'community')
      return {
        ...s,
        stage: 'community',
        communityRegion: action.region,
        question: `${action.region} 공개 여행 코스 보여줘`,
      };
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
    s.question = `${findStay(action.id)?.name ?? '숙소'} ${s.businessMode === 'registered' ? '숙소 후보 선택' : '일정에 넣기'}`;
  }
  if (action.type === 'walk') {
    s.pendingCandidates = [];
    s.walk = Math.max(1, Math.min(20, action.value));
    s.foodId = null;
    s.question = `도보 ${s.walk}분 안에서 찾아줘`;
  }
  if (action.type === 'cuisine') {
    s.pendingCandidates = [];
    s.cuisine = action.value;
    s.foodId = null;
    s.question = `${action.value === '전체' ? '모든 음식 종류' : action.value + '만'} 보여줘`;
  }
  if (action.type === 'stay-budget') {
    s.pendingCandidates = [];
    s.stayBudget = action.value;
    s.stayBudgetExplicit = true;
    s.stayId = null;
    s.question = `숙소는 1박 ${action.value / 10000}만원 이하로`;
  }
  if (action.type === 'show') {
    if (action.stage === 'community')
      return {
        ...s,
        stage: 'community',
        communityRegion:
          before.communityRegion === undefined
            ? before.region
            : before.communityRegion,
        communityTheme: before.communityTheme ?? 'all',
        question: '다른 여행자의 공개 여행 코스 보여줘',
        notice:
          '제작한 공개 코스 예시예요. 실제 회원 게시물은 아직 연결하지 않았어요.',
      };
    s.editingId = null;
    if (action.day && action.day >= 1 && action.day <= s.days) {
      s.activeDay = action.day;
      if (action.day !== before.activeDay && (action.stage === 'food' || action.stage === 'stay')) {
        const visits = s.plan.filter(visit => visit.day === action.day);
        s.anchorId = visits.find(visit => visit.kind === 'place' && findPlace(visit.entityId))?.entityId
          ?? visits.find(visit => findTripAnchor(visit.anchorId))?.anchorId
          ?? null;
      }
    }
    if (action.stage === 'food') showFood(action.kind);
    else if (action.stage === 'stay') showStay();
    else s.stage = action.stage;
    if (action.stage === 'discover') {
      s.theme = 'all';
      s.similarTo = null;
    }
    s.question =
      action.stage === 'collection'
        ? '여행에 담은 곳 보여줘'
        : action.stage === 'food'
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
    s = action.visits
      ? buildSelectedItinerary(s, action.visits)
      : makePlan(s, action.savedOnly);
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
    const kind = s.foodKind === '카페' ? 'cafe' : s.foodKind === '상점' ? 'shop' : 'food';
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
        label: kind === 'cafe' ? '카페에서 쉬기' : kind === 'shop' ? '쇼핑' : '추가 식사',
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
    if (action.businessMode !== undefined || action.nearbyExpanded !== undefined || action.foodBudget !== undefined || action.booked !== undefined) s.pendingCandidates = [];
    if (action.businessMode !== undefined) s.businessMode = action.businessMode;
    if (action.nearbyExpanded !== undefined) s.nearbyExpanded = action.nearbyExpanded;
    if (action.days !== undefined) {
      if (!Number.isInteger(action.days) || action.days < 1 || action.days > 7)
        return {
          ...s,
          question: '여행 기간 변경',
          notice: '여행 생성은 1~7일을 지원해요. 만든 뒤 DAY를 추가해 최대 30일까지 편집할 수 있어요.',
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
      const region = h?.region ?? f?.region ?? findTripAnchor(f!.placeId)!.region;
      if ((s.plan.length || s.collectedIds?.length) && region !== s.region)
        return {
          ...s,
          question: `${entity.name} 선택해줘`,
          notice: '현재 일정과 같은 지역의 후보를 골라주세요.',
        };
      s.region = region as Region;
      if (f) {
        s.anchorId = f.placeId;
        s.foodKind = f.cuisine === '카페' ? '카페' : String(f.cuisine) === '상점' ? '상점' : '식당';
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
  if (action.type === 'collect-entity') {
    s = collectEntities(before, [action.id]);
    s.question = `${chatEntity(action.id)?.name ?? '후보'}을 여행에 담아줘`;
  }
  if (action.type === 'uncollect-entity') {
    const wasCollected = s.collectedIds?.includes(action.id);
    s.stage = 'collection';
    s.editingId = null;
    s.question = `${chatEntity(action.id)?.name ?? '후보'}을 담은 곳에서 빼줘`;
    if (!wasCollected)
      s.notice =
        '현재 여행에 담긴 후보가 아니에요. 다른 담은 곳은 그대로 유지했어요.';
    else {
      s.collectedIds = (s.collectedIds ?? []).filter((id) => id !== action.id);
      const removedFocus =
        s.anchorId === action.id ||
        s.foodId === action.id ||
        s.cafeId === action.id ||
        s.stayId === action.id;
      if (s.foodId === action.id)
        s.foodId =
          [...s.collectedIds]
            .reverse()
            .find(
              (id) => findFood(id)?.cuisine !== '카페' && Boolean(findFood(id)),
            ) ?? null;
      if (s.cafeId === action.id)
        s.cafeId =
          [...s.collectedIds]
            .reverse()
            .find((id) => findFood(id)?.cuisine === '카페') ?? null;
      if (s.stayId === action.id)
        s.stayId =
          [...s.collectedIds].reverse().find((id) => Boolean(findStay(id))) ??
          null;
      if (removedFocus) {
        const remaining = s.collectedIds.at(-1);
        if (remaining) focusCollectedEntity(s, remaining);
        else if (s.anchorId === action.id) s.anchorId = null;
      }
      s.notice =
        '이 후보만 담은 곳에서 뺐어요. 다른 후보·찜·저장한 여행은 그대로예요.';
    }
  }
  if (action.type === 'community-filter') {
    s.stage = 'community';
    if (action.region !== undefined) s.communityRegion = action.region;
    else if (s.communityRegion === undefined) s.communityRegion = before.region;
    if (action.theme !== undefined) s.communityTheme = action.theme;
    if (action.query !== undefined) s.communityQuery = action.query.trim();
    if (action.contentType !== undefined) s.communityType = action.contentType;
    if (action.days !== undefined) s.communityDays = action.days;
    if (action.authorId !== undefined) s.communityAuthorId = action.authorId;
    else if (s.communityTheme === undefined) s.communityTheme = 'all';
    s.question = `${s.communityRegion ?? '전체 지역'} ${s.communityTheme === 'sea' ? '바다' : s.communityTheme === 'green' ? '초록 풍경' : '전체'} 공개 코스 보여줘`;
    s.notice =
      '공개 코스 목록의 조건만 바꿨어요. 만들던 여행과 담은 곳은 그대로예요.';
  }
  if (action.type === 'copy-community') {
    const course = findCommunityTrip(action.id);
    if (!course)
      return {
        ...s,
        stage: 'community',
        question: '공개 코스를 내 여행으로 가져와',
        notice: '목록에 있는 공개 코스 하나를 골라주세요.',
      };
    if (before.booked || before.plan.some((v) => v.locked))
      return {
        ...s,
        stage: 'community',
        question: `${course.title} 내 여행으로 가져와`,
        notice:
          '현재 예약한 숙소를 보호하기 위해 여행을 교체하지 않았어요. 새 여행으로 시작하려면 대화를 초기화한 뒤 코스를 가져와 주세요. 저장한 여행과 찜은 유지돼요.',
      };
    s = {
      ...initialTrip(before.savedIds),
      stage: 'plan',
      region: course.region,
      days: course.days,
      theme: course.theme,
      communityRegion: before.communityRegion,
      communityTheme: before.communityTheme,
      communityQuery:before.communityQuery,communityType:before.communityType,communityDays:before.communityDays,communityAuthorId:before.communityAuthorId,
      communitySourceId: course.id,
      plan: course.visits.map((v, i) => ({
        ...v,
        id: `visit-${i + 1}`,
        locked: false,
      })),
      collectedIds: [...new Set(course.visits.map((v) => v.entityId))],
      anchorId:
        course.visits.find((v) => v.kind === 'place')?.entityId ??
        course.visits[0]?.anchorId ??
        null,
      foodId: course.visits.find((v) => v.kind === 'food')?.entityId ?? null,
      cafeId: course.visits.find((v) => v.kind === 'cafe')?.entityId ?? null,
      stayId: course.visits.find((v) => v.kind === 'stay')?.entityId ?? null,
      meals: course.visits.some((v) => v.kind === 'food'),
      cafes: course.visits.some((v) => v.kind === 'cafe'),
      lodging: course.visits.some((v) => v.kind === 'stay'),
      question: `${course.title} 내 여행으로 가져와`,
      notice: `${course.author}의 제작 예시 코스를 내 여행에 복사했어요. 출처는 남기고, 이 일정만 자유롭게 수정할 수 있어요. 원본과 이전 대화·찜·저장한 여행은 그대로예요. 실제 예약·회원 게시물은 연결하지 않았어요.`,
    };
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
    if (!entity)
      return { ...s, notice: '추가할 후보를 골라주세요.' };
    if (day < 1 || day > s.days)
      return { ...s, notice: `현재 여행은 DAY ${s.days}까지 있어요.` };
    const p = findPlace(entity.id),
      f = findFood(entity.id),
      h = findStay(entity.id);
    const region = p?.region ?? h?.region ?? f?.region ?? findTripAnchor(f!.placeId)!.region;
    if (!s.region && !s.plan.length) s.region = region as Region;
    if (region !== s.region)
      return {
        ...s,
        notice: '현재 일정과 같은 지역의 후보만 추가할 수 있어요.',
      };
    if (h) {
      if (s.booked)
        return { ...s, notice: '예약한 숙소는 유지할게요. 새 숙소를 추가하지 않았어요.' };
      if (day >= s.days)
        return { ...s, notice: s.days === 1 ? '당일 여행에는 숙박을 넣지 않았어요. 여행 기간을 늘린 뒤 숙소를 추가해 주세요.' : `숙박은 DAY ${s.days - 1}까지 추가할 수 있어요. 숙박할 날짜를 골라주세요.` };
      if (s.plan.some((v) => v.day === day && v.kind === 'stay'))
        return { ...s, notice: '이 날은 이미 숙박이 배치되어 있어요. 해당 숙박 항목에서 교체해 주세요.' };
      if (h.price > s.stayBudget)
        return { ...s, notice: '현재 숙박 예산에 맞는 후보를 골라주세요.' };
      const lastAnchor = s.plan.filter((v) => v.day === day).at(-1)?.anchorId;
      const serial = Math.max(0, ...s.plan.map((v) => Number(v.id.replace('visit-', '')) || 0)) + 1;
      const next = s.plan.findIndex((v) => v.day > day);
      s.plan.splice(next < 0 ? s.plan.length : next, 0, {
        id: `visit-${serial}`, day, kind: 'stay', entityId: h.id,
        anchorId: lastAnchor && h.near.includes(lastAnchor) ? lastAnchor : h.near[0],
        label: '숙박', locked: false,
      });
      s.stayId = h.id;
      s.lodging = true;
      s.activeDay = day;
      s.stage = 'plan';
      s.notice = `DAY ${day}의 비어 있던 숙박만 추가했어요. 다른 일정과 숙박은 그대로예요.`;
      return s;
    }
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
            : entity.kind === 'shop' ? '쇼핑'
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
    const compactQuestion = q.replace(/\s/g, '');
    const courseNames = communityTrips.filter(
      (course) =>
        compactQuestion.includes(course.title.replace(/\s/g, '')) ||
        compactQuestion.includes(course.id),
    );
    const publicIntent =
      /여행자(?:가|들이)?\s*만든|공개\s*(?:여행|코스|일정)|커뮤니티|남이\s*(?:만든|짠)|다른\s*(?:사람|여행자).*(?:만든|짠)/.test(
        q,
      );
    const companionIntent = /다른\s*(?:사람|여행자)(?:이랑|과|랑|와|하고)/.test(
      q,
    );
    const communityRequest =
      publicIntent ||
      (!companionIntent &&
        /다른\s*(?:사람|여행자)/.test(q) &&
        /코스|여행|일정|구경|공개/.test(q) &&
        !/(?:일정|여행).*(?:짜줘|만들어줘)/.test(q));
    const courseCopy =
      /가져와|가져오|가져줘|복사해|복사할|내\s*여행.*(?:담아|옮겨)/.test(q);
    const communityContext =
      communityRequest ||
      courseNames.length > 0 ||
      (before.stage === 'community' &&
        (courseCopy || /코스|제주|서울|바다|초록|전체\s*지역/.test(q)) &&
        !/(?:일정|여행).*(?:짜줘|만들어줘)/.test(q));
    if (communityContext) {
      const browse = {
        ...s,
        stage: 'community' as const,
        communityRegion:
          before.communityRegion === undefined
            ? before.region
            : before.communityRegion,
        communityTheme: before.communityTheme ?? 'all',
      };
      if (/전체\s*지역/.test(q)) browse.communityRegion = null;
      else {const region=REGIONS.find(region=>q.includes(region));if(region)browse.communityRegion=region;}
      if(!courseCopy){const duration=q.match(/(?:([0-6])\s*박\s*)?([1-7])\s*일(?!\s*(?:차|째))|당일/);if(duration)s.communityDays=duration[0]==='당일'?1:Number(duration[2]);}
      if(s.communityDays!==undefined)browse.communityDays=s.communityDays;
      if (/전체\s*(?:코스|분위기)|모든\s*코스/.test(q))
        browse.communityTheme = 'all';
      else if (/바다|해변/.test(q)) browse.communityTheme = 'sea';
      else if (/초록|숲|차밭/.test(q) && !courseCopy)
        browse.communityTheme = 'green';
      if (
        courseCopy &&
        !/방법|어떻게|뜻|설명|가져오지|복사하지|(?:가져|복사).*(?:주지\s*마|하지\s*마|말아|아니)/.test(
          q,
        )
      ) {
        const pool = communityResults(browse),
          course =
            courseNames.length === 1
              ? courseNames[0]
              : ordinal && before.stage === 'community'
                ? pool[ordinal === -1 ? pool.length - 1 : ordinal - 1]
                : undefined;
        if (course)
          return {
            ...reduceTrip(browse, { type: 'copy-community', id: course.id }),
            question: q,
          };
        return {
          ...browse,
          notice:
            '가져올 공개 코스 이름 하나나 목록에 표시된 번호를 말해 주세요. 먼저 코스를 살펴봐도 좋아요.',
        };
      }
      return {
        ...browse,
        notice:
          '다른 여행자의 공개 코스를 둘러보는 제작 예시예요. 실제 회원 게시물은 아직 연결하지 않았어요. 만들던 여행과 담은 곳은 그대로예요.',
      };
    }
    const desiredRegion = /제주/.test(q)
      ? '제주'
      : /서울|성수/.test(q)
        ? '서울'
        : null;
    if (
      desiredRegion &&
      before.region &&
      desiredRegion !== before.region &&
      (before.collectedIds?.length ||
        before.booked ||
        before.plan.some((v) => v.locked))
    )
      return {
        ...copy(before),
        question: q,
        notice:
          '담은 곳과 예약 숙소를 보호하기 위해 다른 지역 일정으로 바꾸지 않았어요. 다른 지역의 새 여행은 대화를 초기화한 뒤 시작해 주세요. 찜과 저장한 여행은 유지돼요.',
      };
    const areas = [
      /동쪽|동부/.test(q) ? 'east' : null,
      /서쪽|서부/.test(q) ? 'west' : null,
      /남쪽|남부|서귀포/.test(q) ? 'south' : null,
    ].filter((area): area is 'east' | 'west' | 'south' => Boolean(area));
    const requestedArea = areas.length === 1 ? areas[0] : undefined;
    const areaPlanRequest =
      /(일정|여행|코스).*(짜|만들|구성|추천)/.test(q) ||
      /\d\s*박\s*\d\s*일/.test(q);
    if (areas.length > 1 && areaPlanRequest)
      return {
        ...copy(before),
        question: q,
        notice:
          '먼저 시작할 권역 하나를 말해 주세요. 예: “제주 동쪽 1박 2일 일정 짜줘”. 여러 권역의 장소를 직접 담아 함께 구성할 수도 있어요.',
      };
    if (
      requestedArea &&
      areaPlanRequest &&
      (desiredRegion === '서울' || (s.region === '서울' && !desiredRegion))
    )
      return {
        ...copy(before),
        question: q,
        notice:
          '동쪽·서쪽·남쪽 구분은 이번 제주 샘플에만 있어요. 제주 여행인지 먼저 말해 주세요.',
      };
    if (
      requestedArea &&
      areaPlanRequest &&
      before.collectedIds?.some(
        (id) => findPlace(collectionAnchor(id))?.area !== requestedArea,
      )
    )
      return {
        ...copy(before),
        question: q,
        notice:
          '담은 곳에는 요청한 권역 밖의 후보가 있어요. 담은 후보와 만들던 여행은 그대로 두었어요. 해당 권역만 구성하려면 담은 곳을 변경하거나 새 대화로 시작해 주세요.',
      };
    if (/담/.test(q) && /방법|어떻게|무슨\s*뜻|설명해/.test(q))
      return finish({ type: 'help' });
    if (
      /담/.test(q) &&
      /담지\s*(?:마|않)|안\s*담|(?:빼|제거|삭제|담아).*(?:주지\s*마|하지\s*마|말아|아니)/.test(
        q,
      )
    )
      return {
        ...s,
        stage: 'collection',
        notice: '담은 후보는 그대로 유지했어요.',
      };
    if (
      /담은\s*(?:곳|후보|장소|목록)|여행에\s*담긴/.test(q) &&
      /빼|제거|삭제/.test(q)
    ) {
      const pool = (before.collectedIds ?? []).map((id) => chatEntity(id)!);
      const target =
        entities.length === 1
          ? entities[0]
          : ordinal
            ? pool[ordinal === -1 ? pool.length - 1 : ordinal - 1]
            : undefined;
      return target
        ? finish({ type: 'uncollect-entity', id: target.id })
        : {
            ...s,
            stage: 'collection',
            notice: '담은 곳에서 뺄 후보 이름 하나나 번호를 말해 주세요.',
          };
    }
    if (
      /담은\s*(?:곳|후보|장소)|여행에\s*담긴/.test(q) &&
      /일정.*(?:짜|만들)|일정으로/.test(q)
    ) {
      const duration = q.match(
        /(\d)\s*박\s*(\d)\s*일(?!정|차)|(\d)\s*일(?!정|차)/,
      );
      if (duration) {
        const days = Number(duration[2] ?? duration[3]);
        if (days < 1 || days > 3)
          return {
            ...s,
            stage: 'collection',
            notice: '이번 체험은 1~3일 여행을 지원해요.',
          };
        s.days = days;
      }
      if (/당일|반나절/.test(q)) s.days = 1;
      const built = makeCollectedPlan(s);
      built.question = q;
      return built;
    }
    if (
      /담은\s*(?:곳|후보|장소|목록)|여행에\s*담긴/.test(q) &&
      /보여|보기|확인|목록/.test(q)
    )
      return finish({ type: 'show', stage: 'collection' });
    const collectionRequest =
      /담아|담기|담을래|담아둘|여행에\s*추가/.test(q) ||
      (!before.plan.length && /추가해/.test(q));
    if (
      collectionRequest &&
      !(before.plan.length && /일정|DAY\s*[1-3]|[1-3]\s*일차/i.test(q))
    ) {
      let ids = entities.map((p) => p.id);
      if (ids.length > 1) {
        const compact = q.replace(/\s/g, '');
        const position = (id: string) => {
          const entity = chatEntity(id)!;
          const literal = compact.indexOf(entity.name.replace(/\s/g, ''));
          return literal >= 0
            ? literal
            : compact.indexOf(
                id === 'hyeopjae' ? '협재' : (placeAliases[id] ?? entity.name),
              );
        };
        ids = ids.sort((a, b) => position(a) - position(b));
      }
      if (!ids.length && ordinal) {
        const pool = chatCandidates(before),
          candidate = pool[ordinal === -1 ? pool.length - 1 : ordinal - 1];
        if (candidate) ids = [candidate.id];
      }
      if (!ids.length) {
        const selected =
          before.stage === 'detail'
            ? before.detailId
            : before.stage === 'food'
              ? before.foodKind === '카페'
                ? before.cafeId
                : before.foodId
              : before.stage === 'stay'
                ? before.stayId
                : before.stage === 'collection'
                  ? before.collectedIds?.at(-1)
                  : before.anchorId;
        if (selected) ids = [selected];
      }
      const result = collectEntities(before, ids);
      result.question = q;
      return result;
    }
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
        : before.stage === 'collection'
          ? chatCandidates(before).filter((p) =>
              /식당|맛집/.test(q)
                ? p.kind === 'food'
                : /카페/.test(q)
                  ? p.kind === 'cafe'
                  : /숙소|숙박/.test(q)
                    ? p.kind === 'stay'
                    : true,
            )
          : /식당|맛집/.test(q)
            ? restaurants
                .filter(
                  (p) => p.placeId === before.anchorId && p.cuisine !== '카페',
                )
                .map((p) => chatEntity(p.id)!)
            : /카페/.test(q)
              ? restaurants
                  .filter(
                    (p) =>
                      p.placeId === before.anchorId && p.cuisine === '카페',
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
          ![
            'food',
            'stay',
            'discover',
            'compare',
            'saved',
            'collection',
          ].includes(before.stage)
            ? visitTargets(before, q)
                .map((v) => chatEntity(v.entityId))
                .filter((v) => Boolean(v))
            : chatCandidates(before);
        id = pool[ordinal === -1 ? pool.length - 1 : ordinal - 1]?.id;
        // visitTargets already applies the explicit ordinal.
        if (
          before.plan.length &&
          pool.length === 1 &&
          ![
            'food',
            'stay',
            'discover',
            'compare',
            'saved',
            'collection',
          ].includes(before.stage)
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
    const mentions = (id: string, name: string) => mentionsEntity(q, id, name);
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
      const namedPlace = places.find((p) => mentionsEntity(q, p.id, p.name));
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
    if (/대전|해외|일본/.test(q))
      return {
        ...s,
        notice:
          '현재 등록한 지역에서 찾아볼 수 있어요. 아래에서 지역을 골라주세요.',
        stage: 'discover',
      };
    const registeredRegion = REGIONS.find(region => q.includes(region));
    if (registeredRegion) { setRegion(registeredRegion); recognized = true; }
    else if (/제주/.test(q)) {
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
      if (days < 1 || days > 7)
        return { ...s, notice: '여행 생성은 1~7일, 생성 후 DAY 편집은 최대 30일을 지원해요.' };
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
    const named = places.find((p) => mentionsEntity(q, p.id, p.name));
    if (requestedArea && areaPlanRequest && !named && !s.collectedIds?.length) {
      const first = places
        .filter((p) => p.region === '제주' && p.area === requestedArea)
        .sort((a, b) =>
          s.theme === 'sea'
            ? Number(/바다|해변|해안/.test(b.tags.join(' ') + b.name)) -
              Number(/바다|해변|해안/.test(a.tags.join(' ') + a.name))
            : s.theme === 'green'
              ? b.mood[0] - a.mood[0]
              : 0,
        )[0];
      if (first) {
        choosePlace(first.id);
        recognized = true;
      }
    }
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
        s.stayBudgetExplicit = true;
        s.stayId = null;
      } else {
        s.foodBudget = value;
        s.foodId = null;
      }
      recognized = true;
    }
    const build =
      /(일정|여행).{0,12}(짜|만들|추천|구성)|일정으로/.test(q) ||
      Boolean(duration && /가고|여행|코스|일정/.test(q)) ||
      Boolean(
        duration &&
        /오전|오후/.test(q) &&
        /장소.{0,12}(?:넣어줘|배치해줘)/.test(q),
      );
    if (build) {
      s = makePlan(s, /찜|저장한 장소/.test(q), requestedArea);
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
  const reordered = applyVisitOrder(session, action);
  if (reordered) return demoteEditedTrip(session, reordered, action);
  const local=applyLocalTripAction(session,action);
  if(local)return local;
  const extended = applyTripExtension(session, action);
  if (extended) return demoteEditedTrip(session,extended,action);
  let originalQuestion: string | undefined;
  if(action.type==='continue-trip'){const saved=recentActiveTrip(session);if(saved){action={type:'open',id:saved.id};originalQuestion='최근 저장 여행 이어가기';}}
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
    return {...createTripSession(
      currentTrip(session).savedIds,
      session.library.map((p) => ({
        ...p,
        visits: p.visits.map((v) => ({ ...v })),
      })),
    ),...(session.offlineTrips?{offlineTrips:session.offlineTrips}:{}),...(session.recentPlanIds?{recentPlanIds:[...session.recentPlanIds]}:{})};
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
        JSON.stringify(now.state.plan) !==
          JSON.stringify(previous.state.plan) ||
        JSON.stringify(now.state.collectedIds ?? []) !==
          JSON.stringify(previous.state.collectedIds ?? []) ||
        now.state.title !== previous.state.title ||
        now.state.startDate !== previous.state.startDate ||
        now.state.days !== previous.state.days
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
        state.collectedIds = [...(prior.collectedIds ?? [])];
        if (
          JSON.stringify(before.collectedIds ?? []) !==
          JSON.stringify(prior.collectedIds ?? [])
        ) {
          state.anchorId = prior.anchorId;
          state.foodId = prior.foodId;
          state.cafeId = prior.cafeId;
          state.stayId = prior.stayId;
          state.foodKind = prior.foodKind;
        }
        state.region = prior.region;
        state.days = prior.days;
        state.title = prior.title;
        state.startDate = prior.startDate;
        state.planStatus = prior.planStatus??'DRAFT';
        state.pendingCandidates = [];
        state.communitySourceId = prior.communitySourceId ?? null;
        state.activeDay = prior.activeDay;
        state.editingId = null;
        state.undoOfTurnId = session.turns[changedIndex].id;
        state.stage = state.plan.length
          ? 'plan'
          : state.collectedIds.length
            ? 'collection'
            : 'discover';
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
    const id = state.savedPlanId && !library.some(p=>p.id === state.savedPlanId && p.deletedAt) ? state.savedPlanId : `trip-${Date.now()}-${session.nextId}`;
    const saved: SavedPlan = {
      id,
      title: state.title?.trim() || `${state.region} ${period(state.days)} 여행`,
      region: state.region,
      days: state.days,
      booked: state.booked,
      status: state.planStatus??'DRAFT',
      activeDay: state.activeDay,
      startDate: state.startDate ?? null,
      communitySourceId: state.communitySourceId ?? null,
      visits: state.plan.map((v) => ({ ...v })),
    };
    library = [...library.filter((p) => p.id !== id), saved];
    state.savedPlanId = id;
    state.stage = 'plan';
    state.question = '이 일정을 내 여행에 저장해줘';
    state.notice =
      '이 기기의 내 여행에 저장했어요. 실제 Spotlog 계정에는 전송하지 않았어요.';
  } else if (action.type === 'open') {
    const saved = library.find((p) => p.id === action.id && !p.deletedAt);
    if (!saved) return session;
    state = {
      ...initialTrip(currentTrip(session).savedIds),
      stage: 'plan',
      region: saved.region,
      days: saved.days,
      planStatus: saved.status??'DRAFT',
      activeDay: saved.visits.find(visit=>!visit.status)?.day??saved.activeDay??1,
      title: saved.title,
      startDate: saved.startDate ?? null,
      plan: saved.visits.map((v) => ({ ...v })),
      booked: saved.booked,
      savedPlanId: saved.id,
      communitySourceId: saved.communitySourceId ?? null,
      question: `${saved.title} 다시 열어줘`,
      anchorId: saved.visits.find((v) => v.kind === 'place')?.entityId ?? null,
    };
  } else state = reduceTrip(currentTrip(session), action);
  if (state === currentTrip(session)) return session;
  if (originalQuestion) state.question = originalQuestion;
  if (commandNotice) state.notice = commandNotice;
  if (state.stage === 'library' || state.stage === 'trash')
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
  return demoteEditedTrip(session,{
    ...session,
    turns: [...session.turns, { id: session.nextId, state, restoredFrom }],
    nextId: session.nextId + 1,
    library,
    ...(['save','open'].includes(action.type)&&state.savedPlanId?{recentPlanIds:[state.savedPlanId,...(session.recentPlanIds??[]).filter(id=>id!==state.savedPlanId)].slice(0,50)}:{}),
  },action);
}
export function explanation(s: TripState) {
  if (s.stage === 'social') return '샘플 커뮤니티를 열었어요. 답글과 평가는 이 기기에 저장돼요.';
  if (s.stage === 'answer') return '다음 질문으로 여행 대화를 이어가세요.';
  if(s.stage==='offline')return s.notice||'이 기기에 저장한 여행 사본이에요. 저장 당시의 일정과 번호 좌표를 확인할 수 있어요.';
  if(s.stage==='media')return s.mediaMode==='motion'?'등록 사진에 확대 효과를 적용한 포토모션이에요. 실제 촬영 영상·VR·생성 동영상은 아니에요.':'등록 자료의 실제 사진을 둘러보고 해당 장소의 상세 정보로 이어갈 수 있어요.';
  if (s.stage === 'community')
    return `공개 여행 코스 ${communityResults(s).length}개를 둘러볼 수 있어요. 다른 여행자의 코스를 보고 내 여행으로 가져오는 흐름을 위한 제작 예시예요. 실제 회원 게시물은 연결 전이고, 만들던 여행과 담은 곳은 그대로 유지돼요.`;
  const place = findPlace(s.anchorId);
  if (s.stage === 'discover')
    return s.similarTo
      ? `${findPlace(s.similarTo)?.name}의 분위기에서 출발해 ${s.region ?? '다른 지역'}의 후보를 찾았어요. 마음에 드는 곳을 고르면 그 주변으로 이어갈게요.`
      : `${s.region ?? REGIONS.join('·')}에서 ${s.theme === 'sea' ? '바다 풍경을 즐길' : s.theme === 'green' ? '초록 풍경을 만날' : '여행을 시작할'} 장소예요. 식당·카페·상점부터 시작해도 돼요.`;
  if (s.stage === 'place')
    return `${place?.name ?? '선택한 장소'} 정보를 살펴보고 있어요. 여행에 담은 뒤 다른 장소와 주변 식당·카페를 계속 고를 수 있어요. 숙소는 원할 때 나중에 골라도 돼요.`;
  if (s.stage === 'collection')
    return (s.collectedIds?.length ?? 0)
      ? `지금 여행에 ${(s.collectedIds ?? []).length}곳을 담았어요. ${place?.name ?? s.region} 주변을 더 찾거나 다른 장소를 계속 담을 수 있어요. 숙박은 선택사항이고, 준비되면 담은 곳만 일정으로 만들어요.`
      : '이번 여행에 갈 곳을 여러 개 모아보세요. 장소·식당·카페를 담아 두고, 원할 때 일정으로 만들 수 있어요. 찜한 장소와는 별도로 관리돼요.';
  if (s.stage === 'food')
    return (s.foodKind === '카페' ? s.cafeId : s.foodId)
      ? `${findFood(s.foodKind === '카페' ? s.cafeId : s.foodId)?.name}을 골랐어요. 여행에 담아 두고 다른 장소·식당·카페를 계속 찾을 수 있어요. 숙소는 지금 고르지 않아도 돼요.`
      : s.businessMode === 'registered' ? `${place ? `${place.name} 주변 직선 ${s.nearbyExpanded ? '15' : '3'}km` : s.region ?? '등록 지역'}의 등록 ${s.foodKind} ${foodResults(s).length}곳이에요. 현재 가격·영업·도보시간은 미확인이에요.${foodResults(s).length ? '' : ' 등록한 후보가 없거나 현재 조건을 검증할 수 없는 경우 자동으로 가상 업체를 채우지 않아요.'}` : `${place?.name ?? '선택 장소'} 주변 ${s.foodKind} ${foodResults(s).length}곳이에요. 도보 범위와 음식 조건을 바꾸면 같은 후보 목록이 바뀝니다.`;
  if (s.stage === 'stay')
    return s.stayId
      ? `${findStay(s.stayId)?.name}을 ${period(s.days)} 여행의 숙소 후보로 골랐어요. 예약을 진행한 것은 아니에요.`
      : `${place?.name ?? s.region}을 중심으로 숙소 ${stayResults(s).length}곳을 비교할 수 있어요.${s.businessMode === 'registered' ? ' 등록 자료의 위치를 사용하며 현재 요금·빈 객실·영업 여부는 미확인이에요.' : ' 표시 금액은 1객실·1박 체험 가격입니다.'}`;
  if (s.stage === 'saved')
    return '찜한 장소를 지역별로 보고 담긴 저장 여행과 DAY를 확인해요. 목록의 지역을 바꿔도 현재 여행은 유지돼요.';
  if (s.stage === 'route')
    return '여행 전체 동선과 선택한 DAY의 상세 일정이에요. 도로 경로가 확인되면 차량 참고 거리·시간을, 확인되지 않으면 방문 순서와 직선거리를 보여줘요.';
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
  if (s.stage === 'trash') return '이 기기에서 삭제한 저장본이에요. 한국시간 달력 기준 6개월 동안 복원할 수 있어요. 현재 편집 중인 여행과 대화는 유지돼요.';
  if (s.stage === 'history')
    return '이전 결과에서 이어갈 수 있어요. 표시된 결과 번호를 말하거나 이어가기 버튼을 눌러 주세요.';
  if (s.stage === 'help')
    return '장소 찾기부터 후보 비교·일정 수정·예산·저장·방문 기록까지 대화로 체험할 수 있어요. 아래 예문을 고르거나 같은 형식으로 질문해 보세요.';
  return s.plan.length
    ? `${s.region} ${period(s.days)}, ${s.plan.length}개의 일정 항목을 정리했어요.${s.booked ? ' 예약한 숙소는 그대로 두었어요.' : ''} DAY를 바꾸거나 필요한 항목만 수정해 보세요.`
    : '아직 만든 일정이 없어요. 장소를 고르거나 지역·기간을 말해주면 초안을 만들게요.';
}
export function nextQuestions(s: TripState): string[] {
  const editable =
    s.plan.find((v) => v.day === s.activeDay && !v.locked) ??
    s.plan.find((v) => !v.locked);
  const editCurrent = editable
    ? `DAY ${editable.day} ${editable.entityId ? visitName(editable) : editable.label} 바꿔줘`
    : '담은 곳 보여줘';
  switch (s.stage) {
    case 'social': return ['일정 다시 보여줘', '다른 여행자가 만든 제주 코스 보여줘'];
    case 'offline': return ['저장한 여행 보여줘','최근 저장 여행 이어가기','일정 다시 보여줘'];
    case 'media': return ['부산 사진 장소 보여줘','다른 등록 장소 찾아줘','일정 다시 보여줘'];
    case 'community':
      return communityResults(s).length
        ? [
            '첫 번째 코스를 내 여행으로 가져와',
            '다른 여행자가 만든 제주 바다 코스 보여줘',
            '다른 여행자가 만든 서울 여행 보여줘',
            '일정 다시 보여줘',
          ]
        : [
            '전체 지역 공개 여행 코스 보여줘',
            '다른 여행자가 만든 제주 여행 보여줘',
            '일정 다시 보여줘',
          ];
    case 'collection':
      return s.collectedIds?.length
        ? [
            '다른 장소 더 찾아줘',
            '여기 근처 식당 찾아줘',
            '여기 근처 카페 찾아줘',
            '담은 곳으로 일정 짜줘',
          ]
        : ['제주에서 바다 볼 만한 곳 찾아줘', '서울에서 장소 찾아줘'];
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
        s.plan.length
          ? '첫 번째 후보 선택해줘'
          : '첫 번째 후보를 여행에 담아줘',
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
            `${chatEntity(s.detailId)?.name} ${s.plan.length ? '선택해줘' : '여행에 담아줘'}`,
            s.plan.length ? '일정 다시 보여줘' : '담은 곳 보여줘',
            '할 수 있는 기능 알려줘',
          ]
        : ['할 수 있는 기능 알려줘'];
    case 'library':
      return [
        '첫 번째 저장한 여행 열어줘',
        '찜한 장소 보여줘',
        '할 수 있는 기능 알려줘',
        '휴지통 보여줘',
      ];
    case 'trash': return ['저장한 여행 보여줘', '일정 다시 보여줘'];
    case 'history':
      return [
        '첫 번째 결과에서 이어갈래',
        '일정 다시 보여줘',
        '할 수 있는 기능 알려줘',
      ];
    case 'discover':
      return [
        '제주에서 바다 볼 만한 곳 찾아줘',
        '서울숲에서 반나절 일정 짜줘',
        '다른 여행자가 만든 제주 여행 보여줘',
      ];
    case 'place':
      return [
        '이 장소를 여행에 담아줘',
        '다른 장소 더 찾아줘',
        '여기 근처 식당 찾아줘',
        '여기 근처 카페 찾아줘',
        '여기 길찾기 해줘',
      ];
    case 'food':
      if (s.businessMode === 'registered') return [`첫 번째 ${s.foodKind} 상세정보 보여줘`, `첫 번째 ${s.foodKind}를 여행에 담아줘`, s.anchorId && !s.nearbyExpanded ? '주변 검색 범위를 직선 15km로 넓혀줘' : '담은 곳 보여줘'];
      return (s.foodKind === '카페' ? s.cafeId : s.foodId)
        ? s.plan.length
          ? [
              `이 ${s.foodKind}를 DAY ${s.activeDay}에 추가해줘`,
              '일정 다시 보여줘',
              '방문 순서 보여줘',
            ]
          : [
              `이 ${s.foodKind}를 여행에 담아줘`,
              '다른 장소 더 찾아줘',
              '여기 근처 카페 찾아줘',
              '담은 곳 보여줘',
            ]
        : s.foodKind === '카페'
          ? ['첫 번째 카페 메뉴 보여줘', '도보 10분 안에서', '담은 곳 보여줘']
          : [
              '첫 번째 식당 메뉴 보여줘',
              '도보 5분 안에서',
              '한식만 보여줘',
              '담은 곳 보여줘',
            ];
    case 'stay':
      if (s.businessMode === 'registered') return ['첫 번째 숙소 상세정보 보여줘', '담은 곳 보여줘', '숙소는 이미 예약했어'];
      return s.stayId
        ? ['이 숙소를 여행에 담아줘', '담은 곳 보여줘', '다른 장소 더 찾아줘']
        : ['숙소 10만원 이하로', '숙소 20만원 이하로', '숙소는 이미 예약했어'];
    case 'saved':
      return [
        '찜한 제주 장소로 1박 2일 일정 짜줘',
        '찜한 서울 장소로 당일 일정 짜줘',
      ];
    case 'route':
      return ['일정 다시 보여줘', editCurrent];
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
        editCurrent,
        '방문 순서 보여줘',
        '근처 카페 찾아줘',
      ];
  }
}
