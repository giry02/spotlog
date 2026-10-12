import {
  appendTrip,
  currentTrip,
  explanation,
  foodResults,
  nextQuestions,
  placeResults,
  stayResults,
  type SavedPlan,
  type Stage,
  type TripAction,
  type TripSession,
  type TripState,
  type Visit,
} from './trip-engine';
import { findFood, findPlace, findStay } from './trip-data';

export const CHAT_PROTOCOL_VERSION = 1 as const;
export const MAX_CHAT_REQUEST_BYTES = 1_048_576;
export const MAX_MODEL_RESPONSE_BYTES = 131_072;
export const MAX_SESSION_TURNS = 120;
export const MAX_MODEL_ACTIONS = 4;
export type ChatMode = 'demo' | 'flowise';
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
export type ModelReply = { message: string; actions: TripAction[] };

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
function place(value: unknown): string {
  const result = id(value);
  if (!findPlace(result)) fail('존재하지 않는 장소예요.');
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
  const visits = array(value, 60).map((item) => {
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
    ]);
    id(v.id);
    integer(v.day, 1, days);
    oneOf(v.kind, ['place', 'food', 'cafe', 'stay']);
    const anchor = findPlace(place(v.anchorId))!;
    if (region !== null && anchor.region !== region) fail();
    string(v.label, 120);
    boolean(v.locked);
    if (v.locked && v.kind !== 'stay') fail();
    if (v.status !== undefined) oneOf(v.status, ['done', 'skipped']);
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
      const itemRegion =
        findPlace(entityId)?.region ??
        findStay(entityId)?.region ??
        findPlace(findFood(entityId)?.placeId ?? null)?.region;
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
    keys(p, ['id', 'title', 'region', 'days', 'visits', 'booked']);
    id(p.id);
    string(p.title, 200, true);
    oneOf(p.region, ['제주', '서울']);
    integer(p.days, 1, 3);
    boolean(p.booked);
    validateVisits(p.visits, p.days as number, p.region);
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
  ]);
  oneOf(s.stage, stages);
  string(s.question, 2000);
  string(s.notice, 4000);
  nullable(s.region, (v) => oneOf(v, ['제주', '서울']));
  integer(s.days, 1, 3);
  integer(s.activeDay, 1, s.days as number);
  oneOf(s.theme, ['all', 'sea', 'green']);
  nullable(s.similarTo, place);
  nullable(s.anchorId, place);
  nullable(s.foodId, (v) => {
    if (!findFood(id(v)) || findFood(id(v))?.cuisine === '카페') fail();
  });
  nullable(s.cafeId, (v) => {
    if (findFood(id(v))?.cuisine !== '카페') fail();
  });
  nullable(s.stayId, (v) => {
    if (!findStay(id(v))) fail();
  });
  oneOf(s.foodKind, ['식당', '카페']);
  oneOf(s.cuisine, ['전체', '한식', '양식']);
  integer(s.walk, 1, 20);
  nullable(s.foodBudget, (v) => integer(v, 1, 1_000_000));
  integer(s.stayBudget, 1, 1_000_000);
  for (const key of ['booked', 'meals', 'cafes', 'lodging']) boolean(s[key]);
  const savedIds = array(s.savedIds, 20).map(place);
  unique(savedIds);
  const visits = validateVisits(s.plan, s.days as number, s.region);
  const visitId = (v: unknown) => {
    if (!visits.some((visit) => visit.id === id(v))) fail();
  };
  nullable(s.editingId, visitId);
  nullable(s.savedPlanId, id);
  if (s.directionsVisitId !== undefined) nullable(s.directionsVisitId, visitId);
  if (s.directionsPlaceId !== undefined) nullable(s.directionsPlaceId, place);
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
  keys(s, ['turns', 'nextId', 'library']);
  const turns = array(s.turns, MAX_SESSION_TURNS, 1);
  const ids = turns.map((item) => {
    const t = object(item);
    keys(t, ['id', 'state', 'restoredFrom', 'assistantMessage', 'source']);
    const turnId = integer(t.id, 1, 1_000_000);
    validateState(t.state);
    if (t.restoredFrom !== undefined) integer(t.restoredFrom, 1, turnId - 1);
    if (t.assistantMessage !== undefined) string(t.assistantMessage, 4000);
    if (t.source !== undefined) oneOf(t.source, ['demo', 'flowise']);
    return turnId;
  });
  if (ids.some((value, index) => index > 0 && value <= ids[index - 1])) fail();
  integer(s.nextId, ids[ids.length - 1] + 1, 1_000_001);
  validateLibrary(s.library);
  return s as unknown as TripSession;
}

export function revisionOf(session: TripSession): number {
  return session.turns[session.turns.length - 1].id;
}

/** Parse fields first. Contextual checks run immediately before each tool executes. */
export function parseTripAction(value: unknown): TripAction {
  const a = object(value);
  string(a.type, 40, true);
  switch (a.type) {
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
      if (a.kind !== undefined) oneOf(a.kind, ['식당', '카페']);
      if (a.day !== undefined) integer(a.day, 1, 3);
      break;
    case 'region':
      keys(a, ['type', 'region']);
      oneOf(a.region, ['제주', '서울']);
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
      keys(a, ['type', 'savedOnly']);
      if (a.savedOnly !== undefined) boolean(a.savedOnly);
      break;
    case 'day':
      keys(a, ['type', 'day']);
      integer(a.day, 1, 3);
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
      integer(a.day, 1, 3);
      break;
    case 'select-entity':
      keys(a, ['type', 'id']);
      entity(a.id);
      break;
    case 'add-entity':
      keys(a, ['type', 'id', 'day']);
      entity(a.id);
      if (a.day !== undefined) integer(a.day, 1, 3);
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
      ]);
      if (Object.keys(a).length === 1) fail();
      if (a.days !== undefined) integer(a.days, 1, 3);
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
]);
export function parseModelReply(value: unknown): ModelReply {
  try {
    const reply = object(value);
    keys(reply, ['message', 'actions']);
    const message = string(reply.message, 4000, true);
    if (
      /<\/?[a-z][^>]*>/i.test(message) ||
      /(?:https?:\/\/|javascript:|data:)/i.test(message)
    )
      fail();
    const actions = array(reply.actions, MAX_MODEL_ACTIONS).map(
      parseTripAction,
    );
    if (actions.some((a) => !modelActionTypes.has(a.type))) fail();
    return { message, actions };
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
  ]);
}
export function validateActionContext(
  action: TripAction,
  session: TripSession,
  model: boolean,
) {
  const s = currentTrip(session);
  const actionFields = action as unknown as Record<string, unknown>;
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
    !session.library.some((p) => p.id === action.id)
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
        foodKind: selectedFood.cuisine === '카페' ? '카페' : '식당',
      }).some((item) => item.id === selectedFood.id)
    )
      fail('현재 조건에 맞는 식당·카페를 선택해 주세요.');
    if (selectedStay && (s.booked || selectedStay.price > s.stayBudget))
      fail('현재 조건에서 선택할 수 없는 숙소예요.');
  }
  if (model) {
    if (!modelActionTypes.has(action.type)) fail();
    const available = currentEntityIds(s);
    const requestedIds =
      action.type === 'compare'
        ? (action.ids ?? [])
        : [
              'place',
              'bookmark',
              'detail',
              'add-entity',
              'select-entity',
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

/** Work on immutable temporary snapshots. Nothing is returned unless the entire batch is valid. */
export function applyModelReply(
  request: ChatRequest,
  reply: ModelReply,
): TripSession {
  let temporary = request.session;
  const locked = currentTrip(temporary).plan.filter((v) => v.locked);
  try {
    for (const action of reply.actions) {
      validateActionContext(action, temporary, true);
      temporary = appendTrip(temporary, action);
      const current = currentTrip(temporary);
      if (
        locked.some((before) => {
          const after = current.plan.find((v) => v.id === before.id);
          return (
            !after ||
            ['day', 'kind', 'entityId', 'anchorId', 'locked'].some(
              (field) =>
                before[field as keyof Visit] !== after[field as keyof Visit],
            )
          );
        })
      )
        fail();
    }
    const state: TripState = {
      ...currentTrip(temporary),
      ...(reply.actions.length === 0
        ? { stage: 'answer' as const, notice: '' }
        : {}),
      question:
        request.action.type === 'message'
          ? request.action.text
          : currentTrip(temporary).question,
    };
    const session: TripSession = {
      turns: [
        ...request.session.turns,
        {
          id: request.session.nextId,
          state,
          assistantMessage: reply.message,
          source: 'flowise',
        },
      ],
      nextId: request.session.nextId + 1,
      library: temporary.library,
    };
    parseTripSession(session);
    return session;
  } catch {
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
