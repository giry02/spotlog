import {
  appendTrip,
  currentTrip,
  visitName,
  communityResults,
  explanation,
  foodResults,
  nextQuestions,
  placeResults,
  stayResults,
  MAX_COLLECTED_ENTITIES,
  type SavedPlan,
  type Stage,
  type TripAction,
  type TripSession,
  type TripState,
  type Visit,
  type VisitKnowledge,
} from './trip-engine';
import { findFood, findPlace, findStay, places, restaurants, stays, REGIONS, getKnownEntityPrice } from './trip-data';
import { parseExtensionAction, validateVisitExtensions, validateStateExtensions } from './trip-extension-contract';
import { isTripExtension, stayCheckoutExceedsTrip, dayCopyCheckoutExceedsTrip } from './trip-extensions';
import { validateSpotlogOpenAction } from './spotlog-action';
import { findTripAnchor } from './trip-anchor';
import { requestedBusinessCollectionIds } from './business-collection-intent';
import { parseTripLocalAction, validateTripLocalState, validateTripLocalSession } from './trip-local-contract';
import { isTripLocalAction, recentActiveTrip, planCompletionIssue, packageForSavedPlan, offlineStorageBytes, MAX_OFFLINE_PACKAGES, MAX_OFFLINE_BYTES, currentTripOfflineSaveIssue } from './trip-local-features';
import { hasCommunityAuthor, COMMUNITY_TYPES } from './community-discovery';
import { communityTrips } from './community-trips';
import type { RagRetrieval, AnswerContext } from './rag-types';
import { explicitBuildConstraints, explicitBuildVisitViolation, explicitFullDayScheduleNotice } from './chat-constraints';
import { itineraryRequest } from './itinerary-retrieval';
import { namedKnowledgePlaceIds } from './rag-catalog';
import { builtItineraryMessage, existingDayViewMessage, explicitExistingDayView } from './chat-result-summary';
import { regroupExplicitNearbyBuild } from './itinerary-proximity';
import { isWholeDayCopyOnlyRequest } from './trip-edit-intent';
import { reorderDayVisits, reorderTargetDays } from './trip-reorder';
import { mediaActionMatchesRequest, publicCourseCopyTarget } from './local-feature-intent';
import { hasUnsupportedRegisteredBusinessReputation } from './registered-business-grounding';
import { resolveSocialTarget } from './social-target';
import { isSocialFeatureRequest, socialActionMatchesRequest } from './social-intent';

export const CHAT_PROTOCOL_VERSION = 1 as const;
export const MAX_CHAT_REQUEST_BYTES = 1_048_576;
export const MAX_MODEL_RESPONSE_BYTES = 131_072;
export const MAX_SESSION_TURNS = 120;
export const MAX_MODEL_ACTIONS = 4;
export type ChatMode = 'demo' | 'flowise' | 'ollama' | 'large-model' | 'clarify' | 'local-action';
export type ChatRequest = {
  protocolVersion: 1;
  requestId: string;
  sessionId: string;
  baseRevision: number;
  session: TripSession;
  action: TripAction;
};
export type ChatResponse = {
  protocolVersion: 1;
  requestId: string;
  sessionId: string;
  baseRevision: number;
  revision: number;
  mode: ChatMode;
  session: TripSession;
  message: string;
  nextQuestions: string[];
};
export type ModelReply = {
  message: string;
  actions: TripAction[];
  evidenceIds?: string[];
  needsMoreContext?: boolean;
};

export class ChatContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'ChatContractError';
    this.code = code;
    this.status = status;
  }
}

const stages: Stage[] = [
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
  'media',
  'social',
];
const fail = (message = '요청 내용을 확인해 주세요.'): never => {
  throw new ChatContractError('INVALID_REQUEST', message);
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail();
}
function string(value: unknown, max = 2000, nonempty = false): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (nonempty && !value.trim())
  )
    fail();
  return value as string;
}
function id(value: unknown): string {
  const result = string(value, 160, true);
  if (!/^[A-Za-z0-9_-]+$/.test(result)) fail();
  return result;
}
function integer(value: unknown, min: number, max: number): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < min ||
    (value as number) > max
  )
    fail();
  return value as number;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') fail();
  return value as boolean;
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) fail();
  return value as T;
}
function array(value: unknown, max: number, min = 0): unknown[] {
  if (!Array.isArray(value) || value.length > max || value.length < min) fail();
  return value as unknown[];
}
const unique = (values: string[] | number[]) => {
  if (new Set<string | number>(values).size !== values.length) fail();
};
function entity(value: unknown): string {
  const result = id(value);
  if (!findPlace(result) && !findFood(result) && !findStay(result))
    fail('존재하지 않는 장소 또는 업체예요.');
  return result;
}
function entityRegion(entityId: string): string | undefined {
  return (
    findPlace(entityId)?.region ??
    findStay(entityId)?.region ??
    findFood(entityId)?.region ?? findTripAnchor(findFood(entityId)?.placeId ?? null)?.region
  );
}
function place(value: unknown): string {
  const result = id(value);
  if (!findPlace(result)) fail('존재하지 않는 장소예요.');
  return result;
}
function referenceAnchor(value: unknown): string {
  const result = id(value);
  if (!findTripAnchor(result)) fail('기준 위치를 찾을 수 없어요.');
  return result;
}
function communityCourse(value: unknown): string {
  const result = id(value);
  if (!communityTrips.some((course) => course.id === result))
    fail('공개 코스 예시를 찾을 수 없어요.');
  return result;
}
const nullable = (value: unknown, parse: (value: unknown) => unknown) => {
  if (value !== null) parse(value);
};

function validateVisits(
  value: unknown,
  days: number,
  region: unknown,
): Visit[] {
  const visits = array(value, 180).map((item) => {
    const v = object(item);
    keys(v, [
      'id',
      'day',
      'kind',
      'entityId',
      'anchorId',
      'label',
      'locked',
      'status',
      'knowledge',
      'note', 'time', 'durationMinutes', 'nights',
    ]);
    id(v.id);
    integer(v.day, 1, days);
    oneOf(v.kind, ['place', 'food', 'cafe', 'shop', 'stay']);
    validateVisitExtensions(v, fail);
    const anchor = findTripAnchor(referenceAnchor(v.anchorId))!;
    if (region !== null && anchor.region !== region) fail();
    string(v.label, 120);
    boolean(v.locked);
    if (v.locked && v.kind !== 'stay') fail();
    if (v.status !== undefined) oneOf(v.status, ['done', 'skipped']);
    if (v.knowledge !== undefined) {
      if (v.kind !== 'place' || v.entityId === null) fail();
      const knowledge = object(v.knowledge);
      keys(knowledge, ['indexVersion', 'evidenceIds', 'documentIds']);
      string(knowledge.indexVersion, 160, true);
      for (const field of ['evidenceIds', 'documentIds']) {
        const values = array(knowledge[field], 12, 1).map((value) => string(value, 160, true));
        if (values.some((value) => !/^[A-Za-z0-9_.:-]{1,160}$/.test(value))) fail();
        unique(values);
      }
    }
    if (v.entityId !== null) {
      const entityId = entity(v.entityId);
      if (v.kind === 'place' && !findPlace(entityId)) fail();
      if (v.kind === 'stay' && !findStay(entityId)) fail();
      if (
        v.kind === 'food' &&
        (!findFood(entityId) || findFood(entityId)?.cuisine === '카페')
      )
        fail();
      if (v.kind === 'cafe' && findFood(entityId)?.cuisine !== '카페') fail();
      if (v.kind === 'shop' && String(findFood(entityId)?.cuisine) !== '상점') fail();
      if (v.kind === 'food' && String(findFood(entityId)?.cuisine) === '상점') fail();
      const itemRegion =
        findPlace(entityId)?.region ??
        findStay(entityId)?.region ??
        findFood(entityId)?.region ?? findTripAnchor(findFood(entityId)?.placeId ?? null)?.region;
      if (region !== null && itemRegion !== region) fail();
    }
    return v as unknown as Visit;
  });
  unique(visits.map((v) => v.id));
  return visits;
}
function validateLibrary(value: unknown): SavedPlan[] {
  const plans = array(value, 50).map((item) => {
    const p = object(item);
    keys(p, [
      'id',
      'title',
      'region',
      'days',
      'visits',
      'booked',
      'communitySourceId',
      'startDate', 'deletedAt', 'purgeAfter',
      'status', 'activeDay',
    ]);
    id(p.id);
    string(p.title, 200, true);
    oneOf(p.region, REGIONS);
    integer(p.days, 1, 30);
    validateStateExtensions({ startDate: p.startDate }, fail);
    if ((p.deletedAt === undefined) !== (p.purgeAfter === undefined)) fail();
    for (const field of ['deletedAt', 'purgeAfter']) if (p[field] !== undefined && (typeof p[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(p[field] as string) || !Number.isFinite(Date.parse(p[field] as string)))) fail();
    if (p.deletedAt && Date.parse(p.purgeAfter as string) <= Date.parse(p.deletedAt as string)) fail();
    boolean(p.booked);
    if(p.status!==undefined)oneOf(p.status,['DRAFT','READY']);
    if(p.activeDay!==undefined)integer(p.activeDay,1,p.days as number);
    if (p.communitySourceId !== undefined)
      nullable(p.communitySourceId, communityCourse);
    const visits=validateVisits(p.visits, p.days as number, p.region);
    if(p.status==='READY'&&(!visits.length||visits.some(visit=>!visit.entityId&&!visit.locked)))fail('작성 완료 여행에 미정 방문이 남아 있어요.');
    return p as unknown as SavedPlan;
  });
  unique(plans.map((p) => p.id));
  return plans;
}
function validateState(value: unknown): TripState {
  const s = object(value);
  keys(s, [
    'stage',
    'question',
    'notice',
    'region',
    'days',
    'theme',
    'similarTo',
    'anchorId',
    'foodId',
    'cafeId',
    'stayId',
    'foodKind',
    'cuisine',
    'walk',
    'foodBudget',
    'stayBudget',
    'booked',
    'meals',
    'cafes',
    'lodging',
    'savedIds',
    'collectedIds',
    'plan',
    'editingId',
    'activeDay',
    'savedPlanId',
    'directionsVisitId',
    'directionsPlaceId',
    'directionsBusinessId',
    'comparisonIds',
    'detailId',
    'budgetPeople',
    'budgetRooms',
    'undoOfTurnId',
    'librarySnapshot',
    'historySnapshot',
    'communitySourceId',
    'communityRegion',
    'communityTheme',
    'title','startDate','pendingCandidates','businessMode','nearbyExpanded','stayBudgetExplicit','spotlogNavigation','socialTarget','socialView',
    'planStatus','savedRegion','offlinePackageId','communityQuery','communityType','communityDays','communityAuthorId','mediaMode','mediaRegion','mediaKind',
  ]);
  oneOf(s.stage, stages);
  string(s.question, 2000);
  string(s.notice, 4000);
  nullable(s.region, (v) => oneOf(v, REGIONS));
  integer(s.days, 1, 30);
  validateStateExtensions(s, fail);
  validateTripLocalState(s,fail);
  if (s.nearbyExpanded !== undefined) boolean(s.nearbyExpanded);
  if (s.stayBudgetExplicit !== undefined) boolean(s.stayBudgetExplicit);
  if (s.spotlogNavigation !== undefined) { if (!validateSpotlogOpenAction({ type:'open_spotlog', ...object(s.spotlogNavigation) })) fail(); }
  if (s.socialTarget !== undefined && !resolveSocialTarget(s.socialTarget)) fail();
  if (s.socialView !== undefined) oneOf(s.socialView, ['overview', 'threads', 'reactions']);
  if (s.stage === 'social' && !resolveSocialTarget(s.socialTarget)) fail();
  integer(s.activeDay, 1, s.days as number);
  oneOf(s.theme, ['all', 'sea', 'green']);
  nullable(s.similarTo, place);
  nullable(s.anchorId, referenceAnchor);
  nullable(s.foodId, (v) => {
    if (!findFood(id(v)) || findFood(id(v))?.cuisine === '카페') fail();
  });
  nullable(s.cafeId, (v) => {
    if (findFood(id(v))?.cuisine !== '카페') fail();
  });
  nullable(s.stayId, (v) => {
    if (!findStay(id(v))) fail();
  });
  oneOf(s.foodKind, ['식당', '카페', '상점']);
  oneOf(s.cuisine, ['전체', '한식', '양식']);
  integer(s.walk, 1, 20);
  nullable(s.foodBudget, (v) => integer(v, 1, 1_000_000));
  integer(s.stayBudget, 1, 1_000_000);
  for (const key of ['booked', 'meals', 'cafes', 'lodging']) boolean(s[key]);
  const savedIds = array(s.savedIds, 20).map(place);
  unique(savedIds);
  if (s.collectedIds !== undefined) {
    const collectedIds = array(s.collectedIds, MAX_COLLECTED_ENTITIES).map(
      entity,
    );
    unique(collectedIds);
    const collectedRegions = new Set(collectedIds.map(entityRegion));
    if (
      collectedRegions.size > 1 ||
      (s.region !== null &&
        collectedIds.some((itemId) => entityRegion(itemId) !== s.region))
    )
      fail('담은 장소와 업체는 같은 지역이어야 해요.');
  }
  const visits = validateVisits(s.plan, s.days as number, s.region);
  const visitId = (v: unknown) => {
    if (!visits.some((visit) => visit.id === id(v))) fail();
  };
  nullable(s.editingId, visitId);
  nullable(s.savedPlanId, id);
  if (s.directionsVisitId !== undefined) nullable(s.directionsVisitId, visitId);
  if (s.directionsPlaceId !== undefined) nullable(s.directionsPlaceId, referenceAnchor);
  if (s.directionsBusinessId !== undefined)
    nullable(s.directionsBusinessId, (v) => {
      const itemId = id(v);
      if (!findFood(itemId) && !findStay(itemId)) fail();
    });
  if (s.comparisonIds !== undefined) {
    const ids = array(s.comparisonIds, 3).map(entity);
    unique(ids);
  }
  if (s.detailId !== undefined) nullable(s.detailId, entity);
  if (s.communitySourceId !== undefined)
    nullable(s.communitySourceId, communityCourse);
  if (s.communityRegion !== undefined)
    nullable(s.communityRegion, (value) => oneOf(value, REGIONS));
  if (s.communityTheme !== undefined)
    oneOf(s.communityTheme, ['all', 'sea', 'green']);
  if(s.communityQuery!==undefined)string(s.communityQuery,120);
  if(s.communityType!==undefined)oneOf(s.communityType,COMMUNITY_TYPES);
  if(s.communityDays!==undefined)nullable(s.communityDays,value=>integer(value,1,7));
  if(s.communityAuthorId!==undefined)nullable(s.communityAuthorId,value=>{if(!hasCommunityAuthor(id(value)))fail();});
  if(s.mediaMode!==undefined)oneOf(s.mediaMode,['photos','motion']);
  if(s.mediaRegion!==undefined)nullable(s.mediaRegion,value=>oneOf(value,REGIONS));
  if(s.mediaKind!==undefined)oneOf(s.mediaKind,['all','LANDMARK','FOOD','CAFE','SHOP','STAY']);
  if (s.budgetPeople !== undefined) integer(s.budgetPeople, 1, 20);
  if (s.budgetRooms !== undefined) integer(s.budgetRooms, 1, 10);
  if (s.undoOfTurnId !== undefined) integer(s.undoOfTurnId, 1, 1_000_000);
  if (s.librarySnapshot !== undefined) validateLibrary(s.librarySnapshot);
  if (s.historySnapshot !== undefined) {
    const rows = array(s.historySnapshot, MAX_SESSION_TURNS).map((item) => {
      const row = object(item);
      keys(row, ['id', 'question']);
      integer(row.id, 1, 1_000_000);
      string(row.question, 2000);
      return row.id as number;
    });
    unique(rows);
  }
  return s as unknown as TripState;
}

export function parseTripSession(value: unknown): TripSession {
  const s = object(value);
  keys(s, ['turns', 'nextId', 'library','offlineTrips','recentPlanIds']);
  const turns = array(s.turns, MAX_SESSION_TURNS, 1);
  const ids = turns.map((item) => {
    const t = object(item);
    keys(t, [
      'id',
      'state',
      'restoredFrom',
      'assistantMessage',
      'source',
      'retrieval',
      'evidenceIds',
      'answerContext',
    ]);
    const turnId = integer(t.id, 1, 1_000_000);
    validateState(t.state);
    if (t.restoredFrom !== undefined) integer(t.restoredFrom, 1, turnId - 1);
    if (t.assistantMessage !== undefined) string(t.assistantMessage, 4000);
    if (t.source !== undefined)
      oneOf(t.source, ['demo', 'flowise', 'ollama', 'large-model', 'clarify', 'local-action']);
    if (t.answerContext !== undefined) {
      const context = object(t.answerContext);
      keys(context, ['retrievalStatus', 'weather', 'modelRouting']);
      oneOf(context.retrievalStatus, ['available', 'empty', 'unavailable', 'not-needed', 'disabled']);
      if (context.modelRouting !== undefined) {
        const routing = object(context.modelRouting);
        keys(routing, ['tier', 'provider', 'model', 'reason', 'status']);
        oneOf(routing.tier, ['local', 'large']);
        string(routing.provider, 80, true);
        if (routing.model !== undefined) string(routing.model, 160, true);
        oneOf(routing.reason, ['rag-insufficient', 'primary-failed', 'primary']);
        oneOf(routing.status, ['ready', 'unavailable', 'not-configured']);
      }
      if (context.weather !== undefined) {
        const weather = object(context.weather);
        keys(weather, ['status', 'retrievedAt', 'location', 'dates']);
        oneOf(weather.status, ['ready', 'asked-location', 'unsupported-location', 'unsupported-date', 'unavailable']);
        if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(string(weather.retrievedAt, 40))) fail();
        if (weather.location !== undefined) string(weather.location, 100);
        if (weather.dates !== undefined) for (const date of array(weather.dates, 7)) if (!/^\d{4}-\d{2}-\d{2}$/.test(string(date, 10))) fail();
      }
    }
    if (t.evidenceIds !== undefined) {
      for (const id of array(t.evidenceIds, 12)) string(id, 160);
    }
    if (t.retrieval !== undefined) {
      const retrieval = object(t.retrieval);
      keys(retrieval, [
        'dataMode',
        'indexVersion',
        'embeddingModel',
        'results',
      ]);
      oneOf(retrieval.dataMode, ['authored-demo-data', 'curated-travel-data']);
      string(retrieval.indexVersion, 160);
      string(retrieval.embeddingModel, 160);
      for (const raw of array(retrieval.results, 12)) {
        const evidence = object(raw);
        keys(evidence, [
          'evidenceId',
          'placeId',
          'documentId',
          'chunkId',
          'sourceVersion',
          'text',
          'sourceKind',
          'title',
          'sourceUrl',
          'checkedAt',
        ]);
        oneOf(evidence.sourceKind, ['authored-demo-data', 'curated-official-summary']);
        // These are historical snapshots, not fresh authorized RAG material.
        // Editing/removing a source must not make an old conversation unusable.
        if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(string(evidence.placeId, 160))) fail();
        if (evidence.title !== undefined) string(evidence.title, 200);
        if (evidence.checkedAt !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(string(evidence.checkedAt, 10))) fail();
        if (evidence.sourceUrl !== undefined) {
          try {
            const url = new URL(string(evidence.sourceUrl, 2048));
            if (url.protocol !== 'https:' || url.username || url.password) fail();
          } catch { fail(); }
        }
        for (const field of [
          'evidenceId',
          'documentId',
          'chunkId',
          'sourceVersion',
        ])
          string(evidence[field], 160);
        const text = string(evidence.text, 4000);
        if (/<\/?[a-z][^>]*>|https?:\/\//i.test(text)) fail();
      }
      if (
        Array.isArray(t.evidenceIds) &&
        t.evidenceIds.some(
          (id) =>
            !(retrieval.results as { evidenceId: string }[]).some(
              (e) => e.evidenceId === id,
            ),
        )
      )
        fail();
    } else if (t.evidenceIds !== undefined) fail();
    return turnId;
  });
  if (ids.some((value, index) => index > 0 && value <= ids[index - 1])) fail();
  integer(s.nextId, ids[ids.length - 1] + 1, 1_000_001);
  validateLibrary(s.library);
  validateTripLocalSession(s,validateVisits,fail);
  return s as unknown as TripSession;
}

export function revisionOf(session: TripSession): number {
  return session.turns[session.turns.length - 1].id;
}

/** Parse fields first. Contextual checks run immediately before each tool executes. */
export function parseTripAction(value: unknown): TripAction {
  const a = object(value);
  string(a.type, 40, true);
  const local=parseTripLocalAction(a,fail);
  if(local)return local;
  const extension = parseExtensionAction(a, fail);
  if (extension) return extension;
  switch (a.type) {
    case 'social':
      keys(a, ['type', 'target', 'view']);
      if (!resolveSocialTarget(a.target)) fail();
      if (a.view !== undefined) oneOf(a.view, ['overview', 'threads', 'reactions']);
      break;
    case 'open_spotlog':
      if (!validateSpotlogOpenAction(a)) fail();
      break;
    case 'media':
      keys(a,['type','mode','region','kind']);oneOf(a.mode,['photos','motion']);
      if(a.region!==undefined)nullable(a.region,value=>oneOf(value,REGIONS));
      if(a.kind!==undefined)oneOf(a.kind,['all','LANDMARK','FOOD','CAFE','SHOP','STAY']);
      break;
    case 'message':
      keys(a, ['type', 'text']);
      string(a.text, 2000, true);
      break;
    case 'place':
    case 'bookmark':
      keys(a, a.type === 'bookmark' ? ['type', 'id', 'saved'] : ['type', 'id']);
      place(a.id);
      if (a.saved !== undefined) boolean(a.saved);
      break;
    case 'food':
      keys(a, ['type', 'id']);
      if (!findFood(id(a.id))) fail();
      break;
    case 'stay':
      keys(a, ['type', 'id']);
      if (!findStay(id(a.id))) fail();
      break;
    case 'show':
      keys(a, ['type', 'stage', 'kind', 'day']);
      oneOf(a.stage, stages);
      if (a.kind !== undefined) oneOf(a.kind, ['식당', '카페', '상점']);
      if (a.day !== undefined) integer(a.day, 1, 30);
      break;
    case 'region':
      keys(a, ['type', 'region']);
      oneOf(a.region, REGIONS);
      break;
    case 'walk':
      keys(a, ['type', 'value']);
      integer(a.value, 1, 20);
      break;
    case 'cuisine':
      keys(a, ['type', 'value']);
      oneOf(a.value, ['전체', '한식', '양식']);
      break;
    case 'stay-budget':
      keys(a, ['type', 'value']);
      integer(a.value, 1, 1_000_000);
      break;
    case 'build':
      keys(a, ['type', 'savedOnly', 'visits']);
      if (a.savedOnly !== undefined) boolean(a.savedOnly);
      if (a.visits !== undefined) {
        const visits = array(a.visits, 14, 1).map((raw) => {
          const visit = object(raw);
          keys(visit, ['day', 'placeId']);
          integer(visit.day, 1, 7);
          return place(visit.placeId);
        });
        unique(visits);
      }
      break;
    case 'day':
      keys(a, ['type', 'day']);
      integer(a.day, 1, 30);
      break;
    case 'edit':
    case 'remove':
    case 'open':
      keys(a, ['type', 'id']);
      id(a.id);
      break;
    case 'move':
      keys(a, ['type', 'id', 'direction']);
      id(a.id);
      if (a.direction !== -1 && a.direction !== 1) fail();
      break;
    case 'reorder-visits':
      keys(a, ['type', 'day', 'ids']);
      integer(a.day, 1, 30);
      unique(array(a.ids, 180, 1).map(id));
      break;
    case 'directions':
      keys(a, ['type', 'id', 'placeId', 'businessId']);
      if (
        [a.id, a.placeId, a.businessId].filter((v) => v !== undefined).length >
        1
      )
        fail();
      if (a.id !== undefined) id(a.id);
      if (a.placeId !== undefined) place(a.placeId);
      if (
        a.businessId !== undefined &&
        !findFood(id(a.businessId)) &&
        !findStay(id(a.businessId))
      )
        fail();
      break;
    case 'progress':
      keys(a, ['type', 'id', 'status']);
      id(a.id);
      oneOf(a.status, ['done', 'skipped', 'pending']);
      break;
    case 'resume':
      keys(a, ['type', 'id']);
      integer(a.id, 1, 1_000_000);
      break;
    case 'compare':
      keys(a, ['type', 'ids']);
      if (a.ids !== undefined) unique(array(a.ids, 3, 2).map(entity));
      break;
    case 'budget':
      keys(a, ['type', 'people', 'rooms']);
      if (a.people !== undefined) integer(a.people, 1, 20);
      if (a.rooms !== undefined) integer(a.rooms, 1, 10);
      break;
    case 'detail':
      keys(a, ['type', 'id']);
      if (a.id !== undefined) entity(a.id);
      break;
    case 'transfer':
      keys(a, ['type', 'id', 'day']);
      id(a.id);
      integer(a.day, 1, 30);
      break;
    case 'select-entity':
    case 'collect-entity':
    case 'uncollect-entity':
      keys(a, ['type', 'id']);
      entity(a.id);
      break;
    case 'copy-community':
      keys(a, ['type', 'id']);
      communityCourse(a.id);
      break;
    case 'community-filter':
      keys(a, ['type', 'region', 'theme','query','contentType','days','authorId']);
      if (Object.keys(a).length === 1) fail();
      if (a.region !== undefined)
        nullable(a.region, (value) => oneOf(value, REGIONS));
      if (a.theme !== undefined) oneOf(a.theme, ['all', 'sea', 'green']);
      if(a.query!==undefined)string(a.query,120);
      if(a.contentType!==undefined)oneOf(a.contentType,COMMUNITY_TYPES);
      if(a.days!==undefined)nullable(a.days,value=>integer(value,1,7));
      if(a.authorId!==undefined)nullable(a.authorId,value=>{if(!hasCommunityAuthor(id(value)))fail();});
      break;
    case 'add-entity':
      keys(a, ['type', 'id', 'day']);
      entity(a.id);
      if (a.day !== undefined) integer(a.day, 1, 30);
      break;
    case 'add-selected':
    case 'save':
    case 'check':
    case 'library':
    case 'help':
    case 'history':
    case 'undo':
    case 'reset':
      keys(a, ['type']);
      break;
    case 'configure':
      keys(a, [
        'type',
        'days',
        'theme',
        'foodBudget',
        'booked',
        'meals',
        'cafes',
        'lodging',
        'businessMode',
        'nearbyExpanded',
      ]);
      if (Object.keys(a).length === 1) fail();
      if (a.days !== undefined) integer(a.days, 1, 7);
      if (a.businessMode !== undefined) oneOf(a.businessMode, ['registered','demo']);
      if (a.nearbyExpanded !== undefined) boolean(a.nearbyExpanded);
      if (a.theme !== undefined) oneOf(a.theme, ['all', 'sea', 'green']);
      if (a.foodBudget !== undefined)
        nullable(a.foodBudget, (v) => integer(v, 1, 1_000_000));
      for (const key of ['booked', 'meals', 'cafes', 'lodging'])
        if (a[key] !== undefined) boolean(a[key]);
      break;
    default:
      fail('지원하지 않는 기능 요청이에요.');
  }
  return a as unknown as TripAction;
}

export function parseChatRequest(value: unknown): ChatRequest {
  const body = object(value);
  keys(body, [
    'protocolVersion',
    'requestId',
    'sessionId',
    'baseRevision',
    'session',
    'action',
  ]);
  if (body.protocolVersion !== CHAT_PROTOCOL_VERSION)
    fail('대화 프로토콜 버전을 확인해 주세요.');
  id(body.requestId);
  id(body.sessionId);
  const session = parseTripSession(body.session);
  const baseRevision = integer(body.baseRevision, 1, 1_000_000);
  if (baseRevision !== revisionOf(session)) {
    throw new ChatContractError(
      'REVISION_MISMATCH',
      '현재 대화와 요청의 기준이 달라요. 다시 시도해 주세요.',
      409,
    );
  }
  const action = parseTripAction(body.action);
  validateActionContext(action, session, false);
  return {
    protocolVersion: 1,
    requestId: body.requestId as string,
    sessionId: body.sessionId as string,
    baseRevision,
    session,
    action,
  };
}

const modelActionTypes = new Set([
  'place',
  'bookmark',
  'food',
  'stay',
  'show',
  'region',
  'walk',
  'cuisine',
  'stay-budget',
  'build',
  'day',
  'add-selected',
  'edit',
  'remove',
  'move',
  'directions',
  'progress',
  'save',
  'open',
  'compare',
  'budget',
  'check',
  'detail',
  'library',
  'help',
  'history',
  'transfer',
  'add-entity',
  'select-entity',
  'configure',
  'collect-entity',
  'uncollect-entity',
  'copy-community',
  'community-filter',
  'trip-meta','visit-details','stay-placement','day-add','day-copy','day-delete','visit-copy','candidate-propose','candidate-select','candidate-apply','candidate-reject','trash-list','trash','restore','open_spotlog','social',
  'saved-filter','plan-status','continue-trip','offline-save','offline-open','offline-remove','offline-library','media',
  'reorder-visits',
]);
export function parseModelReply(value: unknown): ModelReply {
  try {
    const reply = object(value);
    keys(reply, ['message', 'actions', 'evidenceIds', 'needsMoreContext']);
    const message = string(reply.message, 4000, true);
    if (
      /<\/?[a-z][^>]*>/i.test(message) ||
      /(?:https?:\/\/|javascript:|data:)/i.test(message)
    )
      fail();
    const actions = array(reply.actions, MAX_MODEL_ACTIONS).map(
      parseTripAction,
    );
    if (reply.needsMoreContext !== undefined) boolean(reply.needsMoreContext);
    if (actions.some((a) => !modelActionTypes.has(a.type))) fail();
    const evidenceIds =
      reply.evidenceIds === undefined
        ? undefined
        : array(reply.evidenceIds, 12).map((id) => string(id, 160));
    if (
      evidenceIds &&
      (new Set(evidenceIds).size !== evidenceIds.length ||
        evidenceIds.some((id) => !/^[A-Za-z0-9_.:-]{1,160}$/.test(id)))
    )
      fail();
    return {
      message,
      actions,
      ...(evidenceIds === undefined ? {} : { evidenceIds }),
      ...(reply.needsMoreContext === undefined ? {} : { needsMoreContext: reply.needsMoreContext as boolean }),
    };
  } catch {
    throw new ChatContractError(
      'MODEL_OUTPUT_INVALID',
      '챗봇의 기능 응답 형식이 올바르지 않아 화면을 유지했어요.',
      502,
    );
  }
}

function currentEntityIds(s: TripState): Set<string> {
  return new Set([
    ...placeResults(s).map((p) => p.id),
    ...foodResults(s).map((p) => p.id),
    ...stayResults(s).map((p) => p.id),
    ...s.savedIds,
    ...s.plan.flatMap((v) => (v.entityId ? [v.entityId] : [])),
    ...[s.anchorId, s.foodId, s.cafeId, s.stayId, s.detailId].filter(
      (v): v is string => Boolean(v),
    ),
    ...(s.comparisonIds ?? []),
    ...(s.collectedIds ?? []),
  ]);
}

/** Names only bound a model action's authority; this never creates actions. */
export function namedBusinessCollectionCandidates(
  request: Pick<ChatRequest, 'action'>,
  state: TripState,
) {
  if (request.action.type !== 'message') return [];
  const text = request.action.text.replace(/\s+/g, '');
  const requested = requestedBusinessCollectionIds(text,[...restaurants.map(item=>({id:item.id,name:item.name,kind:item.cuisine==='카페'?'cafe' as const:String(item.cuisine)==='상점'?'shop' as const:'food' as const})),...stays.map(item=>({id:item.id,name:item.name,kind:'stay' as const}))]);
  const food = restaurants.filter(item => requested.includes(item.id)).map(item => ({
    id: item.id, name: item.name, kind: item.cuisine === '카페' ? 'cafe' : String(item.cuisine) === '상점' ? 'shop' : 'food', registered: Boolean(item.registered),
    anchorId: item.placeId, region: item.region ?? findTripAnchor(item.placeId)!.region,
    eligible: (item.region ?? findTripAnchor(item.placeId)!.region) === state.region && foodResults({
      ...state, anchorId: item.placeId, foodKind: item.cuisine === '카페' ? '카페' : String(item.cuisine) === '상점' ? '상점' : '식당',
    }).some(candidate => candidate.id === item.id),
  }));
  const hotels = stays.filter(item => requested.includes(item.id)).map(item => ({
    id: item.id, name: item.name, kind: 'stay', anchorId: item.near[0], region: item.region, registered: Boolean(item.registered),
    eligible: !state.booked && stayResults({ ...state, anchorId: item.near[0] }).some(candidate => candidate.id === item.id),
  }));
  return [...food, ...hotels].sort((a,b)=>requested.indexOf(a.id)-requested.indexOf(b.id));
}

/** Reads the one current-plan landmark explicitly named for a food browse. */
export function namedNearbyFoodAnchor(request: Pick<ChatRequest, 'action' | 'session'>) {
  if (request.action.type !== 'message') return;
  const state = currentTrip(request.session), text = request.action.text.normalize('NFKC').replace(/\s+/g, '');
  if (!state.region || !state.plan.length || /방법|어떻게|설명|가능|할수있|추가해|넣어|담아|교체|바꿔|변경해|수정해|삭제해|지워줘|옮겨|이동해|저장해|복사해|만들어|짜줘|말고|제외|대신/.test(text)) return;
  const named = places.filter(place => text.includes(place.name.normalize('NFKC').replace(/\s+/g, '')));
  if (named.length !== 1 || named[0].region !== state.region ||
      !state.plan.some(visit => visit.kind === 'place' && visit.entityId === named[0].id)) return;
  const place = named[0], name = place.name.normalize('NFKC').replace(/\s+/g, '');
  if (namedKnowledgePlaceIds(text.replaceAll(name, '')).length) return;
  const clause = request.action.text.split(/[.!?。\n]/).map(part => part.normalize('NFKC').replace(/\s+/g, '')).find(part => part.includes(name));
  if (!clause || !/(?:주변|근처).{0,12}(?:식당|음식점|맛집)/.test(clause) ||
      !/보여줘|보여주세요|찾아줘|찾아주세요|열어줘|열어주세요|추천해줘|추천해주세요/.test(clause) ||
      /카페|상점|숙소|과|와|랑|및|하고|[,·]/.test(clause.replaceAll(name, '')) ||
      /보여주지|보여주면안|보여주지는|찾지|찾아주지|열지|열어주지|추천하지|안보여|안찾|안열|안추천/.test(clause)) return;
  return { id: place.id, name: place.name, kind: '식당' as const };
}

/** Distinguishes one named visit on a stated DAY from deleting the DAY itself. */
export function namedVisitRemovalScope(request: Pick<ChatRequest, 'action' | 'session'>) {
  if (request.action.type !== 'message') return;
  const state = currentTrip(request.session), text = request.action.text.normalize('NFKC').replace(/\s+/g, '');
  if (!state.plan.length || /방법|어떻게|설명|가능|할수있|복사|추가해|넣어|교체|바꿔|변경해|수정해|여행명|여행이름|여행제목|출발일|시작일|저장해|말고|대신|제외/.test(text)) return;
  const clauses = request.action.text.split(/[.!?。\n]/).map(part => part.normalize('NFKC').replace(/\s+/g, ''));
  const named = state.plan.filter(visit => {
    const name = visitName(visit).normalize('NFKC').replace(/\s+/g, '');
    return clauses.some(clause => clause.includes(name) && /빼줘|빼주세요|삭제해줘|삭제해주세요|제거해줘|제거해주세요|지워줘|지워주세요/.test(clause) &&
      !/빼지|빼주지|삭제하지|삭제해주지|제거하지|지우지|지워주지|안빼|안삭제|안제거|안지워/.test(clause) &&
      !/과|와|랑|및|하고|[,·]/.test(clause.replaceAll(name, '')));
  });
  if (!named.length) return;
  const days = [...text.matchAll(/(?:DAY|데이)(\d{1,2})(?!\d)|(?<!\d)(\d{1,2})일차/gi)];
  const day = days.length === 1 ? Number(days[0][1] ?? days[0][2]) : undefined;
  const targets = day && day <= state.days ? named.filter(visit => visit.day === day).map(visit => ({ id: visit.id, day: visit.day, name: visitName(visit), locked: visit.locked })) : [];
  return { day, targets };
}

/** Bounds an explicit single catalog addition; the model still chooses its action. */
export function namedItineraryAdditionScope(request: Pick<ChatRequest, 'action' | 'session'>, state = currentTrip(request.session)) {
  if (request.action.type !== 'message' || !state.region || !state.plan.length) return;
  const text = request.action.text.normalize('NFKC').replace(/\s+/g, '');
  if (/메모|체류|시각|시간|여행이름|여행제목|여행명|출발일|시작일|복사|교체|바꿔|바꾸|수정|삭제|제거|지워|옮겨|이동|저장|새로|새관광지|만들|짜|계획|찜|수집|담은목록|후보|비교|방법|어떻게|설명|가능|할수있|알려|말고|제외|대신|빼고/.test(text)) return;
  const dayMatches = [...text.matchAll(/(?:DAY|데이)(\d{1,2})|(\d{1,2})일차/gi)];
  if (dayMatches.length !== 1) return;
  const day = Number(dayMatches[0][1] ?? dayMatches[0][2]);
  if (day < 1 || day > state.days) return;
  const catalog = [
    ...places.map(item => ({ id: item.id, name: item.name, kind: 'place' as const, region: item.region, registered: Boolean(item.registered) })),
    ...restaurants.map(item => ({ id: item.id, name: item.name, kind: item.cuisine === '카페' ? 'cafe' as const : String(item.cuisine) === '상점' ? 'shop' as const : 'food' as const, region: item.region ?? findTripAnchor(item.placeId)?.region, registered: Boolean(item.registered) })),
    ...stays.map(item => ({ id: item.id, name: item.name, kind: 'stay' as const, region: item.region, registered: Boolean(item.registered) })),
  ];
  const named = catalog.filter(item => text.includes(item.name.normalize('NFKC').replace(/\s+/g, '')));
  if (named.length !== 1 || named[0].region !== state.region) return;
  const item = named[0], name = item.name.normalize('NFKC').replace(/\s+/g, '');
  if (namedKnowledgePlaceIds(text.replaceAll(name, '')).length) return;
  const clause = request.action.text.split(/[.!?。\n]/).map(part => part.normalize('NFKC').replace(/\s+/g, '')).find(part => part.includes(name));
  if (!clause || /과|와|랑|및|하고|[,·]/.test(clause.replaceAll(name, '')) || !/추가해(?:줘|주세요)?|넣어(?:줘|주세요)?/.test(clause) ||
      /추가하지|추가해주지|추가(?:는|를)?안|안추가|넣지|넣어주지|안넣|추가해(?:주)?면안(?:돼|되|됩)/.test(clause)) return;
  const food = findFood(item.id), hotel = findStay(item.id);
  const existingStay = hotel ? state.plan.find(visit => visit.kind === 'stay' && visit.day === day) : undefined;
  const eligible = !existingStay && (food ? foodResults({ ...state, anchorId: food.placeId, foodKind: item.kind === 'cafe' ? '카페' : item.kind === 'shop' ? '상점' : '식당' }).some(candidate => candidate.id === item.id)
    : hotel ? !state.booked && stayResults({ ...state, anchorId: hotel.near[0] }).some(candidate => candidate.id === item.id)
    : true);
  return { day, existingStay: existingStay ? { id: existingStay.id, name: visitName(existingStay), day: existingStay.day } : undefined, candidate: { ...item, fictional: item.kind !== 'place' && !item.registered, eligible },
    instruction: existingStay ? `DAY ${day}에는 ${visitName(existingStay)} 숙박이 이미 배치되어 있어 새 숙소를 추가하거나 교체하지 않았다. actions:[]로 기존 숙박 유지를 정확히 안내한다.` : eligible ? '명시한 한 항목만 해당 DAY에 추가한다. 기존 숙박·중복·예약 보호는 서버가 그대로 검사한다.'
      : '현재 등록/체험 업체 모드 또는 예산·음식·도보·예약 조건에 맞지 않는다. 조건을 자동 변경하지 않고 필요한 확인만 질문한다.' };
}

/** Exact registered collection authority shared by prompts and the mutation boundary. */
export function namedBusinessCollectorScope(request: ChatRequest) {
  if (request.action.type !== 'message') return;
  const s = currentTrip(request.session), text = request.action.text, needs = itineraryRequest(request);
  if (needs.requested || needs.outsideCorpus ||
      /비교|메뉴|상세|날씨|예보|추천|찾아|검색|찜|저장|예약|결제|바꿔|바꾸|교체|메모|체류|시각|시간|여행\s*(?:이름|제목)|출발일|시작일|수정|복사|삭제|어떻게|방법|설명|가능|알려|보여/.test(text)) return;
  const commands = text.replace(/(?:만들|짜|생성하|구성하)지\s*(?:마(?:세요)?|말아\s*(?:줘|주세요)|말고)/g, '');
  if (/만들어|만들고|짜줘|짜\s*줘|생성해|구성해|배치해/.test(commands)) return;
  const named = namedBusinessCollectionCandidates(request, s);
  if (!named.length || named.some(item => !item.registered)) return;
  const explicitRegions = REGIONS.filter(region => text.includes(region));
  const requestedRegion = s.region === null && explicitRegions.length === 1 && named.every(item => item.region === explicitRegions[0]) ? explicitRegions[0] : null;
  if (s.region === null && requestedRegion === null) return;
  const candidates = requestedRegion ? namedBusinessCollectionCandidates(request, { ...s, region: requestedRegion }) : named;
  if (candidates.some(item => !item.eligible || !item.registered)) return;
  return { requestedRegion, candidates };
}

function explicitNamedCollectionRegion(request: ChatRequest, actions: TripAction[]): TripAction[] {
  if (currentTrip(request.session).region !== null || !actions.length || actions.length >= MAX_MODEL_ACTIONS || actions.some(action => action.type !== 'collect-entity')) return actions;
  const scope = namedBusinessCollectorScope(request);
  if (!scope?.requestedRegion || actions.some(action => action.type === 'collect-entity' && !scope.candidates.some(candidate => candidate.id === action.id))) return actions;
  // Only complete a missing parameter explicitly stated by the human. The model
  // still chooses every collected ID, which is validated again during execution.
  return [{ type: 'region', region: scope.requestedRegion }, ...actions];
}

export function validateActionContext(
  action: TripAction,
  session: TripSession,
  model: boolean,
  request?: Pick<ChatRequest, 'action'>,
) {
  const s = currentTrip(session);
  const actionFields = action as unknown as Record<string, unknown>;
  if (action.type === 'social') {
    if (!resolveSocialTarget(action.target)) fail('등록된 장소나 공개 코스의 스레드만 열 수 있어요.');
    if (model && (request?.action.type !== 'message' || !socialActionMatchesRequest(action, s, request.action.text)))
      fail('이번 질문에서 정확히 지정한 장소·코스·방문 카드만 열 수 있어요.');
  }
  if (action.type === 'media' && model && request?.action.type === 'message' && !mediaActionMatchesRequest(action, request.action.text))
    fail('요청한 사진 지역·종류·보기 방식이 빠지거나 달라 화면을 유지했어요.');
  if (action.type === 'reorder-visits') {
    if (action.day > s.days) fail('편집할 DAY가 없어요.');
    try { reorderDayVisits(s.plan, action.day, action.ids); }
    catch (error) { fail(error instanceof Error ? error.message : '방문 순서를 확인해 주세요.'); }
    if (model && request?.action.type === 'message') {
      const text = request.action.text;
      const namedDays = reorderTargetDays(text);
      if (/DAY\s*\d/gi.test(text) && (!namedDays.includes(action.day) || new Set(namedDays).size > 1)) fail('지정한 한 DAY 안에서만 순서를 바꿀 수 있어요.');
      const compact = text.replace(/\s+/g, '');
      const negative = /(?:순서|방문).{0,15}(?:바꾸지|변경하지|옮기지|이동하지|안바꿔|안바꾸|안옮겨|안옮기|안이동|안변경|변경안|이동안)|(?:옮기|이동하|변경하|바꾸)지(?:는)?(?:마|말|않)|(?:이동|순서변경|변경)은?하지(?:마|말|않)/.test(compact);
      if (!/바꿔|바꾸|변경해|옮겨|옮기|이동해|배치해|정반대|반대로|역순|먼저\s*(?:가|방문|배치|옮겨)|앞으로\s*(?:가|배치|옮겨)|뒤로\s*(?:가|배치|옮겨)|앞에\s*(?:놓|넣|배치|옮겨)|뒤에\s*(?:놓|넣|배치|옮겨)/.test(text) || /방법|어떻게|설명|할\s*수\s*있|가능한지/.test(text) || negative) fail('명시적으로 방문 순서를 바꿔 달라는 요청이 있어야 적용해요.');
    }
  }
  if(isTripLocalAction(action)){
    if(action.type==='plan-status'){
      const saved=session.library.find(plan=>plan.id===s.savedPlanId&&!plan.deletedAt);if(!saved)fail('저장한 개인 여행을 먼저 열거나 저장해 주세요.');
      if(action.status==='READY'){const issue=planCompletionIssue(s);if(issue)fail(issue);}
    }
    if(action.type==='offline-save'){
      const saved=session.library.find(plan=>plan.id===(action.id??s.savedPlanId)&&!plan.deletedAt);if(!saved||saved.status!=='READY')fail('작성 완료한 활성 저장 여행만 오프라인 사본으로 보관할 수 있어요.');
      const currentRequest=request?.action.type==='message'&&/(?:현재|지금|이)(?:여행|일정)(?:의)?오프라인/.test(request.action.text.normalize('NFKC').replace(/\s+/g,''));
      if(currentRequest&&action.id!==undefined&&action.id!==s.savedPlanId)fail('현재 여행의 오프라인 사본은 현재 저장 여행에서만 만들 수 있어요.');
      if(action.id===undefined||currentRequest){const issue=currentTripOfflineSaveIssue(s,saved);if(issue)fail(issue);}
      const next=[...(session.offlineTrips??[]).filter(pack=>pack.sourcePlanId!==saved!.id),packageForSavedPlan(saved!)];
      if(next.length>MAX_OFFLINE_PACKAGES||offlineStorageBytes(next)>MAX_OFFLINE_BYTES)fail('오프라인 저장 개수나 크기를 넘었어요. 필요 없는 사본을 먼저 정리해 주세요.');
    }
    if((action.type==='offline-open'||action.type==='offline-remove')&&!session.offlineTrips?.some(pack=>pack.id===action.id))fail('이 기기의 오프라인 사본을 찾을 수 없어요.');
    if(model&&request?.action.type==='message'&&['plan-status','offline-save','offline-remove'].includes(action.type)){
      const text=request.action.text;
      if(/방법|어떻게|설명|할\s*수\s*있|가능한지/.test(text))fail('설명 요청으로 저장 상태를 바꾸지 않아요.');
      const compact=text.replace(/\s+/g,'');
      const not='(?:하지|해주지|해두지|하지는|지)(?:마|말|않)|안(?:해|할)';
      const targeted=action.type==='offline-save'?'(?:오프라인(?:사본|여행)?(?:으로|을|를|은|는)?(?:저장|보관|갱신)|사본(?:을|은|는)?(?:저장|보관|갱신)|저장|보관|갱신)':action.type==='offline-remove'?'(?:오프라인(?:사본|여행)?(?:을|를|은|는)?(?:삭제|제거|지우)|사본(?:을|은|는)?(?:삭제|제거|지우)|삭제|제거|지우)':action.type==='plan-status'&&action.status==='READY'?'(?:작성완료|최종확정|완료|확정)':'(?:초안으로(?:되돌리|돌리)|작성중으로(?:되돌리|돌리)|완료취소)';
      const negativePattern=new RegExp(`${targeted}(?:은|는|을|를|도|만)?(?:아직|절대)?(?:으로|로)?(?:바꾸|변경하|표시하|설정하|되돌리|돌리)?(?:${not})|(?:안|아직안)${targeted}`,'g');
      const forbidden=[...compact.matchAll(negativePattern)].some(match=>{
        const prefix=compact.slice(0,match.index),positive=[...prefix.matchAll(/해줘|해주세요|보관해|저장해|갱신해|완료해|확정해|삭제해|제거해/g)].at(-1);
        const boundary=Math.max(prefix.lastIndexOf('.')+1,prefix.lastIndexOf(',')+1,prefix.lastIndexOf(';')+1,positive?positive.index+positive[0].length:0);
        const scope=compact.slice(boundary,match.index+match[0].length),specific=action.type==='plan-status'?/작성|일정|이여행|현재여행/:/오프라인|사본/;
        return specific.test(scope)||!/원본|공개|게시|업로드|계정|회원|서버|예약|여행기/.test(scope);
      });
      if(forbidden)fail('해당 변경을 하지 말라는 요청은 실행하지 않아요.');
      if(action.type==='plan-status'&&!(action.status==='READY'?/작성\s*완료|일정\s*완료|최종\s*확정|완료해/:/초안|작성\s*중|완료.*(?:취소|되돌)/).test(text))fail('작성 상태를 바꾸겠다는 요청을 먼저 확인해 주세요.');
      if(action.type==='offline-save'&&!/오프라인/.test(text))fail();
      if(action.type==='offline-remove'&&!/오프라인.*(?:삭제|지워|제거)|사본.*(?:삭제|지워|제거)/.test(text))fail();
    }
  }
  if (action.type === 'build' && s.days > 7) fail('새 일정 생성은 최대 7일이에요. 기존 긴 여행은 DAY·방문 편집으로 수정해 주세요.');
  if (isTripExtension(action)) {
    if (action.type === 'delete-permanent' && model) fail('영구 삭제는 사용자 확인 버튼에서만 실행해요.');
    if (model && request?.action.type === 'message') {
      const text = request.action.text;
      if (!['trash-list','candidate-propose','candidate-reject'].includes(action.type) && /(?:방법|어떻게|무슨\s*뜻|설명해|설명해줘|가능한지|할\s*수\s*있)/.test(text) && !/(?:설명(?:은|말고)|방법(?:은|말고)).{0,10}(?:바꿔줘|변경해줘|삭제해줘|적용해줘)/.test(text)) fail('설명 요청만으로 여행을 변경하지 않아요.');
      const intent: Partial<Record<TripAction['type'], RegExp>> = {
        'trip-meta': /여행\s*(?:이름|제목)|시작일|출발일|날짜|여행명/,
        'visit-details': /메모|체류|머물|소요|시간|시[간\s]|분/,
        'stay-placement': /숙소|숙박|호텔|체크인|체크아웃|박수/,
        'day-add': /추가|늘려|늘리/, 'day-copy': /복사/, 'day-delete': /삭제|지워|빼/, 'visit-copy': /복사/,
        'candidate-apply': /적용|확정|선택한\s*(?:걸로|것으로)|그대로\s*(?:해|진행)/,
        'candidate-select': /선택|고를|골라|할래|해줘/,
        'trash': /저장.*(?:삭제|지워|휴지통)|여행.*(?:삭제|지워|휴지통)/,
        'restore': /복원|되살려|되돌려/,
      };
      const negated: Partial<Record<TripAction['type'], RegExp>> = {
        'candidate-apply': /(?:적용|확정|반영)하지|(?:적용|확정|반영)\s*(?:안\s*해|말아)/,
        'candidate-select': /선택하지|고르지|선택\s*안/,
        'trip-meta': /(?:이름|제목|시작일|날짜).{0,12}(?:바꾸지|변경하지|수정하지)/,
        'visit-details': /(?:메모|시간|체류).{0,12}(?:바꾸지|변경하지|수정하지)/,
        'visit-copy': /복사하지|복사\s*안/, 'day-copy': /복사하지|복사\s*안/,
        'day-add': /추가하지|늘리지/, 'day-delete': /삭제하지|지우지|빼지/,
        'stay-placement': /(?:숙소|숙박|호텔).{0,12}(?:바꾸지|변경하지|추가하지|넣지|이동하지)/,
        'trash': /삭제하지|지우지|휴지통.{0,8}옮기지/, 'restore': /복원하지|되돌리지/,
      };
      if (intent[action.type] && !intent[action.type]!.test(text)) fail('이번 사용자 요청에 해당 편집을 실행할 근거가 없어요.');
      if (negated[action.type]?.test(text)) fail('변경하지 말라는 요청은 실행하지 않아요.');
      if (['trash','day-delete'].includes(action.type) && /(?:삭제|지우|지워).{0,5}(?:말|않)|삭제하지|지우지/.test(text)) fail();
    }
    if (['visit-details','visit-copy'].includes(action.type)) {
      const visit = s.plan.find(row => row.id === actionFields.id);
      if (!visit || visit.locked) fail('예약 숙소는 편집하거나 복사하지 않아요.');
      else if (action.type === 'visit-copy' && stayCheckoutExceedsTrip(visit, s.days, action.day ?? visit.day)) fail('숙박은 체크아웃이 여행 마지막 날 이내인 DAY에만 복사할 수 있어요. DAY를 먼저 추가하거나 다른 날짜를 골라 주세요.');
    }
    if (action.type === 'stay-placement') {
      if (action.startDay + action.nights > s.days || findStay(action.stayId)?.region !== s.region || s.booked || s.plan.some(v=>v.locked && v.kind === 'stay')) fail('여행 날짜와 예약 숙소 조건을 확인해 주세요.');
      if (s.stayBudgetExplicit && (getKnownEntityPrice(findStay(action.stayId)) === null || findStay(action.stayId)!.price > s.stayBudget)) fail('현재 요금을 확인하지 못해 명시한 숙박 예산을 충족한다고 배치하지 않아요.');
    }
    if (action.type === 'day-add' || action.type === 'day-copy') {
      if (s.days >= 30) fail('여행은 최대 30일까지 편집할 수 있어요.');
      const insert = action.type === 'day-add' ? (action.afterDay ?? s.days) + 1 : action.toDay ?? s.days + 1;
      if (insert > s.days + 1 || s.plan.some(v => v.locked && v.day >= insert) || action.type === 'day-copy' && s.plan.some(v => v.day === action.day && v.locked)) fail('예약 숙소의 날짜를 바꾸는 DAY 편집은 실행하지 않아요.');
      if (action.type === 'day-copy' && dayCopyCheckoutExceedsTrip(s.plan, s.days, action.day, insert)) fail('이 DAY를 복사하면 숙박의 체크아웃이 여행 기간을 넘어요. 숙박 날짜·박수를 먼저 조정해 주세요. 일정은 그대로 유지했어요.');
    }
    if (action.type === 'day-delete' && (s.days <= 1 || s.plan.some(v=>v.locked && v.day >= action.day))) fail('예약 숙소를 유지하고 적어도 하루는 남겨야 해요.');
    if (action.type === 'day-delete' && s.plan.some(v => v.day !== action.day && stayCheckoutExceedsTrip(v, s.days - 1, v.day > action.day ? v.day - 1 : v.day))) fail('이 DAY를 삭제하면 남은 숙박의 체크아웃이 여행 기간을 넘어요. 숙박 날짜·박수를 먼저 조정해 주세요. 일정은 그대로 유지했어요.');
    if (action.type === 'candidate-propose') {
      if ((s.pendingCandidates?.length ?? 0) >= 30) fail();
      const kind = findStay(action.ids[0]) ? 'stay' : findFood(action.ids[0])?.cuisine === '카페' ? 'cafe' : String(findFood(action.ids[0])?.cuisine) === '상점' ? 'shop' : 'food';
      const anchor = action.anchorId ?? findFood(action.ids[0])?.placeId ?? findStay(action.ids[0])?.near[0];
      const day = action.day ?? s.activeDay;
      if (!anchor || findTripAnchor(anchor)?.region !== s.region || action.ids.some(id => entityRegion(id) !== s.region) || (kind === 'stay' && (s.booked || day >= s.days))) fail();
      for (const id of action.ids) {
        const eligible = kind === 'stay' ? stayResults({...s,anchorId:anchor!}) : foodResults({...s, anchorId:anchor!, foodKind:kind === 'cafe' ? '카페' : kind === 'shop' ? '상점' : '식당'});
        if (!eligible.some(row=>row.id === id)) fail('현재 지역·주변·종류·예산에 맞는 후보로 제안해 주세요.');
      }
    }
    if (action.type === 'candidate-select' && !s.pendingCandidates?.some(g=>g.id === action.groupId && g.optionIds.includes(action.id))) fail();
    if (action.type === 'candidate-apply') {
      const groups = s.pendingCandidates ?? [];
      const picks = action.selections ?? groups.flatMap(g=>g.selectedId ? [{groupId:g.id,id:g.selectedId}] : []);
      if (!groups.length || picks.length !== groups.length || new Set(picks.map(p=>p.groupId)).size !== groups.length || picks.some(p=>!groups.some(g=>g.id===p.groupId && g.optionIds.includes(p.id)))) fail('모든 후보를 선택한 뒤 적용해 주세요.');
    }
    if (action.type === 'trash' || action.type === 'restore' || action.type === 'delete-permanent') {
      const saved = session.library.find(p=>p.id === action.id);
      if (!saved || (action.type === 'trash' ? saved.deletedAt : !saved.deletedAt)) fail('저장 여행 상태를 확인해 주세요.');
    }
  }
  if (
    model &&
    action.type === 'region' &&
    s.stage !== 'community' &&
    action.region !== s.region &&
    (s.booked || s.plan.some((visit) => visit.locked))
  )
    fail('예약한 숙소가 있는 여행의 지역은 챗봇이 자동으로 바꾸지 않아요.');
  const day = actionFields.day;
  if (typeof day === 'number' && day > s.days)
    fail('현재 일정에 없는 날짜예요.');
  const visitTypes = ['edit', 'remove', 'move', 'progress', 'transfer'];
  if (
    visitTypes.includes(action.type) ||
    (action.type === 'directions' && action.id)
  ) {
    const visit = s.plan.find((v) => v.id === actionFields.id);
    if (!visit) fail('현재 일정에 없는 방문이에요.');
    if (
      visit?.locked &&
      ['edit', 'remove', 'move', 'transfer'].includes(action.type)
    )
      fail('예약한 숙소는 자동으로 바꾸거나 지우지 않아요.');
  }
  if (
    action.type === 'open' &&
    !session.library.some((p) => p.id === action.id && !p.deletedAt)
  )
    fail('저장된 여행을 찾을 수 없어요.');
  if (
    action.type === 'resume' &&
    !session.turns.some((t) => t.id === action.id)
  )
    fail('이전 대화 결과를 찾을 수 없어요.');
  if (action.type === 'food' && !foodResults(s).some((p) => p.id === action.id))
    fail('현재 조건의 식당·카페 후보를 선택해 주세요.');
  if (
    action.type === 'stay' &&
    (s.booked || !stayResults(s).some((p) => p.id === action.id))
  )
    fail('현재 조건에서 선택할 수 없는 숙소예요.');
  if (action.type === 'select-entity') {
    const selectedFood = findFood(action.id);
    const selectedStay = findStay(action.id);
    if (
      selectedFood &&
      !foodResults({
        ...s,
        anchorId: selectedFood.placeId,
        foodKind: selectedFood.cuisine === '카페' ? '카페' : String(selectedFood.cuisine) === '상점' ? '상점' : '식당',
      }).some((item) => item.id === selectedFood.id)
    )
      fail('현재 조건에 맞는 식당·카페를 선택해 주세요.');
    if (selectedStay && (s.booked || selectedStay.price > s.stayBudget))
      fail('현재 조건에서 선택할 수 없는 숙소예요.');
  }
  if (action.type === 'collect-entity') {
    const collection = s.collectedIds ?? [];
    const activeRegion =
      s.region ?? (collection[0] ? entityRegion(collection[0]) : undefined);
    if (activeRegion && entityRegion(action.id) !== activeRegion)
      fail('같은 지역의 장소와 업체를 담아 주세요.');
    if (
      !collection.includes(action.id) &&
      collection.length >= MAX_COLLECTED_ENTITIES
    )
      fail('이번 여행에 담을 수 있는 항목 수를 넘었어요.');
    if (s.booked && findStay(action.id))
      fail('예약한 숙소를 유지해요. 새 숙소를 자동으로 담지 않아요.');
  }
  if (
    action.type === 'uncollect-entity' &&
    !(s.collectedIds ?? []).includes(action.id)
  )
    fail('현재 담은 항목에서 찾을 수 없어요.');
  if (action.type === 'copy-community') {
    if (model && (s.booked || s.plan.some((visit) => visit.locked)))
      fail('예약한 숙소가 있는 여행은 공개 코스로 덮어쓰지 않아요.');
    if (!communityResults(s).some((course) => course.id === action.id))
      fail('현재 지역·취향 조건의 공개 코스 예시를 골라 주세요.');
  }
  if (model) {
    if (action.type === 'build' && !s.region)
      fail('지역을 확인한 뒤 일정을 만들 수 있어요.');
    if (!modelActionTypes.has(action.type)) fail();
    const available = currentEntityIds(s);
    if (action.type === 'add-entity' && request?.action.type === 'message') {
      const scope = namedItineraryAdditionScope({ ...request, session }, s);
      if (scope && scope.candidate.eligible && action.id === scope.candidate.id && action.day === scope.day) available.add(scope.candidate.id);
    }
    // Both kinds are explicit server candidates. Collecting a cafe need not
    // navigate the UI's restaurant tab first; filters and anchor still apply.
    if (action.type === 'collect-entity') {
      for (const kind of ['식당', '카페', '상점'] as const)
        for (const item of foodResults({ ...s, foodKind: kind }))
          available.add(item.id);
      // Only this new user message may name a business at another anchor.
      // Recheck each canonical business against the live state after every action.
      const named = request ? namedBusinessCollectionCandidates(request, s) : [];
      const requestedBusiness = findFood(action.id) ?? findStay(action.id);
      if (requestedBusiness && request?.action.type === 'message' &&
        request.action.text.replace(/\s+/g,'').includes(requestedBusiness.name.replace(/\s+/g,'')) &&
        !named.some(item=>item.id===action.id)) fail('이 업체를 담으라는 긍정 요청이 없거나 직접 제외한 항목이에요.');
      const selected = named.find(item => item.id === action.id);
      if (selected && !selected.eligible) fail('이름을 지정한 업체도 현재 지역·도보·음식·예산 조건에 맞아야 담을 수 있어요.');
      for (const item of named) if (item.eligible) available.add(item.id);
    }
    const requestedIds =
      action.type === 'compare'
        ? (action.ids ?? [])
        : [
              'place',
              'bookmark',
              'detail',
              'add-entity',
              'select-entity',
              'collect-entity',
              'uncollect-entity',
            ].includes(action.type)
          ? [actionFields.id].filter((v): v is string => typeof v === 'string')
          : action.type === 'directions'
            ? [action.placeId, action.businessId].filter((v): v is string =>
                Boolean(v),
              )
            : [];
    if (requestedIds.some((itemId) => !available.has(itemId)))
      fail('현재 후보에 없는 항목을 챗봇이 요청했어요.');
  }
}

export function chatResponse(
  request: ChatRequest,
  session: TripSession,
  mode: ChatMode,
): ChatResponse {
  const latest = session.turns[session.turns.length - 1];
  return {
    protocolVersion: 1,
    requestId: request.requestId,
    sessionId: request.sessionId,
    baseRevision: request.baseRevision,
    revision: revisionOf(session),
    mode,
    session,
    message: latest.assistantMessage ?? explanation(latest.state),
    nextQuestions: nextQuestions(latest.state),
  };
}

function itineraryGroundingError(): never {
  throw new ChatContractError(
    'MODEL_ITINERARY_UNGROUNDED',
    '현재 검색 자료에서 확인한 방문지를 선택해야 일정을 만들 수 있어요.',
    502,
  );
}

/** Only this turn's verified retrieval may authorize a newly selected itinerary place. */
function modelItineraryKnowledge(
  action: TripAction,
  state: TripState,
  retrieval?: RagRetrieval,
): Map<string, VisitKnowledge> | undefined {
  let selected: { day: number; placeId: string }[] | undefined;
  if (action.type === 'build') {
    // A food/cafe/shop-only trip has no landmark to invent or ground in tourism RAG.
    // Every explicit collected entity still resolves through the server catalog.
    if (!action.visits && (state.collectedIds?.length ?? 0) > 0 && state.collectedIds!.every(id => !findPlace(id) && Boolean(findFood(id) || findStay(id)))) return undefined;
    // Legacy direct UI/old offline calls keep their existing build semantics.
    // The chat route always supplies current retrieval for a grounded build.
    if (!retrieval && !action.visits) return undefined;
    if (!action.visits?.length || !retrieval?.results.length) itineraryGroundingError();
    selected = action.visits;
    if (action.savedOnly && selected.some(({ placeId }) => !state.savedIds.includes(placeId))) itineraryGroundingError();
    for (const visit of selected) {
      const sameDay = selected.filter((item) => item.day === visit.day);
      if (sameDay.length > 2 || (findPlace(visit.placeId)?.planning?.dayScope === 'full-day' && sameDay.length !== 1)) itineraryGroundingError();
    }
  } else if (state.plan.some((visit) => visit.knowledge)) {
    const editing = state.plan.find((visit) => visit.id === state.editingId);
    if (action.type === 'place' && editing?.kind === 'place') selected = [{ day: editing.day, placeId: action.id }];
    if (action.type === 'add-entity' && findPlace(action.id)) selected = [{ day: action.day ?? state.activeDay, placeId: action.id }];
  }
  if (!selected) return undefined;
  if (!retrieval?.results.length) itineraryGroundingError();
  if (action.type !== 'build') {
    for (const visit of selected) {
      const existing = state.plan.filter((item) => item.day === visit.day && item.kind === 'place' &&
        !(action.type === 'place' && item.id === state.editingId));
      if (existing.length && (findPlace(visit.placeId)?.planning?.dayScope === 'full-day' ||
        existing.some((item) => findPlace(item.entityId)?.planning?.dayScope === 'full-day'))) itineraryGroundingError();
    }
  }
  const result = new Map<string, VisitKnowledge>();
  for (const visit of selected) {
    const place = findPlace(visit.placeId);
    if (!place || place.region !== state.region || visit.day < 1 || visit.day > state.days) itineraryGroundingError();
    const sources = retrieval.results.filter((evidence) => evidence.placeId === visit.placeId);
    const source = sources.find((evidence) => evidence.sourceKind === 'curated-official-summary') ?? sources[0];
    if (!source) itineraryGroundingError();
    result.set(visit.placeId, {
      indexVersion: retrieval.indexVersion,
      evidenceIds: [source.evidenceId],
      documentIds: [source.documentId],
    });
  }
  return result;
}

function stampItineraryKnowledge(session: TripSession, knowledge: Map<string, VisitKnowledge>): TripSession {
  const latest = session.turns.at(-1)!;
  return {
    ...session,
    turns: [
      ...session.turns.slice(0, -1),
      { ...latest, state: { ...latest.state, plan: latest.state.plan.map((visit) =>
        visit.kind === 'place' && visit.entityId && knowledge.has(visit.entityId)
          ? { ...visit, knowledge: knowledge.get(visit.entityId)! }
          : visit,
      ) } },
    ],
  };
}

/** Work on immutable temporary snapshots. Nothing is returned unless the entire batch is valid. */
export function applyModelReply(
  request: ChatRequest,
  reply: ModelReply,
  source: 'flowise' | 'ollama' | 'large-model' | 'clarify' | 'local-action' = 'flowise',
  retrieval?: RagRetrieval,
  answerContext?: AnswerContext,
): TripSession {
  if (request.action.type === 'message' && ['flowise', 'ollama', 'large-model'].includes(source)
      && hasUnsupportedRegisteredBusinessReputation(request.action.text, reply.message))
    throw new ChatContractError('MODEL_FACTS_UNGROUNDED', '등록 자료에 없는 인기도·평점 단정이 포함되어 답변을 다시 확인해야 해요. 현재 화면은 유지했습니다.', 502);
  let temporary = request.session;
  const dayView = explicitExistingDayView(request);
  const effectiveReply = dayView ? {
    message: existingDayViewMessage(currentTrip(request.session), dayView.day!),
    actions: [dayView],
  } : reply;
  const actions = explicitBuildConstraints(request, explicitNamedCollectionRegion(request, effectiveReply.actions));
  const locked = currentTrip(temporary).plan.filter((v) => v.locked);
  // Enforce explicit narrow user scope independently of model tool selection.
  // This is a mutation boundary, not a replacement natural-language interpreter.
  const scope =
    request.action.type === 'message'
      ? request.action.text.match(
          /DAY\s*([1-9]|[12]\d|30)\s*(오전|오후)\s*(?:장소|방문)?\s*만/i,
        )
      : null;
  const originalPlan = currentTrip(temporary).plan;
  const nearbyAnchor = namedNearbyFoodAnchor(request);
  const removal = namedVisitRemovalScope(request);
  let proximityNotice: string | undefined;
  const scopedVisit = scope
    ? originalPlan.find(
        (v) =>
          v.day === Number(scope[1]) &&
          v.kind === 'place' &&
          v.label.includes(scope[2]),
      )
    : null;
  const dayCopiedVisits: { sourceId: string; copyId: string }[] = [];
  try {
    if (actions.length > MAX_MODEL_ACTIONS) fail();
    if (request.action.type === 'message' && isSocialFeatureRequest(currentTrip(request.session), request.action.text) &&
        (actions.length > 1 || actions.some(action => action.type !== 'social')))
      fail('스레드·평가 조회에서는 해당 읽기 화면 하나만 열 수 있어요.');
    if (nearbyAnchor && actions.length === 0) fail('명시한 장소의 주변 식당 후보 패널을 여는 행동이 필요해요.');
    if (nearbyAnchor && actions.some(action => !(action.type === 'place' && action.id === nearbyAnchor.id ||
        action.type === 'show' && (action.stage === 'plan' || action.stage === 'food' && (action.kind === undefined || action.kind === '식당')))))
      fail('명시한 현재 방문의 주변 식당 후보만 조회할 수 있어요.');
    if (removal && actions.length && (removal.targets.length !== 1 || removal.targets[0].locked ||
        actions.length !== 1 || actions[0].type !== 'remove' || actions[0].id !== removal.targets[0].id))
      fail('명시한 DAY의 단일 방문만 제거할 수 있어요. DAY 전체와 다른 방문은 유지해요.');
    const addition = namedItineraryAdditionScope(request);
    if (addition && actions.length && (actions.length !== 1 || actions[0].type !== 'add-entity' ||
        actions[0].id !== addition.candidate.id || actions[0].day !== addition.day || !addition.candidate.eligible))
      fail('이번 요청에서 명시한 한 항목과 DAY에 추가하는 행동만 허용해요.');
    const publicCopyTarget = publicCourseCopyTarget(request);
    if (request.action.type === 'message' && (publicCopyTarget || actions.some(action => action.type === 'copy-community')) &&
        (actions.length !== 1 || actions[0].type !== 'copy-community' || actions[0].id !== publicCopyTarget))
      fail('명시한 공개 코스 하나를 개인 초안으로 복사하는 행동만 허용해요.');
    if (isWholeDayCopyOnlyRequest(request) && actions.length && (actions.length !== 1 || actions[0].type !== 'day-copy'))
      fail('DAY 전체 복사 요청에는 DAY 복사만 적용해요. 다른 방문이나 메모는 변경하지 않았어요.');
    if (effectiveReply.needsMoreContext && actions.length) itineraryGroundingError();
    const usedEvidenceIds = new Set(effectiveReply.evidenceIds ?? []);
    if (
      effectiveReply.evidenceIds?.length &&
      (!retrieval ||
        effectiveReply.evidenceIds.some(
          (id) =>
            !retrieval.results.some((evidence) => evidence.evidenceId === id),
        ))
    )
      fail();
    if (
      scope &&
      (!scopedVisit ||
        actions.some(
          (a) =>
            !['edit', 'place', 'show', 'detail', 'compare', 'day'].includes(
              a.type,
            ) ||
            (a.type === 'edit' && a.id !== scopedVisit.id),
        ))
    )
      fail();
    const explicitDuration = request.action.type === 'message' && itineraryRequest(request).daysSpecified;
    for (const [index, requestedAction] of actions.entries()) {
      let action = requestedAction;
      if (explicitDuration && action.type === 'configure' && action.days !== undefined &&
        actions.slice(index + 1).some((next) => next.type === 'build')) {
        const before = currentTrip(temporary);
        const minimumBookedDays = Math.max(1, ...before.plan.filter((visit) => visit.locked && visit.kind === 'stay').map((visit) => visit.day + 1));
        const days = Math.max(action.days, minimumBookedDays);
        // A full rebuild replaces old unbooked visits. Trim only its temporary
        // snapshot so configure can shorten the trip; a later invalid action
        // still discards the entire batch and leaves the original untouched.
        if (before.plan.some((visit) => visit.day > days)) {
          const latest = temporary.turns.at(-1)!;
          temporary = { ...temporary, turns: [...temporary.turns.slice(0, -1), {
            ...latest, state: { ...before, plan: before.plan.filter((visit) => visit.day <= days || visit.locked) },
          }] };
        }
        action = { ...action, days };
      }
      const dailyVisitViolation = explicitBuildVisitViolation(request, action, currentTrip(temporary));
      if (dailyVisitViolation) throw new ChatContractError('MODEL_ITINERARY_DAILY_SLOTS', dailyVisitViolation, 502);
      const beforeAction = currentTrip(temporary);
      if (action.type === 'visit-copy') {
        const sourceId = action.id;
        const destination = action.day ?? beforeAction.plan.find(visit => visit.id === sourceId)?.day ?? beforeAction.activeDay;
        if (dayCopiedVisits.some(copy => copy.sourceId === sourceId && beforeAction.plan.some(visit => visit.id === copy.copyId && visit.day === destination)))
          fail('DAY 복사에 이미 포함한 방문을 같은 DAY에 다시 복사하지 않아요. 이번 변경은 적용하지 않았어요.');
      }
      const copyDestination = action.type === 'day-copy' ? action.toDay ?? beforeAction.days + 1 : 0;
      const copySourceDay = action.type === 'day-copy' ? action.day : 0;
      const copySources = copySourceDay ? beforeAction.plan.filter(visit => visit.day === copySourceDay && (visit.kind !== 'stay' || copyDestination <= beforeAction.days)) : [];
      const knowledge = modelItineraryKnowledge(action, currentTrip(temporary), retrieval);
      validateActionContext(action, temporary, true, request);
      const regrouped = regroupExplicitNearbyBuild(request, actions, action, currentTrip(temporary), retrieval);
      if (regrouped) {
        action = regrouped.action;
        proximityNotice = regrouped.notice;
      }
      temporary = appendTrip(temporary, action);
      if (action.type === 'day-copy') {
        const previousIds = new Set(beforeAction.plan.map(visit => visit.id));
        // Copy IDs are allocated in source order; using IDs also follows later
        // DAY insertions/deletions without confusing equal entities or labels.
        const copies = currentTrip(temporary).plan.filter(visit => !previousIds.has(visit.id)).sort((a, b) => Number(a.id.slice(6)) - Number(b.id.slice(6)));
        for (const [index, copy] of copies.entries()) if (copySources[index]) dayCopiedVisits.push({ sourceId: copySources[index].id, copyId: copy.id });
      }
      if (knowledge) {
        temporary = stampItineraryKnowledge(temporary, knowledge);
        for (const entry of knowledge.values()) for (const evidenceId of entry.evidenceIds) usedEvidenceIds.add(evidenceId);
      }
      const current = currentTrip(temporary);
      if (
        scope &&
        (current.plan.length !== originalPlan.length ||
          originalPlan.some(
            (v) =>
              v.id !== scopedVisit?.id &&
              !current.plan.some(
                (after) =>
                  after.id === v.id &&
                  JSON.stringify(after) === JSON.stringify(v),
              ),
          ))
      )
        fail();
      if (
        locked.some((before) => {
          const after = current.plan.find((v) => v.id === before.id);
          return (
            !after ||
            ['day', 'kind', 'entityId', 'anchorId', 'locked', 'nights', 'time', 'note', 'durationMinutes'].some(
              (field) =>
                before[field as keyof Visit] !== after[field as keyof Visit],
            )
          );
        })
      )
        fail();
    }
    if (removal && actions.length) {
      const final = currentTrip(temporary), original = currentTrip(request.session);
      if (JSON.stringify(final.plan) !== JSON.stringify(originalPlan.filter(visit => visit.id !== removal.targets[0].id)) ||
          ['region', 'days', 'title', 'startDate', 'communitySourceId', 'booked'].some(field => final[field as keyof TripState] !== original[field as keyof TripState]) ||
          JSON.stringify(temporary.library) !== JSON.stringify(request.session.library))
        fail('지정 방문을 제외한 기존 일정과 저장본은 유지해야 해요.');
    }
    if (nearbyAnchor) {
      const final = currentTrip(temporary), original = currentTrip(request.session);
      if (final.anchorId !== nearbyAnchor.id || final.stage !== 'food' || final.foodKind !== '식당' ||
          JSON.stringify(final.plan) !== JSON.stringify(originalPlan) ||
          ['region', 'days', 'title', 'startDate', 'communitySourceId', 'booked', 'planStatus'].some(field => final[field as keyof TripState] !== original[field as keyof TripState]) ||
          JSON.stringify(temporary.library) !== JSON.stringify(request.session.library))
        fail('요청한 기준 장소와 기존 일정을 유지하는 주변 조회인지 확인해 주세요.');
    }
    const state: TripState = {
      ...currentTrip(temporary),
      ...(actions.length === 0
        ? { stage: 'answer' as const, notice: '' }
        : {}),
      question:
        request.action.type === 'message'
          ? request.action.text
          : currentTrip(temporary).question,
    };
    if (actions.some(action => action.type === 'build')) {
      const finalVisitViolation = explicitBuildVisitViolation(request, { type: 'build', visits: state.plan.flatMap(visit =>
        visit.kind === 'place' && visit.entityId ? [{ day: visit.day, placeId: visit.entityId }] : [],
      ) }, state);
      if (finalVisitViolation) throw new ChatContractError('MODEL_ITINERARY_DAILY_SLOTS', finalVisitViolation, 502);
    }
    const fullDayNotice = actions.some(action => action.type === 'build') ? explicitFullDayScheduleNotice(request, state) : undefined;
    if (fullDayNotice) state.notice = `${state.notice} ${fullDayNotice}`;
    if (proximityNotice) state.notice = `${state.notice} ${proximityNotice}`;
    let assistantMessage = actions.some(action => action.type === 'build') ? builtItineraryMessage(state, effectiveReply.message) : effectiveReply.message;
    // App actions prepare destination buttons; they do not open or mutate the app.
    if (actions.some(action => action.type === 'open_spotlog'))
      assistantMessage = '아래 버튼으로 Spotlog 앱의 해당 화면을 열 수 있어요. 실제 작업은 앱 화면에서 내용을 선택·확인한 뒤 진행해 주세요.';
    if (actions.some(action => action.type === 'social'))
      assistantMessage = '샘플 커뮤니티를 열었어요. 스레드에 답글을 달거나 평가를 남겨보세요. 내 기록은 이 기기에 저장돼요.';
    if (fullDayNotice) {
      const paragraphs = assistantMessage.split('\n\n');
      while (paragraphs.length > 1 && paragraphs.join('\n\n').length + fullDayNotice.length + 2 > 4000) paragraphs.pop();
      assistantMessage = `${paragraphs.join('\n\n')}\n\n${fullDayNotice}`;
    }
    const session: TripSession = {
      ...request.session,
      turns: [
        ...request.session.turns,
        {
          id: request.session.nextId,
          state,
          assistantMessage,
          source,
          ...(answerContext ? { answerContext } : {}),
          ...(retrieval
            ? { retrieval, evidenceIds: [...usedEvidenceIds] }
            : {}),
        },
      ],
      nextId: request.session.nextId + 1,
      library: temporary.library,
      ...(temporary.offlineTrips?{offlineTrips:temporary.offlineTrips}:{}),
      ...(temporary.recentPlanIds?{recentPlanIds:temporary.recentPlanIds}:{}),
    };
    parseTripSession(session);
    return session;
  } catch (error) {
    if (error instanceof ChatContractError && error.code.startsWith('MODEL_ITINERARY_')) throw error;
    throw new ChatContractError(
      'MODEL_ACTION_INVALID',
      '챗봇이 현재 조건에서 실행할 수 없는 기능을 요청해 화면을 유지했어요.',
      502,
    );
  }
}

/** Destructive conversation controls are dispatched only from an explicit human phrase. */
export function explicitConversationControl(text: string): TripAction | null {
  const compact = text.trim().replace(/[\s.!?。！？]/g, '');
  if (
    /^(?:대화|채팅)(?:를)?(?:초기화|리셋)(?:해줘|해주세요|할래)?$|^(?:대화|채팅)(?:를)?지워(?:줘|주세요)$|^(?:처음부터(?:다시)?시작|새대화(?:로)?시작)(?:해줘|해주세요|할래)?$/.test(
      compact,
    )
  )
    return { type: 'reset' };
  if (
    /^(?:(?:방금|마지막)(?:수정|변경)(?:을)?(?:취소|되돌려)|실행취소|수정취소|이전으로되돌려)(?:해줘|주세요|줘|할래)?$/.test(
      compact,
    )
  )
    return { type: 'undo' };
  const resume = compact.match(
    /^(?:[1-9]\d{0,5}(?:번째|번)|첫번째|두번째|세번째)(?:결과|대화)(?:에서)?(?:이어갈래|이어줘|이어서할래|이어가줘)$/,
  );
  // The engine resolves the human-visible ordinal to its actual immutable turn ID.
  return resume ? { type: 'message', text } : null;
}
